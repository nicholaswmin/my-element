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
- `util/server/index.js` - Mock server with exact BAPI endpoints
- `util/server/test/server.test.js` - Mock server validation tests
- `util/services/bapi.js` - Standardized BAPI service configuration
- `util/services/acme.js` - Generic service configuration for core tests  

## Service Configurations

All external configuration tests use standardized service configurations:

```javascript
import { bapiService } from './util/services/bapi.js'
import { acmeService } from './util/services/acme.js'

// Use BAPI service for Bitpaper-specific tests
const config = bapiService(baseURL + '/api')
behavior.api = config

// Use ACME service for generic core behavior tests  
const config = acmeService(baseURL + '/api')
behavior.api = config
```

**BAPI Service**: Complete Bitpaper API configuration with auth, paper, tags, preferences, assets, and RTC domains.

**ACME Service**: Minimal generic configuration with auth and resource domains for testing core HttpBehavior functionality.

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

- Tests marked with `{ todo: true }` track missing features  
