import { expect, test, type APIRequestContext } from '@playwright/test'
import { z } from 'zod'
import { ApiResponseSchema, ApiListSchema, HealthStatusSchema, ProjectSchema, ProjectSummarySchema, BriefRevisionSchema, DirectionSchema, DirectionRevisionSchema, ReferenceSchema, AssetSchema, AssetDetailSchema, AssetVersionSchema, ImpactAssessmentSchema, DecisionSchema } from '../packages/contracts/src/index.ts'
const base = 'https://api.solit.my.id/api/v1'
async function read<T>(request: APIRequestContext, path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await request.get(base + path, { headers: { 'X-Request-Id': crypto.randomUUID() } })
  expect(response.ok(), `GET ${path}: HTTP ${response.status()}`).toBe(true)
  const parsed = schema.safeParse(await response.json())
  expect(parsed.success, `GET ${path}: ${parsed.success ? '' : parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}`).toBe(true)
  if (!parsed.success) throw new Error(`Contract mismatch at ${path}`)
  return parsed.data
}
test('deployed backend supports completed frontend features through real browser CORS', async ({ request, page }) => {
  const health = await read(request, '/health', ApiResponseSchema(HealthStatusSchema)); expect(health.data.contractVersion.split('.')[0]).toBe('1')
  const projects = await read(request, '/projects?status=ACTIVE', ApiListSchema(ProjectSchema)); expect(projects.data.length).toBeGreaterThan(0)
  const project = projects.data[0]; const root = `/projects/${project.id}`
  await read(request, root, ApiResponseSchema(ProjectSchema)); await read(request, `${root}/summary`, ApiResponseSchema(ProjectSummarySchema))
  const briefs = await read(request, `${root}/brief-revisions`, ApiListSchema(BriefRevisionSchema)); if (briefs.data.length) await read(request, `/brief-revisions/${briefs.data[0].id}`, ApiResponseSchema(BriefRevisionSchema))
  const directions = await read(request, `${root}/directions`, ApiListSchema(DirectionSchema)); for (const direction of directions.data) await read(request, `/directions/${direction.id}/revisions`, ApiListSchema(DirectionRevisionSchema))
  await read(request, `${root}/references`, ApiListSchema(ReferenceSchema))
  const assets = await read(request, `${root}/assets`, ApiListSchema(AssetSchema))
  for (const asset of assets.data.slice(0, 4)) { await read(request, `/assets/${asset.id}`, ApiResponseSchema(AssetDetailSchema)); if (asset.latestVersion) await read(request, `/asset-versions/${asset.latestVersion.id}`, ApiResponseSchema(AssetVersionSchema)) }
  await read(request, `${root}/decisions?currentOnly=false&sort=createdAt:desc`, ApiListSchema(DecisionSchema))
  const assessments = await read(request, `${root}/impact-assessments`, ApiListSchema(ImpactAssessmentSchema)); if (assessments.data.length) await read(request, `/impact-assessments/${assessments.data[0].id}`, ApiResponseSchema(ImpactAssessmentSchema))
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const browserHealth = page.waitForResponse(response => response.url() === `${base}/health` && response.ok())
  await page.goto('/#/projects'); await browserHealth; await expect(page.getByText('Backend API mode', { exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
  for (const [suffix, heading] of [['', project.name], ['/brief', 'Brief'], ['/directions', 'Creative directions'], ['/references', 'Reference Board'], ['/assets', 'Asset Library'], ['/impact', 'Impact Assessment & Impact Map'], ['/decisions', 'Human decisions']]) {
    await page.goto(`/#${root}${suffix}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    // Await the feature's list/context requests before checking for an error state.
    if (suffix === '/impact') await expect(page.getByRole('button', { name: 'Start assessment', exact: true })).toBeVisible()
    if (suffix === '/assets' && assets.data.length) await expect(page.getByRole('heading', { name: assets.data[0].title })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
  if (assets.data[0]?.latestVersion) { const asset = assets.data[0]; await page.goto(`/#${root}/assets/${asset.id}/versions/${asset.latestVersion!.id}`); await expect(page.getByRole('article', { name: `Selected version: Version ${asset.latestVersion!.versionNumber}` })).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0) }
  expect(errors).toEqual([])
})
