import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'
import { bapiService } from '../util/services/bapi.js'

import '../../http-behavior.js'

test('HttpBehavior element state management', async t => {
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
    behavior.loggedInUser = {
      id_user: '123',
      tokens: { access: server.createValidToken() }
    }
  })

  await t.test('component state: loading management', async t => {
    const component = createMockComponent()

    // SPECIFICATION PATTERN: api(this) not service(this)
    const promise = behavior.api(component).tags.list()

    t.assert.strictEqual(component.loading, true, 'should be loading immediately')

    await promise

    t.assert.strictEqual(component.loading, false, 'should stop loading after completion')
  })

  await t.test('component state: response handling', async t => {
    const component = createMockComponent()

    // SPECIFICATION PATTERN: api(this) not service(this)
    const result = await behavior.api(component).tags.list()

    t.assert.strictEqual(component.lastResponse, result)
    t.assert.ok(Array.isArray(component.lastResponse), 'response should be array')
  })

  await t.test('component state: error handling', async t => {
    const component = createMockComponent()
    behavior.loggedInUser = { tokens: { access: server.createMalformedToken() } }

    try {
      // SPECIFICATION PATTERN: api(this) not service(this)
      await behavior.api(component).paper.save({ id_session: 'resource-123' })
    } catch (e) {
      // Expected
    }

    t.assert.ok(component.lastError, 'should have error')
    t.assert.ok(component.lastError instanceof Error)
    t.assert.strictEqual(component.lastError.status, 403)
  })

  t.todo('component events: polymer integration', async t => {
    const component = createMockComponent()

    // SPECIFICATION PATTERN: api(this) not service(this)
    await behavior.api(component).tags.list()

    const responseEvent = component.firedEvents.find(e => e.name === 'response')
    t.assert.ok(responseEvent, 'should fire response event')
  })

  t.todo('component isolation: multiple components', async t => {
    const comp1 = createMockComponent()
    const comp2 = createMockComponent()

    // SPECIFICATION PATTERN: api(this) not service(this)
    const p1 = behavior.api(comp1).paper.save({ id_session: 'resource-1' })
    const p2 = behavior.api(comp2).tags.list()

    t.assert.strictEqual(comp1.loading, true, 'component 1 should be loading')
    t.assert.strictEqual(comp2.loading, true, 'component 2 should be loading')

    await Promise.all([p1, p2])

    t.assert.strictEqual(comp1.loading, false)
    t.assert.strictEqual(comp2.loading, false)
  })

})

// Track missing event features
test('HttpBehavior element features', async t => {
  t.todo('events: structured detail objects')

  t.todo('performance: concurrent request handling')

  t.todo('features: request cancellation')
})
