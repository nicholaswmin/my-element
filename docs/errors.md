# Error Handling Documentation

## Overview

The HttpBehavior error handling system uses a single, streamlined `AuthError` class that provides focused authentication error handling with seamless BAPI integration.

## Architecture

### AuthError (Single Error Class)

The `AuthError` class extends JavaScript's native `Error` and provides authentication-specific error handling with automatic BAPI message integration.

```javascript
class AuthError extends Error {
  constructor(options) {
    AuthError.validateProps(options);
    
    super(options.message);
    Object.assign(this, {
      name: this.constructor.name,
      type: 'auth',
      code: options.code,
      status: options.status,
      retry: options.retry || false
    });
  }
}
```

**Properties:**
- `name`: Automatically set to 'AuthError'
- `type`: Always 'auth' for authentication errors
- `code`: Machine-readable error code (e.g., 'UNAUTHORIZED', 'FORBIDDEN')
- `message`: Human-readable error message (prioritizes BAPI messages)
- `status`: HTTP status code
- `retry`: Boolean indicating if the operation can be retried

## Static Factory Methods

### Core Authentication Errors

**`AuthError.Unauthorized()`**
- Returns 401 error for invalid/expired tokens
- `retry: true` - can attempt token refresh
- Code: 'UNAUTHORIZED'

**`AuthError.Forbidden()`**
- Returns 403 error for access denied scenarios
- `retry: false` - no retry possible
- Code: 'FORBIDDEN'

**`AuthError.TokenRefreshFailed(error = null)`**
- Returns error for failed token refresh attempts
- Extracts BAPI error messages when available
- Detects token state: 'expired' vs 'failed'
- Code: 'TOKEN_REFRESH_FAILED'

### HTTP Response Integration

**`AuthError.fromHTTP(response, error = null)`**
- Creates errors from HTTP responses
- Prioritizes BAPI error messages via `extractMessage()`
- Maps specific BAPI patterns (e.g., `access_token_expired` → `SESSION_EXPIRED`)
- Handles status code mapping with fallbacks

## Flow Control Methods

### `isRetryable()`
Returns boolean indicating if request should be retried based on the `retry` property.

### `shouldRefreshToken()`
Returns true for errors that should trigger token refresh:
- `SESSION_EXPIRED` (from `access_token_expired` BAPI message)
- `UNAUTHORIZED` (general 401 responses)

### `shouldRedirectToLogin()`
Returns true for errors requiring login redirect:
- `TOKEN_REFRESH_FAILED` (refresh token issues)

## BAPI Integration

### Message Extraction

The `extractMessage()` static method provides seamless BAPI integration:

```javascript
static extractMessage(error) {
  if (!error) return null;
  // BAPI uses 'errorMessage' field, fallback to standard 'message'
  return error.errorMessage || error.message || null;
}
```

**BAPI Error Response Format:**
```json
{
  "status": "error",
  "errorMessage": "access_token_expired"
}
```

**NestJS Standard Format:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### Status Code Mapping

Predefined mappings for common authentication scenarios:

```javascript
static get status() {
  return {
    401: { code: 'UNAUTHORIZED', fallback: 'Unauthorized', retry: true },
    403: { code: 'FORBIDDEN', fallback: 'Forbidden', retry: false }
  };
}
```

Additional status codes (400, 404, 5xx) are handled with fallback logic.

## Error Response Format

```javascript
{
  name: 'AuthError',              // Auto from constructor.name
  type: 'auth',                   // Always 'auth'
  code: 'UNAUTHORIZED',           // Machine-readable
  message: 'Unauthorized',        // Human-readable (or BAPI message)
  status: 401,                    // HTTP status
  retry: true,                    // Retry indicator
  state: 'expired'                // Additional context (for refresh errors)
}
```

## Usage Examples

### Basic Error Creation

```javascript
// Factory methods
const unauthorized = AuthError.Unauthorized();
const forbidden = AuthError.Forbidden();

// From HTTP response with BAPI integration
const error = AuthError.fromHTTP(
  { status: 401 }, 
  { errorMessage: 'access_token_expired' }
);
```

### Error Flow Control

```javascript
try {
  await api.fetchData();
} catch (error) {
  if (error.shouldRefreshToken()) {
    await refreshToken();
    return retry();
  } else if (error.shouldRedirectToLogin()) {
    redirectToLogin();
  } else if (error.isRetryable()) {
    setTimeout(retry, 1000);
  }
}
```

### Token State Detection

```javascript
const error = AuthError.TokenRefreshFailed({
  response: { errorMessage: 'refresh_token_expired' }
});

console.log(error.state);   // 'expired'
console.log(error.message); // 'refresh_token_expired' (from BAPI)
```

## Validation

The constructor validates required properties using a functional approach:

```javascript
static validateProps(options) {
  ['code', 'message']
    .filter(key => !options[key])
    .forEach(key => { throw new TypeError(`Missing ${key}`); });
}
```

## Testing Strategy

Error tests focus on logic-critical behavior:
- **Retry logic**: Testing `isRetryable()` method
- **Flow decisions**: Testing `shouldRefreshToken()` and `shouldRedirectToLogin()`
- **Status mapping**: HTTP status code to error code mapping
- **Token state detection**: Extracting token state from BAPI responses
- **Fallback behavior**: Default error handling when BAPI messages unavailable

## Design Principles

1. **Single Responsibility**: One error class for all authentication scenarios
2. **BAPI Integration**: Seamless message passthrough from backend
3. **Automatic Detection**: Constructor name assignment, no hardcoded strings
4. **Machine/Human Separation**: Clear distinction between codes and messages
5. **Minimal Surface Area**: Only essential properties and methods
6. **Functional Validation**: Clean property validation using array methods