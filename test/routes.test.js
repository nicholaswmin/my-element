import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance } from './util/setup.js'

import '../http-behavior.js'

test('HttpBehavior URL building', async t => {
  let cleanup
  let behavior
  
  t.before(() => {
    cleanup = createTestEnvironment()
  })
  
  t.after(() => {
    cleanup?.()
  })
  
  t.beforeEach(() => {
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
  })

  await t.test('service builds API URLs from configuration', async t => {
    await t.test('prepends base URL to relative paths', async t => {
      behavior.services = {
        bapi: { baseURL: 'https://api.example.com' },
        api: { baseURL: 'https://legacy.example.com' }
      }
      
      const url = behavior._buildUrl('/api/test')
      t.assert.strictEqual(url, 'https://api.example.com/api/test')
    })


    await t.test('returns path when no configuration exists', async t => {
      behavior.services = null
      
      const url = behavior._buildUrl('/api/test')
      t.assert.strictEqual(url, '/api/test')
    })
  })

  // Parameter substitution and query building removed - contradicts specification
  // Spec explicitly states: "WHAT PARAMETER SUBSTITUTION? just prepend the right baseurl"

  await t.test('service handles absolute URLs', async t => {
    behavior.services = {
      bapi: { baseURL: 'https://api.example.com' }
    }

    await t.test('preserves external URLs unchanged', async t => {
      const url = behavior._buildUrl('https://external.api.com/webhook')
      t.assert.strictEqual(url, 'https://external.api.com/webhook')
    })
  })

  await t.test('service adapts to environment URLs', async t => {
    await t.test('uses development URLs locally', async t => {
      behavior.services = {
        bapi: { baseURL: 'http://localhost:3000' },
        api: { baseURL: 'http://localhost:4000' }
      }
      
      const url = behavior._buildUrl('/api/test')
      t.assert.strictEqual(url, 'http://localhost:3000/api/test')
    })

    await t.test('uses production URLs in deployment', async t => {
      behavior.services = {
        bapi: { baseURL: 'https://api.bitpaper.io' },
        api: { baseURL: 'https://legacy-api.bitpaper.io' }
      }
      
      const url = behavior._buildUrl('/api/test')
      t.assert.strictEqual(url, 'https://api.bitpaper.io/api/test')
    })
  })
})

// Route feature TODOs removed - parameter substitution not part of specification
// URLs built at call time using template literals in action methods