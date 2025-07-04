import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'
import { bapiService } from './util/services/bapi.js'
import { acmeService } from './util/services/acme.js'

import '../http-behavior.js'

test('HttpBehavior external configuration', async t => {
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
  })

  await t.test('accepts external API configuration', async t => {
    await t.todo('api property: accepts external configuration', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.api = config
      
      // Should trigger _apiChanged observer that transforms config to function
      t.assert.ok(behavior.api, 'api property should be set')
      t.assert.strictEqual(typeof behavior.api, 'function', 'api should be function after _apiChanged processes config')
    })

    await t.todo('method binding: enables cross-calling', async t => {
      // Use standardized BAPI service configuration which includes method binding
      const config = bapiService(baseURL + '/api')

      behavior.api = config
      const component = createMockComponent();
      
      // Mock fetch to track cross-method calls
      const fetchCalls = [];
      const originalFetch = behavior.api(component).fetch;
      behavior.api(component).fetch = function(service, path, options) {
        fetchCalls.push({ service, path, options });
        // Mock paper.get() to return true (exists), triggering paper.edit()
        if (path === '/paper/test-123') return Promise.resolve(true);
        return Promise.resolve(null);
      };
      
      // Should be able to call methods that reference each other
      await behavior.api(component).paper.save('test-123', { title: 'Test' });
      
      // Verify cross-method calling happened: save() -> get() -> edit()
      t.assert.strictEqual(fetchCalls.length, 2, 'Should call get() then edit()')
      t.assert.strictEqual(fetchCalls.at(0).path, '/paper/test-123', 'Should call get() first')
      t.assert.strictEqual(fetchCalls.at(1).path, '/paper/test-123', 'Should call edit() second')
      t.assert.strictEqual(fetchCalls.at(1).options.method, 'PATCH', 'Should call edit() with PATCH')
    })
  })

  await t.test('provides fetch method for service multiplexing', async t => {
    await t.todo('fetch method: service multiplexing', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.api = config
      const component = createMockComponent();
      const api = behavior.api(component);

      // Mock global fetch to capture service multiplexing
      const capturedRequests = [];
      global.fetch = async (url, options) => {
        capturedRequests.push({ url, options });
        return { json: () => Promise.resolve([]) };
      };

      // Should be able to use fetch method for different endpoints
      t.assert.strictEqual(typeof api.fetch, 'function', 'fetch method should be available')
      
      await api.paper.list()
      await api.tags.list()

      // Verify fetch method worked correctly with different endpoints
      t.assert.strictEqual(capturedRequests.length, 2, 'Should make 2 requests')
      t.assert.strictEqual(capturedRequests.at(0).url, baseURL + '/api/user/papers', 'First request should be papers')
      t.assert.strictEqual(capturedRequests.at(1).url, baseURL + '/api/user/tags', 'Second request should be tags')
    })

    await t.todo('fetch method: environment URLs', async t => {
      // Use standardized BAPI service with production environment
      const config = bapiService(baseURL + '/api')
      config.env = 'production'  // Override for this test

      behavior.api = config
      const component = createMockComponent();
      
      // Mock global fetch to capture environment URL selection
      const capturedUrls = [];
      global.fetch = async (url, options) => {
        capturedUrls.push(url);
        return { json: () => Promise.resolve([]) };
      };
      
      // Should use production URL when env=production
      await behavior.api(component).paper.list()
      
      t.assert.strictEqual(capturedUrls.length, 1, 'Should make one request')
      t.assert.strictEqual(capturedUrls.at(0), 'https://api.bitpaper.io/user/papers', 'Should use production URL when env=production')
    })
  })

  await t.test('creates contextual API function', async t => {
    await t.todo('api function: component context', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.api = config
      const component = createMockComponent();
      const api = behavior.api(component);

      t.assert.ok(api.auth, 'Should have auth domain')
      t.assert.ok(api.paper, 'Should have paper domain')
      t.assert.ok(api.tags, 'Should have tags domain')
      t.assert.strictEqual(typeof api.auth.login, 'function', 'Domain methods should be functions')
      t.assert.strictEqual(typeof api.fetch, 'function', 'Should provide fetch method')
    })

    await t.todo('loading state: automatic management', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.api = config
      behavior.loggedInUser = { tokens: { access: server.createValidToken() } };
      
      const component = createMockComponent();
      const promise = behavior.api(component).test.slowOperation();

      t.assert.strictEqual(component.loading, true, 'Should set loading=true during request')
      
      await promise;
      
      t.assert.strictEqual(component.loading, false, 'Should set loading=false after completion')
      t.assert.ok(component.lastResponse, 'Should set lastResponse')
    })
  })

  await t.test('handles missing or invalid configuration', async t => {
    await t.todo('validation: missing service error', async t => {
      const config = {
        env: 'development',
        actions: {
          test: {
            badCall: function() {
              return this.fetch('nonexistent', '/test');
            }
          }
        },
        services: {
          bapi: {
            base: { development: baseURL + '/api' }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();

      await t.assert.rejects(
        () => behavior.api(component).test.badCall(),
        /Service 'nonexistent' not found/
      );
    })

    await t.todo('validation: missing environment error', async t => {
      const config = {
        env: 'staging',  // Not defined in service base
        actions: {
          test: {
            call: function() {
              return this.fetch('bapi', '/test');
            }
          }
        },
        services: {
          bapi: {
            base: {
              development: baseURL + '/api',
              production: 'https://api.bitpaper.io'
            }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();

      await t.assert.rejects(
        () => behavior.api(component).test.call(),
        /Environment 'staging' not found/
      );
    })
  })
})

// TODO tests for missing auth methods that should be externally configured
test('HttpBehavior auth methods via external configuration', async t => {
  await t.todo('auth actions: register method')

  await t.todo('auth actions: resetPassword method')

  await t.todo('auth actions: verifyEmail method')
})
