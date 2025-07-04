// Tests Bitpaper-specific endpoints

import test from 'node:test'
import { createTestEnvironment, createBehaviorInstance } from './util/setup.js'
import { createTestServer } from './util/server/index.js'

import '../http-behavior.js'

test('HttpBehavior endpoint integration', async t => {
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
      id_user: '123', tokens: { access: server.createValidToken() } 
    }
    behavior._buildService()
  })

  await t.test('authenticated user saves paper', async t => {
    await t.test('receives 204 on successful save', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/papers/save`, {
        method: 'POST',
        body: JSON.stringify({ 
          id_session: 'test-123',
          name: 'Test Paper' 
        })
      })
      
      t.assert.strictEqual(response, null, '204 should return null')
    })
  })

  await t.test('authenticated user lists papers', async t => {
    await t.test('receives paper array', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/papers`)
      
      t.assert.ok(Array.isArray(response))
      t.assert.ok(response.length > 0)
      t.assert.ok(response[0].id)
    })
  })

  await t.test('authenticated user manages tags', async t => {
    await t.test('lists existing tags', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/tags`)
      
      t.assert.ok(Array.isArray(response))
      t.assert.strictEqual(response[0].name, 'Important')
    })

    await t.test('creates new tag', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/tags`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Tag' })
      })
      
      t.assert.ok(response.id)
      t.assert.strictEqual(response.name, 'New Tag')
    })
  })

  await t.test('authenticated user manages preferences', async t => {
    await t.test('retrieves editor preferences', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/preferences/editor`)
      
      t.assert.ok(response.selectedStroke)
      t.assert.ok(response.selectedStroke.write)
      t.assert.strictEqual(response.fontSize, 24)
      t.assert.ok(Array.isArray(response.colorPresets))
    })

    await t.test('updates editor preferences', async t => {
      const newPrefs = {
        selectedStroke: {
          write: { width: 4, color: '#FF0000', opacity: 1 }
        },
        fontSize: 36
      }
      
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/preferences/editor`, {
        method: 'PATCH',
        body: JSON.stringify(newPrefs)
      })
      
      t.assert.deepStrictEqual(response, newPrefs)
    })

    await t.test('retrieves public preferences', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/preferences/public`)
      
      t.assert.strictEqual(response.displayName, 'Test User')
      t.assert.strictEqual(response.cursorColor, '#FF0000')
      t.assert.strictEqual(response.pointerVisible, true)
    })

    await t.test('updates public preferences', async t => {
      const newPrefs = {
        displayName: 'Updated User',
        cursorColor: '#00FF00',
        pointerVisible: false
      }
      
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/user/preferences/public`, {
        method: 'PATCH',
        body: JSON.stringify(newPrefs)
      })
      
      t.assert.deepStrictEqual(response, newPrefs)
    })
  })

  await t.test('authenticated user updates tags', async t => {
    await t.test('updates tag with PATCH method', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/tags/123`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Tag' })
      })
      
      t.assert.strictEqual(response.id, '123')
      t.assert.strictEqual(response.name, 'Updated Tag')
      t.assert.ok(response.updated_at)
    })
  })

  await t.test('authenticated user manages RTC tokens', async t => {
    await t.test('generates paper call token', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/paper/test-paper-123/call/token`, {
        method: 'POST'
      })
      
      t.assert.ok(response.token)
      t.assert.ok(response.sessionId)
      t.assert.ok(response.apiKey)
    })

    await t.test('generates Twilio call token', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/paper/test-session-456/call/twilio`, {
        method: 'POST'
      })
      
      t.assert.ok(response.token)
      t.assert.ok(response.identity)
      t.assert.ok(response.roomName)
    })

    await t.test('generates OpenTok call token', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/paper/test-session-789/call/opentok`, {
        method: 'POST'
      })
      
      t.assert.ok(response.token)
      t.assert.ok(response.apiKey)
      t.assert.ok(response.sessionId.includes('opentok-session'))
    })
  })

  await t.test('authenticated user updates paper', async t => {
    await t.test('updates paper with PATCH method', async t => {
      const response = await behavior._http.request.call(behavior, `${baseURL}/api/paper/test-paper-123`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Title', content: 'Updated content' })
      })
      
      t.assert.strictEqual(response, null, 'PATCH returns 204 No Content')
    })
  })
})

// Track missing endpoint features
test('HttpBehavior endpoint features', async t => {
  await t.test('asset upload with S3', { 
    todo: 'Test signed URL generation for file uploads' 
  }, async t => {})
  
  await t.test('paper deletion', { 
    todo: 'Implement DELETE /api/paper/:id endpoint' 
  }, async t => {})
  
  await t.test('paper URL availability', { 
    todo: 'Test paper exists by URL check' 
  }, async t => {})
})
