import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
test('filters recorded activity and downloads exact project history in each export format', async ({ page }) => {
  await page.goto('/#/projects/00000000-0000-4000-8000-000000000010')
  await page.getByRole('link', { name: 'View activity & export' }).click()
  await expect(page.getByRole('heading', { name: 'Activity log', exact: true })).toBeVisible()
  await expect(page.getByText('Created fictional Solara demo project.')).toBeVisible()
  await page.getByLabel('Event type', { exact: true }).selectOption('EXPORT_CREATED')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByText('No activity matches these filters.')).toBeVisible()
  for (const format of ['JSON', 'MARKDOWN', 'CSV']) {
    await page.getByLabel('Export format', { exact: true }).selectOption(format)
    await page.getByRole('button', { name: 'Create export', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Download export', exact: true })).toBeVisible()
    await expect(page.getByText(`Created ${format} project export.`)).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download export', exact: true }).click()
    const download = await downloadPromise; const path = await download.path(); expect(path).toBeTruthy()
    const content = await readFile(path!, 'utf8')
    if (format === 'JSON') { const data = JSON.parse(content); expect(data.assets).toHaveLength(4); expect(data.collections[0].revisions[0].items[0].pinnedVersion.id).toBe('00000000-0000-4000-8000-000000000061') }
    if (format === 'MARKDOWN') expect(content).toContain('## Collections and exact pins')
    if (format === 'CSV') expect(content.split('\r\n')).toHaveLength(5)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
