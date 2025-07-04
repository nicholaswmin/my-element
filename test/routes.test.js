import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance, createMockComponent } from './util/setup.js'
import { createTestServer } from './util/server/index.js'

import '../http-behavior.js'

test('HttpBehavior URL building via external configuration', async t => {
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
  })

  await t.test('fetch method builds URLs from external configuration', async t => {
    await t.todo('url building: service selection', async t => {
      const config = {
        env: 'development',
        actions: {
          test: {
            callBapi: function() {
              return this.fetch('bapi', '/test');
            },
            callSocket: function() {
              return this.fetch('socket', '/connect');
            }
          }
        },
        services: {
          bapi: {
            base: {
              development: 'http://localhost:5100/api',
              production: 'https://api.bitpaper.io'
            }
          },
          socket: {
            base: {
              development: 'ws://localhost:5002',
              production: 'wss://ws.bitpaper.io'
            }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();
      
      // Mock global fetch to capture URLs
      const capturedUrls = [];
      global.fetch = async (url, options) => {
        capturedUrls.push(url);
        return { json: () => Promise.resolve([]) };
      };

      await behavior.service(component).test.callBapi();
      await behavior.service(component).test.callSocket();

      t.assert.strictEqual(capturedUrls.at(0), 'http://localhost:5100/api/test', 'Should use bapi development URL')
      t.assert.strictEqual(capturedUrls.at(1), 'ws://localhost:5002/connect', 'Should use socket development URL')
    })

    await t.todo('url building: environment selection', async t => {
      const config = {
        env: 'production',
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
              development: 'http://localhost:5100/api',
              production: 'https://api.bitpaper.io'
            }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();
      
      // Mock global fetch to capture URLs
      const capturedUrls = [];
      global.fetch = async (url, options) => {
        capturedUrls.push(url);
        return { json: () => Promise.resolve([]) };
      };

      await behavior.service(component).test.call();

      t.assert.strictEqual(capturedUrls.at(0), 'https://api.bitpaper.io/test', 'Should use production URL when env=production')
    })

    await t.todo('url building: absolute URL passthrough', async t => {
      const config = {
        env: 'development',
        actions: {
          test: {
            callExternal: function() {
              return this.fetch('external', 'https://external.api.com/webhook');
            }
          }
        },
        services: {
          external: {
            base: {
              development: 'should-be-ignored'
            }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();
      
      // Mock global fetch to capture URLs
      const capturedUrls = [];
      global.fetch = async (url, options) => {
        capturedUrls.push(url);
        return { json: () => Promise.resolve([]) };
      };

      await behavior.service(component).test.callExternal();

      t.assert.strictEqual(capturedUrls.at(0), 'https://external.api.com/webhook', 'Should preserve absolute URLs unchanged')
    })
  })

  await t.test('fetch method handles path combinations', async t => {
    await t.todo('url building: path concatenation', async t => {
      const config = {
        env: 'development',
        actions: {
          test: {
            callWithPath: function() {
              return this.fetch('bapi', '/user/papers');
            },
            callWithLeadingSlash: function() {
              return this.fetch('bapi', 'user/papers');
            }
          }
        },
        services: {
          bapi: {
            base: {
              development: server.host + '/api'  // ends without slash
            }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();
      
      // Mock global fetch to capture URLs
      const capturedUrls = [];
      global.fetch = async (url, options) => {
        capturedUrls.push(url);
        return { json: () => Promise.resolve([]) };
      };

      await behavior.service(component).test.callWithPath();
      await behavior.service(component).test.callWithLeadingSlash();

      t.assert.strictEqual(capturedUrls.at(0), server.host + '/api/user/papers', 'Should handle path with leading slash')
      t.assert.strictEqual(capturedUrls.at(1), server.host + '/api/user/papers', 'Should handle path without leading slash')
    })
  })

  await t.test('fetch method error validation', async t => {
    await t.todo('url building: missing service error', async t => {
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
            base: { development: server.host + '/api' }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();

      await t.assert.rejects(
        () => behavior.service(component).test.badCall(),
        /Service 'nonexistent' not found/
      );
    })

    await t.todo('url building: missing environment error', async t => {
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
              development: server.host + '/api',
              production: 'https://api.bitpaper.io'
            }
          }
        }
      };

      behavior.api = config;
      const component = createMockComponent();

      await t.assert.rejects(
        () => behavior.service(component).test.call(),
        /Environment 'staging' not found/
      );
    })
  })
})

// Simple URL building - no parameter substitution as per specification
// URLs built at call time using template literals in action methods:
// Example: `/user/${userId}/papers` instead of parameter substitution
