import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'

import '../../http-behavior.js'

test('Logout and session cleanup', async t => {
  let cleanup
  let server
  let behavior
  
  t.before(async () => {
    cleanup = createTestEnvironment()
    server = createTestServer(); await server.start()
  }) 
  
  t.after(async () => {
    await server?.stop()
    cleanup?.()
  })
  
  t.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
    behavior.services = { bapi: { baseURL: server.host } }
    behavior._buildApi()
  })

  await t.test('logout through API pattern', async t => {
    t.todo('clears session and local storage', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = { id_user: '123', email: 'test@example.com' }
      window.localStorage.setItem('loggedInUser', 
        JSON.stringify({ id_user: '123' }))
      
      // SPECIFICATION PATTERN: api(this).auth.logout()
      await behavior.api(component).auth.logout()
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.ok(behavior.getFiredEvents('user-logged-out').length > 0)
    })
  })

  await t.test('session cleanup scenarios', async t => {
    await t.test('clears complete user session data', async t => {
      const fullUser = {
        isLoggedIn: true,
        id_user: '123',
        name: 'Test User',
        email: 'test@example.com',
        network: 'email',
        email_verified: true,
        subscription: { plan: 'pro' },
        parent_user_id: null,
        is_child: false,
        editor_preferences: { theme: 'dark' },
        public_preferences: { showEmail: false },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tokens: {
          access: 'access-token',
          refresh: 'refresh-token'
        }
      }

      behavior.loggedInUser = fullUser
      window.localStorage.setItem('loggedInUser', JSON.stringify(fullUser))
      
      behavior._clearStoredUser()
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
    })

    await t.test('handles logout from already cleared session', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = null
      window.localStorage.removeItem('loggedInUser')
      
      // Should not throw error when already logged out
      await t.assert.doesNotReject(
        () => behavior.api(component).auth.logout()
      )
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
    })

    await t.test('logout fires expected events', async t => {
      const component = createMockComponent()
      behavior.loggedInUser = { 
        id_user: '123', 
        email: 'test@example.com',
        tokens: { access: 'token', refresh: 'refresh' }
      }
      
      await behavior.api(component).auth.logout()
      
      const logoutEvents = behavior.getFiredEvents('user-logged-out')
      t.assert.ok(logoutEvents.length > 0, 'Should fire user-logged-out event')
    })
  })

  await t.test('logout during active session scenarios', async t => {
    await t.test('clears tokens during ongoing requests', async t => {
      behavior.loggedInUser = {
        id_user: '123',
        tokens: { access: server.createValidToken(), refresh: 'valid-refresh' }
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh' }
      }))

      const component = createMockComponent()
      
      // Start a logout while user is logged in
      await behavior.api(component).auth.logout()
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      
      // Subsequent authenticated requests should fail
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${server.host}/api/test`),
        error => error.status === 403,
        'Should reject requests after logout'
      )
    })
  })
})
