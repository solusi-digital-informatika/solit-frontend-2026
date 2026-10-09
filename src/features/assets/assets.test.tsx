import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { ApiListSchema, ApiResponseSchema, AssetSchema, AssetDetailSchema, AssetVersionSummarySchema } from '../../../packages/contracts/src'
import { createApiClient, ApiClientError } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { assetTargetFixtures } from '../../mocks/assetFixtures'
import { solaraProjectFixture } from '../../mocks/fixtures'
import { projectApi } from '../projects/api'
import { directionApi } from '../directions/api'
import { referenceApi } from '../references/api'
import { assetApi, AssetDetailViewSchema } from './api'
import { AssetLibrary } from './AssetLibrary'
import { AssetForm } from './AssetForm'
import { AssetMedia, AssetStatus } from './AssetMedia'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = assetApi(client); const projectId = solaraProjectFixture.id; const id = assetTargetFixtures[0].asset.id
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
const input = { title: 'Campaign layout', description: 'Homepage composition', assetType: 'LAYOUT' as const, tags: ['launch', 'web'] }
it('validates seed assets and returns newest-first version summaries', async () => {
  const result = await api.list(projectId, {})
  expect(result.data).toHaveLength(4)
  result.data.forEach(asset => AssetSchema.parse(asset))
  const detail = (await api.get(id)).data
  AssetDetailSchema.parse(detail)
  expect(detail.versions.map(version => version.versionNumber)).toEqual([2, 1])
  expect(detail.latestVersion?.id).toBe('00000000-0000-4000-8000-000000000061')
})
it('combines search, type, owner, status and tag filters on the server', async () => {
  await api.create(projectId, { ...input, ownerUserId: solaraProjectFixture.owner.id }, crypto.randomUUID())
  const result = await api.list(projectId, { q: 'composition', assetType: 'LAYOUT', tag: 'web', ownerUserId: solaraProjectFixture.owner.id, status: 'DRAFT' })
  expect(result.data.map(value => value.title)).toEqual(['Campaign layout'])
  expect((await api.list(projectId, { tag: 'absent' })).data).toEqual([])
})
it('sorts and paginates without duplicate assets', async () => {
  const first = await api.list(projectId, { sort: 'title:asc', limit: 2 })
  const second = await api.list(projectId, { sort: 'title:asc', cursor: first.page.nextCursor!, limit: 2 })
  expect([...first.data, ...second.data].map(value => value.title)).toEqual(['Factory Background', 'Hero Product Reveal', 'Metal Texture Detail', 'Product Close-up'])
  expect((await api.list(projectId, { sort: 'versionCount:desc' })).data[0].id).toBe(id)
  await expect(api.list(projectId, { sort: 'invalid' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  await expect(api.list(projectId, { cursor: 'invalid' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
})
it('filters by recorded latest-version direction without following the active pointer', async () => {
  const query = { directionId: '00000000-0000-4000-8000-000000000030' }
  const before = (await api.list(projectId, query)).data
  await directionApi(client).activate(projectId, '00000000-0000-4000-8000-000000000041', 'Use warm organic direction')
  expect((await api.list(projectId, query)).data).toEqual(before)
  expect((await api.list(projectId, { directionId: '00000000-0000-4000-8000-000000000040' })).data).toEqual([])
})
it('creates an unapproved logical asset with no invented file/version and replays its creation', async () => {
  const key = crypto.randomUUID(); const first = (await api.create(projectId, input, key)).data
  expect(first).toMatchObject({ status: 'DRAFT', versionCount: 0, latestVersion: null, versions: [], owner: null })
  expect((await api.create(projectId, input, key)).data).toEqual(first)
  expect((await api.list(projectId, {})).data).toHaveLength(5)
  await expect(api.create(projectId, { ...input, title: 'Different' }, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  expect((await projectApi(client).summary(projectId)).data.assetCounts).toMatchObject({ total: 5, byStatus: { DRAFT: 2, APPROVED: 3 } })
})
it('edits metadata without changing version identity, status or history', async () => {
  const before = (await api.get(id)).data
  const after = (await api.edit(id, { ...input, expectedUpdatedAt: before.updatedAt })).data
  expect(after.status).toBe('APPROVED'); expect(after.latestVersion).toEqual(before.latestVersion)
  expect((await api.get(id)).data.versions).toEqual(before.versions)
  const versions = await client.request(`/assets/${id}/versions`, ApiListSchema(AssetVersionSummarySchema))
  expect(versions.data).toEqual(before.versions)
  await expect(api.edit(id, { ...input, expectedUpdatedAt: before.updatedAt })).rejects.toMatchObject({ code: 'CONFLICT' })
})
it('refuses logical asset approval outside a version decision', async () => {
  const before = (await api.get(id)).data
  await expect(client.request(`/assets/${id}`, ApiResponseSchema(AssetSchema), { method: 'PATCH', body: { status: 'APPROVED', expectedUpdatedAt: before.updatedAt } })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION', status: 409 })
  expect((await api.get(id)).data).toEqual(before)
})
it('archives/restores logical assets while preserving approved versions', async () => {
  const before = (await api.get(id)).data
  const archived = (await api.status(before, 'ARCHIVED')).data
  expect((await api.list(projectId, {})).data).toHaveLength(3)
  expect((await api.list(projectId, { status: 'ARCHIVED', includeArchived: true })).data[0].id).toBe(id)
  expect((await projectApi(client).summary(projectId)).data.assetCounts.byStatus.ARCHIVED).toBe(1)
  const restored = (await api.status(archived, 'DRAFT')).data
  expect(restored.status).toBe('DRAFT'); expect(restored.archivedAt).toBeNull()
  expect((await api.get(id)).data.versions).toEqual(before.versions)
})
it('shares new asset identities and reference links across feature stores', async () => {
  const asset = (await api.create(projectId, input, crypto.randomUUID())).data
  const refs = referenceApi(client); const ref = (await refs.list(projectId, {})).data[0]
  await refs.link(ref.id, { targetType: 'ASSET', targetId: asset.id, usageNote: 'Material study' })
  expect((await api.get(asset.id)).data.referenceLinks).toEqual([{ referenceId: ref.id, relationshipType: 'INSPIRATION', note: 'Material study' }])
  expect((await refs.targets(projectId)).some(target => target.id === asset.id && target.label === input.title)).toBe(true)
  await refs.unlink(ref.id, 'ASSET', asset.id)
  expect((await api.get(asset.id)).data.referenceLinks).toEqual([])
})
it('shows library metadata and no-result state', async () => {
  render(<AssetLibrary client={client} projectId={projectId} />)
  await screen.findByRole('heading', { name: 'Hero Product Reveal' })
  expect(screen.getByLabelText('Latest version direction')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Search assets'), { target: { value: 'does-not-exist' } })
  await screen.findByText('No assets match these filters.')
})
it('shows empty projects and rejects cross-project detail routes', async () => {
  const project = (await projectApi(client).create({ name: 'Empty', template: 'BLANK' }, crypto.randomUUID())).data
  const view = render(<AssetLibrary client={client} projectId={project.id} />)
  await screen.findByText('No assets yet. Create an asset record to begin.'); view.unmount()
  render(<AssetLibrary client={client} projectId={project.id} assetId={id} />)
  await screen.findByText('This asset belongs to a different project.')
  expect(screen.queryByRole('heading', { name: 'Hero Product Reveal' })).toBeNull()
})
it.each(['VIEWER', 'FUTURE_ROLE'])('hides mutations for role %s', async role => {
  server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...solaraProjectFixture, currentUserRole: role } })))
  render(<AssetLibrary client={client} projectId={projectId} assetId={id} />)
  await screen.findByText('Your role can inspect assets but cannot change them.')
  await screen.findByRole('heading', { name: 'Hero Product Reveal' })
  expect(screen.queryByRole('button', { name: 'Edit asset metadata' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Archive asset' })).toBeNull()
})
it('retries a failed read with the server request ID visible', async () => {
  server.use(http.get(`${base}/projects/${projectId}/assets`, () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Asset service unavailable', details: [], requestId: 'asset-request' } }, { status: 500 }), { once: true }))
  render(<AssetLibrary client={client} projectId={projectId} />)
  await screen.findByText('Asset service unavailable'); expect(screen.getByText(/asset-request/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('heading', { name: 'Hero Product Reveal' })
})
it('preserves the metadata draft during conflict comparison', async () => {
  const save = vi.fn().mockRejectedValueOnce(new ApiClientError('Conflict', { code: 'CONFLICT' })).mockResolvedValue(undefined)
  render(<AssetForm asset={assetTargetFixtures[0].asset} owner={solaraProjectFixture.owner} save={save} cancel={() => {}} reload={async () => ({ ...assetTargetFixtures[0].asset, title: 'Server title', updatedAt: '2026-10-10T00:00:00Z' })} />)
  fireEvent.change(screen.getByLabelText('Asset title'), { target: { value: 'My draft' } }); fireEvent.click(screen.getByRole('button', { name: 'Save asset' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Load latest metadata' })); await screen.findByText('Server title')
  expect(screen.getByLabelText('Asset title')).toHaveValue('My draft')
  fireEvent.click(screen.getByRole('button', { name: 'Save asset' }))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'My draft', expectedUpdatedAt: '2026-10-10T00:00:00Z' }), expect.any(String))
})
it('keeps the same creation intent on an unchanged failed retry', async () => {
  const save = vi.fn().mockRejectedValue(new ApiClientError('Network unavailable', { code: 'NETWORK_ERROR' }))
  render(<AssetForm owner={solaraProjectFixture.owner} save={save} cancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save asset' })); expect(save).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Asset title'), { target: { value: 'My asset' } }); fireEvent.click(screen.getByRole('button', { name: 'Save asset' }))
  await screen.findByText('Network unavailable'); const key = save.mock.calls[0][1]
  fireEvent.click(screen.getByRole('button', { name: 'Save asset' })); await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1][1]).toBe(key)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save asset' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Asset title'), { target: { value: 'Changed asset' } }); fireEvent.click(screen.getByRole('button', { name: 'Save asset' }))
  expect(save.mock.calls[2][1]).not.toBe(key)
})
it('handles future enums and unavailable previews without unsafe images', () => {
  const detail = AssetDetailViewSchema.parse({ ...assetTargetFixtures[0].asset, status: 'FUTURE_STATUS', assetType: 'FUTURE_TYPE', versions: [], referenceLinks: [], recentDecisions: [] })
  expect(detail.status).toBe('FUTURE_STATUS')
  const view = render(<><AssetStatus status={detail.status} /><AssetMedia url="javascript:alert(1)" title="Asset" /></>)
  expect(screen.getByText('Unknown')).toBeVisible(); expect(screen.getByText('No preview available')).toBeVisible(); view.unmount()
  render(<AssetMedia url="/missing.jpg" title="Asset" />); fireEvent.error(screen.getByRole('img')); expect(screen.getByText('Preview could not be loaded')).toBeVisible()
})
it('offers only editable logical statuses and never a direct approval control', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<AssetForm asset={assetTargetFixtures[0].asset} owner={solaraProjectFixture.owner} save={save} cancel={() => {}} />)
  expect(screen.queryByRole('option', { name: 'Approved' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Asset status'), { target: { value: 'NEEDS_REVIEW' } }); fireEvent.click(screen.getByRole('button', { name: 'Save asset' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'NEEDS_REVIEW' }), expect.any(String)))
})
