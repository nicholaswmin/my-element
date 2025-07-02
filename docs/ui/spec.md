# HttpBehavior Specification

## Overview

HttpBehavior is a Polymer 1.x behavior that provides unified authentication and HTTP request handling for Bitpaper's whiteboard application. It replaces the problematic `auth-ajax` and `logged-in-user` components with a single, race-condition-free implementation.

## Architecture Principles

### Service-Name Agnostic

The behavior accepts a `services` configuration object and uses the first service with a `baseURL`. Service names are completely flexible - the behavior finds and uses whichever service has a `baseURL` property. Services must include a `statics` object containing URLs for related services (socket, fetch, s3, etc.).

### Contextual Service Pattern

Child components receive a `service` function that takes the component as context. When called as `this.service(this).domain.method()`, the pattern:

- Automatically manages `loading`, `lastError`, `lastResponse` states on the calling component
- Fires Polymer events (`response`, `error`, domain-specific events)
- Handles authentication transparently
- Prevents race conditions through centralized token management

This eliminates boilerplate code in components while providing consistent state management.

### Property Observers Instead of Async

**Critical Design Decision**: We avoid `this.async()` which creates race conditions. Instead, we use Polymer property observers to react to property changes. This ensures proper initialization order without deferred execution timing issues.

## Core Implementation

### Properties

The behavior defines three key properties:

- **services**: Configuration object containing service endpoints (observed for changes)
- **loggedInUser**: Current authenticated user state (notifying property)
- **service**: Service API instance passed to child components (notifying property)

### Lifecycle

On attachment, the behavior initializes authentication by checking localStorage. Service building occurs through property observers when the `services` configuration is set, ensuring proper initialization order without timing issues.

### Authentication Initialization

On attachment, the behavior:
1. Checks localStorage for existing user
2. If found with valid refresh token, attempts refresh
3. Fires `initial-login-completed` event (always, even on failure)
4. Clears invalid sessions

The `initial-login-completed` event ensures components can proceed with initialization regardless of authentication state.

### Service API

The behavior transforms an external configuration into a callable API with domain-organized methods. All business logic is defined externally, making HttpBehavior truly service-agnostic.

#### The api(this) Pattern

Components access the API using a contextual pattern:

```javascript
this.api(this).paper.save(id, data)
this.api(this).auth.login(credentials)
this.api(this).preferences.update('editor', prefs)
```

When a component passes itself via `api(this)`, the API automatically:
1. Sets `loading=true` on the component during requests
2. Clears `lastError` before requests
3. Updates `lastResponse` or `lastError` after completion
4. Fires `response` or `error` events on the component
5. Returns a promise for additional handling

This pattern eliminates boilerplate while providing consistent state management across all components.

### API Configuration Structure

The API configuration uses a clean structure that separates business logic (actions) from service endpoints (services), with environment selection controlled by a single property.

**Complete configuration example is provided below in this document.**

#### Configuration Object Structure

```javascript
{
  env: '{{NODE_ENV}}',  // 'development', 'staging', or 'production'
  
  actions: {
    // Auth is just another domain, not special
    auth: {
      login: function(credentials) {
        return this.fetch('bapi', '/user/login/email', {
          method: 'POST',
          body: credentials,
          skipAuth: true  // Prevent circular dependency
        });
      },
      
      refresh: function() {
        const refreshToken = localStorage.getItem('refreshToken');
        return this.fetch('bapi', '/user/refresh', {
          method: 'POST',
          body: { refreshToken },
          skipAuth: true
        });
      },
      
      logout: function() {
        // Client-side only - no server endpoint needed
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('refreshToken');
        return Promise.resolve();
      },
      
      register: function(userData) {
        return this.fetch('bapi', '/user/signup', {
          method: 'POST',
          body: userData,
          skipAuth: true
        });
      }
    },
    
    paper: {
      save: function(id, data) {
        // Methods can call other methods via 'this'
        return this.paper.get(id)
          .then(exists => exists 
            ? this.paper.edit(id, data)
            : this.paper.add(id, data)
          );
      },
      
      edit: function(id, data) {
        return this.fetch('bapi', `/paper/${id}`, {
          method: 'PATCH',
          body: data
        });
      },
      
      get: function(id) {
        return this.fetch('bapi', `/paper/${id}`);
      },
      
      list: function() {
        return this.fetch('bapi', '/user/papers');
      }
    },
    
    preferences: {
      update: function(type, prefs) {
        return this.fetch('bapi', `/user/preferences/${type}`, {
          method: 'PATCH',
          body: prefs
        });
      }
    },
    
    tags: {
      list: function() {
        return this.fetch('bapi', '/user/tags');
      },
      
      create: function(tag) {
        return this.fetch('bapi', '/user/tags', {
          method: 'POST',
          body: tag
        });
      }
    }
  },
  
  services: {
    bapi: {
      base: {
        development: 'http://localhost:5100/api',
        staging: 'https://api-stage.bitpaper.io',
        production: 'https://api.bitpaper.io'
      }
    },
    socket: {
      base: {
        development: 'http://localhost:5002',
        staging: 'https://ws-stage.bitpaper.io',
        production: 'https://ws.bitpaper.io'
      }
    },
    s3: {
      base: {
        development: 'https://bitpaper-dev.s3.amazonaws.com',
        staging: 'https://bitpaper-stage.s3.amazonaws.com',
        production: 'https://bitpaper.s3.amazonaws.com'
      }
    }
  }
}
```

