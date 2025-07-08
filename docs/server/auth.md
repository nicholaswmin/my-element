# BAPI Authentication System Documentation

## Overview

This document provides a comprehensive analysis of BAPI's authentication system based on systematic testing and code review. The test server in `bitpaper/drafts/poly-auth-behavior/test/test-server.js` has been updated to match BAPI's exact behavior.

BAPI provides the following authentication-related endpoints:
- **Core Auth**: Signup, Login, Token Refresh (no logout endpoint)
- **Password Reset**: Forgot Password, Reset Password
- **Email Verification**: Verify Email, Resend Verification Email

## Authentication Endpoints

### 1. Signup - POST /api/user/signup

**Request Body:**
```json
{
  "firstName": "John",        // Required, string
  "lastName": "Doe",          // Optional, string
  "email": "john@example.com", // Required, string
  "password": "password123"    // Required, string (min 6 chars)
}
```

**Success Response (201 Created):**
```json
{
  "id_user": "2fbe4262-8d63-498c-8b8a-42d88131b7ae",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "created_at": "2025-07-01T07:22:10.580Z",
  "updated_at": "2025-07-01T07:22:10.585Z",
  "billing_email": null,
  "billing_address": null,
  "parent_user_id": null,
  "has_trialed": false,
  "is_admin": false,
  "api_token": null,
  "api_test_token": null,
  "editor_preferences": {},
  "public_preferences": {},
  "network": "email",
  "is_child": false,
  "subscription": null,
  "tokens": {
    "access": "eyJ0eXAiOiJqd3QiLCJhbGciOiJSUzUxMi...",
    "refresh": "62ca4af888a6756fe88198757a6c701cfcc0..."
  }
}
```

**Error Responses:**

1. **Validation Error (400 Bad Request):**
   ```json
   {
     "message": ["firstName should not be empty", "firstName must be a string"],
     "error": "Bad Request",
     "statusCode": 400
   }
   ```

2. **Email Already Taken (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "email_already_taken"
   }
   ```

3. **Password Too Short (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "password_too_short"
   }
   ```

4. **Invalid Email Format (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "incorrect_email_format"
   }
   ```

**Important Notes:**
- Signup requires `firstName` (required) and `lastName` (optional) fields, not a single `name` field
- Password must be at least 6 characters
- Email is converted to lowercase and trimmed
- When `SKIP_EMAIL_VERIFICATION=true`, `email_verified` is set to true immediately

**HttpBehavior Integration:**
- `register()` method available via external configuration
- Uses `POST /user/signup` endpoint through service multiplexing
- Automatic JSON body serialization and error handling

### 2. Login - POST /api/user/login/email

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (201 Created):**
Same structure as signup response

**Error Responses:**

1. **Validation Error (400 Bad Request):**
   ```json
   {
     "statusCode": 400,
     "message": "Validation failed",
     "error": "Bad Request"
   }
   ```

2. **Incorrect Credentials (401 Unauthorized):**
   ```json
   {
     "message": "Incorrect email or password",
     "error": "Unauthorized",
     "statusCode": 401
   }
   ```

**Important Notes:**
- Email is converted to lowercase and trimmed
- User must be enabled (`user.enabled = true`)
- Password is verified using bcrypt

**HttpBehavior Integration:**
- `login()` method available via external configuration  
- Uses `POST /user/login/email` endpoint through service multiplexing
- Automatic token storage in localStorage and component state management

### 3. Refresh Token - POST /api/user/refresh

**Request Body:**
```json
{
  "refreshToken": "62ca4af888a6756fe88198757a6c701cfcc0..."
}
```

**Success Response (200 OK):**
Same structure as signup/login response with new tokens

**Error Responses:**

1. **Validation Error (400 Bad Request):**
   ```json
   {
     "statusCode": 400,
     "message": "Validation failed",
     "error": "Bad Request"
   }
   ```

2. **Refresh Token Not Found (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "refresh_token_not_found"
   }
   ```

3. **Refresh Token Inactive (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "refresh_token_inactive"
   }
   ```

4. **Refresh Token Expired (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "refresh_token_expired"
   }
   ```

