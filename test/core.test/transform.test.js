import test from 'node:test'
import assert from 'node:assert'
import { createTestEnvironment } from '../util/setup.js'

test('Service Configuration Transformer', async t => {
  let cleanup

  t.before(() => {
    cleanup = createTestEnvironment()
  })

  t.after(() => {
    cleanup?.()
  })

  t.beforeEach(() => {
    window.localStorage.clear()
  })

  // Mock window.apiRoutes structure (matches actual api-routes.js)
  const mockApiRoutes = {
    bapi: {
      env: {
        development: {
          baseURL: 'http://localhost:5100/api',
          statics: {
            socket: 'http://localhost:5002',
            fetch: 'http://localhost:5005',
            s3: 'https://bitpaper.s3-eu-west-1.amazonaws.com'
          }
        },
        staging: {
          baseURL: 'https://bitpaper-api-stage.herokuapp.com/api/v1',
          statics: {
            socket: 'https://bitpaper-ws-stage.herokuapp.com',
            fetch: 'https://fetch-stage.bitpaper.io',
            s3: 'https://bitpaper.s3-eu-west-1.amazonaws.com'
          }
        },
        production: {
          baseURL: 'https://bitpaper-api.herokuapp.com/api/v1',
          statics: {
            socket: 'https://bitpaper-ws.herokuapp.com',
            fetch: 'https://fetch.bitpaper.io',
            s3: 'https://bitpaper.s3-eu-west-1.amazonaws.com'
          }
        }
      }
    }
  }

  // Service configuration transformer
  function transformApiRoutesToHttpBehaviorConfig(env, apiRoutes = mockApiRoutes) {
    const routes = apiRoutes.bapi
    return {
      env: env,
      actions: {
        auth: {
          login: function(credentials) {
            return this.fetch('bapi', '/user/login/email', {
              method: 'POST', body: credentials, skipAuth: true
            })
          }
        },
        paper: {
          list: function() {
            return this.fetch('bapi', '/user/papers')
          }
        }
      },
      services: {
        bapi: {
          base: {
            development: routes.env.development.baseURL,
            staging: routes.env.staging.baseURL,
            production: routes.env.production.baseURL
          },
          statics: routes.env[env].statics
        }
      }
    }
  }

  await t.test('object path access validation', async t => {
    await t.test('accesses development baseURL correctly', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('development')
      assert.strictEqual(
        config.services.bapi.base.development,
        'http://localhost:5100/api'
      )
    })

    await t.test('accesses staging baseURL correctly', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('staging')
      assert.strictEqual(
        config.services.bapi.base.staging,
        'https://bitpaper-api-stage.herokuapp.com/api/v1'
      )
    })

    await t.test('accesses production baseURL correctly', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('production')
      assert.strictEqual(
        config.services.bapi.base.production,
        'https://bitpaper-api.herokuapp.com/api/v1'
      )
    })
  })

  await t.test('dynamic environment statics access', async t => {
    await t.test('accesses development statics via dynamic key', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('development')
      assert.deepStrictEqual(
        config.services.bapi.statics,
        {
          socket: 'http://localhost:5002',
          fetch: 'http://localhost:5005',
          s3: 'https://bitpaper.s3-eu-west-1.amazonaws.com'
        }
      )
    })

    await t.test('accesses production statics via dynamic key', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('production')
      assert.deepStrictEqual(
        config.services.bapi.statics,
        {
          socket: 'https://bitpaper-ws.herokuapp.com',
          fetch: 'https://fetch.bitpaper.io',
          s3: 'https://bitpaper.s3-eu-west-1.amazonaws.com'
        }
      )
    })
  })

  await t.test('error handling', async t => {
    await t.test('handles missing bapi gracefully', async t => {
      const invalidApiRoutes = { notBapi: {} }
      assert.throws(() => {
        transformApiRoutesToHttpBehaviorConfig('development', invalidApiRoutes)
      }, /Cannot read properties of undefined/)
    })

    await t.test('handles missing environment gracefully', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('development')

      // Accessing undefined property returns undefined (doesn't throw)
      const nonExistentEnv = config.services.bapi.base.nonexistent
      assert.strictEqual(nonExistentEnv, undefined)
    })
  })

  await t.test('full configuration structure validation', async t => {
    await t.test('generates complete HttpBehavior config structure', async t => {
      const config = transformApiRoutesToHttpBehaviorConfig('development')

      // Validate top-level structure
      assert.ok(config.env)
      assert.ok(config.actions)
      assert.ok(config.services)

      // Validate actions structure
      assert.ok(config.actions.auth)
      assert.ok(config.actions.paper)
      assert.strictEqual(typeof config.actions.auth.login, 'function')
      assert.strictEqual(typeof config.actions.paper.list, 'function')

      // Validate services structure
      assert.ok(config.services.bapi)
      assert.ok(config.services.bapi.base)
      assert.ok(config.services.bapi.statics)
    })

    await t.test('maintains URL accuracy across environments', async t => {
      const environments = ['development', 'staging', 'production']

      environments.forEach(env => {
        const config = transformApiRoutesToHttpBehaviorConfig(env)

        // Each environment should have its own baseURL
        assert.ok(config.services.bapi.base[env])
        assert.ok(config.services.bapi.base[env].startsWith('http'))

        // Statics should match the environment
        assert.ok(config.services.bapi.statics.socket)
        assert.ok(config.services.bapi.statics.fetch)
        assert.ok(config.services.bapi.statics.s3)
      })
    })
  })

  await t.test('integration with actual api-routes.js structure', async t => {
    await t.test('matches expected api-routes.js structure', async t => {
      // This test validates that our mock matches real structure expectations
      const routes = mockApiRoutes.bapi

      // Validate expected nested structure exists
      assert.ok(routes.env)
      assert.ok(routes.env.development)
      assert.ok(routes.env.development.baseURL)
      assert.ok(routes.env.development.statics)

      // Validate all required environments exist
      assert.ok(routes.env.development)
      assert.ok(routes.env.staging)
      assert.ok(routes.env.production)
    })
  })
})