# Implementation Status and TODOs

This document tracks implementation status, remaining issues, test coverage gaps, and pending removals.

## Background

HttpBehavior replaces the problematic auth-ajax and logged-in-user components that were causing race conditions due to duplicate token refresh implementations. The SPECIFICATION describes a contextual service pattern (`this.api(this).domain.method()`) with external configuration, but the CURRENT IMPLEMENTATION uses `this.service(this)` with hardcoded endpoints.

## Current Implementation Status

### ⚠️ Out of Scope
- Social login (Google/Facebook)
- Company login from URL parameters
- Guest user localStorage support
- Request cancellation (AbortController)
- Server logout endpoint (logout is client-side only)

### ✅ Actually Completed
- [x] Core JWT authentication (login, token refresh)
- [x] Race condition prevention for token refresh
- [x] Automatic auth headers and 401 retry logic
- [x] Backward-compatible localStorage format
- [x] Property observers (no `this.async()`)
- [x] Basic test suite (99 tests passing)
- [x] Loading/error state management on components
- [x] Event firing (`response`, `error`, domain-specific)

### ❌ Not Implemented (Despite Documentation Claims)
- [ ] Service-name agnostic architecture - ALL endpoints are hardcoded
- [ ] External API configuration - No support for `actions` object
- [ ] API configuration pattern - Uses `service(this)` not `api(this)`
- [ ] Service multiplexing - No `fetch('serviceName', path)` method
- [ ] Environment-based URL selection - No `env` property support
- [ ] Method binding - Actions can't call each other via `this`
- [ ] The `api` property - Only `service` property exists
- [ ] The `_apiChanged` observer - Not implemented

## Implementation Tasks (Priority Order)

### Phase 1: Add External Configuration Support
- [ ] Add `api` property to HttpBehavior properties
- [ ] Implement `_apiChanged` observer method
- [ ] Add support for `actions` configuration object
- [ ] Implement the documented `fetch(serviceName, path)` method
- [ ] Add environment-based URL selection via `env` property
- [ ] Implement method binding so actions can call each other
- [ ] Make `api(this)` return the configured actions + fetch method
- [ ] Keep `service` as alias for backward compatibility

### Phase 2: Remove Hardcoded Implementation
- [ ] Remove all hardcoded endpoints from `_buildService()`
- [ ] Remove hardcoded auth methods (use config instead)
- [ ] Remove hardcoded paper domain methods
- [ ] Remove hardcoded tags domain methods
- [ ] Remove hardcoded preferences domain methods
- [ ] Remove hardcoded assets domain methods
- [ ] Remove hardcoded rtc domain methods

### Phase 3: Add Missing Auth Methods
- [ ] Add `register()` to auth configuration
- [ ] Add `resetPassword()` to auth configuration
- [ ] Add `verifyEmail()` to auth configuration

### Phase 4: Update Tests
- [ ] Update http-behavior.test.js to use acmeService config
- [ ] Update bitpaper.test.js to use bapiService config
- [ ] Test the new configuration system
- [ ] Test service multiplexing
- [ ] Test method binding
- [ ] Remove tests for hardcoded behavior

## Remaining Issues

### Test Coverage Gaps

**Issue**: Some implemented features lack test coverage.

**Untested Features**:
- RTC domain methods (`generateToken()`) - TODO test exists
- Preferences domain `update()` method - `get()` is tested
- `checkExists()` method in paper domain - TODO test exists

**Configuration Items** (not code issues):
- Auth domain `register()` method - can be added to API configuration
- Auth domain `resetPassword()` method - can be added to API configuration
- Auth domain `verifyEmail()` method - can be added to API configuration

**Note**: These auth methods are now configurable via the external API configuration object. They don't require HttpBehavior changes, just configuration updates.

**Note**: URL path parameter substitution is fully tested in routes.test.js

**Impact**: These features may have bugs that aren't caught by tests.

**Recommendation**: Either add comprehensive tests or remove these features if they're not actively used.

### TODO Tests

The test suite has several TODO items that indicate incomplete functionality:
- Asset upload with S3 signed URLs
- Paper deletion endpoint
- Tag update/delete operations
- OpenTok/Twilio token generation
- Paper exists by URL check
- Event detail objects
- Concurrent request handling
- AbortController support
- Route template caching
- Parameter validation
- Dynamic route resolution

These represent features that are either partially implemented or planned but not yet built.

## Major Removals Pending

This section tracks all elements, pages, and routes that need to be removed as part of the HttpBehavior migration.

### Auth Elements to Remove
- [ ] `/app/elements/auth-form/custom-elements/utils/auth-ajax/` (entire directory)
- [ ] `/app/elements/auth-form/custom-elements/utils/logged-in-user/` (entire directory)

### Subscription Elements to Remove
- [ ] `/app/elements/auth-form/custom-elements/subscription/subscription-page.html`
- [ ] `/app/elements/auth-form/custom-elements/subscription/flows/` (entire directory)

### Account Management Elements to Remove
- [ ] `/app/elements/auth-form/custom-elements/account/` (entire directory)

### Enterprise User Management to Remove
- [ ] `/app/elements/auth-form/custom-elements/ee-user-management/` (entire directory)

### Pages to Remove
- [ ] `/app/views/pages/account-page/` (entire directory)
- [ ] `/app/views/pages/account-deleted-page/` (entire directory)
- [ ] `/app/views/pages/my-papers-page/` (entire directory)
- [ ] `/app/views/pages/pricing-page/` (entire directory)
- [ ] `/app/views/pages/new-pricing-page/` (entire directory)

### Server Routes to Remove
- [ ] `/my-papers` route in server/app.js
- [ ] `/pricing` route in server/app.js
- [ ] `/account` route in server/app.js
- [ ] `/account/deleted` route in server/app.js
- [ ] `/new-pricing` route in server/app.js

### Navigation Links to Remove
- [ ] Pricing link in nav-bar.html
- [ ] Papers link in nav-bar.html
- [ ] Account link in nav-bar.html
- [ ] My Papers link in app-menu.html
- [ ] Account link in app-menu.html

### Prerequisites Before Removal
- [ ] Migrate all components using auth-ajax to HttpBehavior
- [ ] Ensure no broken imports after removal
- [ ] Test whiteboard flow thoroughly after removals

## Integration Notes
- [ ] Update PointerRouter: 'logged-in-user-set' → 'logged-in-user-changed'
- [ ] All child components must receive `api` and `loggedInUser` properties

## Migration Pattern

When migrating components from auth-ajax:

```javascript
// Before:
<auth-ajax
  url="[[saveUrl]]"
  method="POST"
  body="[[data]]"
  loading="{{loading}}"
  last-error="{{lastError}}"
  on-response="_handleSave">
</auth-ajax>

// After:
// No template change needed, just implement method:
_savePaper: function() {
  this.api(this).paper.save(this.data);
}
```

## Testing Checklist

- [ ] Login with email/password
- [ ] Logout
- [ ] Refresh page - stay logged in
- [ ] Let token expire - auto refresh
- [ ] Save paper
- [ ] Create tag
- [ ] Upload asset
- [ ] All modals work
- [ ] Video calls authenticate