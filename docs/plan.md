# Test Suite Restructuring Plan

## 🔄 Implementation Status (PARTIAL - HYBRID ARCHITECTURE)

**External configuration system implemented but runs alongside legacy hardcoded system.**

- ✅ **External Configuration**: Working `apiConfig` property with method binding and service multiplexing
- ✅ **API Pattern**: `api(this)` pattern functional in both external and legacy modes
- ⚠️ **Hybrid Architecture**: Both external configuration AND legacy hardcoded methods coexist (276 lines in `_buildApi`)
- ✅ **Auth Methods**: `register()`, `resetPassword()`, `verifyEmail()` implemented via external configuration
- ✅ **Cross-calling**: Method binding enables `this.paper.get()` → `this.paper.edit()` flows in external config
- ✅ **Service Multiplexing**: `fetch(serviceName, path)` method working with environment URLs
- ⚠️ **Test Coverage**: Most tests (47 passing) validate legacy system via `_buildApi()`, not external configuration
- ✅ **Configuration Tests**: Dedicated external configuration tests in `config.test.js` passing

**Current Test Results**: 60 total tests, 47 passing, 0 failing, 13 TODO (future features)
**Test Reality**: External configuration tested in ~10 tests; legacy system tested in ~37 tests

---

## Original Problem Analysis

The current test suite has fundamental misalignment with the specification:

- **Wrong API Pattern**: Tests use `service(this)` but spec requires `api(this)`
- **Wrong Implementation Focus**: Tests hardcoded endpoints, spec requires external configuration
- **Contradictory Features**: Tests parameter substitution that spec explicitly rejects
- **Missing Core Features**: No tests for external actions, service multiplexing, environment selection

## Strategic Approach: Red-Green-Refactor Test Suite

Create a test suite that **tests the specification**, not the current implementation. Tests will initially **FAIL** (red), then guide implementation step-by-step to make them **PASS** (green), enabling confident refactoring.

## Phase 1: Remove Contradictory Tests

### 1.1 Remove Parameter Substitution Tests
- **File**: `test/routes.test.js:42-107`
- **Reason**: Spec explicitly rejects parameter substitution
- **Action**: Delete entirely, keep only environment URL tests

### 1.2 Remove Out-of-Scope Tests  
- **File**: `test/http-behavior.test.js:403-410`
- **Reason**: Data binding marked "out of scope"
- **Action**: Delete data binding test section

### 1.3 Convert Hardcoded Tests to TODO
- **Files**: All test files
- **Reason**: Current tests validate hardcoded implementation
- **Action**: Mark as TODO tests until external configuration implemented

## Phase 2: Restructure Test Organization

### 2.1 New Test File Structure
```
test/
├── external-config.test.js     # External configuration tests (NEW)
├── api-pattern.test.js         # API pattern usage tests (REWRITTEN)
├── authentication.test.js      # Auth flows (RESTRUCTURED)
├── error-handling.test.js      # Error scenarios (RESTRUCTURED)  
├── component-integration.test.js # Component state management (RESTRUCTURED)
└── server.test.js             # Infrastructure tests (KEEP)
```

### 2.2 Test Flow Logic
1. **External Configuration** - Foundation layer
2. **API Pattern Usage** - How components use the API
3. **Authentication Flows** - Login/logout/refresh
4. **Error Handling** - 401s, validation, network errors
5. **Component Integration** - State management, events, lifecycle

## Phase 3: Implement Specification-Driven Tests

### 3.1 External Configuration Tests (`external-config.test.js`)
```javascript
test('HttpBehavior external configuration', async t => {
  await t.test('accepts actions object configuration', { 
    todo: 'Implement api property and _apiChanged observer' 
  }, async t => {
    const config = {
      env: 'development',
      actions: {
        auth: {
          login: function(credentials) {
            return this.fetch('bapi', '/user/login/email', {
              method: 'POST',
              body: credentials,
              skipAuth: true
            });
          }
        }
      },
      services: {
        bapi: {
          base: {
            development: 'http://localhost:5100/api'
          }
        }
      }
    };
    
    behavior.api = config;
    t.assert.ok(behavior.api);
    t.assert.strictEqual(typeof behavior.api, 'function');
  });
})
```

### 3.2 API Pattern Tests (`api-pattern.test.js`)
```javascript
test('API pattern usage', async t => {
  await t.test('provides api(this) function to components', {
    todo: 'Implement api function that returns bound actions'
  }, async t => {
    const component = createMockComponent();
    const api = behavior.service(component);
    
    t.assert.ok(api.auth);
    t.assert.ok(api.paper);
    t.assert.strictEqual(typeof api.auth.login, 'function');
  });
})
```

