import test from 'node:test'
import { AuthError } from '../../errors/auth.js'

test('AuthError', async t => {
  await t.test('retry logic', async t => {
    t.assert.strictEqual(AuthError.Unauthorized().retry, true)
    t.assert.strictEqual(AuthError.Forbidden().retry, false)
    t.assert.strictEqual(AuthError.TokenRefreshFailed().retry, false)
  })

  await t.test('flow decisions', async t => {
    t.assert.strictEqual(AuthError.Unauthorized().shouldRefreshToken(), true)
    t.assert.strictEqual(AuthError.Forbidden().shouldRefreshToken(), false)
    t.assert.strictEqual(AuthError.TokenRefreshFailed().shouldRedirectToLogin(), true)
  })

  await t.test('status mapping', async t => {
    t.assert.strictEqual(AuthError.fromHTTP({ status: 401 }).code, 'UNAUTHORIZED')
    t.assert.strictEqual(AuthError.fromHTTP({ status: 403 }).code, 'FORBIDDEN')

    const error = AuthError.fromHTTP({ status: 401 }, { message: 'access_token_expired' })
    t.assert.strictEqual(error.code, 'SESSION_EXPIRED')
  })

  await t.test('token state detection', async t => {
    const error = AuthError.TokenRefreshFailed({ response: { message: 'refresh_token_expired' } })
    t.assert.strictEqual(error.state, 'expired')
  })

  await t.test('fallback behavior', async t => {
    const error500 = AuthError.fromHTTP({ status: 500 })
    t.assert.strictEqual(error500.code, 'SERVER_ERROR')
    t.assert.strictEqual(error500.retry, true) // 500 >= 500

    const error404 = AuthError.fromHTTP({ status: 404 })
    t.assert.strictEqual(error404.code, 'NOT_FOUND')
    t.assert.strictEqual(error404.retry, false) // 404 < 500

    const error400 = AuthError.fromHTTP({ status: 400 })
    t.assert.strictEqual(error400.code, 'BAD_REQUEST')
    t.assert.strictEqual(error400.retry, false)
  })
})