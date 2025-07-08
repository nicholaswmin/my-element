# CLAUDE.md

This directory contains the HttpBehavior implementation for Bitpaper's authentication  
system refactoring.

## Project Overview

This is a Polymer 1.x behavior that consolidates HTTP requests, authentication, and  
service layer functionality into a single testable unit. It replaces the problematic  
auth-ajax and logged-in-user components that were causing race conditions.

## Key Files

- `http-behavior.js` - The main behavior implementation
- `errors/auth.js` - Streamlined error handling with BAPI integration
- `test/` - Node.js test runner tests using JSDOM
  - `core.test/` - Core HTTP behavior, external config, URL building, service transformation
  - `auth.test/` - Authentication flow tests (login, logout, refresh, session)
  - `ui.test/` - Component integration and error propagation tests
  - `errors.test/` - AuthError class and edge case tests
  - `api.test/` - BAPI endpoint integration tests
- `docs/errors.md` - AuthError class documentation
- `docs/server/auth.md` - BAPI authentication documentation
- `docs/plan.md` - Implementation plan and status

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Configuration

The behavior accepts an `apiConfig` configuration object for external  
configuration:

```javascript
apiConfig: {
  env: '{{NODE_ENV}}',
  actions: {
    auth: {
      login: function(credentials) {
        return this.fetch('bapi', '/user/login/email', {
          method: 'POST',
          body: credentials
        });
      },
      // Other auth methods...
    },
    paper: {
      save: function(id, data) {
        return this.paper.get(id)
          .then(exists => exists 
            ? this.paper.edit(id, data)
            : this.paper.add(id, data)
          );
      },
      // Other paper methods...
    }
  },
  services: {
    bapi: {
      base: {
        development: 'http://localhost:5100/api',
        staging: 'https://api-stage.bitpaper.io',
        production: 'https://api.bitpaper.io'
      }
    }
  }
}
```

**🔄 HYBRID IMPLEMENTATION**: External API configuration working alongside legacy  
hardcoded system.

**External Configuration Features (Fully Working)**:
- External configuration supports complete action definitions with cross-calling
- Service multiplexing via `fetch(serviceName, path)` method
- Environment-based URL selection (development, staging, production)
- JSON body stringification for proper request handling
- Automatic loading state management for external actions
- Full auth method suite: login, logout, register, resetPassword, verifyEmail, refresh
- Method binding enables `this.paper.get()` → `this.paper.edit()` cross-calling  
  patterns

**Architecture Implementation**:
- **External Configuration**: `_buildExternalApi()` method (lines 114-189)
- **Service Multiplexing**: Environment-based URL selection with  
  `fetch(serviceName, path)` 
- **Method Binding**: Cross-calling support via proper `this` binding
- **Component Integration**: Automatic state management and event firing

Current implementation uses external configuration exclusively via `apiConfig`  
property.

**Test Environment Setup**:  
In test environments, external configuration requires manual observer trigger:
```javascript
const config = bapiService(server.host + '/api')
behavior.apiConfig = config
behavior._apiConfigChanged(config)  // Required in tests
```

**Component State Management**:
External actions automatically manage component state:
- `component.set('loading', true)` when request starts
- `component.set('loading', false)` when request completes
- `component.set('lastResponse', response)` on success
- `component.set('lastError', error)` on failure
- `component.fire('response'/'error')` events for component lifecycle

## Implementation Notes

1. The behavior uses a contextual API pattern: `this.api(this).domain.method()`
2. All HTTP requests automatically include auth headers and handle 401s
3. Token refresh has built-in race condition prevention
4. Compatible with existing Polymer 1.x property binding and events
5. HttpBehavior is defined globally but ONLY mixed into app-whiteboard
6. Child components receive `service` and `loggedInUser` through property  
   injection
7. Service names in tests (like `bapi`) reflect real app usage, not behavior  
   requirements

## Development Guidelines

- Keep social login out of scope for now
- Maintain exact localStorage format for backward compatibility
- Fire same events as legacy components for compatibility
- Test with mocked Polymer.Base and JSDOM for speed
- **AVOID `this.async()`** - It creates race conditions. Use property observers  
  or other Polymer patterns instead

## Code Style

### Docs

- Only document specific counts and values when their value **far exceeds** the  
  maintenance burden they create
- Avoid unnecessary fluff and stay on **actionable points**
- Use **strong** formatting sparingly to emphasize very important, **key  
  information** in a sentence
- Focus on capabilities and concepts rather than implementation details
- Document patterns and principles, not specific code examples that become  
  outdated

## Current Status

🎉 **PRODUCTION READY** - All core features implemented with comprehensive test coverage:

### ✅ **Comprehensive Cleanup Completed**
- **Error System Refactored**: Simplified from complex inheritance to single `AuthError` class
- **Test Organization**: Restructured into single-word logical folders (`core/`, `auth/`, `ui/`, `errors/`, `api/`)
- **Code Modernization**: Fixed deprecated `substr()` method, removed unused functions
- **Quality Improvements**: Removed trailing whitespace, eliminated duplicate code
- **Documentation Updated**: Error handling docs rewritten to reflect actual implementation

### ✅ **Core Implementation**
- ✅ **External Configuration**: Working `apiConfig` property with observer
- ✅ **API Pattern**: `api(this).domain.method()` pattern
- ✅ **Service Multiplexing**: Environment-based URL selection
- ✅ **Method Binding**: Cross-calling between actions
- ✅ **Loading State Management**: Automatic component state management
- ✅ **Complete Auth Suite**: Full authentication methods
- ✅ **Race Condition Prevention**: Token refresh deduplication
- ✅ **Component Integration**: Automatic loading states and event firing

✅ **Core Features**:
- Service multiplexing with environment URLs
- External action configuration
- Dynamic domain creation
- Cross-calling method binding
- Automatic loading states
- Streamlined error handling with BAPI integration

✅ **Architecture Benefits**:
- Clean external configuration system
- Unified testing approach
- Automatic component state management
- Environment-based service multiplexing
- Cross-calling method binding
- Minimal error handling with BAPI integration

❌ **Out of Scope** (By Design):
- Social login (Google/Facebook)
- Company login
- Guest user localStorage support
- Iron-ajax auto-refetch patterns (not needed per analysis)

📋 **Optional Enhancements**:
- 🔮 Request cancellation - AbortController support
- ⚠️ Edge case handling - Rapid requests, malformed responses  
- 🎯 Component features - Isolation, property binding, auth delegation
- 📊 Future features - Registration endpoint, configuration patterns

🚀 **Ready for Integration**:
- Component migration from auth-ajax (10 components)
- Production configuration setup
- Removal of legacy auth elements and pages

## Node.js Test Style Guide

Tests use Node.js test runner with domain-driven semantic grouping:

### Test Organization
- **Semantic grouping**: Tests read like specifications using domain language
- **Hierarchical structure**: `test() > t.test() > t.test()` mirrors user scenarios
- **Domain titles**: Use real-world events, not technical implementation details

```javascript
test('HttpBehavior external configuration', async t => {
  await t.test('accepts external API configuration', async t => {
    await t.todo('api property: accepts external configuration', async t => {
      // Test implementation
    })
  })
})
```

### Test Guidelines
- **Flexible assertions**: Use `t.assert.partialDeepStrictEqual()` for extensible objects
- **Array access**: Use `.at(0)` not `[0]` for better error messages  
- **Mock timers**: Use `t.mock.timers` for deterministic time-dependent tests
- **Setup/teardown**: Use `t.beforeEach()`/`t.afterEach()` to reduce boilerplate
- **TODO tests**: Use `t.todo()` for red-green-refactor specification markers
- **80-character limit**: Keep lines concise and readable
- **Minimal imports**: Only import test runner and system under test

### Test File Structure (Single-Word Folders with .test Postfix)
```
test/
├── core.test/             # Core HttpBehavior functionality
│   ├── behavior.test.js   # Core HTTP behavior and error handling
│   ├── config.test.js     # External configuration setup
│   ├── routes.test.js     # URL building and service multiplexing
│   └── transform.test.js  # Service configuration transformer
├── auth.test/             # Authentication flow tests
│   ├── login.test.js      # Login and authentication
│   ├── logout.test.js     # Logout and session cleanup
│   ├── refresh.test.js    # Token refresh and expiration
│   ├── session.test.js    # Session initialization
│   ├── headers.test.js    # Authorization headers
│   └── storage.test.js    # localStorage persistence
├── ui.test/               # Component integration tests
│   ├── lifecycle.test.js  # Component integration and lifecycle
│   ├── errors.test.js     # Error propagation through hierarchy
│   └── state.test.js      # Component state management
├── errors.test/           # Error handling tests
│   ├── auth.test.js       # AuthError class tests
│   └── edges.test.js      # Edge cases and boundary scenarios
├── api.test/              # External service integration
│   └── endpoints.test.js  # BAPI endpoint integration
└── util/                  # Test utilities
    ├── server/            # Mock server
    ├── services/          # Service configurations
    └── setup.js           # Test environment setup
```

## Key Findings from Analysis

- Only 2 whiteboard elements use reactive auth observers (app-whiteboard, object-sync)
- No iron-ajax auto-refetch patterns in whiteboard elements
- BAPI design eliminates ~80% of URL parameter needs
- Simple JSON configuration sufficient - no reactive complexity needed
- ✅ Domain-specific methods ARE externally defined via actions configuration