#### Key Design Decisions

1. **Methods, not metadata**: Actions are actual functions, not route descriptions
2. **Closure-based binding**: All methods are bound so they can call each other via `this`
3. **Service multiplexing**: `fetch('serviceName', path)` allows using different services
4. **Environment selection**: Single `env` property selects URLs from all services
5. **Auth as regular domain**: No special auth handling, just `skipAuth: true`

### Implementation in HttpBehavior

#### Binding Methods for Cross-Calling

The configuration object requires a binding step to enable methods to call each other:

```javascript
// In whiteboard-page.hbs, inside the api property value function
function bind(obj, root) {
  root = root || obj;
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'function') {
      obj[key] = obj[key].bind(root);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      bind(obj[key], root);
    }
  });
  return obj;
}

// Apply binding to enable this.domain.method() calls
return {
  env: env,
  actions: bind({
    auth: { ... },
    paper: { ... },
    preferences: { ... }
  }),
  services: { ... }
};
```

This binding enables methods to reference each other through closure, critical for composed operations like `paper.save()` calling `paper.get()`, `paper.edit()`, and `paper.add()`.

#### Service Building in HttpBehavior

When the `api` property is set, HttpBehavior transforms it into a callable function:

```javascript
_apiChanged: function(apiConfig) {
  if (!apiConfig) return;
  
  const self = this;
  
  // Create the api function that captures component context
  this.api = function(component) {
    return {
      // Spread all action domains
      ...apiConfig.actions,
      
      // Add the fetch method
      fetch: function(serviceName, path, options = {}) {
        const service = apiConfig.services[serviceName];
        if (!service || !service.base) {
          throw new Error(`Service '${serviceName}' not found`);
        }
        
        const baseURL = service.base[apiConfig.env];
        const url = baseURL + path;
        
        // Set loading state on component
        if (component && component._setLoading) {
          component._setLoading(true);
          component.lastError = null;
        }
        
        // Auto-stringify body if object
        if (options.body && typeof options.body === 'object') {
          options.body = JSON.stringify(options.body);
          options.headers = { 'Content-Type': 'application/json', ...options.headers };
        }
        
        // Add auth header unless skipAuth
        if (!options.skipAuth && self.loggedInUser?.tokens?.access) {
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${self.loggedInUser.tokens.access}`
          };
        }
        
        // Make request with automatic retry on 401
        return self._request(url, options)
          .then(response => {
            if (component && component._setLoading) {
              component._setLoading(false);
              component.lastResponse = response;
              component.fire('response', { response });
            }
            return response;
          })
          .catch(error => {
            if (component && component._setLoading) {
              component._setLoading(false);
              component.lastError = error;
              component.fire('error', { error });
            }
            throw error;
          });
      },
      
      // Add fire method for domain events
      fire: function(...args) {
        return self.fire(...args);
      }
    };
  };
  
  // Also set as 'service' for backward compatibility
  this.service = this.api;
}
```

#### The Fetch Method

The `fetch` method is the core of all HTTP operations:

```javascript
fetch('serviceName', '/path', options)
```

**Parameters:**
- `serviceName`: Which service to use ('bapi', 'socket', 's3', etc.)
- `path`: The API path (e.g., '/user/papers', '/paper/123')
- `options`: Standard fetch options (method, body, headers, skipAuth)

**Features:**
- Resolves service URLs based on current environment
- Automatically stringifies JSON bodies
- Adds auth headers unless `skipAuth: true`
- Handles 401 responses with token refresh
- Manages component loading states
- Fires component events

### Token Refresh Mechanism

HttpBehavior automatically handles 401 responses by refreshing tokens:

```javascript
_request: function(url, options) {
  return fetch(url, options)
    .then(response => {
      if (response.status === 401 && !options.skipAuth) {
        // Use the configured auth.refresh method
        return this.api(null).auth.refresh()
          .then(() => {
            // Retry original request with new token
            options.headers.Authorization = `Bearer ${this.loggedInUser.tokens.access}`;
            return fetch(url, options);
          });
      }
      return response;
    });
}
```

This leverages the auth domain's refresh method, maintaining consistency and avoiding special cases.

### Component Integration

#### Property Declaration

Components using the API must declare these properties:

```javascript
properties: {
  api: Function,           // The API function
  loading: {               // Automatically managed
    type: Boolean,
    value: false,
    readOnly: true
  },
  lastResponse: Object,    // Last successful response
  lastError: Object        // Last error (if any)
}
```

#### Usage Examples

```javascript
// In a component method
savePaper: function() {
  const data = {
    title: this.title,
    content: this.$.canvas.exportJSON()
  };
  
  this.api(this).paper.save(this.paperId, data)
    .then(response => {
      this.showToast('Paper saved successfully');
      this.fire('paper-saved', response);
    })
    .catch(error => {
      // error is also in this.lastError
      this.showErrorToast(error.message);
    });
},

