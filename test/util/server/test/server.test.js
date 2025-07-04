import test from 'node:test'
import { createTestServer } from '../index.js'

test('createTestServer()', async t => {
  let server
  
  
  await t.test('server lifecycle management', async t => {
    await t.test('starts and provides localhost URL', async t => {
      server = createTestServer(); await server.start()
      
      
      t.assert.ok(server.host)
      t.assert.ok(server.host.includes('http://localhost:'))
    })
    
    await t.test('stops cleanly without errors', async t => {
      await t.assert.doesNotReject(() => server.stop())
    })
  })
  
})