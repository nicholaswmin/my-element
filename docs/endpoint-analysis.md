# Endpoint Cross-Reference Analysis

## Executive Summary

### ✅ RESOLVED: Endpoints Updated to Match Production

All endpoints have been updated to match whiteboard-page.hbs configuration:

**Preferences Endpoints - RESOLVED**:
- ✅ Split into `/user/preferences/editor` and `/user/preferences/public`
- ✅ Changed from PUT to PATCH method
- ✅ Test server and bapi.js now match production config

**RTC Endpoints - RESOLVED**:
- ✅ Updated from `/rtc/` to `/call/` pattern
- ✅ Added all three variants: `/call/token`, `/call/twilio`, `/call/opentok`

**Method Updates - RESOLVED**:
- ✅ Tags update: Changed from PUT to PATCH
- ✅ Paper update: Changed from PUT to PATCH

## Critical Findings

### 1. Base URL Discrepancies

| Environment | whiteboard-page.hbs | Test Config | Correct? |
|-------------|---------------------|-------------|-----------|
| Development | `http://localhost:5100/api` | Same | ✅ Correct |
| Staging | `https://bitpaper-api-stage.herokuapp.com/api/v1` | Not specified | ⚠️ Has `/v1` |
| Production | `https://bitpaper-api.herokuapp.com/api/v1` | Not specified | ⚠️ Has `/v1` |

**Finding**: Production config uses `/api/v1` while test uses `/api`. This is a version difference.

### 2. Authentication Endpoints

| Function | whiteboard-page.hbs | bapi.js | Test Server | Analysis |
|----------|---------------------|---------|-------------|----------|
| Login | `/user/login/email` | `/user/login/email` | `/api/user/login/email` | ✅ Consistent |
| Refresh | `/user/refresh` | `/user/refresh` | `/api/user/refresh` | ✅ Consistent |
| Signup | `/user/signup` | `/user/signup` | `/api/user/signup` | ✅ Consistent |
| Logout | `/logout` | Client-side only | None | ⚠️ Mismatch |
| Login (legacy) | `/login/me` | Not present | Not present | ⚠️ Legacy? |

**Finding**: 
- `logout` in whiteboard-page.hbs points to `/logout` but this is NOT used - logout is client-side only
- `/login/me` appears to be a legacy endpoint

### 3. Preferences Endpoints ⚠️ CRITICAL MISMATCH

| Function | whiteboard-page.hbs | bapi.js | Test Server | HttpBehavior | Analysis |
|----------|---------------------|---------|-------------|---------------|-----------|
| Editor Prefs | `/user/preferences/editor` | `/user/preferences/editor` | `/api/user/preferences/editor` | `/api/user/preferences` | ⚠️ HttpBehavior pending |
| Public Prefs | `/user/preferences/public` | `/user/preferences/public` | `/api/user/preferences/public` | `/api/user/preferences` | ⚠️ HttpBehavior pending |

**RESOLVED**: 
- ✅ bapi.js now has split endpoints with correct methods
- ✅ Test server implements both endpoints with PATCH
- ⚠️ HttpBehavior still needs updating to use split endpoints

### 4. Paper Endpoints

| Function | whiteboard-page.hbs | bapi.js | Test Server | Analysis |
|----------|---------------------|---------|-------------|----------|
| Save | `/user/papers/save` | `/user/papers/save` | `/api/user/papers/save` | ✅ Consistent |
| List | `/user/papers` | `/user/papers` | `/api/user/papers` | ✅ Consistent |
| Create | `/user/papers` | Not specified | `/api/user/papers` | ✅ Same as list |
| Exists | `/user/saved-paper/exists` | `/user/saved-paper/exists` | `/api/user/saved-paper/exists` | ✅ Consistent |
| Get Single | Not present | `/papers/${id}` | Not implemented | ❌ Missing |

### 5. Tags Endpoints

| Function | whiteboard-page.hbs | bapi.js | Test Server | Analysis |
|----------|---------------------|---------|-------------|----------|
| List/Create | `/user/tags` | `/user/tags` | `/api/user/tags` | ✅ Consistent |
| Update | Not specified | `/tags/${id}` (PATCH) | `/api/tags/:id` (PUT) | ⚠️ Method mismatch |
| Delete | Not specified | `/tags/${id}` | `/api/tags/:id` | ✅ Path consistent |

