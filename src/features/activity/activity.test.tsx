import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { ActivityEventSchema, ApiListSchema, ApiResponseSchema, ImpactAssessmentSchema, type ActivityEvent } from '../../../packages/contracts/src'
import { createApiClient } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { assetApi } from '../assets/api'
import { collectionApi } from '../collections/api'
import { directionApi } from '../directions/api'
import { projectApi } from '../projects/api'
import { decisionApi } from '../decisions/api'
import { activityApi } from './api'
import { ActivityPage } from './ActivityPage'
import { ExportPanel } from './ExportPanel'
import { downloadExport } from './download'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = activityApi(client)
const id = (suffix: string) => `00000000-0000-4000-8000-000000000${suffix}`; const projectId = id('010')
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => { server.resetHandlers(...createHandlers(base)); vi.restoreAllMocks() })
afterAll(() => server.close())
async function exportJson(project = projectId) { return JSON.parse((await api.export(project, 'JSON')).data.content) }

it('aggregates confirmed direction, version and collection activity with exact request IDs', async () => {
  await directionApi(client).activate(projectId, id('041'), 'Use warm campaign direction')
  const version = (await assetApi(client).createVersion(id('051'), { metadataOnly: true, revisionRationale: 'Adapt the product close-up' }, crypto.randomUUID())).data
  const collections = collectionApi(client); const revision = (await collections.revise(id('070'), { changeSummary: 'Warm direction review' }, crypto.randomUUID())).data
  await collections.item(revision.items[1].id, { assetVersionId: version.id, rationale: 'Use warm version for this revision' }); await collections.review(revision.id, 'submit-review'); await collections.review(revision.id, 'approve', {})
  const events = (await api.list(projectId, {})).data
  expect(events.map(value => value.eventType)).toEqual(expect.arrayContaining(['ACTIVE_DIRECTION_CHANGED', 'ASSET_VERSION_CREATED', 'COLLECTION_REVISION_CREATED', 'COLLECTION_ITEM_REPLACED', 'COLLECTION_APPROVED']))
  expect(events.find(value => value.eventType === 'ASSET_VERSION_CREATED')).toMatchObject({ entityId: version.id, actor: { displayName: 'Demo Owner' } })
  expect(events.filter(value => value.eventType !== 'PROJECT_CREATED').every(value => value.requestId)).toBe(true)
  const exported = await exportJson(); expect(exported.collections[0].revisions.find((value: { id: string }) => value.id === id('071')).items[1].pinnedVersion.id).toBe(id('062'))
  expect(exported.collections[0].revisions.find((value: { id: string }) => value.id === revision.id).items[1].pinnedVersion.id).toBe(version.id)
})
it('filters and paginates the server activity stream without leaking other projects', async () => {
  const before = new Date().toISOString(); await api.export(projectId, 'JSON'); await api.export(projectId, 'CSV')
  const first = await api.list(projectId, { eventType: 'EXPORT_CREATED', actorId: id('001'), entityType: 'EXPORT', from: before, to: new Date().toISOString(), limit: 1 })
  expect(first.data).toHaveLength(1); expect(first.page.nextCursor).toBeTruthy()
  const second = await api.list(projectId, { eventType: 'EXPORT_CREATED', limit: 1, cursor: first.page.nextCursor! }); expect(second.data[0].id).not.toBe(first.data[0].id)
  expect((await api.list(projectId, { entityId: first.data[0].entityId! })).data).toHaveLength(1)
  const foreign = (await projectApi(client).create({ name: 'Other project', template: 'BLANK' }, crypto.randomUUID())).data
  expect((await api.list(foreign.id, {})).data.every(value => value.projectId === foreign.id)).toBe(true)
  const exported = await exportJson(foreign.id); expect(exported.assets).toEqual([]); expect(exported.collections).toEqual([]); expect(exported.directions).toEqual([])
  await expect(api.list(id('999'), {})).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(api.export(id('999'), 'JSON')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(api.list(projectId, { actorId: 'invalid' })).rejects.toMatchObject({ status: 400 })
  await expect(api.list(projectId, { from: 'invalid' })).rejects.toMatchObject({ status: 400 })
  await expect(api.list(projectId, { from: '2026-12-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' })).rejects.toMatchObject({ status: 400 })
  await expect(api.list(projectId, { cursor: 'unknown' })).rejects.toMatchObject({ status: 400 })
})
it('exports original assessment evidence and append-only human decision supersession', async () => {
  const assessment = (await client.request(`/projects/${projectId}/impact-assessments`, ApiResponseSchema(ImpactAssessmentSchema), { method: 'POST', body: { newDirectionRevisionId: id('041'), mode: 'RULES_ONLY' }, idempotencyKey: crypto.randomUUID() })).data
  const item = assessment.items!.find(value => value.assetVersion.id === id('064'))!; const decisions = decisionApi(client)
  const first = (await decisions.resolve(assessment.id, item.id, { resolution: 'OVERRIDE', overrideRecommendation: 'REVIEW_REQUIRED', rationale: 'Inspect material compatibility manually' })).data.decision
  const second = (await decisions.resolve(assessment.id, item.id, { resolution: 'DEFER' })).data.decision
  const data = await exportJson(); const exportedItem = data.assessments[0].items.find((value: { id: string }) => value.id === item.id)
  expect(exportedItem.recommendation).toBe('RECREATE_CANDIDATE'); expect(exportedItem.supportingEvidence).toEqual(item.supportingEvidence); expect(exportedItem.resolutionStatus).toBe('DEFERRED')
  expect(data.decisions.find((value: { id: string }) => value.id === first.id).supersededByDecisionId).toBe(second.id)
  expect((await api.list(projectId, { eventType: 'RECOMMENDATION_RESOLVED' })).data).toHaveLength(2)
})
it('loads subsequent activity pages and resets the cursor after changing filters', async () => {
  for (let index = 0; index < 26; index++) await api.export(projectId, 'CSV')
  render(<ActivityPage client={client} projectId={projectId} />)
  const more = await screen.findByRole('button', { name: 'Load more activity' }); expect(screen.getAllByRole('listitem')).toHaveLength(25)
  fireEvent.click(more); await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more activity' })).not.toBeInTheDocument()); expect(screen.getAllByText('Created CSV project export.')).toHaveLength(26)
  fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'PROJECT_CREATED' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' })); await waitFor(() => expect(screen.queryByText('Created CSV project export.')).not.toBeInTheDocument()); expect(await screen.findByText('Created fictional Solara demo project.')).toBeVisible()
})
it('exports full historical records, warns about media and redacts credential fields and signed URLs', async () => {
  await assetApi(client).createVersion(id('050'), { metadataOnly: true, revisionRationale: 'Safe metadata export', generationSettings: { seed: 42, max_tokens: 512, nested: { api_key: 'DO_NOT_EXPORT', storageKey: 'PRIVATE_STORAGE', authorization: 'PRIVATE_AUTH', url: 'https://cdn.test/file?X-Amz-Signature=PRIVATE_SIGN' } } }, crypto.randomUUID())
  const response = (await api.export(projectId, 'JSON')).data; const data = JSON.parse(response.content)
  expect(data.briefRevisions).toHaveLength(1); expect(data.directions[0].revisions).toHaveLength(1); expect(data.references).toHaveLength(2); expect(data.assets[0].versions).toHaveLength(3)
  expect(data.collections[0].revisions[0].items[0].pinnedVersion.id).toBe(id('061')); expect(data.collections[0].revisions[0].approvals[0].decision).toBe('APPROVED')
  expect(response.warnings.map(value => value.code)).toEqual(['LOCAL_ONLY_FILE_PATHS', 'METADATA_ONLY_VERSIONS'])
  for (const secret of ['DO_NOT_EXPORT', 'PRIVATE_STORAGE', 'PRIVATE_AUTH', 'PRIVATE_SIGN']) expect(response.content).not.toContain(secret)
  expect(response.content).toContain('42'); expect(response.content).toContain('"max_tokens": 512'); expect(data.assets[0].versions.every((value: { fileUrl: string | null }) => value.fileUrl === null)).toBe(true)
})
it('creates a human report and a CSV with one latest row per asset and safe spreadsheet values', async () => {
  const assets = assetApi(client); const asset = (await assets.get(id('050'))).data
  await assets.edit(asset.id, { title: '=HYPERLINK("https://bad.test")', description: asset.description, assetType: 'HERO_IMAGE', tags: asset.tags, expectedUpdatedAt: asset.updatedAt })
  const markdown = (await api.export(projectId, 'MARKDOWN')).data; expect(markdown.content).toContain('## Collections and exact pins'); expect(markdown.content).toContain(id('061'))
  const csv = (await api.export(projectId, 'CSV')).data; expect(csv.content.split('\r\n')).toHaveLength(5); expect(csv.content).toContain('"\'=HYPERLINK(""https://bad.test"")"'); expect(csv.content).toContain(id('061')); expect(csv.content).not.toContain(id('060'))
  await expect(client.request(`/projects/${projectId}/exports`, ApiListSchema(ActivityEventSchema), { method: 'POST', body: { format: 'ZIP' } })).rejects.toMatchObject({ status: 400, details: [{ path: 'body.format', message: expect.any(String) }] })
})
it('renders unknown activity safely and hides unrecognized metadata', async () => {
  const event: ActivityEvent = { id: crypto.randomUUID(), projectId, actor: null, eventType: 'FUTURE_EVENT', entityType: 'FUTURE', entityId: null, summary: '<script>not executed</script>', metadata: { unexpected: 'PRIVATE_METADATA' }, requestId: null, createdAt: new Date().toISOString() }
  server.use(http.get(`${base}/projects/:projectId/activity`, () => HttpResponse.json({ data: [event], page: { limit: 25, nextCursor: null } })))
  render(<ActivityPage client={client} projectId={projectId} />)
  expect(await screen.findByRole('heading', { name: 'Other activity' })).toBeVisible(); expect(screen.getByText(event.summary)).toBeVisible(); expect(screen.queryByText('PRIVATE_METADATA')).not.toBeInTheDocument(); expect(screen.getByText('System', { exact: false })).toBeVisible()
})
it('applies filters explicitly, validates identifiers and shows no-results', async () => {
  render(<ActivityPage client={client} projectId={projectId} />); await screen.findByText('Created fictional Solara demo project.')
  fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'COLLECTION_APPROVED' } }); expect(screen.getByText('Created fictional Solara demo project.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' })); expect(await screen.findByText('No activity matches these filters.')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Actor ID'), { target: { value: 'invalid' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' })); expect(await screen.findByRole('alert')).toHaveTextContent('Use valid UUIDs')
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' })); expect(await screen.findByText('Created fictional Solara demo project.')).toBeVisible()
})
it('shows request IDs and retries failed reads without rendering an empty success', async () => {
  server.use(http.get(`${base}/projects/:projectId/activity`, () => HttpResponse.json({ error: { code: 'RATE_LIMITED', message: 'Please wait.', details: [], requestId: 'activity-read' } }, { status: 429, headers: { 'Retry-After': '2' } })))
  render(<ActivityPage client={client} projectId={projectId} />); expect(await screen.findByRole('alert')).toHaveTextContent('activity-read'); expect(screen.getByText('Try again after 2 seconds.')).toBeVisible(); expect(screen.queryByText('No activity recorded yet.')).not.toBeInTheDocument()
  server.resetHandlers(...createHandlers(base)); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('Created fictional Solara demo project.')).toBeVisible()
})
it('rejects foreign-project activity and never exposes it', async () => {
  server.use(http.get(`${base}/projects/:projectId/activity`, () => HttpResponse.json({ data: [{ id: crypto.randomUUID(), projectId: id('999'), actor: null, eventType: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: null, summary: 'FOREIGN_DATA', metadata: {}, requestId: null, createdAt: new Date().toISOString() }], page: { limit: 25, nextCursor: null } })))
  render(<ActivityPage client={client} projectId={projectId} />); expect(await screen.findByRole('alert')).toHaveTextContent('another project'); expect(screen.queryByText('FOREIGN_DATA')).not.toBeInTheDocument()
})
it('preserves the selected format after failed export and prevents duplicate in-flight writes', async () => {
  let calls = 0; let finish!: () => void; const gate = new Promise<void>(resolve => { finish = resolve })
  server.use(http.post(`${base}/projects/:projectId/exports`, async () => { calls++; await gate; return HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Export failed.', details: [], requestId: 'export-write' } }, { status: 500 }) }))
  render(<ExportPanel api={api} projectId={projectId} canExport created={() => {}} />); fireEvent.change(screen.getByLabelText('Export format'), { target: { value: 'CSV' } }); const button = screen.getByRole('button', { name: 'Create export' }); fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(calls).toBe(1)); finish(); expect(await screen.findByRole('alert')).toHaveTextContent('export-write'); expect(screen.getByLabelText('Export format')).toHaveValue('CSV'); expect(screen.queryByRole('button', { name: 'Download export' })).not.toBeInTheDocument()
  server.resetHandlers(...createHandlers(base)); fireEvent.click(screen.getByRole('button', { name: 'Create export' })); expect(await screen.findByRole('button', { name: 'Download export' })).toBeVisible()
})
it('allows viewers to export, shows API warnings, and logs the confirmed export', async () => {
  const project = (await projectApi(client).get(projectId)).data
  server.use(http.get(`${base}/projects/:projectId`, () => HttpResponse.json({ data: { ...project, currentUserRole: 'VIEWER' } })))
  render(<ActivityPage client={client} projectId={projectId} />); fireEvent.click(await screen.findByRole('button', { name: 'Create export' })); expect(await screen.findByRole('button', { name: 'Download export' })).toBeVisible(); expect(screen.getByLabelText('Export warnings')).toHaveTextContent('local demo paths'); expect(await screen.findByText('Created JSON project export.')).toBeVisible()
})
it('downloads the server-provided content with a sanitized filename and revokes its object URL', async () => {
  const result = (await api.export(projectId, 'JSON')).data; const create = vi.fn(() => 'blob:export'); const revoke = vi.fn(); let clicked: { download: string; href: string } | null = null; const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked = { download: this.download, href: this.href } })
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
  vi.useFakeTimers()
  try { downloadExport({ ...result, filename: '../export.json' }); expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce(); expect(clicked).toHaveProperty('download', '.._export.json'); expect(clicked).toHaveProperty('href', 'blob:export'); vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:export') }
  finally { vi.useRealTimers(); vi.unstubAllGlobals() }
})
