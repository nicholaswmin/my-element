# HttpBehavior Tests  

## Generic Tests  

Stay relevant to bitpaper-relevant structures like URL structures,  
flows etc but **you must use generic** terms like "resource", "item", "user"  

- `http-behavior.test.js` - Core behavior: auth, token refresh, service API  
- `element.test.js` - Component state management and event firing  
- `routes.test.js` - URL building and parameter substitution  
- `server.test.js` - Mock server validation  
- `util/setup.js` - JSDOM setup, mock components, test environment  

## Bitpaper-specific Tests  

Use **exact Bitpaper terms** like "paper", "tags", "BAPI".  
Use exact structures like: "/api/user/papers/save".  

Domain accuracy is required, not just encouraged.  

- `bitpaper.test.js` - Bitpaper endpoint integration tests  
- `util/server/index.js` - Mock server with exact BAPI endpoints  

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
