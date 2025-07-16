import { test } from 'node:test'
import { page } from './helpers/browser.js'

test('#my-element', async t => {
  t.beforeEach(async t => {
    Object.assign(t, await page('test.page.html'))
  })

  t.afterEach(async t => {
    await t.browser?.close()
  })

  await t.test('registers', async t => {
    t.assert.ok(await t.page.$('my-element'))
  })

  await t.test('updates counter', async t => {
    await t.page.click('paper-button')
    
    t.assert.strictEqual(
      await t.page.$eval('my-element p', el => el.textContent),
      'Counter: 1'
    )
  })
})