import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'

import '../../http-behavior.js'

test('Login and Authentication', async t => {
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
    behavior._buildService()
  })

  await t.test('client-side login through API pattern', async t => {
    await t.todo('stores session and fires success events', async t => {
      const component = createMockComponent()
      
      // SPECIFICATION PATTERN: api(this).auth.login()
      await behavior.service(component).auth.login({ 
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

  await t.test('server-side authentication endpoint', async t => {
    await t.test('receives JWT tokens on success', async t => {
      const response = await fetch(`${server.host}/api/user/login/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'password' 
        })
      })
      
      t.assert.strictEqual(response.status, 201)
      const user = await response.json()
      t.assert.ok(user.tokens)
      t.assert.ok(user.tokens.access)
      t.assert.ok(user.tokens.refresh)
    })
    
    await t.test('receives user profile data', async t => {
      const response = await fetch(`${server.host}/api/user/login/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'password' 
        })
      })
      
      const user = await response.json()
      t.assert.strictEqual(user.email, 'test@example.com')
      t.assert.strictEqual(user.name, 'Test User')
      t.assert.ok(user.id_user)
    })
  })

  await t.todo('registration endpoint', async t => {
    // Future: Add registration tests when implemented
  })
})
