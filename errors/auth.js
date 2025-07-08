/**
 * Authentication error classes
 * @author @nicholaswmin
 *
 * Usage:
 * ```js
 * const authError = AuthError.fromHTTP(response, httpError)
 *
 * if (authError.shouldRefreshToken())
 *   return await refreshToken()
 *
 * if (authError.shouldRedirectToLogin())
 *   return redirectToLogin()
 *
 * if (authError.isRetryable())
 *   return setTimeout(retry, 1000)
 * ```
 */

(function(global) {
  'use strict';

  // Auth error class
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

    static validateProps(options) {
      ['code', 'message']
        .filter(key => !options[key])
        .forEach(key => { throw new TypeError(`Missing ${key}`); });
    }

    static Unauthorized() {
      return new AuthError({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        status: 401,
        retry: true
      });
    }

    static Forbidden() {
      return new AuthError({
        code: 'FORBIDDEN',
        message: 'Forbidden',
        status: 403,
        retry: false
      });
    }

    static TokenRefreshFailed(error = null) {
      const authError = new AuthError({
        code: 'TOKEN_REFRESH_FAILED',
        message: AuthError.extractMessage(error) || 'Token refresh failed',
        status: (error && error.status) || 401,
        retry: false
      });
      authError.state = AuthError.extractTokenState(error);
      return authError;
    }

    static fromHTTP(response, error = null) {
      const { status } = response;
      const message = AuthError.extractMessage(error);

      // Handle specific BAPI error messages
      if (status === 401 && error && error.message === 'access_token_expired') {
        return new AuthError({
          code: 'SESSION_EXPIRED',
          message,
          status,
          retry: true
        });
      }

      // Handle by status code
      const config = AuthError.status[status];
      if (config) {
        return new AuthError({
          code: config.code,
          message: message || config.fallback,
          retry: config.retry,
          status
        });
      }

      // Default fallback
      let code, retry;
      if (status === 400) {
        code = 'BAD_REQUEST';
        retry = false;
      } else if (status === 404) {
        code = 'NOT_FOUND';
        retry = false;
      } else if (status >= 500) {
        code = 'SERVER_ERROR';
        retry = true;
      } else {
        code = 'HTTP_ERROR';
        retry = false;
      }

      return new AuthError({
        code,
        message: message || `HTTP ${status}`,
        status,
        retry
      });
    }

    isRetryable() {
      return this.retry;
    }

    shouldRefreshToken() {
      return AuthError.shouldRefreshTokenFor(this.code);
    }

    shouldRedirectToLogin() {
      return AuthError.shouldRedirectToLoginFor(this.code);
    }

    static shouldRefreshTokenFor(code) {
      return ['SESSION_EXPIRED', 'UNAUTHORIZED'].includes(code);
    }

    static shouldRedirectToLoginFor(code) {
      return code === 'TOKEN_REFRESH_FAILED';
    }

    static extractTokenState(error) {
      return error && error.response && error.response.message === 'refresh_token_expired'
        ? 'expired'
        : 'failed';
    }

    static extractMessage(error) {
      if (!error) return null;
      // BAPI uses 'errorMessage' field, fallback to standard 'message'
      return error.errorMessage || error.message || null;
    }

    static get status() {
      return {
        401: { code: 'UNAUTHORIZED', fallback: 'Unauthorized', retry: true },
        403: { code: 'FORBIDDEN', fallback: 'Forbidden', retry: false }
      };
    }
  }

  // Expose to global scope
  global.AuthError = AuthError;

})(typeof globalThis !== 'undefined' ? globalThis :
   typeof window !== 'undefined' ? window :
   typeof global !== 'undefined' ? global : this);

// Export for ESM compatibility (tests)
const AuthError = globalThis.AuthError;

export { AuthError };

