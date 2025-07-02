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

The behavior requires a `services` configuration object passed as a property:

```javascript
api: {
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

**❌ NOT IMPLEMENTED**: The specification describes external API configuration, but the current implementation has all endpoints hardcoded. See todo.md for implementation tasks.

Key points:
- Service must include `statics` object with URLs (socket, fetch, s3, etc)
- Statics are accessed via Polymer data binding: `[[services.serviceName.statics.socket]]` ✓
- Auth routes MUST be provided in configuration (currently hardcoded)
- Domain-specific methods (paper, tags, etc.) should be externally defined
- No reactive URL parameter substitution needed (build URLs at call time)

Tests use `bapi` by convention, but any service name would work.

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

❌ **Out of Scope**:
- Social login (Google/Facebook)
- Company login
- Guest user localStorage support
- Request cancellation (AbortController)
- Reactive URL parameter substitution (not needed per analysis)
- Iron-ajax auto-refetch patterns (none found in whiteboard)

✅ **Working Features**:
- Core authentication (login, logout, token refresh)
- Race condition prevention for token refresh
- Loading/error state management
- Event firing
- Statics implementation
- Property observers (no `this.async()`)
- 99 tests passing

❌ **Major Issues NOT Resolved**:
- **Service-name agnostic** - FALSE, all endpoints hardcoded
- **External configuration** - FALSE, no support for actions object
- **No hardcoded domains** - FALSE, all domains hardcoded in _buildService
- **API pattern** - Uses service(this) not api(this)
- **Missing auth methods** - register, resetPassword, verifyEmail

⚠️ **Pending**:
- Component migration from auth-ajax (10 components)
- Removal of legacy auth elements and pages

## Key Findings from Analysis

- Only 2 whiteboard elements use reactive auth observers (app-whiteboard, object-sync)
- No iron-ajax auto-refetch patterns in whiteboard elements
- BAPI design eliminates ~80% of URL parameter needs
- Simple JSON configuration sufficient - no reactive complexity needed
- ❌ Domain-specific methods are NOT externally defined - still hardcoded