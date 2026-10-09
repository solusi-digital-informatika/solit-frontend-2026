import { expect, test } from '@playwright/test'

test('creates a brief revision and verifies the previous one stays unchanged', async ({ page }) => {
  await page.goto('/#/projects/00000000-0000-4000-8000-000000000010')
  await page.getByRole('link', { name: 'View brief', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Solara product visual campaign', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Create new revision', exact: true }).click()
  await page.getByLabel('Brief title').fill('Solara revised brief')
  await page.getByLabel('Change summary').fill('Refine the campaign title')
  await page.getByRole('button', { name: 'Save new revision', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Solara revised brief', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Revision 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Solara product visual campaign', exact: true })).toBeVisible()
  await expect(page.getByText('Revision 1 · Historical revision')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('link', { name: /Project overview/ }).click()
  await expect(page.getByRole('article', { name: 'Project overview' })).toBeVisible()
})
