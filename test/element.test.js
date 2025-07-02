import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'

import '../http-behavior.js'

test('HttpBehavior element state management', async t => {
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
    behavior.loggedInUser = { 
      id_user: '123',
      tokens: { access: 'valid-token' } 
    }
    behavior._buildService()
  })

  await t.test('component makes HTTP request', async t => {
    const component = createMockComponent()
    const service = behavior.service(component)

    await t.test('sets loading state during request', async t => {
      // Use generic resource save instead of paper.save
      const promise = service.paper.save({ id_session: 'resource-123' })
      
      t.assert.strictEqual(component.loading, true, 'should be loading immediately')
      
      await promise
      
      t.assert.strictEqual(component.loading, false, 'should stop loading after completion')
    })

    await t.test('clears loading state on error', async t => {
      behavior.loggedInUser = { tokens: { access: 'invalid-token' } }
      
      try {
        await service.paper.save({ id_session: 'resource-123' })
      } catch (e) {
        // Expected error
      }
      
      t.assert.strictEqual(component.loading, false, 'should clear loading on failure')
    })
  })

  await t.test('component receives response data', async t => {
    const component = createMockComponent()
    const service = behavior.service(component)

    await t.test('stores successful response', async t => {
      // Use generic list method instead of tags.list
      const result = await service.tags.list()
      
      t.assert.strictEqual(component.lastResponse, result)
      t.assert.ok(Array.isArray(component.lastResponse), 'response should be array')
    })

    await t.test('stores null for 204 responses', async t => {
      await service.paper.save({ id_session: 'resource-123' })
      
      t.assert.strictEqual(component.lastResponse, null, '204 should return null')
    })

    await t.test('clears previous errors on success', async t => {
      component.lastError = new Error('Previous error')
      
      await service.tags.list()
      
      t.assert.strictEqual(component.lastError, null, 'should clear old errors')
    })
  })

  await t.test('component handles request errors', async t => {
    await t.test('stores error object with details', async t => {
      const component = createMockComponent()
      const service = behavior.service(component)
      behavior.loggedInUser = { tokens: { access: 'invalid-token' } }
      
      try {
        await service.paper.save({ id_session: 'resource-123' })
      } catch (e) {
        // Expected
      }
      
      t.assert.ok(component.lastError, 'should have error')
      t.assert.ok(component.lastError instanceof Error)
      t.assert.strictEqual(component.lastError.status, 403)
    })

    await t.test('includes error response data', async t => {
      const component = createMockComponent()
      const service = behavior.service(component)
      behavior.loggedInUser = { tokens: { access: 'invalid-token' } }
      
      try {
        await service.tags.create({ name: 'Test Item' })
      } catch (e) {
        // Expected
      }
      
      t.assert.ok(component.lastError.message)
      t.assert.ok(component.lastError.response)
    })
  })

  await t.test('component fires Polymer events', async t => {
    const component = createMockComponent()
    const service = behavior.service(component)

    await t.test('fires response event on success', async t => {
      await service.tags.list()
      
      const responseEvent = component.firedEvents.find(e => e.name === 'response')
      t.assert.ok(responseEvent, 'should fire response event')
    })

    await t.test('fires error event on failure', async t => {
      const component = createMockComponent()
      const service = behavior.service(component)
      behavior.loggedInUser = { tokens: { access: 'invalid-token' } }
      
      try {
        await service.paper.save({ id_session: 'resource-123' })
      } catch (e) {
        // Expected
      }
      
      const errorEvent = component.firedEvents.find(e => e.name === 'error')
      t.assert.ok(errorEvent, 'should fire error event')
    })

    await t.test('fires domain-specific events', async t => {
      await service.paper.save({ id_session: 'resource-123', title: 'Test Resource' })
      
      const savedEvent = component.firedEvents.find(e => e.name === 'paper-saved')
      t.assert.ok(savedEvent, 'should fire resource-saved event')
    })
  })

  await t.test('multiple components maintain isolated state', async t => {
    const comp1 = createMockComponent()
    const comp2 = createMockComponent()
    
    const service1 = behavior.service(comp1)
    const service2 = behavior.service(comp2)
    
    // Use generic resource operations
    const p1 = service1.paper.save({ id_session: 'resource-1' })
    const p2 = service2.tags.list()
    
    t.assert.strictEqual(comp1.loading, true, 'component 1 should be loading')
    t.assert.strictEqual(comp2.loading, true, 'component 2 should be loading')
    
    await Promise.all([p1, p2])
    
    t.assert.strictEqual(comp1.loading, false)
    t.assert.strictEqual(comp2.loading, false)
    
    t.assert.strictEqual(comp1.lastResponse, null, 'component 1 should have null (204)')
    t.assert.ok(Array.isArray(comp2.lastResponse), 'component 2 should have array')
    
    t.assert.ok(comp1.firedEvents.find(e => e.name === 'paper-saved'))
    t.assert.strictEqual(comp2.firedEvents.find(e => e.name === 'paper-saved'), undefined)
  })

  await t.test('behavior fires authentication events', async t => {
    await t.test('fires login-success after login', async t => {
      behavior._firedEvents = []
      
      await behavior.loginLocal({ 
        email: 'test@example.com', 
        password: 'password' 
      })
      
      const loginSuccess = behavior.getFiredEvents('login-success')
      t.assert.ok(loginSuccess.length > 0, 'should fire login-success')
    })

    await t.test('fires login-request-success for user login', async t => {
      behavior._firedEvents = []
      
      await behavior.loginLocal({ 
        email: 'test@example.com', 
        password: 'password' 
      })
      
      const loginRequestSuccess = behavior.getFiredEvents('login-request-success')
      t.assert.ok(loginRequestSuccess.length > 0, 'should fire login-request-success')
    })

    await t.test('fires user-logged-out after logout', async t => {
      behavior._firedEvents = []
      behavior.loggedInUser = { id_user: '123' }
      
      await behavior.logout()
      
      const loggedOut = behavior.getFiredEvents('user-logged-out')
      t.assert.ok(loggedOut.length > 0, 'should fire user-logged-out')
    })

    await t.test('fires initial-login-completed on startup', async t => {
      behavior._firedEvents = []
      
      await behavior._initializeAuth()
      
      const initComplete = behavior.getFiredEvents('initial-login-completed')
      t.assert.ok(initComplete.length > 0, 'should fire initial-login-completed')
    })
  })
})

// Track missing event features
test('HttpBehavior element features', async t => {
  await t.test('event detail objects', { 
    todo: 'Add structured detail objects to all events' 
  }, async t => {})
  
  await t.test('concurrent request handling', { 
    todo: 'Test multiple simultaneous requests on same component' 
  }, async t => {})
  
  await t.test('request cancellation', { 
    todo: 'Implement AbortController support' 
  }, async t => {})
})