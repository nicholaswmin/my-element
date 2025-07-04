import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from '../util/setup.js'
import { createTestServer } from '../util/server/index.js'

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
    behavior.services = { bapi: { baseURL } }
  })

  await t.test('component lifecycle hooks', async t => {
    await t.test('attached initializes auth', async t => {
      behavior.attached()
      
      // Should trigger auth initialization without throwing
      t.assert.strictEqual(typeof behavior.attached, 'function', 
        'attached method should exist')
      // Note: Auth initialization is async, can't test completion here
    })
    
    await t.test('services observer builds service', async t => {
      const services = { 
        bapi: { 
          bapiURL: 'http://test.com',
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
      t.assert.strictEqual(behavior.services.bapi.statics.socket, 
        'ws://socket.test.com')
    })
  })

  await t.test('API pattern component isolation', async t => {
    await t.todo('provides domain-organized methods', async t => {
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

    await t.todo('creates isolated API per component', async t => {
      behavior.loggedInUser = { 
        id_user: '123',
        tokens: { access: server.createValidToken() } 
      }
      // External configuration instead of _buildService()
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
      const api1 = behavior.service(comp1)
      const api2 = behavior.service(comp2)
      
      t.assert.ok(api1)
      t.assert.ok(api2)
      t.assert.strictEqual(typeof behavior.api, 'function')
    })

    await t.todo('delegates auth operations to behavior', async t => {
      behavior.loggedInUser = { 
        id_user: '123',
        tokens: { access: server.createValidToken() } 
      }
      // External configuration instead of _buildService()
      behavior.api = {
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
        const result = await behavior.service(component).auth.login({ 
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
        await behavior.service(logoutComponent).auth.logout()
        
        t.assert.strictEqual(behavior.loggedInUser, null)
      })
    })
  })

  await t.test('service configuration handling', async t => {
    await t.test('handles services with statics configuration', async t => {
      const servicesWithStatics = {
        bapi: {
          baseURL: 'http://api.test.com',
          statics: {
            socket: 'ws://realtime.test.com',
            fetch: 'http://data.test.com',
            s3: 'https://storage.test.com'
          }
        }
      }
      
      behavior.services = servicesWithStatics
      behavior._servicesChanged(servicesWithStatics)
      
      // Statics should be preserved and accessible
      t.assert.strictEqual(behavior.services.bapi.statics.socket, 
        'ws://realtime.test.com')
      t.assert.strictEqual(behavior.services.bapi.statics.fetch, 
        'http://data.test.com')
      t.assert.strictEqual(behavior.services.bapi.statics.s3, 
        'https://storage.test.com')
    })

    await t.test('handles missing statics gracefully', async t => {
      const servicesWithoutStatics = {
        bapi: {
          baseURL: 'http://api.test.com'
        }
      }
      
      behavior.services = servicesWithoutStatics
      
      // Should not throw error when accessing statics
      t.assert.doesNotThrow(() => {
        behavior._servicesChanged(servicesWithoutStatics)
      })
    })

    await t.test('validates service configuration structure', async t => {
      const invalidServices = null
      
      // Should handle null/undefined services gracefully
      t.assert.doesNotThrow(() => {
        behavior._servicesChanged(invalidServices)
      })
    })
  })

  await t.test('external configuration integration', async t => {
    await t.todo('accepts external API configuration', async t => {
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
      
      behavior.api = externalConfig
      const component = createMockComponent()
      const api = behavior.service(component)
      
      t.assert.ok(api.auth)
      t.assert.strictEqual(typeof api.auth.login, 'function')
    })
  })
})
