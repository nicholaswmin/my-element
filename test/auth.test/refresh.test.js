import test from 'node:test'
import jwt from 'jsonwebtoken'
import { createTestEnvironment, createBehaviorInstance } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'
import { bapiService } from '../util/services/bapi.js'

import '../../http-behavior.js'

test('Token refresh and expiration handling', async t => {
  let cleanup
  let server
  let behavior

  t.before(async () => {
    cleanup = createTestEnvironment()
    server = createTestServer()
    await server.start()
  })

  t.after(async () => {
    await server?.stop()
    cleanup?.()
  })

  t.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
    const config = bapiService(server.host + '/api')
    behavior.apiConfig = config
    behavior._apiConfigChanged(config)
  })

  await t.test('token expiration detection and refresh', async t => {
    await t.test('automatically refreshes expired tokens during requests', async t => {
      const expiredToken = server.createExpiredToken()
      behavior.loggedInUser = {
        tokens: { access: expiredToken, refresh: 'valid-refresh-token' }
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh-token' }
      }))

      const result = await behavior._http.request.call(behavior,
        `${server.host}/api/test`)

      // Should get fresh token after refresh and succeed
      t.assert.deepStrictEqual(result, { data: 'success' })
      t.assert.notStrictEqual(behavior.loggedInUser.tokens.access,
        expiredToken, 'Should have new token')
    })
  })

  await t.test('automatic refresh mechanism', async t => {
    await t.test('automatically refreshes using refresh token', async t => {
      const expiredToken = server.createExpiredToken()
      behavior.loggedInUser = {
        tokens: { access: expiredToken, refresh: 'valid-refresh-token' }
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh-token' }
      }))

      const result = await behavior._http.request.call(behavior,
        `${server.host}/api/test`)

      t.assert.deepStrictEqual(result, { data: 'success' })
      t.assert.ok(behavior.loggedInUser.tokens.access.startsWith('eyJ'),
        'Should be a JWT token')
    })

    await t.test('prevents concurrent refresh attempts', async t => {
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh-token' }
      }))
      server.clearRequests()

      const promises = [
        behavior._refreshToken(),
        behavior._refreshToken(),
        behavior._refreshToken()
      ]

      await Promise.all(promises)

      const refreshRequests = server.getRequests()
        .filter(r => r.method === 'POST' && r.url === '/api/user/refresh')
      t.assert.strictEqual(refreshRequests.length, 1)
    })

    await t.test('clears session on refresh failure', async t => {
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'expired-refresh-token' }
      }))

      await t.assert.rejects(
        () => behavior._refreshToken(),
        /Token refresh failed/
      )

      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'),
        null)
      t.assert.strictEqual(behavior.loggedInUser, null)
    })
  })

  await t.test('time-based expiration with mock timers', async t => {
    await t.test('token expires during request using mock time', async t => {
      // Enable mock timers for this test
      t.mock.timers.enable({ apis: ['Date'] })

      try {
        // Create token that expires in 5 minutes - we'll use createJWTToken directly
        const shortLivedToken = jwt.sign(
          { sub: 'test-user', iat: Math.floor(Date.now() / 1000) },
          'test-jwt-secret-key',
          { expiresIn: '5m', algorithm: 'HS256' }
        )
        behavior.loggedInUser = {
          tokens: { access: shortLivedToken, refresh: 'valid-refresh-token' }
        }
        window.localStorage.setItem('loggedInUser', JSON.stringify({
          tokens: { refresh: 'valid-refresh-token' }
        }))

        // Token should work initially
        let result = await behavior._http.request.call(behavior,
          `${server.host}/api/test`)
        t.assert.deepStrictEqual(result, { data: 'success' })
        t.assert.strictEqual(behavior.loggedInUser.tokens.access,
          shortLivedToken, 'Should keep original token')

        // Fast-forward time by 6 minutes (past expiration)
        t.mock.timers.tick(6 * 60 * 1000)

        // Now the token should be expired and auto-refresh
        result = await behavior._http.request.call(behavior,
          `${server.host}/api/test`)
        t.assert.deepStrictEqual(result, { data: 'success' })
        t.assert.notStrictEqual(behavior.loggedInUser.tokens.access,
          shortLivedToken, 'Should have refreshed token')
      } finally {
        t.mock.timers.reset()
      }
    })
  })

  await t.test('server-side refresh endpoint', async t => {
    await t.test('receives new access token', async t => {
      const response = await fetch(`${server.host}/api/user/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'valid-refresh-token' })
      })

      t.assert.strictEqual(response.status, 201)
      const user = await response.json()
      t.assert.ok(user.tokens.access.startsWith('eyJ'),
        'Should be a JWT token')
    })

    await t.test('receives updated user profile', async t => {
      const response = await fetch(`${server.host}/api/user/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'valid-refresh-token' })
      })

      const user = await response.json()
      t.assert.strictEqual(user.name, 'Test User')
      t.assert.strictEqual(user.subscription, null)
    })
  })
})