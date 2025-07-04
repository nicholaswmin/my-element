import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'

import '../http-behavior.js'

test('HttpBehavior edge cases and boundary scenarios', async t => {
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
    behavior.loggedInUser = {
      id_user: '123',
      tokens: { access: server.createValidToken() }
    }
    behavior._buildService()
  })

  await t.test('edge cases: concurrent request handling', async t => {
    await t.todo('edge case: multiple components requesting simultaneously', async t => {
      const comp1 = createMockComponent()
      const comp2 = createMockComponent()
      const comp3 = createMockComponent()
      
      // Start concurrent requests from different components
      const promise1 = behavior.service(comp1).paper.save({ id_session: 'paper-1' })
      const promise2 = behavior.service(comp2).tags.list()
      const promise3 = behavior.service(comp3).paper.list()
      
      // All should be loading
      t.assert.strictEqual(comp1.loading, true, 'Component 1 should be loading')
      t.assert.strictEqual(comp2.loading, true, 'Component 2 should be loading')
      t.assert.strictEqual(comp3.loading, true, 'Component 3 should be loading')
      
      await Promise.all([promise1, promise2, promise3])
      
      // All should complete independently
      t.assert.strictEqual(comp1.loading, false, 'Component 1 should finish loading')
      t.assert.strictEqual(comp2.loading, false, 'Component 2 should finish loading')
      t.assert.strictEqual(comp3.loading, false, 'Component 3 should finish loading')
    })

    await t.todo('edge case: rapid sequential requests from same component', async t => {
      const component = createMockComponent()
      
      // Make rapid sequential requests
      const promise1 = behavior.service(component).tags.list()
      const promise2 = behavior.service(component).paper.list()
      
      // Second request should cancel first request's component state
      await Promise.all([promise1, promise2])
      
      t.assert.strictEqual(component.loading, false, 'Should finish loading')
      t.assert.ok(Array.isArray(component.lastResponse), 'Should have array response from final request')
    })
  })

  await t.test('edge cases: boundary conditions', async t => {
    await t.todo('edge case: empty request body handling', async t => {
      const component = createMockComponent()
      
      // Test behavior with empty/null data
      await t.assert.rejects(
        () => behavior.service(component).paper.save({}),
        error => error.message.includes('validation'),
        'Should handle empty data gracefully'
      )
      
      t.assert.ok(component.lastError, 'Should set error on component')
    })

    await t.todo('edge case: malformed response handling', async t => {
      const component = createMockComponent()
      
      // Test with endpoint that returns non-JSON
      await t.assert.rejects(
        () => behavior.service(component).test.malformed(),
        error => error.message.includes('JSON'),
        'Should handle malformed responses'
      )
    })

  })

  await t.test('edge cases: service function behavior', async t => {
    await t.todo('edge case: service function availability', async t => {
      const component = createMockComponent()
      
      // Test service function exists and works
      t.assert.strictEqual(typeof behavior.service, 'function', 'service should be function')
      
      const service = behavior.service(component)
      t.assert.ok(service, 'service(component) should return service object')
      t.assert.ok(service.paper, 'Should have paper domain')
      t.assert.ok(service.tags, 'Should have tags domain')
    })
  })
})

// TODO tests for demonstrating correct component integration patterns
test('Edge cases: Component integration', async t => {
  await t.todo('integration: component property declaration', async t => {
    // Components should declare:
    // properties: {
    //   api: Function,
    //   loading: { type: Boolean, readOnly: true },
    //   lastResponse: Object,
    //   lastError: Object
    // }
  })

  await t.todo('integration: property binding from parent', async t => {
    // app-whiteboard should bind: api="[[api]]"
    // Child components receive the api function
  })
})