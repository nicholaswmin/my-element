import { AuthError } from './errors/auth.js';

/**
 * HttpBehavior - External configuration-based auth and HTTP service layer for Polymer 1.x
 *
 * Provides:
 * - Automatic auth header injection
 * - Token refresh with race condition prevention
 * - Contextual API pattern: api(this).domain.method()
 * - Loading/error state management
 * - Event compatibility with existing auth components
 * - External configuration via apiConfig property (required)
 *
 * External Configuration (required):
 * behavior.apiConfig = {
 *   env: 'development',
 *   actions: {
 *     auth: {
 *       login: function(credentials) {
 *         return this.fetch('bapi', '/user/login/email', { method: 'POST', body: credentials });
 *       }
 *     }
 *   },
 *   services: {
 *     bapi: {
 *       base: {
 *         development: 'http://localhost:5100/api',
 *         production: 'https://api.bitpaper.io'
 *       }
 *     }
 *   }
 * }
 *
 * Usage: api(component).auth.login({ email: 'user@example.com', password: 'pass' })
 */
globalThis.HttpBehavior = {
  properties: {
    // External API configuration object (specification pattern)
    apiConfig: {
      type: Object,
      observer: '_apiConfigChanged'
    },


    // User authentication state
    loggedInUser: {
      type: Object,
      notify: true,  // Fires 'logged-in-user-changed' event automatically
      value: function() { return null; }
    },

    // API instance function
    api: {
      type: Object,
      notify: true,
      value: function() { return null; }
    }
  },

  attached: function() {
    this._initializeAuth();
    // API building happens via _apiConfigChanged observer
  },

  _apiConfigChanged: function(apiConfig) {
    if (apiConfig) {
      // Validate configuration (even if properties are missing)
      const validation = this._validateConfiguration(apiConfig);

      if (validation.errors.length > 0) {
        console.error('HttpBehavior Configuration Errors:', validation.errors);
        // In development, throw error. In production, log and continue with degraded functionality
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          throw new AuthError({
            code: 'INVALID_CONFIGURATION',
            message: 'Configuration validation failed',
            status: 500,
            retry: false
          });
        }
      }

      if (validation.warnings.length > 0) {
        console.warn('HttpBehavior Configuration Warnings:', validation.warnings);
      }

      // Only build API if no validation errors
      if (validation.errors.length === 0) {
        // Transform external config into internal services format and build API
        this._externalConfig = apiConfig;
        this._buildExternalApi();
      }
    }
  },

  _validateConfiguration: function(config) {
    const errors = [];
    const warnings = [];

    // Validate required structure
    if (!config.env) errors.push({
      category: 'config',
      code: 'MISSING_ENV',
      message: 'Missing required "env" property',
      suggestions: ['Add env property: { env: "development" }']
    });

    if (!config.actions) errors.push({
      category: 'config',
      code: 'MISSING_ACTIONS',
      message: 'Missing required "actions" property',
      suggestions: ['Add actions property with domain methods']
    });

    if (!config.services) errors.push({
      category: 'config',
      code: 'MISSING_SERVICES',
      message: 'Missing required "services" property',
      suggestions: ['Add services property with base URLs']
    });

    if (config.env && config.services) {
      // Check service references from actions
      const referencedServices = new Set();
      if (config.actions) {
        this._findServiceReferences(config.actions, referencedServices);
      }

      // Validate environment availability for referenced services
      Object.keys(config.services).forEach(serviceName => {
        const service = config.services[serviceName];
        if (!service.base || !service.base[config.env]) {
          warnings.push(`Environment '${config.env}' not configured for service '${serviceName}' - runtime errors will occur`);
        }

        // Warn about unused services
        if (!referencedServices.has(serviceName)) {
          warnings.push(`Service '${serviceName}' is defined but not used in actions`);
        }
      });
    }

    return { errors, warnings };
  },

  _findServiceReferences: function(obj, referencedServices) {
    if (typeof obj === 'function') {
      // Check function body for this.fetch('serviceName') calls
      const funcStr = obj.toString();
      const matches = funcStr.match(/this\.fetch\(['"`]([^'"`]+)['"`]/g);
      if (matches) {
        matches.forEach(match => {
          const serviceName = match.match(/this\.fetch\(['"`]([^'"`]+)['"`]/)[1];
          referencedServices.add(serviceName);
        });
      }
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(value => {
        this._findServiceReferences(value, referencedServices);
      });
    }
  },

  _generateRequestId: function() {
    return 'req-' + crypto.randomUUID().slice(0, 8);
  },

  _createRequestContext: function(component, url, options = {}) {
    return {
      requestId: this._generateRequestId(),
      timestamp: new Date().toISOString(),
      component: component ? {
        tagName: component.tagName || 'unknown',
        id: component.id || 'unknown'
      } : null,
      request: {
        url,
        method: options.method || 'GET',
        hasAuth: !!this.loggedInUser?.tokens?.access
      },
      user: this.loggedInUser ? {
        id: this.loggedInUser.id_user,
        isAuthenticated: true
      } : { isAuthenticated: false },
      configuration: {
        environment: this._externalConfig?.env,
        availableServices: Object.keys(this._externalConfig?.services || {})
      }
    };
  },

  _extractErrorMessage: function(errorResponse) {
    if (!errorResponse) return null;

    // Handle different BAPI error response formats
    if (errorResponse.message) return errorResponse.message;
    if (errorResponse.errorMessage) return errorResponse.errorMessage;
    if (Array.isArray(errorResponse.message)) return errorResponse.message.join(', ');

    return null;
  },

  _createHttpError: function(response, context, error) {
    const status = response.status;

    // Use AuthError for all HTTP errors
    const authError = AuthError.fromHTTP(response, error);

    // Add response property for test compatibility
    authError.response = error;

    return authError;
  },



  // Public auth methods (replaces logged-in-user element)


  logout: function() {
    // Clear local state
    this.set('loggedInUser', null);
    window.localStorage.removeItem('loggedInUser');

    // Fire event for compatibility
    this.fire('user-logged-out');

    return Promise.resolve();
  },

  // Private methods

  _initializeAuth: function() {
    // Check for existing user in localStorage
    const storedUser = this._getStoredUser();
    if (storedUser && storedUser.tokens && storedUser.tokens.refresh) {
      // Refresh token to get latest user data
      return this._refreshToken()
        .then(() => {
          this.fire('initial-login-completed');
        })
        .catch(err => {
          console.error('Token refresh failed:', err);
          this._clearStoredUser();
          this.fire('initial-login-completed');
        });
    } else {
      // No stored user
      this.fire('initial-login-completed');
      return Promise.resolve();
    }
  },

  _buildExternalApi: function() {
    if (!this._externalConfig) {
      console.warn('HttpBehavior: external configuration not available');
      return;
    }

    const config = this._externalConfig;
    const self = this;

    // Build API function that creates contextual API from external configuration
    this.set('api', function(component) {
      const api = {};

      // Add behavior instance reference for external actions
      api._getBehaviorInstance = function() {
        return self;
      };

      // Add fetch method for service multiplexing
      api.fetch = function(serviceName, path, options = {}) {
        const service = config.services[serviceName];
        if (!service) {
          throw new AuthError({
            code: 'SERVICE_NOT_FOUND',
            message: `Service '${serviceName}' is not configured`,
            status: 500,
            retry: false
          });
        }

        const baseUrls = service.base;
        if (!baseUrls || !baseUrls[config.env]) {
          throw new AuthError({
            code: 'ENVIRONMENT_NOT_FOUND',
            message: `Environment '${config.env}' is not configured for service '${serviceName}'`,
            status: 500,
            retry: false
          });
        }

        const baseUrl = baseUrls[config.env];
        const url = baseUrl + path;

        // Clone options to avoid mutating original
        const requestOptions = { ...options };

        // Stringify JSON body if needed
        if (requestOptions.body && typeof requestOptions.body === 'object') {
          requestOptions.body = JSON.stringify(requestOptions.body);
        }

        // Set loading state if component provided
        if (component && component.set) {
          component.set('loading', true);
          component.set('lastError', null);
        }

        return self._http.request.call(self, url, requestOptions, component)
          .then(response => {
            // Handle login responses automatically
            if (response && response.tokens && response.id_user) {
              self._handleLoginSuccess(response, true);
            }
            
            if (component && component.set) {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
            }
            return response;
          })
          .catch(error => {
            if (component && component.set) {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
            }
            throw error;
          });
      };

      // Add all action domains from external configuration
      Object.keys(config.actions).forEach(domain => {
        api[domain] = {};
        Object.keys(config.actions[domain]).forEach(method => {
          // Create a wrapper that ensures proper binding to api object
          const originalMethod = config.actions[domain][method];
          api[domain][method] = function(...args) {
            return originalMethod.call(api, ...args);
          };
        });
      });

      return api;
    });
  },


  _addAuthHeaders: function(options) {
    // Add auth headers
    const user = this.loggedInUser;
    if (user && user.tokens && user.tokens.access) {
      options.headers = options.headers || {};
      options.headers['Authorization'] = `Bearer ${user.tokens.access}`;
    }

    // Add content-type for JSON bodies
    if (options.body && typeof options.body === 'string') {
      options.headers = options.headers || {};
      options.headers['Content-Type'] = 'application/json';
    }
  },

  _handleResponse: function(response) {
    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Parse JSON response
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      return response.text();
    }
    
    // If not ok, let error handling take over
    return response;
  },

  _handleError: function(response, context) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json().then(err => {
        throw this._createHttpError(response, context, err);
      });
    } else {
      return response.text().then(text => {
        throw this._createHttpError(response, context, { message: text });
      });
    }
  },

  _http: {
    request: function(url, options = {}, component = null) {
      // Create request context for better error messages
      const context = this._createRequestContext(component, url, options);

      // Add authentication and content headers
      this._addAuthHeaders(options);

      // Make request
      return fetch(url, options)
        .then(response => {
          // Handle 401 - token expired
          if (response.status === 401) {
            return this._refreshToken.call(this)
              .then(() => {
                // Retry with new token
                const user = this.loggedInUser;
                options.headers['Authorization'] = `Bearer ${user.tokens.access}`;
                return fetch(url, options);
              });
          }
          return response;
        })
        .then(response => {
          // Handle successful responses
          if (response.ok || response.status === 204) {
            return this._handleResponse(response);
          } else {
            // Handle error responses
            return this._handleError(response, context);
          }
        });
    }
  },

  _refreshToken: function() {
    // Prevent concurrent refresh attempts
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    const storedUser = this._getStoredUser();
    if (!storedUser || !storedUser.tokens || !storedUser.tokens.refresh) {
      return Promise.reject(new Error('No refresh token available'));
    }

    // Get base URL from external configuration
    if (!this._externalConfig || !this._externalConfig.services) {
      return Promise.reject(new Error('External configuration required for token refresh'));
    }

    // Use the first available service
    const serviceName = Object.keys(this._externalConfig.services)[0];
    const service = this._externalConfig.services[serviceName];
    if (!service || !service.base || !service.base[this._externalConfig.env]) {
      return Promise.reject(new Error('Service configuration not found for token refresh'));
    }

    const baseUrl = service.base[this._externalConfig.env];
    const url = `${baseUrl}/user/refresh`;

    this._refreshPromise = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedUser.tokens.refresh })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errorData => {
          const context = this._createRequestContext(null, url, { method: 'POST' });
          throw AuthError.TokenRefreshFailed({
            status: response.status,
            response: errorData
          });
        }).catch(() => {
          // If JSON parsing fails, create error with just status
          const context = this._createRequestContext(null, url, { method: 'POST' });
          throw AuthError.TokenRefreshFailed({ status: response.status });
        });
      }
      return response.json();
    })
    .then(userData => {
      this._handleLoginSuccess(userData, false); // false = not user-initiated
      return userData;
    })
    .catch(error => {
      // Clear stored user on refresh failure
      this._clearStoredUser();
      throw error;
    })
    .finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  },

  _handleLoginSuccess: function(userData, isUserInitiated) {
    // Create user object
    const user = {
      isLoggedIn: true,
      id_user: userData.id_user,
      name: userData.name,
      email: userData.email,
      network: userData.network || 'email',
      subscription: userData.subscription,
      tokens: {
        access: userData.tokens.access,
        refresh: userData.tokens.refresh
      }
    };

    // Store in localStorage first
    this._storeUser(user);

    // Update component state
    this.set('loggedInUser', user);

    // Fire events
    this.fire('login-success', { detail: user });

    if (isUserInitiated) {
      this.fire('login-request-success', { detail: user });
    }
  },

  _storeUser: function(user) {
    const storageData = {
      id_user: user.id_user,
      tokens: {
        access: user.tokens.access,
        refresh: user.tokens.refresh
      },
      name: user.name,
      email: user.email,
      network: user.network
    };

    window.localStorage.setItem('loggedInUser', JSON.stringify(storageData));
  },

  _getStoredUser: function() {
    try {
      return JSON.parse(window.localStorage.getItem('loggedInUser') || '{}');
    } catch (e) {
      console.warn('Failed to parse stored user:', e);

      return {};
    }
  },

  _clearStoredUser: function() {
    window.localStorage.removeItem('loggedInUser');
    this.set('loggedInUser', null);
  }
};
