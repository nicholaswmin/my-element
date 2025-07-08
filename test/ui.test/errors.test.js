import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'
import { bapiService } from '../util/services/bapi.js'

import '../../http-behavior.js'

test('Error propagation through component hierarchy', async t => {
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

  await t.test('authentication errors propagate correctly', async t => {
    await t.test('403 forbidden error sets component state', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = { tokens: { access: server.createMalformedToken() } }

      await t.assert.rejects(
        () => behavior.api(component).tags.list(),
        error => error.status === 403
      )

      t.assert.strictEqual(component.loading, false, 'Should stop loading after error')
      t.assert.ok(component.lastError, 'Should set lastError')
      t.assert.strictEqual(component.lastError.status, 403, 'Should have correct status')
      t.assert.strictEqual(component.lastError.code, 'FORBIDDEN', 'Should have correct error code')

      // Check event firing
      const errorEvents = component.firedEvents.filter(e => e.name === 'error')
      t.assert.strictEqual(errorEvents.length, 1, 'Should fire one error event')
      t.assert.strictEqual(errorEvents[0].detail.error, component.lastError, 'Event should contain error')
    })

    await t.test('401 unauthorized error triggers token refresh flow', async t => {
      const component = createMockComponent()
      const expiredToken = server.createExpiredToken()
      behavior.loggedInUser = {
        tokens: { access: expiredToken, refresh: 'valid-refresh-token' }
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh-token' }
      }))

      // Should succeed due to auto-refresh, not propagate error
      const result = await behavior.api(component).tags.list()

      t.assert.strictEqual(component.loading, false, 'Should stop loading after success')
      t.assert.ok(component.lastResponse, 'Should set lastResponse after refresh')
      t.assert.ok(Array.isArray(result), 'Should return successful response')
      t.assert.strictEqual(component.lastError, null, 'Should clear any previous errors')
    })

    await t.test('missing refresh token propagates 401 error', async t => {
      const component = createMockComponent()
      const expiredToken = server.createExpiredToken()
      behavior.loggedInUser = { tokens: { access: expiredToken } } // No refresh token

      await t.assert.rejects(
        () => behavior.api(component).tags.list(),
        error => error.message.includes('No refresh token')
      )

      t.assert.ok(component.lastError, 'Should set lastError')
      t.assert.ok(component.lastError.message.includes('No refresh token'), 'Should have specific error message')
    })
  })

  await t.test('HTTP errors propagate with correct structure', async t => {
    await t.test('400 validation errors preserve BAPI error messages', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = {
        tokens: { access: server.createValidToken() }
      }

      await t.assert.rejects(
        () => behavior.api(component).auth.resetPassword('unknown@example.com'),
        error => error.message === 'unknown_user_email'
      )

      t.assert.ok(component.lastError, 'Should set lastError')
      t.assert.strictEqual(component.lastError.message, 'unknown_user_email', 'Should preserve BAPI error message')
      t.assert.strictEqual(component.lastError.status, 400, 'Should have correct status')
      t.assert.strictEqual(component.lastError.code, 'BAD_REQUEST', 'Should have correct error code')
    })

    await t.test('server errors are retryable', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = { tokens: { access: server.createValidToken() } }

      // Test with a non-existent endpoint that returns 404
      await t.assert.rejects(
        () => behavior.api(component).paper.get('nonexistent-paper'),
        error => error.status === 404
      )

      t.assert.ok(component.lastError, 'Should set lastError')
      t.assert.strictEqual(component.lastError.status, 404, 'Should have 404 status')
      t.assert.strictEqual(component.lastError.retry, false, '404 should not be retryable')
    })
  })

  await t.test('component isolation during errors', async t => {
    await t.test('errors in one component do not affect others', async t => {
      const comp1 = createMockComponent()
      const comp2 = createMockComponent()

      // Set up comp1 to fail (malformed token)
      behavior.loggedInUser = { tokens: { access: server.createMalformedToken() } }

      let comp1Error = null
      try {
        await behavior.api(comp1).tags.list()
      } catch (error) {
        comp1Error = error
      }

      // Change to valid token for comp2
      behavior.loggedInUser = { tokens: { access: server.createValidToken() } }
      const comp2Result = await behavior.api(comp2).tags.list()

      // Verify comp1 has error state
      t.assert.ok(comp1.lastError, 'Component 1 should have error')
      t.assert.strictEqual(comp1.lastError.status, 403, 'Component 1 should have 403 error')
      t.assert.strictEqual(comp1.loading, false, 'Component 1 should not be loading')

      // Verify comp2 has success state
      t.assert.ok(comp2.lastResponse, 'Component 2 should have response')
      t.assert.strictEqual(comp2.lastError, null, 'Component 2 should have no error')
      t.assert.strictEqual(comp2.loading, false, 'Component 2 should not be loading')
      t.assert.ok(Array.isArray(comp2Result), 'Component 2 should get successful result')
    })
  })

  await t.test('event propagation integrity', async t => {
    await t.test('error events contain complete error information', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = { tokens: { access: server.createMalformedToken() } }

      await t.assert.rejects(
        () => behavior.api(component).tags.list()
      )

      const errorEvents = component.firedEvents.filter(e => e.name === 'error')
      t.assert.strictEqual(errorEvents.length, 1, 'Should fire exactly one error event')

      const errorEvent = errorEvents[0]
      t.assert.ok(errorEvent.detail, 'Error event should have detail')
      t.assert.ok(errorEvent.detail.error, 'Error event detail should contain error')
      t.assert.strictEqual(errorEvent.detail.error, component.lastError, 'Event error should match component error')
      t.assert.ok(errorEvent.detail.error instanceof Error, 'Event error should be Error instance')
    })

    await t.test('loading state is properly managed during errors', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = { tokens: { access: server.createMalformedToken() } }

      const promise = behavior.api(component).tags.list()

      // Should be loading immediately
      t.assert.strictEqual(component.loading, true, 'Should be loading during request')
      t.assert.strictEqual(component.lastError, null, 'Should clear previous errors when starting')

      await t.assert.rejects(() => promise)

      // Should stop loading after error
      t.assert.strictEqual(component.loading, false, 'Should stop loading after error')
      t.assert.ok(component.lastError, 'Should set error after failure')
    })
  })
})