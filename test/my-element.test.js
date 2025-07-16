import { test } from 'node:test'

test('my-element', async t => {
  await t.test('initializes correctly', t => {
    t.assert.strictEqual(1 + 1, 2)
  })
})