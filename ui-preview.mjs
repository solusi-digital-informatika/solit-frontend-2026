import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
mkdirSync('test-results/ui-preview', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })
for (const width of [1440, 390, 320, 768]) {
  const page = await browser.newPage({ viewport: { width, height: 960 } })
  await page.goto('http://127.0.0.1:5175/#/projects')
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor()
  await page.getByRole('link', { name: /Open project/ }).first().waitFor()
  await page.screenshot({ path: `test-results/ui-preview/${width}-projects.png`, fullPage: true })
  await page.getByRole('link', { name: /Open project/ }).first().click()
  await page.locator('.home-header').waitFor()
  const root = page.url()
  for (const section of ['', 'brief', 'directions', 'references', 'assets', 'impact', 'collections', 'decisions', 'activity']) {
    await page.goto(root + (section ? '/' + section : ''))
    await page.waitForTimeout(550)
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    console.log(JSON.stringify({ width, section: section || 'overview', ...dimensions }))
    if (width === 1440 || width === 390) await page.screenshot({ path: `test-results/ui-preview/${width}-${section || 'overview'}.png`, fullPage: true })
  }
  await page.close()
}
await browser.close()
