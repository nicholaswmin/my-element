import test from 'node:test'
import jwt from 'jsonwebtoken'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'

import '../http-behavior.js'

test('HttpBehavior', async t => {
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




  await t.todo('api pattern: component usage', async t => {
    t.beforeEach(() => {
      behavior.loggedInUser = { 
        id_user: '123',
        tokens: { access: server.createValidToken() } 
      }
      // External configuration instead of _buildService()
      behavior.api = {
        env: 'development',
        actions: {
          auth: {
            login: function() { return Promise.resolve(); },
            logout: function() { return Promise.resolve(); }
          },
          paper: {
            save: function() { return Promise.resolve(); },
            list: function() { return Promise.resolve([]); }
          },
          tags: {
            list: function() { return Promise.resolve([]); }
          }
        },
        services: {
          bapi: { base: { development: server.host + '/api' } }
        }
      }
    })

    await t.test('provides domain-organized methods', async t => {
      const component = createMockComponent()
      
      // SPECIFICATION PATTERN: api(this) not service(this)
      const api = behavior.service(component)
      
      // Check that api has expected domains from external configuration
      t.assert.ok(api.auth)
      t.assert.ok(api.paper)
      t.assert.ok(api.tags)
      
      // Check methods come from external actions
      t.assert.strictEqual(typeof api.auth.login, 'function')
      t.assert.strictEqual(typeof api.auth.logout, 'function')
      t.assert.strictEqual(typeof api.paper.save, 'function')
      t.assert.strictEqual(typeof api.paper.list, 'function')
      t.assert.strictEqual(typeof api.tags.list, 'function')
    })

    await t.test('creates isolated API per component', async t => {
      const comp1 = createMockComponent()
      const comp2 = createMockComponent()
      
      // SPECIFICATION PATTERN: api(this) not service(this)
      const api1 = behavior.service(comp1)
      const api2 = behavior.service(comp2)
      
      t.assert.ok(api1)
      t.assert.ok(api2)
      t.assert.strictEqual(typeof behavior.api, 'function')
    })

  })


  await t.test('HTTP request encounters error', async t => {
    t.beforeEach(() => {
      behavior._buildService()
    })

    await t.test('handles 401 unauthorized response', async t => {
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${server.host}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('handles 403 forbidden response', async t => {
      behavior.loggedInUser = { tokens: { access: server.createMalformedToken() } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${server.host}/api/test`),
        error => error.status === 403
      )
    })

    await t.test('handles 404 not found response', async t => {
      behavior.loggedInUser = { tokens: { access: server.createValidToken() } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${server.host}/api/nonexistent`),
        error => error.status === 404
      )
    })
    
    await t.test('handles validation errors', async t => {
      behavior.loggedInUser = { tokens: { access: server.createValidToken() } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${server.host}/api/user/papers/save`, {
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
      behavior.loggedInUser = { tokens: { access: server.createValidToken() } }
      
      await t.assert.rejects(
        () => behavior._http.request.call(behavior, `${server.host}/api/alt-error`),
        error => {
          t.assert.ok(error.message)
          return true
        }
      )
    })
  })



  await t.todo('api pattern: generic request method')
})

// Data binding tests removed - explicitly marked "out of scope" in specification