loadTags: function() {
  this.api(this).tags.list()
    .then(tags => {
      this.set('tags', tags);
    });
},

handleLogin: function() {
  this.api(this).auth.login({
    email: this.$.emailInput.value,
    password: this.$.passwordInput.value
  }).then(user => {
    // HttpBehavior handles token storage
    this.fire('login-success');
  });
}
```

### HTTP Request Handler

The core `_request` method handles all HTTP operations:

```javascript
_request: function(url, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
    ...options
  };
  
  return fetch(url, fetchOptions)
    .then(response => {
      // Handle 401 with token refresh
      if (response.status === 401 && !options.skipAuth) {
        return this._handleTokenRefresh().then(() => {
          // Retry with new token
          return fetch(url, fetchOptions);
        });
      }
      
      // Parse response based on content type
      const contentType = response.headers.get('content-type');
      if (response.status === 204) {
        return null;
      } else if (contentType?.includes('application/json')) {
        return response.json();
      } else {
        return response.text();
      }
    });
}
```

Features:
- Automatic 401 retry with token refresh
- Content-Type aware response parsing
- Handles 204 No Content
- Standard fetch API compatibility

### URL Handling

The behavior keeps URL handling simple:
- Actions build complete paths using template literals (e.g., `/paper/${id}`)
- The `fetch` method prepends the appropriate baseURL for the current environment
- No parameter substitution or URL building helpers needed

### Token Refresh Mechanism

Single-use refresh tokens require race condition prevention through a singleton promise pattern. When multiple 401 responses occur simultaneously:

1. The first 401 triggers a refresh request
2. Subsequent 401s reuse the same promise
3. All waiting requests retry after refresh completes
4. Failed refresh clears the stored session

This prevents the "refresh token already used" error that plagued the previous implementation.

### Authentication Methods

#### register(userData)
Creates new user account:
- Accepts `email`, `password`, `firstName`, `lastName` (optional)
- Returns user object with tokens (same as login)
- Automatically logs in the new user
- Fires `registration-success` event

#### login(credentials)
Email/password authentication that:
- Stores user data and tokens in localStorage
- Updates the `loggedInUser` property
- Fires `login-success` for all successful logins
- Fires `login-request-success` for user-initiated logins (triggers UI actions)

#### logout()
Clears authentication state:
- Removes tokens from localStorage
- Clears `loggedInUser` property
- Fires `user-logged-out` event
- **Note**: No server endpoint needed or implemented - logout is purely client-side

#### resetPassword(email)
Initiates password reset flow:
- Sends reset email to provided address
- Returns success/error status
- Fires `password-reset-requested` event

#### verifyEmail(token)
Confirms email address:
- Validates email verification token
- Updates user's email verification status
- Fires `email-verified` event

### Generic Request Method

#### request(url, options)
Makes authenticated requests to any endpoint:
- Accepts relative or absolute URLs
- Supports all HTTP methods and fetch options
- Automatically includes auth headers (unless `skipAuth: true`)
- Handles 401s with token refresh
- Sets loading/error states on calling component
- Fires `response` and `error` events
- Returns promise with parsed response

**Example**:
```javascript
service(this).request('/api/custom/endpoint', {
  method: 'POST',
  body: JSON.stringify({ custom: 'data' })
})
```

### localStorage Management

Uses key `loggedInUser` for backward compatibility. Stores:
- User ID and basic info (name, email, network)
- Access and refresh tokens
- Only essential data (no subscription details, preferences are separate)

This maintains compatibility with existing code that reads from localStorage.

## Events

| Event | When Fired | Detail | Purpose |
|-------|-----------|---------|---------|
| `initial-login-completed` | After auth initialization | None | Signals auth check complete |
| `login-success` | After any successful login | `{ detail: user }` | General login notification |
| `login-request-success` | After user-initiated login | `{ detail: user }` | Triggers UI actions |
| `user-logged-out` | After logout | None | Cleanup signal |
| `logged-in-user-changed` | When loggedInUser changes | `{ value: user }` | Polymer notify event |
| `response` | After successful request | `{ response: data }` | Component compatibility |
| `error` | After failed request | `{ error: Error }` | Error handling |
| `paper-saved` | After paper save | `{ detail: response }` | Domain-specific event |

## Error Handling

Errors are passed through with minimal modification:
- Error objects include `status` and `response` properties
- Response body is parsed as JSON if possible, otherwise as text
- 204 No Content returns `null` instead of parsing
- Components receive the error through `lastError` property and `error` event

## What We Explicitly Avoid

### Out of Scope Features:
- **Social Login**: Google/Facebook authentication
- **Company Login**: Company login from URL parameters  
- **Guest Users**: localStorage support for guest users
- **Request Cancellation**: AbortController support
- **Legacy API Support**: No `useLegacy` option or fallback

### Technical Decisions:
- **No `this.async()`**: Race conditions are prevented through property observers and proper promise management, not deferred execution
- **No Global Objects**: No `window.auth`, `window.BitpaperHttp`, or global state. Everything flows through Polymer properties

## Integration Pattern

HttpBehavior is mixed ONLY into app-whiteboard. Child components receive `service` and `loggedInUser` through Polymer property binding. This creates a clean dependency injection pattern where:

1. app-whiteboard is the sole owner of authentication state
2. Child components declare `service` and `loggedInUser` properties
3. Components use `this.service(this).domain.method()` for API calls
4. No global state or direct behavior access

## Testing

The behavior is tested with:
- JSDOM for Polymer simulation
- Mock test server mimicking BAPI exactly
- Comprehensive test coverage including race conditions
- Property observer behavior verification
- Generic test concepts (avoiding Bitpaper-specific naming)

## Migration from Legacy

Components currently using `auth-ajax`:
1. Remove `<auth-ajax>` element from template
2. Add `service` property
3. Replace `generateRequest()` with service method call
4. Loading/error states managed automatically

Components using direct fetch:
- Can continue if no auth needed (paper-fetch, board-fetch)
- Or migrate to service pattern for consistency

## Performance Characteristics

- **Token Refresh**: Single promise prevents concurrent refreshes
- **Memory**: No promise chains or lingering references
- **Initialization**: Non-blocking, uses property observers
- **Request Overhead**: Minimal - just auth header injection

## Security Considerations

- Tokens stored in localStorage (XSS vulnerable but required for compatibility)
- Refresh tokens are single-use
- Failed refresh clears session immediately
- No token logging or exposure in errors

## Implementation Notes

For current implementation status, limitations, and roadmap, see `docs/todo.md`.