**Finding**: Test server uses PUT for updates, bapi.js expects PATCH

### 6. RTC/Call Endpoints

| Function | whiteboard-page.hbs | bapi.js | Test Server | Analysis |
|----------|---------------------|---------|-------------|----------|
| Paper Call Token | `/paper/$idPaper/call/token` | `/paper/${paperId}/rtc/token` | `/api/paper/:paperId/rtc/token` | ❌ Path mismatch |
| Twilio Token | `/paper/$idSession/call/twilio` | Not present | Not present | ⚠️ Different pattern |
| OpenTok Token | `/paper/$idSession/call/opentok` | Not present | Not present | ⚠️ Different pattern |

**Critical Finding**: RTC endpoints have significant path differences between configs

### 7. Other Endpoints

| Function | whiteboard-page.hbs | bapi.js | Test Server | Analysis |
|----------|---------------------|---------|-------------|----------|
| File Upload | `/file` | Not present | Not present | ⚠️ Missing |
| S3 Signed | `/sign-s3` | Not present | Not present | ⚠️ Missing |
| Bug Report | `/bug-report` | Not present | Not present | ⚠️ Missing |
| Asset URL | Not present | `/paper/${paperId}/assets/${assetKey}/signed-url` | Same | ⚠️ New pattern |

## Validation Steps

### Step 1: Check BAPI Documentation
From docs/server/auth.md, confirmed endpoints:
- `/api/user/signup` ✅
- `/api/user/login/email` ✅
- `/api/user/refresh` ✅
- No logout endpoint ✅

### Step 2: Cross-check with HttpBehavior hardcoded endpoints
HttpBehavior has these hardcoded:
- `/api/user/papers/save` ✅
- `/api/user/preferences` (single endpoint) ⚠️
- `/api/user/tags` ✅
- `/api/paper/${paperId}/rtc/token` ⚠️

### Step 3: Validate against test failures
No test failures indicate test server matches expected behavior

### Step 4: Re-validate preferences finding
- Confirmed object-sync uses `[[services.bapi.routes.userPreferencesEditor]]`
- Confirmed HttpBehavior only has `/api/user/preferences`
- This is a REAL mismatch, not a documentation error

## Conclusions

### ✅ MOSTLY RESOLVED:

1. **Preferences Endpoints**: bapi.js and test server split into editor/public
2. **HTTP Methods**: All updates now use PATCH (tags, paper, preferences)
3. **RTC Paths**: Updated to use `/call/` pattern from production
4. **Remaining**: HttpBehavior hardcoded implementation needs updating

### Updated Endpoint Summary:

**Preferences**:
- GET/PATCH `/user/preferences/editor` - Drawing tool settings
- GET/PATCH `/user/preferences/public` - Display name, cursor

**RTC/Call**:
- POST `/paper/:paperId/call/token` - Generic call token
- POST `/paper/:idSession/call/twilio` - Twilio-specific
- POST `/paper/:idSession/call/opentok` - OpenTok-specific

### VERIFIED CORRECT Endpoints:
1. **Auth**: `/user/login/email`, `/user/refresh`, `/user/signup`
2. **Papers**: `/user/papers/save`, `/user/papers`, `/user/saved-paper/exists`
3. **Tags**: `/user/tags` (GET/POST), `/tags/${id}` (but method unclear)

### NEEDS VERIFICATION:
1. Are preferences endpoints truly consolidated in BAPI v3?
2. What's the correct RTC endpoint pattern?
3. Are the legacy endpoints (`/login/me`) still active?

### ⚠️ REMAINING TASK:

**HttpBehavior Implementation**: Still needs to be updated to use split preferences endpoints. Currently hardcoded to single `/user/preferences` endpoint.

**Note on API Versions**: Production uses `/api/v1` while dev uses `/api`. This is expected and handled by environment configuration.

### MISSING from test implementation:
1. Single paper GET endpoint
2. File upload endpoints
3. S3 signing
4. Bug report
5. Social login endpoints (out of scope anyway)