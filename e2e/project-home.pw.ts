import { expect, test } from '@playwright/test'

test('opens Solara with mock summary, keeps focus and fits the viewport', async ({ page }) => {
  await page.goto('/#/projects')
  await page.getByRole('link', { name: 'Solara — Product Visual Campaign', exact: true }).click()
  const overview = page.getByRole('article', { name: 'Project overview' })
  await expect(overview).toBeVisible()
  await expect(overview.getByText('Cold Industrial', { exact: false })).toBeVisible()
  await expect(overview.getByText('No decisions recorded yet.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Solara — Product Visual Campaign' })).toBeFocused()
  await page.getByRole('link', { name: 'Review active direction' }).click()
  await expect(page.locator('#active-direction')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'All projects' }).click()
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
})
