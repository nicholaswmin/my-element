import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'
import { bapiService } from './util/services/bapi.js'

import '../http-behavior.js'

test('HttpBehavior external configuration', async t => {
  let cleanup
  let server
  let baseURL
  let behavior
  let originalFetch

  t.before(async () => {
    cleanup = createTestEnvironment()
    server = createTestServer()
    baseURL = await server.start()
    originalFetch = global.fetch  // Store original fetch before any tests
  })

  t.after(async () => {
    await server?.stop()
    cleanup?.()
    // Restore original fetch after all tests
    global.fetch = originalFetch
  })

  t.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
  })

  t.afterEach(() => {
    // Restore original fetch after each test in case it was mocked
    global.fetch = originalFetch
  })

  await t.test('accepts external API configuration', async t => {
    await t.test('api property: accepts external configuration', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
      
      // Should trigger _apiConfigChanged observer that transforms config and builds API function
      t.assert.ok(behavior.api, 'api property should be set')
      t.assert.strictEqual(typeof behavior.api, 'function', 'api should be function after _apiConfigChanged processes config')
    })

    await t.test('method binding: enables cross-calling', async t => {
      // Use standardized BAPI service configuration which includes method binding
      const config = bapiService(baseURL + '/api')

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
      const component = createMockComponent();
      const api = behavior.api(component);
      
      // Mock fetch to track cross-method calls
      const fetchCalls = [];
      const originalFetch = api.fetch;
      api.fetch = function(service, path, options) {
        fetchCalls.push({ service, path, options });
        // Mock paper.get() to return true (exists), triggering paper.edit()
        if (path === '/paper/test-123') return Promise.resolve(true);
        return Promise.resolve(null);
      };
      
      // Should be able to call methods that reference each other
      await api.paper.save('test-123', { title: 'Test' });
      
      // Verify cross-method calling happened: save() -> get() -> edit()
      t.assert.strictEqual(fetchCalls.length, 2, 'Should call get() then edit()')
      t.assert.strictEqual(fetchCalls.at(0).path, '/paper/test-123', 'Should call get() first')
      t.assert.strictEqual(fetchCalls.at(1).path, '/paper/test-123', 'Should call edit() second')
      t.assert.strictEqual(fetchCalls.at(1).options.method, 'PATCH', 'Should call edit() with PATCH')
    })
  })

  await t.test('provides fetch method for service multiplexing', async t => {
    await t.test('fetch method: service multiplexing', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
      const component = createMockComponent();
      const api = behavior.api(component);

      // Mock global fetch to capture service multiplexing
      const capturedRequests = [];
      global.fetch = async (url, options) => {
        capturedRequests.push({ url, options });
        return { 
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([]) 
        };
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

    await t.test('fetch method: environment URLs', async t => {
      // Use standardized BAPI service with production environment
      const config = bapiService(baseURL + '/api')
      config.env = 'production'  // Override for this test

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
      const component = createMockComponent();
      
      // Mock global fetch to capture environment URL selection
      const capturedUrls = [];
      global.fetch = async (url, options) => {
        capturedUrls.push(url);
        return { 
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([]) 
        };
      };
      
      // Should use production URL when env=production
      await behavior.api(component).paper.list()
      
      t.assert.strictEqual(capturedUrls.length, 1, 'Should make one request')
      t.assert.strictEqual(capturedUrls.at(0), 'https://api.bitpaper.io/user/papers', 'Should use production URL when env=production')
    })
  })

  await t.test('creates contextual API function', async t => {
    await t.test('api function: component context', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
      const component = createMockComponent();
      const api = behavior.api(component);

      t.assert.ok(api.auth, 'Should have auth domain')
      t.assert.ok(api.paper, 'Should have paper domain')
      t.assert.ok(api.tags, 'Should have tags domain')
      t.assert.strictEqual(typeof api.auth.login, 'function', 'Domain methods should be functions')
      t.assert.strictEqual(typeof api.fetch, 'function', 'Should provide fetch method')
    })

    await t.test('loading state: automatic management', async t => {
      // Use standardized BAPI service configuration
      const config = bapiService(baseURL + '/api')

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment
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
    await t.test('validation: missing service error', async t => {
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

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment;
      const component = createMockComponent();

      try {
        await behavior.api(component).test.badCall();
        t.assert.fail('Should have thrown error');
      } catch (error) {
        t.assert.ok(error.message.includes('Service \'nonexistent\' not found'), 'Should throw service not found error');
      }
    })

    await t.test('validation: missing environment error', async t => {
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

      behavior.apiConfig = config
      behavior._apiConfigChanged(config)  // Manually trigger observer in test environment;
      const component = createMockComponent();

      try {
        await behavior.api(component).test.call();
        t.assert.fail('Should have thrown error');
      } catch (error) {
        t.assert.ok(error.message.includes('Environment \'staging\' not found'), 'Should throw environment not found error');
      }
    })
  })
})

test('HttpBehavior auth methods via external configuration', async t => {
  let cleanup
  let server
  let baseURL
  let behavior
  let originalFetch

  t.before(async () => {
    cleanup = createTestEnvironment()
    server = createTestServer()
    baseURL = await server.start()
    originalFetch = global.fetch  // Store original fetch
  })

  t.after(async () => {
    await server?.stop()
    cleanup?.()
    // Restore original fetch
    global.fetch = originalFetch
  })

  t.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
    // Ensure we're using real fetch for auth tests
    global.fetch = originalFetch
  })

  await t.test('auth actions: register method', async t => {
    const config = bapiService(baseURL + '/api')
    behavior.apiConfig = config
    behavior._apiConfigChanged(config)
    const component = createMockComponent()
    const api = behavior.api(component)

    // Test successful registration
    const result = await api.auth.register({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    })

    t.assert.ok(result, 'Should return registration result')
    t.assert.strictEqual(typeof result.id_user, 'string', 'Should return user ID')
    t.assert.strictEqual(result.email, 'john@example.com', 'Should return email')
    t.assert.ok(result.tokens, 'Should return tokens')
  })

  await t.test('auth actions: resetPassword method', async t => {
    const config = bapiService(baseURL + '/api')
    behavior.apiConfig = config
    behavior._apiConfigChanged(config)
    const component = createMockComponent()
    const api = behavior.api(component)

    // Test successful password reset request
    await api.auth.resetPassword('test@example.com')
    
    // Should complete without error
    t.assert.ok(true, 'Password reset request should complete')

    // Test error case
    await t.assert.rejects(
      () => api.auth.resetPassword('unknown@example.com'),
      /unknown_user_email/,
      'Should throw error for unknown email'
    )
  })

  await t.test('auth actions: verifyEmail method', async t => {
    const config = bapiService(baseURL + '/api')
    behavior.apiConfig = config
    behavior._apiConfigChanged(config)
    const component = createMockComponent()
    const api = behavior.api(component)

    // Test successful email verification
    await api.auth.verifyEmail('valid-token')
    
    // Should complete without error
    t.assert.ok(true, 'Email verification should complete')

    // Test error case
    await t.assert.rejects(
      () => api.auth.verifyEmail('invalid-token'),
      /incorrect_token/,
      'Should throw error for invalid token'
    )
  })
})
