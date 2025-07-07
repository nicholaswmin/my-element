# HttpBehavior Tests  

## Authentication Tests (auth/)

Complete authentication flow with concise, clear names:

- `session.test.js` - Session initialization on page load
- `login.test.js` - Login authentication and endpoints  
- `headers.test.js` - Authorization headers and BAPI compliance
- `refresh.test.js` - Token refresh and expiration handling
- `logout.test.js` - Logout and session cleanup
- `storage.test.js` - localStorage persistence and validation
- `integration.test.js` - Component integration and lifecycle

## Core Behavior Tests

Generic tests using terms like "resource", "item", "user":

- `http-behavior.test.js` - Core HTTP behavior and error handling
- `element.test.js` - Component state management and isolation  
- `edges.test.js` - Edge cases and boundary scenarios
- `config.test.js` - External configuration (comprehensive API pattern tests)
- `routes.test.js` - URL building and service multiplexing
- `server.test.js` - Mock server validation  

## Bitpaper Integration Tests

Use **exact Bitpaper terms** like "paper", "tags", "BAPI":

- `bitpaper.test.js` - BAPI endpoint integration tests  

## Test Utilities

- `util/setup.js` - JSDOM setup, mock components, test environment
- `util/server/index.js` - Mock server with exact BAPI endpoints and new auth endpoints
- `util/server/test/server.test.js` - Mock server validation tests
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

## Notes  

- Tests marked with `{ todo: true }` track future enhancement features
- External configuration functionality is implemented and tested
- Legacy hardcoded system maintains backward compatibility
- Most tests validate the legacy system via `_buildApi()` 
- External configuration tests are in `config.test.js`  
