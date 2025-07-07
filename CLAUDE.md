# CLAUDE.md

This directory contains the HttpBehavior implementation for Bitpaper's authentication system refactoring.

## Project Overview

This is a Polymer 1.x behavior that consolidates HTTP requests, authentication, and service layer functionality into a single testable unit. It replaces the problematic auth-ajax and logged-in-user components that were causing race conditions.

## Key Files

- `http-behavior.js` - The main behavior implementation
- `test/*.test.js` - Node.js test runner tests using JSDOM
- `docs/ui/spec.md` - Complete HttpBehavior specification
- `docs/server/auth.md` - BAPI authentication documentation
- `docs/todo.md` - Test coverage gaps, TODO items, and pending removals

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Configuration

The behavior accepts an `apiConfig` configuration object for external configuration:

```javascript
apiConfig: {
  env: '{{NODE_ENV}}',
  actions: {
    auth: {
      login: function(credentials) {
        return this.fetch('bapi', '/user/login/email', {
          method: 'POST',
          body: credentials,
          skipAuth: true
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

**🔄 HYBRID IMPLEMENTATION**: External API configuration working alongside legacy hardcoded system.

**External Configuration Features (Fully Working)**:
- External configuration supports complete action definitions with cross-calling
- Service multiplexing via `fetch(serviceName, path)` method
- Environment-based URL selection (development, staging, production)
- JSON body stringification for proper request handling
- Automatic loading state management for external actions
- Full auth method suite: login, logout, register, resetPassword, verifyEmail, refresh
- Method binding enables `this.paper.get()` → `this.paper.edit()` cross-calling patterns

**Architecture Reality**:
- **External Configuration**: `_buildExternalApi()` method (lines 145-220)
- **Legacy Hardcoded**: `_buildApi()` method (lines 222-498) with 276 lines of hardcoded endpoints
- **Dual System**: Both systems coexist for backward compatibility

Current implementation supports both patterns - external config when `apiConfig` is provided, legacy when `services` property is used.

## Implementation Notes

1. The behavior uses a contextual API pattern: `this.api(this).domain.method()`
2. All HTTP requests automatically include auth headers and handle 401s
3. Token refresh has built-in race condition prevention
4. Compatible with existing Polymer 1.x property binding and events
5. HttpBehavior is defined globally but ONLY mixed into app-whiteboard
6. Child components receive `service` and `loggedInUser` through property injection
7. Service names in tests (like `bapi`) reflect real app usage, not behavior requirements

## Development Guidelines

- Keep social login out of scope for now
- Maintain exact localStorage format for backward compatibility
- Fire same events as legacy components for compatibility
- Test with mocked Polymer.Base and JSDOM for speed
- **AVOID `this.async()`** - It creates race conditions. Use property observers or other Polymer patterns instead

## Current Status

🔄 **HYBRID IMPLEMENTATION** (External Config + Legacy System):
- **External Configuration**: Working `apiConfig` property with `_apiConfigChanged` observer
- **API Pattern**: `api(this).domain.method()` pattern works in both external and legacy modes
- **Service Multiplexing**: `fetch(serviceName, path)` method with environment-based URL selection (external config)
- **Method Binding**: Cross-calling between external actions (`this.paper.get()` → `this.paper.edit()`)
- **Loading State Management**: Automatic component state management for both systems
- **Complete Auth Suite**: Available via external configuration (register, resetPassword, verifyEmail, refresh)
- **Legacy Compatibility**: Maintains full hardcoded API implementation (276 lines in `_buildApi`)
- **Race Condition Prevention**: Token refresh with concurrent request deduplication
- **Test Coverage**: 60 tests total, 47 passing, 0 failing, 13 TODO (majority test legacy system)

✅ **External Configuration Features WORKING**:
- **Service-name agnostic** - ✅ IMPLEMENTED with service multiplexing
- **External configuration** - ✅ IMPLEMENTED with actions object support  
- **Dynamic domain creation** - ✅ IMPLEMENTED from external config
- **API pattern** - ✅ IMPLEMENTED - Uses `api(this)` as specified
- **Auth methods** - ✅ AVAILABLE via external configuration
- **Cross-calling** - ✅ IMPLEMENTED with proper method binding
- **Loading states** - ✅ IMPLEMENTED for external actions

⚠️ **Architecture Considerations**:
- **Dual System**: Both external configuration and legacy hardcoded implementations coexist
- **Test Split**: Most tests validate legacy system, limited external configuration testing
- **Code Complexity**: Maintains 276 lines of hardcoded API methods alongside external config

❌ **Out of Scope** (By Design):
- Social login (Google/Facebook)
- Company login
- Guest user localStorage support
- Iron-ajax auto-refetch patterns (not needed per analysis)

📋 **Future Enhancements** (13 TODO tests):
- Request cancellation (AbortController)
- Advanced URL building edge cases
- Rapid sequential request handling
- Malformed response handling
- Component isolation improvements

⚠️ **Next Phase** (Integration):
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

### Test File Structure
```
test/
├── config.test.js         # External configuration setup
├── edges.test.js          # Edge cases & boundary scenarios  
├── http-behavior.test.js  # Core behavior (auth, lifecycle)
├── element.test.js        # Component integration mechanics
├── bitpaper.test.js       # Real endpoint integration (minimal)
└── routes.test.js         # URL building tests
```

## Key Findings from Analysis

- Only 2 whiteboard elements use reactive auth observers (app-whiteboard, object-sync)
- No iron-ajax auto-refetch patterns in whiteboard elements
- BAPI design eliminates ~80% of URL parameter needs
- Simple JSON configuration sufficient - no reactive complexity needed
- ✅ Domain-specific methods ARE externally defined via actions configuration