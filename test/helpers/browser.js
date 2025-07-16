// Browser testing helpers for Puppeteer

import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const page = async (htmlFile) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--no-sandbox'
    ]
  })
  const page = await browser.newPage()
  const testPath = join(__dirname, htmlFile)
  
  await page.goto(`file://${testPath}`)
  
  return { browser, page }
}

