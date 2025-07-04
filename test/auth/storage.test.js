import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'

import '../../http-behavior.js'

test('Storage persistence and data handling', async t => {
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
  })

  await t.test('complete user object storage', async t => {
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

    await t.test('stores only essential user fields', async t => {
      const user = {
        id_user: '456',
        name: 'Test User',
        email: 'test@example.com',
        network: 'email',
        subscription: { 
          plan: 'pro', 
          billing_cycle: 'monthly',
          features: ['unlimited_papers', 'team_collaboration']
        },
        editor_preferences: { 
          theme: 'dark', 
          auto_save: true,
          shortcuts: { save: 'cmd+s', undo: 'cmd+z' }
        },
        tokens: { access: 'token', refresh: 'refresh' }
      }
      
      behavior._storeUser(user)
      
      const stored = behavior._getStoredUser()
      
      // Only essential fields are stored
      t.assert.strictEqual(stored.id_user, user.id_user)
      t.assert.strictEqual(stored.name, user.name)
      t.assert.strictEqual(stored.email, user.email)
      t.assert.strictEqual(stored.network, user.network)
      t.assert.deepStrictEqual(stored.tokens, user.tokens)
      
      // Complex fields are not stored
      t.assert.strictEqual(stored.subscription, undefined)
      t.assert.strictEqual(stored.editor_preferences, undefined)
    })
  })

  await t.test('data retrieval and validation', async t => {
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

    await t.test('handles empty localStorage gracefully', async t => {
      window.localStorage.removeItem('loggedInUser')
      
      const retrieved = behavior._getStoredUser()
      
      t.assert.deepStrictEqual(retrieved, {})
    })

    await t.test('handles corrupted data gracefully', async t => {
      window.localStorage.setItem('loggedInUser', 'not-json')
      
      const retrieved = behavior._getStoredUser()
      
      t.assert.deepStrictEqual(retrieved, {})
    })

    await t.test('handles malformed JSON gracefully', async t => {
      window.localStorage.setItem('loggedInUser', '{"incomplete": }')
      
      const retrieved = behavior._getStoredUser()
      
      t.assert.deepStrictEqual(retrieved, {})
    })
  })

  await t.test('storage cleanup operations', async t => {
    await t.test('clears storage completely', async t => {
      window.localStorage.setItem('loggedInUser', 
        JSON.stringify({ id: '123' }))
      behavior.loggedInUser = { id: '123' }
      
      behavior._clearStoredUser()
      
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.strictEqual(behavior.loggedInUser, null)
    })

    await t.test('clears storage when behavior state is null', async t => {
      window.localStorage.setItem('loggedInUser', 
        JSON.stringify({ id: '123' }))
      behavior.loggedInUser = null
      
      behavior._clearStoredUser()
      
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.strictEqual(behavior.loggedInUser, null)
    })

    await t.test('handles clearing already empty storage', async t => {
      window.localStorage.removeItem('loggedInUser')
      behavior.loggedInUser = null
      
      // Should not throw error
      behavior._clearStoredUser()
      
      t.assert.strictEqual(window.localStorage.getItem('loggedInUser'), null)
      t.assert.strictEqual(behavior.loggedInUser, null)
    })
  })

  await t.test('token storage security considerations', async t => {
    await t.test('stores tokens in expected format', async t => {
      const user = {
        id_user: '123',
        tokens: {
          access: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
          refresh: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
        }
      }
      
      behavior._storeUser(user)
      
      const stored = JSON.parse(window.localStorage.getItem('loggedInUser'))
      t.assert.ok(stored.tokens.access.startsWith('eyJ'), 
        'Access token should be JWT format')
      t.assert.strictEqual(stored.tokens.refresh.length, 32, 
        'Refresh token should be 32 chars')
    })

    await t.test('overwrites previous session data', async t => {
      // Store initial user
      const user1 = {
        id_user: '123',
        name: 'User One',
        tokens: { access: 'token1', refresh: 'refresh1' }
      }
      behavior._storeUser(user1)
      
      // Store different user
      const user2 = {
        id_user: '456',
        name: 'User Two',
        tokens: { access: 'token2', refresh: 'refresh2' }
      }
      behavior._storeUser(user2)
      
      const stored = JSON.parse(window.localStorage.getItem('loggedInUser'))
      t.assert.strictEqual(stored.id_user, '456')
      t.assert.strictEqual(stored.name, 'User Two')
      t.assert.strictEqual(stored.tokens.access, 'token2')
    })
  })
})