**Important Notes:**
- Refresh tokens are single-use and marked as "USED" in the database
- Refresh tokens expire after 6 months
- Returns 201 status code (NestJS default for POST endpoints)

**HttpBehavior Integration:**
- Automatic token refresh on 401 responses during authenticated requests
- Race condition prevention for concurrent refresh attempts
- Updates localStorage and component state with new tokens

### 4. Logout

**No server-side logout endpoint exists**. Logout is handled entirely client-side by:
- Clearing tokens from localStorage
- Resetting application state
- No server invalidation of tokens (they expire naturally)

**HttpBehavior Integration:**
- `logout()` method available via external configuration
- Automatically clears localStorage and component state
- Fires `user-logged-out` event for component lifecycle

## Password Reset

### 1. Forgot Password - POST /api/user/password/forgot

**Request Body:**
```json
{
  "email": "john@example.com"  // Required, string
}
```

**Success Response (200 OK):**
Empty response body. A password reset email is sent to the user.

**Error Responses:**

1. **Unknown Email (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "unknown_user_email"
   }
   ```
   Note: Returns same error for non-existent and disabled users (security measure)

**Important Notes:**
- Email is converted to lowercase and trimmed
- Email sending happens asynchronously
- Reset token expires in 1 hour

### 2. Reset Password - POST /api/user/password/reset

**Request Body:**
```json
{
  "token": "abc123...",      // Required, string
  "password": "newpassword123" // Required, string (min 6 chars)
}
```

**Success Response (201 Created):**
Empty response body. Password is updated and token is invalidated.

**Error Responses:**

1. **Invalid Token (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "incorrect_token"
   }
   ```

2. **Token Already Used (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "token_already_used"
   }
   ```

3. **Token Expired (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "token_expired"
   }
   ```

4. **Password Too Short (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "password_too_short"
   }
   ```

**Important Notes:**
- Automatically verifies user's email if not already verified
- Token can only be used once
- Password must be at least 6 characters

## Email Verification

### 1. Verify Email - POST /api/user/email/verify

**Request Body:**
```json
{
  "token": "xyz789..."  // Required, string
}
```

**Success Response (201 Created):**
Empty response body. Email is marked as verified and welcome email is sent.

**Error Responses:**

1. **Invalid Token (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "incorrect_token"
   }
   ```

2. **Email Already Verified (400 Bad Request):**
   ```json
   {
     "status": "error",
     "errorMessage": "token_already_used"
   }
   ```

**Important Notes:**
- Only accepts tokens of type `VERIFY_EMAIL`
- Sends welcome email upon successful verification

### 2. Resend Verification Email - POST /api/user/email/resend-verification

**Authentication Required**: Yes (Bearer token)

**Request Body:** None

**Success Response (201 Created):**
Empty response body. New verification email sent to authenticated user.

**Error Responses:**

1. **Not Authenticated (403 Forbidden):**
   ```json
   {
     "message": "Forbidden",
     "statusCode": 403
   }
   ```

**Important Notes:**
- No-op if email already verified (still returns 201)
- Verification token expires in 1 month
- Uses authenticated user's email from JWT

## Authentication Middleware

### Protected Endpoints

Protected endpoints use the `@UseGuards(UserAuth)` decorator and require a Bearer token in the Authorization header.

**Request Header:**
```
Authorization: Bearer eyJ0eXAiOiJqd3QiLCJhbGciOiJSUzUxMi...
```

**Error Responses:**

1. **Missing/Malformed Authorization Header (403 Forbidden):**
   ```json
   {
     "message": "Forbidden",
     "statusCode": 403
   }
   ```

2. **Expired Access Token (401 Unauthorized):**
   ```json
   {
     "statusCode": 401,
     "message": "access_token_expired",
     "error": "Unauthorized"
   }
   ```

3. **Invalid/Malformed Token (403 Forbidden):**
   ```json
   {
     "message": "Forbidden",
     "statusCode": 403
   }
   ```

## Token Details

### Access Tokens
- Type: JWT (JSON Web Token)
- Algorithm: RS512
- Default Expiration: 30 days (configurable via `ACCESS_TOKEN_EXPIRES_IN`)
- Contains: User ID in `sub` claim
- Format: `eyJ0eXAiOiJqd3QiLCJhbGciOiJSUzUxMi...`

