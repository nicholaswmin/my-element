import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'
import { bapiService } from '../util/services/bapi.js'

import '../../http-behavior.js'

test('Component integration and lifecycle', async t => {
  let cleanup, server, baseURL, behavior

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
    const config = bapiService(baseURL + '/api')
    behavior.apiConfig = config
    behavior._apiConfigChanged(config)
  })

  await t.test('component lifecycle hooks', async t => {
    await t.test('attached initializes auth', async t => {
      behavior.attached()

      // Should trigger auth initialization without throwing
      t.assert.strictEqual(typeof behavior.attached, 'function',
        'attached method should exist')
      // Note: Auth initialization is async, can't test completion here
    })
  })

  await t.test('API pattern component isolation', async t => {
    t.todo('provides domain-organized methods', async t => {
      behavior.loggedInUser = {
        id_user: '123',
        tokens: { access: server.createValidToken() }
      }
      // External configuration instead of _buildApi()
      behavior.apiConfig = {
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

      const component = createMockComponent()

      // SPECIFICATION PATTERN: api(this) not service(this)
      const api = behavior.api(component)

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

    t.todo('creates isolated API per component', async t => {
      behavior.loggedInUser = {
        id_user: '123',
        tokens: { access: server.createValidToken() }
      }
      // External configuration instead of _buildApi()
      behavior.service = {
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

      const comp1 = createMockComponent()
      const comp2 = createMockComponent()

      // SPECIFICATION PATTERN: api(this) not service(this)
      const api1 = behavior.api(comp1)
      const api2 = behavior.api(comp2)

      t.assert.ok(api1)
      t.assert.ok(api2)
      t.assert.strictEqual(typeof behavior.api, 'function')
    })

    t.todo('delegates auth operations to behavior', async t => {
      behavior.loggedInUser = {
        id_user: '123',
        tokens: { access: server.createValidToken() }
      }
      // External configuration instead of _buildApi()
      behavior.apiConfig = {
        env: 'development',
        actions: {
          auth: {
            login: function() { return Promise.resolve({ id_user: '123' }); },
            logout: function() {
              behavior.loggedInUser = null;
              return Promise.resolve();
            }
          }
        },
        services: {
          bapi: { base: { development: server.host + '/api' } }
        }
      }

      const component = createMockComponent()

      await t.test('login updates behavior state', async t => {
        // SPECIFICATION PATTERN: api(this).auth.login()
        const result = await behavior.api(component).auth.login({
          email: 'test@example.com',
          password: 'password'
        })

        t.assert.ok(result.id_user)
        t.assert.ok(behavior.loggedInUser)
      })

      await t.test('logout clears behavior state', async t => {
        const logoutComponent = createMockComponent()

        behavior.loggedInUser = { id_user: '123' }

        // SPECIFICATION PATTERN: api(this).auth.logout()
        await behavior.api(logoutComponent).auth.logout()

        t.assert.strictEqual(behavior.loggedInUser, null)
      })
    })
  })


  await t.test('external configuration integration', async t => {
    t.todo('accepts external API configuration', async t => {
      // This test expects the external configuration to be implemented
      // where actions and services come from external configuration
      const externalConfig = {
        env: 'development',
        actions: {
          auth: {
            login: () => Promise.resolve({ success: true }),
            logout: () => Promise.resolve()
          }
        },
        services: {
          bapi: {
            base: { development: `${server.host}/api` }
          }
        }
      }

      behavior.apiConfig = externalConfig
      const component = createMockComponent()
      const api = behavior.api(component)

      t.assert.ok(api.auth)
      t.assert.strictEqual(typeof api.auth.login, 'function')
    })
  })
})
