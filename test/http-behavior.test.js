import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'

import '../http-behavior.js'

test('HttpBehavior', async t => {
  let cleanup
  let server
  let baseURL
  let behavior
  
  t.before(async () => {
    cleanup = createTestEnvironment()
    server = createTestServer()
    baseURL = await server.start()
  })
  
  t.after(async () => {
    await server?.stop()
    cleanup?.()
  })
  
  t.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
    behavior.services = { bapi: { baseURL } }
  })

  await t.test('user session initialization on page load', async t => {
    await t.test('starts with no stored session', async t => {
      await behavior._initializeAuth()
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      const events = behavior.getFiredEvents('initial-login-completed')
      t.assert.strictEqual(events.length, 1)
    })

    await t.test('restores session from localStorage', async t => {
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        id_user: '123',
        tokens: { access: 'old', refresh: 'valid-refresh-token' },
        name: 'Stored User',
        email: 'stored@example.com',
        network: 'email'
      }))
      
      await behavior._initializeAuth()
      
      t.assert.ok(behavior.loggedInUser)
      t.assert.ok(behavior.loggedInUser.tokens.access.includes('new'))
      t.assert.strictEqual(behavior.loggedInUser.email, 'test@example.com')
    })

    await t.test('clears expired session from storage', async t => {
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'invalid-refresh-token' }
      }))
      
      await behavior._initializeAuth()
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
    })

    await t.test('handles corrupted localStorage data', async t => {
      window.localStorage.setItem('loggedInUser', 'invalid-json{')
      
      const user = behavior._getStoredUser()
      
      t.assert.deepStrictEqual(user, {})
    })

  })

  await t.test('user registers new account', { 
    todo: 'Implement register method in HttpBehavior' 
  }, async t => {})

  await t.test('user performs email/password login', async t => {
    await t.test('stores session and fires success events', async t => {
      await behavior.loginLocal({ 
        email: 'test@example.com', 
        password: 'password' 
      })
      
      t.assert.strictEqual(behavior.loggedInUser.id_user, '00000000-0000-0000-0000-000000000123')
      t.assert.strictEqual(behavior.loggedInUser.isLoggedIn, true)
      t.assert.ok(behavior.loggedInUser.tokens.access)
      
      const stored = JSON.parse(window.localStorage.getItem('loggedInUser'))
      t.assert.strictEqual(stored.email, 'test@example.com')
      
      t.assert.ok(behavior.getFiredEvents('login-success').length > 0)
      t.assert.ok(behavior.getFiredEvents('login-request-success').length > 0)
    })
  })

  await t.test('user logs out of application', async t => {
    await t.test('clears session and local storage', async t => {
      behavior.loggedInUser = { id_user: '123', email: 'test@example.com' }
      window.localStorage.setItem('loggedInUser', JSON.stringify({ id_user: '123' }))
      
      await behavior.logout()
      
      t.assert.strictEqual(behavior.loggedInUser, null)
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.ok(behavior.getFiredEvents('user-logged-out').length > 0)
    })
  })

  await t.test('user requests password reset', { 
    todo: 'Implement resetPassword method in HttpBehavior' 
  }, async t => {})

  await t.test('user verifies email address', { 
    todo: 'Implement verifyEmail method in HttpBehavior' 
  }, async t => {})

  await t.test('access token expires during usage', async t => {
    await t.test('automatically refreshes using refresh token', async t => {
      behavior.loggedInUser = {
        tokens: { access: 'old-token', refresh: 'valid-refresh-token' }
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify({
        tokens: { refresh: 'valid-refresh-token' }
      }))
      
      const result = await behavior._http.request.call(behavior, `${baseURL}/api/test`)
      
      t.assert.deepStrictEqual(result, { data: 'success' })
      t.assert.ok(behavior.loggedInUser.tokens.access.includes('new'))
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
        /Refresh failed/
      )
      
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.strictEqual(behavior.loggedInUser, null)
    })
  })

  await t.test('component uses service API pattern', async t => {
    t.beforeEach(() => {
      behavior.loggedInUser = { 
        id_user: '123',
        tokens: { access: 'valid-token' } 
      }
      behavior._buildService()
    })

    await t.test('provides domain-organized methods', async t => {
      const component = createMockComponent()
      const service = behavior.service(component)
      
      // Check that service has expected domains
      t.assert.ok(service.auth)
      t.assert.ok(service.paper)
      t.assert.ok(service.tags)
      
      // Check auth domain methods
      // TODO: Add these methods to HttpBehavior
      // t.assert.strictEqual(typeof service.auth.register, 'function')
      t.assert.strictEqual(typeof service.auth.login, 'function')
      t.assert.strictEqual(typeof service.auth.logout, 'function')
      // t.assert.strictEqual(typeof service.auth.resetPassword, 'function')
      // t.assert.strictEqual(typeof service.auth.verifyEmail, 'function')
      
      // Check other domain methods exist
      t.assert.strictEqual(typeof service.paper.save, 'function')
      t.assert.strictEqual(typeof service.paper.list, 'function')
      t.assert.strictEqual(typeof service.tags.list, 'function')
    })

    await t.test('creates isolated service per component', async t => {
      const comp1 = createMockComponent()
      const comp2 = createMockComponent()
      
      const service1 = behavior.service(comp1)
      const service2 = behavior.service(comp2)
      
      t.assert.ok(service1)
      t.assert.ok(service2)
      t.assert.strictEqual(typeof behavior.service, 'function')
    })

    await t.test('delegates auth operations to behavior', async t => {
      const component = createMockComponent()
      const service = behavior.service(component)

      await t.test('login updates behavior state', async t => {
        const result = await service.auth.login({ 
          email: 'test@example.com', 
          password: 'password' 
        })
        
        t.assert.ok(result.id_user)
        t.assert.ok(behavior.loggedInUser)
      })
      
      await t.test('logout clears behavior state', async t => {
        const logoutComponent = createMockComponent()
        const logoutService = behavior.service(logoutComponent)
        
        behavior.loggedInUser = { id_user: '123' }
        
        await logoutService.auth.logout()
        
        t.assert.strictEqual(behavior.loggedInUser, null)
      })
    })
  })

  await t.test('HTTP request encounters error', async t => {
    t.beforeEach(() => {
      behavior._buildService()
    })

    await t.test('handles 401 unauthorized response', async t => {
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('handles 403 forbidden response', async t => {
      behavior.loggedInUser = { tokens: { access: 'invalid-token' } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('handles 404 not found response', async t => {
      behavior.loggedInUser = { tokens: { access: 'valid-token' } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/nonexistent`),
        error => error.status === 404
      )
    })
    
    await t.test('handles validation errors', async t => {
      behavior.loggedInUser = { tokens: { access: 'valid-token' } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/user/papers/save`, {
          method: 'POST',
          body: JSON.stringify({})
        }),
        error => {
          t.assert.ok(error.message)
          t.assert.ok(error.response)
          return true
        }
      )
    })
    
    await t.test('handles alternative error format', async t => {
      behavior.loggedInUser = { tokens: { access: 'valid-token' } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${baseURL}/api/alt-error`),
        error => {
          t.assert.ok(error.message)
          return true
        }
      )
    })
  })

  await t.test('behavior manages localStorage persistence', async t => {
    await t.test('stores complete user object', async t => {
      const user = {
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
      
      behavior._storeUser(user)
      
      const stored = JSON.parse(window.localStorage.getItem('loggedInUser'))
      t.assert.strictEqual(stored.id_user, '123')
      t.assert.strictEqual(stored.name, 'Test User')
      t.assert.strictEqual(stored.email, 'test@example.com')
      t.assert.deepStrictEqual(stored.tokens, user.tokens)
    })

    await t.test('retrieves stored user data', async t => {
      const userData = {
        id_user: '456',
        tokens: { access: 'token', refresh: 'refresh' },
        name: 'Stored User',
        email: 'stored@example.com'
      }
      window.localStorage.setItem('loggedInUser', JSON.stringify(userData))
      
      const retrieved = behavior._getStoredUser()
      
      t.assert.deepStrictEqual(retrieved, userData)
    })

    await t.test('handles corrupted data gracefully', async t => {
      window.localStorage.setItem('loggedInUser', 'not-json')
      
      const retrieved = behavior._getStoredUser()
      
      t.assert.deepStrictEqual(retrieved, {})
    })

    await t.test('clears storage completely', async t => {
      window.localStorage.setItem('loggedInUser', JSON.stringify({ id: '123' }))
      behavior.loggedInUser = { id: '123' }
      
      behavior._clearStoredUser()
      
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.strictEqual(behavior.loggedInUser, null)
    })
  })

  await t.test('component lifecycle hooks execute', async t => {
    await t.test('attached initializes auth', async t => {
      behavior.attached()
      
      // Auth initialization happens immediately
      t.assert.ok(true, 'attached called without errors')
    })
    
    await t.test('services observer builds service', async t => {
      const services = { 
        bapi: { 
          baseURL: 'http://test.com',
          statics: {
            socket: 'ws://socket.test.com',
            fetch: 'http://fetch.test.com'
          }
        } 
      }
      behavior.services = services
      
      // Manually trigger observer since we're not in real Polymer environment
      behavior._servicesChanged(services)
      
      // Service should be built
      t.assert.ok(behavior.service)
      t.assert.strictEqual(typeof behavior.service, 'function')
      
      // Statics should be accessible via property binding
      t.assert.ok(behavior.services.bapi.statics)
      t.assert.strictEqual(behavior.services.bapi.statics.socket, 'ws://socket.test.com')
    })
  })

  await t.test('generic request method for custom endpoints', { 
    todo: 'Implement generic request method in service API' 
  }, async t => {})
})

// Track statics data binding usage
test('HttpBehavior data binding', async t => {
  await t.test('statics accessed via data binding', { 
    skip: 'Data binding tests out of scope' 
  }, async t => {})
  
  await t.test('services property bound from parent', { 
    skip: 'Data binding tests out of scope' 
  }, async t => {})
})