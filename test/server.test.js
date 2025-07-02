import test from 'node:test'
import { createTestServer } from './util/server/index.js'

test('createTestServer()', async t => {
  let server
  let baseURL
  
  await t.test('server lifecycle management', async t => {
    await t.test('starts and provides localhost URL', async t => {
      server = createTestServer()
      baseURL = await server.start()
      
      t.assert.ok(baseURL)
      t.assert.ok(baseURL.includes('http://localhost:'))
    })
    
    await t.test('stops cleanly without errors', async t => {
      await t.assert.doesNotReject(() => server.stop())
    })
  })
  
  await t.test('user authenticates with email/password', async t => {
    t.before(async () => {
      server = createTestServer()
      baseURL = await server.start()
    })
    
    t.after(async () => await server.stop())
    
    await t.test('receives JWT tokens on success', async t => {
      const response = await fetch(`${baseURL}/api/user/login/email`, {
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
      const response = await fetch(`${baseURL}/api/user/login/email`, {
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
  
  await t.test('protected endpoint validates authorization', async t => {
    t.before(async () => {
      server = createTestServer()
      baseURL = await server.start()
    })
    
    t.after(async () => await server.stop())
    
    await t.test('rejects missing authorization header', async t => {
      const response = await fetch(`${baseURL}/api/test`)
      t.assert.strictEqual(response.status, 403)
    })
    
    await t.test('accepts valid bearer token', async t => {
      const response = await fetch(`${baseURL}/api/test`, {
        headers: { 'Authorization': 'Bearer valid-token' }
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
  
  await t.test('user refreshes expired access token', async t => {
    t.before(async () => {
      server = createTestServer()
      baseURL = await server.start()
    })
    
    t.after(async () => await server.stop())
    
    await t.test('receives new access token', async t => {
      const response = await fetch(`${baseURL}/api/user/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'valid-refresh-token' })
      })
      
      t.assert.strictEqual(response.status, 201)
      const user = await response.json()
      t.assert.ok(user.tokens.access.includes('new'))
    })
    
    await t.test('receives updated user profile', async t => {
      const response = await fetch(`${baseURL}/api/user/refresh`, {
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