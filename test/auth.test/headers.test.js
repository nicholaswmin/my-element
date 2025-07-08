import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'
import { bapiService } from '../util/services/bapi.js'

import '../../http-behavior.js'

test('Authorization headers and token validation', async t => {
  let cleanup
  let server
  let baseURL
  let behavior

  t.before(async () => {
    server  = createTestServer()
    cleanup = createTestEnvironment()
    baseURL = await server.start()
  })

  t.after(async () => {
    await server?.stop()
    cleanup?.()
  })

  t.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
    const config = bapiService(baseURL + '/api')
    behavior.apiConfig = config
    behavior._apiConfigChanged(config)
  })

  await t.test('BAPI authorization compliance', async t => {
    await t.test('missing authorization header returns 403 forbidden', async t => {
      behavior.loggedInUser = null

      // BAPI spec: Missing Authorization Header → 403 Forbidden
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('malformed authorization header returns 403 forbidden', async t => {
      behavior.loggedInUser = { tokens: { access: 'not-a-bearer-token' } }

      // BAPI spec: Malformed Authorization Header → 403 Forbidden
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('expired access token triggers auto-refresh', async t => {
      const expiredToken = server.createExpiredToken()
      behavior.loggedInUser = {
        tokens: { access: expiredToken, refresh: 'valid-refresh-token' }
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh-token' }
      }))

      // HttpBehavior auto-refreshes expired tokens instead of returning 401
      const result = await behavior._http.request.call(behavior, `${baseURL}/api/test`)
      t.assert.deepStrictEqual(result, { data: 'success' })
      t.assert.notStrictEqual(
        behavior.loggedInUser.tokens.access,
        expiredToken,
        'Should have new token after auto-refresh'
      )
    })

    await t.test('expired access token with no refresh token returns 401', async t => {
      const expiredToken = server.createExpiredToken()
      behavior.loggedInUser = { tokens: { access: expiredToken } }

      // BAPI spec: Expired Access Token with no refresh → 401 Unauthorized
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/test`),
        error => error.message.includes('No refresh token')
      )
    })

    await t.test('invalid JWT token returns 403 forbidden', async t => {
      const malformedToken = server.createMalformedToken()
      behavior.loggedInUser = { tokens: { access: malformedToken } }

      // BAPI spec: Invalid/Malformed Token → 403 Forbidden
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('valid JWT token with Bearer prefix succeeds', async t => {
      const validToken = server.createValidToken()
      behavior.loggedInUser = { tokens: { access: validToken } }

      // BAPI spec: Valid Bearer token should succeed
      const result = await behavior._http.request.call(behavior, `${baseURL}/api/test`)
      t.assert.deepStrictEqual(result, { data: 'success' })
    })

    await t.test('skipAuth bypasses authorization entirely', async t => {
      const validToken = server.createValidToken()
      behavior.loggedInUser = { tokens: { access: validToken } }

      // Should succeed without auth header when skipAuth: true
      const result = await behavior._http.request.call(behavior, `${baseURL}/api/user/login/email`, {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
        skipAuth: true
      })

      t.assert.ok(result.id_user, 'Should succeed with skipAuth despite having token')
    })
  })

  await t.test('server-side endpoint validation', async t => {
    await t.test('rejects missing authorization header', async t => {
      const response = await fetch(`${baseURL}/api/test`)
      t.assert.strictEqual(response.status, 403)
    })

    await t.test('accepts valid bearer token', async t => {
      const validToken = server.createValidToken()
      const response = await fetch(`${baseURL}/api/test`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      })

      t.assert.strictEqual(response.status, 200)
      const data = await response.json()
      t.assert.deepStrictEqual(data, { data: 'success' })
    })

    await t.test('rejects expired access token', async t => {
      const response = await fetch(`${baseURL}/api/test`, {
        headers: { 'Authorization': 'Bearer old-token' }
      })

      t.assert.strictEqual(response.status, 401)
    })
  })
})