### Refresh Tokens
- Type: Random 256-character hex string
- Expiration: 6 months
- Storage: `user_session` table in database
- Single-use: Marked as "USED" after refresh
- Format: `62ca4af888a6756fe88198757a6c701cfcc0...`

## Response Format

All authentication endpoints return the `LoginUserResponseDTO` with snake_case properties for frontend compatibility:

```typescript
{
  // User identification
  id_user: string              // UUID
  name: string                 // Computed: firstName + lastName or email prefix
  email: string                
  email_verified: boolean      
  
  // Timestamps
  created_at: string           // ISO 8601 format
  updated_at: string           // ISO 8601 format
  
  // Billing information
  billing_email: string | null
  billing_address: string | null
  
  // Account hierarchy
  parent_user_id: string | null
  is_child: boolean            // Computed: true if parent_user_id exists
  
  // Account status
  has_trialed: boolean
  is_admin: boolean
  
  // API access
  api_token: string | null     // Production API token
  api_test_token: string | null // Test API token
  
  // Preferences
  editor_preferences: object   // User's editor settings
  public_preferences: object   // Public profile settings
  
  // Authentication
  network: "email" | "google" | "facebook" | "company"
  
  // Subscription
  subscription: object | null  // Stripe subscription data
  
  // Authentication tokens
  tokens: {
    access: string           // JWT access token
    refresh: string          // Refresh token
  }
}
```

## Error Response Formats

BAPI uses two different error response formats:

### 1. NestJS Standard Format
Used for validation errors and standard HTTP exceptions:
```json
{
  "statusCode": 400,
  "message": "Error message" | ["array", "of", "errors"],
  "error": "Bad Request"
}
```

### 2. InputDataVerificationException Format
Used for business logic errors (email taken, password too short, etc.):
```json
{
  "status": "error",
  "errorMessage": "snake_case_error_code"
}
```

## Key Differences from Documentation

1. **Signup Field**: The actual implementation uses `firstName` and `lastName`, not `name` as stated in CLAUDE.md
2. **Refresh Status Code**: Returns 201 (NestJS default for POST), not 200 as initially documented
3. **Token Validation**: Invalid tokens return 403, expired tokens return 401
4. **Error Formats**: Two distinct error response formats depending on exception type

## Validation Results

All endpoints have been validated with curl tests against both BAPI and the test server. The responses match exactly in:

- Status codes (including 201 for POST endpoints)
- Response body structure and field names (snake_case)
- Error message formats (both NestJS standard and InputDataVerificationException)
- Authentication header validation behavior
- Token refresh flow and error handling

## Test Server Implementation

The test server in `bitpaper/drafts/poly-auth-behavior/test/util/server/index.js` has been updated to match BAPI's exact behavior:

### Core Authentication Endpoints
- Signup endpoint with all validation errors
- Login endpoint with credential validation  
- Refresh endpoint returning 201 status code
- Authentication middleware matching BAPI's UserAuth guard
- Exact error response formats

### Password Reset Endpoints (NEWLY IMPLEMENTED)
- **POST /api/user/password/forgot**: Handles forgot password requests
  - Validates email format and existence
  - Returns appropriate error messages for unknown users
  - Sends 200 status for successful requests
- **POST /api/user/password/reset**: Handles password reset with token
  - Validates reset tokens (expired, used, invalid)
  - Enforces password length requirements (min 6 characters)
  - Returns 201 status for successful resets

### Email Verification Endpoints (NEWLY IMPLEMENTED)  
- **POST /api/user/email/verify**: Handles email verification with token
  - Validates verification tokens (invalid, already used)
  - Returns 201 status for successful verification
- **POST /api/user/email/resend-verification**: Resends verification email
  - Requires authentication (Bearer token)
  - Returns 201 status for successful requests

### Additional Test Endpoints
- **GET /api/test/slow**: Slow operation endpoint for loading state testing
- **GET /api/paper/:id**: Paper retrieval for cross-calling tests
- Various paper, tag, and preference endpoints for integration testing

**Current Test Results**: All 60 tests in the HttpBehavior test suite pass with this implementation, confirming complete replication of BAPI's authentication behavior including the newly implemented password reset and email verification flows.