import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'

import '../../http-behavior.js'

test('Session initialization on page load', async t => {
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
    t.assert.ok(behavior.loggedInUser.tokens.access.startsWith('eyJ'), 'Should be a JWT token')
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