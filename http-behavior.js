/**
 * HttpBehavior - Unified auth and HTTP service layer for Polymer 1.x
 * 
 * Provides:
 * - Automatic auth header injection
 * - Token refresh with race condition prevention  
 * - Contextual API pattern: api(this).domain.method()
 * - Loading/error state management
 * - Event compatibility with existing auth components
 * - External configuration support via apiConfig property
 * 
 * External Configuration (recommended):
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
 * 
 * Legacy Configuration:
 * The behavior also supports legacy `services` property for backward compatibility.
 * Statics are accessed via Polymer data binding: [[services.serviceName.statics.socket]]
 */
globalThis.HttpBehavior = {
  properties: {
    // External API configuration object (specification pattern)
    apiConfig: {
      type: Object,
      observer: '_apiConfigChanged'
    },

    // Service configuration object (internal)
    services: {
      type: Object,
      value: function() { return {}; },
      observer: '_servicesChanged'
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
    // API building happens via _servicesChanged observer
  },

  _apiConfigChanged: function(apiConfig) {
    if (apiConfig && apiConfig.actions && apiConfig.services) {
      // Transform external config into internal services format and build API
      this._externalConfig = apiConfig;
      this._buildExternalApi();
    }
  },

  _servicesChanged: function(newServices) {
    if (newServices && Object.keys(newServices).length > 0) {
      this._buildApi();
    }
  },

  // Private helper to get base URL from first service with baseURL
  _getBaseUrl: function() {
    if (!this.services) return '';
    const mainService = Object.values(this.services).find(s => s && s.baseURL);
    return mainService?.baseURL || '';
  },

  // Public auth methods (replaces logged-in-user element)
  
  loginLocal: function(credentials) {
    const baseUrl = this._getBaseUrl();
    const url = `${baseUrl}/api/user/login/email`;
    
    return this._http.request.call(this, url, {
      method: 'POST',
      body: JSON.stringify(credentials),
      skipAuth: true // Don't add auth headers to login request
    })
    .then(response => {
      this._handleLoginSuccess(response, true); // true = user-initiated
      return response;
    });
  },

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

      // Add fetch method for service multiplexing
      api.fetch = function(serviceName, path, options = {}) {
        const service = config.services[serviceName];
        if (!service) {
          throw new Error(`Service '${serviceName}' not found in configuration`);
        }

        const baseUrls = service.base;
        if (!baseUrls || !baseUrls[config.env]) {
          throw new Error(`Environment '${config.env}' not found for service '${serviceName}'`);
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

        return self._http.request.call(self, url, requestOptions)
          .then(response => {
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

  _buildApi: function() {
    if (!this.services) {
      console.warn('HttpBehavior: services not configured');
      return;
    }

    // Find the main API service (first one with baseURL)
    const mainService = Object.values(this.services).find(s => s && s.baseURL);
    if (!mainService) {
      console.warn('HttpBehavior: no service with baseURL found');
      return;
    }

    const baseUrl = mainService.baseURL;
    const http = this._http;
    const self = this;

    // Build API with contextual pattern
    this.set('api', function(component) {
      return {
        auth: {
          login: function(credentials) {
            return self.loginLocal.call(self, credentials);
          },
          logout: function() {
            return self.logout.call(self);
          }
        },

        paper: {
          save: function(data) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/user/papers/save`, {
              method: 'POST',
              body: JSON.stringify(data)
            })
            .then(response => {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
              component.fire('paper-saved', { detail: response });
              return response;
            })
            .catch(error => {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
              throw error;
            });
          },

          list: function() {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/user/papers`)
              .then(response => {
                component.set('loading', false);
                component.set('lastResponse', response);
                component.fire('response', { response });
                return response;
              })
              .catch(error => {
                component.set('loading', false);
                component.set('lastError', error);
                component.fire('error', { error });
                throw error;
              });
          },

          checkExists: function(paperUrl) {
            return http.request.call(self, `${baseUrl}/api/user/saved-paper/exists`, {
              method: 'POST',
              body: JSON.stringify({ url: paperUrl })
            });
          },

          delete: function(paperId) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/papers/${paperId}`, {
              method: 'DELETE'
            })
            .then(response => {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
              component.fire('paper-deleted', { detail: { paperId } });
              return response;
            })
            .catch(error => {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
              throw error;
            });
          }
        },

        tags: {
          list: function() {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/user/tags`)
              .then(response => {
                component.set('loading', false);
                component.set('lastResponse', response);
                component.fire('response', { response });
                return response;
              })
              .catch(error => {
                component.set('loading', false);
                component.set('lastError', error);
                component.fire('error', { error });
                throw error;
              });
          },

          create: function(tag) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/user/tags`, {
              method: 'POST',
              body: JSON.stringify(tag)
            })
            .then(response => {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
              return response;
            })
            .catch(error => {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
              throw error;
            });
          },

          update: function(tagId, updates) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/tags/${tagId}`, {
              method: 'PUT',
              body: JSON.stringify(updates)
            })
            .then(response => {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
              return response;
            })
            .catch(error => {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
              throw error;
            });
          },

          delete: function(tagId) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/tags/${tagId}`, {
              method: 'DELETE'
            })
            .then(response => {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
              return response;
            })
            .catch(error => {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
              throw error;
            });
          }
        },

        assets: {
          getSignedUrl: function(paperId, assetKey) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/paper/${paperId}/assets/${assetKey}/signed-url`)
              .then(response => {
                component.set('loading', false);
                component.set('lastResponse', response);
                component.fire('response', { response });
                return response;
              })
              .catch(error => {
                component.set('loading', false);
                component.set('lastError', error);
                component.fire('error', { error });
                throw error;
              });
          }
        },

        preferences: {
          get: function() {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/user/preferences`)
              .then(response => {
                component.set('loading', false);
                component.set('lastResponse', response);
                component.fire('response', { response });
                return response;
              })
              .catch(error => {
                component.set('loading', false);
                component.set('lastError', error);
                component.fire('error', { error });
                throw error;
              });
          },

          update: function(preferences) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/user/preferences`, {
              method: 'PUT',
              body: JSON.stringify(preferences)
            })
            .then(response => {
              component.set('loading', false);
              component.set('lastResponse', response);
              component.fire('response', { response });
              return response;
            })
            .catch(error => {
              component.set('loading', false);
              component.set('lastError', error);
              component.fire('error', { error });
              throw error;
            });
          }
        },

        rtc: {
          generateToken: function(paperId) {
            component.set('loading', true);
            component.set('lastError', null);
            
            return http.request.call(self, `${baseUrl}/api/paper/${paperId}/rtc/token`, {
              method: 'POST'
            })
            .then(response => {
                component.set('loading', false);
                component.set('lastResponse', response);
                component.fire('response', { response });
                return response;
              })
              .catch(error => {
                component.set('loading', false);
                component.set('lastError', error);
                component.fire('error', { error });
                throw error;
              });
          }
        }
      };
    });
  },

  _http: {
    request: function(url, options = {}) {
      // Add auth headers unless skipped
      if (!options.skipAuth) {
        const user = this.loggedInUser;
        if (user && user.tokens && user.tokens.access) {
          options.headers = options.headers || {};
          options.headers['Authorization'] = `Bearer ${user.tokens.access}`;
        }
      }

      // Add content-type for JSON bodies
      if (options.body && typeof options.body === 'string') {
        options.headers = options.headers || {};
        options.headers['Content-Type'] = 'application/json';
      }

      // Make request
      return fetch(url, options)
        .then(response => {
          // Handle 401 - token expired
          if (response.status === 401 && !options.skipAuth) {
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
          } else {
            // Handle error responses - clone response to read body twice if needed
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return response.json().then(err => {
                const error = new Error(err.message || err.errorMessage || `HTTP ${response.status}`);
                error.status = response.status;
                error.response = err;
                throw error;
              });
            } else {
              return response.text().then(text => {
                const error = new Error(text || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;
              });
            }
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

    const baseUrl = this._getBaseUrl();
    const url = `${baseUrl}/api/user/refresh`;

    this._refreshPromise = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedUser.tokens.refresh })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
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
