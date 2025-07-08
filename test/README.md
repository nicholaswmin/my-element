# HttpBehavior Tests  

## Authentication Tests (auth.test/)

Complete authentication flow with concise, clear names:

- `session.test.js` - Session initialization on page load
- `login.test.js` - Login authentication and endpoints  
- `headers.test.js` - Authorization headers and BAPI compliance
- `refresh.test.js` - Token refresh and expiration handling
- `logout.test.js` - Logout and session cleanup
- `storage.test.js` - localStorage persistence and validation
- `integration.test.js` - Component integration and lifecycle

## UI Tests (ui.test/)

Component integration and state management:

- `ui.test/errors.test.js` - Error propagation through component hierarchy
- `ui.test/state.test.js` - Component state management and isolation
- `ui.test/lifecycle.test.js` - Component integration and lifecycle

## Error Tests (errors.test/)

Error handling and edge cases:

- `errors.test/auth.test.js` - AuthError class tests (logic-critical behavior)
- `errors.test/edges.test.js` - Edge cases and boundary scenarios

## Core Behavior Tests (core.test/)

Generic tests using terms like "resource", "item", "user":

- `core.test/behavior.test.js` - Core HTTP behavior and error handling
- `core.test/config.test.js` - External configuration (comprehensive API pattern tests)
- `core.test/routes.test.js` - URL building and service multiplexing
- `core.test/transform.test.js` - Service configuration transformer validation

## API Integration Tests (api.test/)

Use **exact Bitpaper terms** like "paper", "tags", "BAPI":

- `api.test/endpoints.test.js` - BAPI endpoint integration tests  

## Test Utilities

- `util/setup.js` - JSDOM setup, mock components, test environment
- `util/server/index.js` - Mock server with exact BAPI endpoints and new auth endpoints
- `util/services/bapi.js` - Standardized BAPI service configuration with complete auth suite  

## Service Configurations

All external configuration tests use standardized BAPI service configuration:

```javascript
import { bapiService } from './util/services/bapi.js'

// BAPI service for all external configuration tests
const config = bapiService(baseURL + '/api')
behavior.apiConfig = config
behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
```

**BAPI Service**: Complete Bitpaper API configuration with full auth suite (login, logout, register, resetPassword, verifyEmail, refresh), paper management with cross-calling logic, tags, preferences, assets, RTC tokens, and test endpoints for loading state verification.

## Running Tests  

```bash
npm test                    # Run all tests
node --test test/file.js    # Run specific file
```

## Test Guidelines  

- Write tests like specs: `await t.test('user logs in', ...)`  
- Group by behavior: `t.test('when token expires', ...)`  
- Use `t.assert.*` for assertions (e.g., `t.assert.strictEqual`)  
- Fresh JSDOM per file: `window.close()` in `t.after`  
- Minimal syntax: no semicolons or unnecessary braces  
- Generic concepts except in files listed above  
- Mark future work: `{ todo: 'implement X' }`  

## Current Test Status

**Test Results**: Comprehensive test coverage with all core functionality passing

**Implementation Status**: 🎉 **PRODUCTION READY**
- ✅ **External Configuration**: Complete system implemented via `bapiService()` helper
- ✅ **Authentication Suite**: Login, logout, session management, token refresh, storage
- ✅ **Service Multiplexing**: Environment-based URL selection and service routing
- ✅ **Component Integration**: Loading states, error handling, event firing, state isolation
- ✅ **Error Handling**: Complete AuthError system with BAPI integration
- ✅ **HTTP Layer**: Request/response handling, auth headers, token refresh automation

**Test Coverage by Category**:
- **Core Tests** (`core.test/`): Core HTTP behavior, external config, URL building, service transformation
- **Auth Tests** (`auth.test/`): Session, login, logout, headers, refresh, storage
- **UI Tests** (`ui.test/`): Component lifecycle, error propagation, state management
- **Error Tests** (`errors.test/`): AuthError class and HTTP error handling
- **API Tests** (`api.test/`): BAPI endpoint integration with real configurations

**Remaining TODOs (optional enhancements)**:
- 🔮 **Request Cancellation** - AbortController support for advanced use cases
- ⚠️ **Edge Case Handling** - Rapid requests, malformed responses, service availability
- 🎯 **Component Features** - Multiple component isolation, property binding, auth delegation
- 📊 **Future Features** - Registration endpoint, external configuration patterns

**Production Readiness**: All core functionality working with comprehensive test coverage. TODOs represent optional enhancements, not missing core features.  