### 3.3 Service Multiplexing Tests
```javascript
test('service multiplexing', async t => {
  await t.test('fetch method selects service by name', {
    todo: 'Implement fetch(serviceName, path) method'
  }, async t => {
    const api = behavior.service(component);
    
    // Should use bapi service
    await api.fetch('bapi', '/user/papers');
    
    // Should use different service  
    await api.fetch('socket', '/connect');
  });
})
```

## Phase 4: Rewrite Existing Tests with New Pattern

### 4.1 API Pattern Conversion
**Before:**
```javascript
const service = behavior.service(component);
await service.auth.login(credentials);
```

**After:**
```javascript
await behavior.service(component).auth.login(credentials);
```

### 4.2 Mark Implementation Dependencies as TODO
All tests depending on hardcoded implementation get TODO markers:

```javascript
await t.test('user login updates behavior state', {
  todo: 'Requires external auth.login action implementation'
}, async t => {
  await behavior.service(component).auth.login({
    email: 'test@example.com',
    password: 'password'
  });
  
  t.assert.ok(behavior.loggedInUser);
});
```

## Phase 5: TODO Test Strategy

### 5.1 Implementation-Driven TODOs
Each TODO test represents a specific implementation requirement:

- `'Implement api property and _apiChanged observer'`
- `'Implement fetch(serviceName, path) method'`  
- `'Add external actions configuration support'`
- `'Implement method binding for cross-calling'`
- `'Add environment-based URL selection'`

### 5.2 Feature-Complete TODOs
Mark missing auth methods as TODOs:

```javascript
await t.test('user registers new account', {
  todo: 'Add register method to external auth actions'
}, async t => {
  await behavior.service(component).auth.register({
    email: 'new@example.com',
    password: 'password',
    name: 'New User'
  });
});
```

## Phase 6: Validation Strategy

### 6.1 Red-Green-Refactor Markers
- **Red**: Tests fail because external configuration not implemented
- **Green**: Implement features to make tests pass
- **Refactor**: Improve implementation with confidence

### 6.2 Progressive Implementation
1. Add `api` property and `_apiChanged` observer → Some tests pass
2. Implement `fetch(serviceName, path)` → More tests pass  
3. Add action binding → Cross-calling tests pass
4. Add missing auth methods → All auth tests pass

### 6.3 Test Coverage Goals
- **100% specification coverage** - Every spec feature has tests
- **0% hardcoded implementation** - No tests for current hardcoded code
- **Clear TODO markers** - Implementation requirements obvious
- **Logical test flow** - Foundation → Usage → Integration

## Success Criteria

✅ **All tests initially FAIL** (red) - Testing specification, not current implementation
✅ **Clear implementation path** - TODO tests show exactly what to build  
✅ **No contradictory features** - Parameter substitution removed entirely
✅ **Specification alignment** - Every test validates spec requirements
✅ **Agile workflow** - Can implement feature-by-feature guided by tests

This approach ensures the test suite becomes the **definitive specification** for the external configuration implementation, providing confidence and clear direction for the refactoring effort.

---

## 🔄 Implementation Results (CURRENT STATUS - HYBRID SYSTEM)

**External configuration system implemented alongside legacy system:**

### Phase Completion
- **Phase 1**: ✅ Contradictory tests removed and cleaned up
- **Phase 2**: ✅ Test organization restructured into logical domains
- **Phase 3**: ✅ External configuration tests implemented and passing
- **Phase 4**: ⚠️ Most existing tests still use legacy `_buildApi()` system
- **Phase 5**: ✅ TODO strategy partially executed - external config clear
- **Phase 6**: ⚠️ Tests validate hybrid system, not pure external configuration

### Key Achievements
1. **External Configuration**: Working `apiConfig` property with method binding and service multiplexing
2. **Method Binding**: Cross-calling between external actions working correctly
3. **Service Multiplexing**: `fetch(serviceName, path)` pattern implemented for external config
4. **Legacy Compatibility**: Maintains backward compatibility with `services` property
5. **Hybrid Architecture**: Both systems coexist (external config + 276 lines of hardcoded API methods)
6. **Test Coverage**: 60 tests total, 47 passing, 0 failing (most test legacy system)

### Architecture Reality
- **External Configuration**: Lines 145-220 in `_buildExternalApi()`
- **Legacy Hardcoded**: Lines 222-498 in `_buildApi()` with full domain implementations
- **Test Split**: ~10 tests for external config, ~37 tests for legacy system

### Remaining Work
- **Architectural Decision**: Choose between hybrid approach or pure external configuration
- **Test Migration**: Convert legacy tests to external configuration if desired
- **13 TODO tests**: Future enhancement features
- **Component Migration**: Integration into main Bitpaper app

**The HttpBehavior implementation provides working external configuration but maintains a dual-architecture approach.**
