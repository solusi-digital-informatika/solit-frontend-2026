import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { AssetVersionSchema, AssetDetailSchema, ApiResponseSchema } from '../../../packages/contracts/src'
import { createApiClient, ApiClientError } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { solaraProjectFixture } from '../../mocks/fixtures'
import { projectApi } from '../projects/api'
import { directionApi } from '../directions/api'
import { referenceApi } from '../references/api'
import { assetApi, VersionViewSchema } from './api'
import { versionContextApi } from './versionApi'
import { VersionForm } from './VersionForm'
import { VersionWorkspace } from './VersionWorkspace'
import { VersionInspection } from './VersionInspection'
import { isVersionFileUrl } from '../../lib/versionFile'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = assetApi(client); const projectId = solaraProjectFixture.id; const assetId = '00000000-0000-4000-8000-000000000050'; const oldId = '00000000-0000-4000-8000-000000000061'
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
const input = { revisionRationale: 'Refine hero composition', derivedFromVersionId: oldId, metadataOnly: true, status: 'CANDIDATE' as const, prompt: 'Warm product composition', generationSettings: { seed: 42, stylized: false }, recordedAttributes: { mood: ['calm'] } }
it('validates canonical seed details, lineage and exact approved pins', async () => {
  const version = AssetVersionSchema.parse((await api.version(oldId)).data)
  expect(version.lineage.derivedFrom?.id).toBe('00000000-0000-4000-8000-000000000060')
  expect(version.pinnedIn[0]).toMatchObject({ collectionRevisionId: '00000000-0000-4000-8000-000000000071', revisionStatus: 'APPROVED' })
  expect(version.providerName).toBeNull(); expect(version.prompt).toBeNull()
})
it('appends a new version without moving approval or collection pins', async () => {
  const before = (await api.version(oldId)).data
  const next = (await api.createVersion(assetId, input, crypto.randomUUID())).data
  expect(next).toMatchObject({ versionNumber: 3, status: 'CANDIDATE', pinnedIn: [], isMetadataOnly: true, fileUrl: null, externalFileUrl: null })
  const after = (await api.version(oldId)).data
  expect(after.status).toBe('APPROVED'); expect(after.pinnedIn).toEqual(before.pinnedIn)
  const { isLatest: _latest, lineage: _lineage, ...content } = before
  expect(after).toMatchObject(content); expect(after.isLatest).toBe(false); expect(after.lineage.derivedVersions[0].id).toBe(next.id)
  const asset = (await api.get(assetId)).data; expect(asset.latestVersion?.id).toBe(next.id); expect(asset.status).toBe('APPROVED')
  expect(asset.versions.map(value => value.versionNumber)).toEqual([3, 2, 1])
})
it('replays a version intent without allocating another version number', async () => {
  const key = crypto.randomUUID(); const next = (await api.createVersion(assetId, input, key)).data
  expect((await api.createVersion(assetId, input, key)).data).toEqual(next)
  expect((await api.versions(assetId)).map(value => value.versionNumber)).toEqual([3, 2, 1])
  await expect(api.createVersion(assetId, { ...input, revisionRationale: 'Different intent' }, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
})
it('allocates distinct sequential numbers for concurrent creation requests', async () => {
  const results = await Promise.all([api.createVersion(assetId, input, crypto.randomUUID()), api.createVersion(assetId, input, crypto.randomUUID())])
  expect(results.map(value => value.data.versionNumber).sort()).toEqual([3, 4])
  expect((await api.versions(assetId))).toHaveLength(4)
})
it('binds defaults to the active direction and latest brief without rewriting old versions', async () => {
  await directionApi(client).activate(projectId, '00000000-0000-4000-8000-000000000041', 'Use organic art direction')
  const next = (await api.createVersion(assetId, input, crypto.randomUUID())).data
  expect(next.directionRevisionId).toBe('00000000-0000-4000-8000-000000000041')
  expect(next.briefRevisionId).toBe('00000000-0000-4000-8000-000000000020')
  expect((await api.version(oldId)).data.directionRevisionId).toBe('00000000-0000-4000-8000-000000000031')
  expect((await api.list(projectId, { directionId: '00000000-0000-4000-8000-000000000040' })).data[0].id).toBe(assetId)
  expect((await api.list(projectId, { directionId: '00000000-0000-4000-8000-000000000030' })).data.some(value => value.id === assetId)).toBe(false)
})
it('requires an explicit metadata-only declaration or safe file source', async () => {
  await expect(api.createVersion(assetId, { revisionRationale: 'Missing file choice' }, crypto.randomUUID())).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  await expect(api.createVersion(assetId, { revisionRationale: 'Unsafe URL', externalFileUrl: 'javascript:alert(1)' }, crypto.randomUUID())).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  const version = (await api.createVersion(assetId, { revisionRationale: 'User registered local demo file', externalFileUrl: '/demo-assets/hero-v2.jpg', mimeType: 'image/jpeg', width: 640, height: 400 }, crypto.randomUUID())).data
  expect(version).toMatchObject({ isMetadataOnly: false, externalFileUrl: '/demo-assets/hero-v2.jpg', mimeType: 'image/jpeg', width: 640, thumbnailUrl: null, providerName: null })
})
it('validates source asset and cross-project direction, brief and reference identities', async () => {
  await expect(api.createVersion(assetId, { ...input, derivedFromVersionId: '00000000-0000-4000-8000-000000000062' }, crypto.randomUUID())).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  const project = (await projectApi(client).create({ name: 'Another project', template: 'BLANK' }, crypto.randomUUID())).data
  const asset = (await api.create(project.id, { title: 'Other asset', description: null, assetType: 'OTHER', tags: [] }, crypto.randomUUID())).data
  for (const extra of [{ directionRevisionId: '00000000-0000-4000-8000-000000000031' }, { briefRevisionId: '00000000-0000-4000-8000-000000000020' }, { references: [{ referenceId: '00000000-0000-4000-8000-000000000080' }] }]) await expect(api.createVersion(asset.id, { revisionRationale: 'Foreign association', metadataOnly: true, ...extra }, crypto.randomUUID())).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  expect((await api.versions(asset.id))).toEqual([])
})
it('creates asset and initial version atomically and rejects invalid initial input without an asset', async () => {
  const body = { title: 'Initial version asset', assetType: 'OTHER', initialVersion: { revisionRationale: 'Initial version', metadataOnly: true } }
  const result = await client.request(`/projects/${projectId}/assets`, ApiResponseSchema(AssetDetailSchema), { method: 'POST', body, idempotencyKey: crypto.randomUUID() })
  expect(result.data).toMatchObject({ versionCount: 1, latestVersion: { versionNumber: 1 } })
  const count = (await api.list(projectId, {})).data.length
  await expect(client.request(`/projects/${projectId}/assets`, ApiResponseSchema(AssetDetailSchema), { method: 'POST', body: { ...body, initialVersion: { revisionRationale: 'Initial version' } }, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  expect((await api.list(projectId, {})).data).toHaveLength(count)
})
it('allows new exact version IDs to be linked from Reference Board', async () => {
  const version = (await api.createVersion(assetId, { ...input, references: [{ referenceId: '00000000-0000-4000-8000-000000000080', usageNote: 'Material inspiration' }] }, crypto.randomUUID())).data
  const refs = referenceApi(client)
  await refs.link('00000000-0000-4000-8000-000000000080', { targetType: 'ASSET_VERSION', targetId: version.id })
  expect((await refs.targets(projectId)).some(value => value.id === version.id)).toBe(true)
  expect(version.references[0].usageNote).toBe('Material inspiration')
})
it('compares exact versions and permits inspection of the parent lineage', async () => {
  render(<VersionWorkspace client={client} asset={(await api.get(assetId)).data} canEdit created={() => {}} />)
  await screen.findByRole('article', { name: 'Selected version: Version 2' })
  fireEvent.change(screen.getByLabelText('Second version'), { target: { value: '00000000-0000-4000-8000-000000000060' } }); fireEvent.click(screen.getByRole('button', { name: 'Compare versions' }))
  await screen.findByRole('article', { name: 'First version: Version 2' }); await screen.findByRole('article', { name: 'Second version: Version 1' })
  fireEvent.click(within(screen.getByRole('article', { name: 'First version: Version 2' })).getByRole('button', { name: 'Version 1' }))
  await screen.findByRole('article', { name: 'Selected version: Version 1' })
})
it('shows errors with request IDs and retries version reads', async () => {
  server.use(http.get(`${base}/asset-versions/${oldId}`, () => HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Version access unavailable', requestId: 'version-request', details: [] } }, { status: 403 }), { once: true }))
  render(<VersionWorkspace client={client} asset={(await api.get(assetId)).data} canEdit={false} created={() => {}} />)
  await screen.findByText('Version access unavailable'); expect(screen.getByText(/version-request/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByRole('article', { name: 'Selected version: Version 2' })
  expect(screen.queryByRole('button', { name: 'Create new version' })).toBeNull()
})
it('retains input and unchanged idempotency intent after a failed version write', async () => {
  const save = vi.fn().mockRejectedValue(new ApiClientError('Write failed', { code: 'NETWORK_ERROR', requestId: 'write-request' }))
  render(<VersionForm asset={(await api.get(assetId)).data} source={(await api.version(oldId)).data} options={await versionContextApi(client).options(projectId)} save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Revision rationale'), { target: { value: 'Warm lighting revision' } }); fireEvent.change(screen.getByLabelText('Prompt', { exact: true }), { target: { value: '<script>untrusted source</script>' } }); fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))
  await screen.findByText('Write failed'); expect(screen.getByLabelText('Prompt', { exact: true })).toHaveValue('<script>untrusted source</script>')
  const key = save.mock.calls[0][1]; fireEvent.click(screen.getByRole('button', { name: 'Save new version' })); await waitFor(() => expect(save).toHaveBeenCalledTimes(2)); expect(save.mock.calls[1][1]).toBe(key)
})
it('preserves nested settings and requires valid numeric settings/file dimensions', async () => {
  const source = (await api.version(oldId)).data; source.generationSettings = { seed: 42, enabled: false, sampler: { mode: 'fixed' } }; const save = vi.fn().mockResolvedValue(undefined)
  render(<VersionForm asset={(await api.get(assetId)).data} source={source} options={await versionContextApi(client).options(projectId)} save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Revision rationale'), { target: { value: 'New settings version' } }); fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ generationSettings: { seed: 42, enabled: false, sampler: { mode: 'fixed' } } }), expect.any(String)))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save new version' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('File source'), { target: { value: 'external' } }); fireEvent.change(screen.getByLabelText('File URL'), { target: { value: 'https://example.com/file.jpg' } }); fireEvent.change(screen.getByLabelText('Width (px)'), { target: { value: '-2' } }); fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))
  expect(save).toHaveBeenCalledTimes(1); expect(screen.getAllByText(/Use a positive whole number/).length).toBeGreaterThan(0)
})
it('renders metadata-only/future-status versions without unsafe file links', async () => {
  const version = VersionViewSchema.parse({ ...(await api.version(oldId)).data, status: 'FUTURE_STATUS', isMetadataOnly: true, externalFileUrl: 'javascript:alert(1)', fileUrl: null })
  render(<VersionInspection version={version} options={null} inspect={() => {}} prefix="Selected version" />)
  expect(screen.getByText('Metadata-only version — no file attached.')).toBeVisible(); expect(screen.queryByRole('link', { name: 'Open version file' })).toBeNull()
  expect(screen.getByText('Unknown')).toBeVisible()
})
it('rejects unsafe file sources and normalized demo-path escapes', () => {
  for (const url of ['javascript:alert(1)', 'file:///private.jpg', '//example.com/file.jpg', 'https://user:password@example.com/file.jpg', '/demo-assets/../private.jpg', '/demo-assets/%2e%2e/private.jpg']) expect(isVersionFileUrl(url)).toBe(false)
  expect(isVersionFileUrl(' https://example.com/file.jpg ')).toBe(true)
  expect(isVersionFileUrl('/demo-assets/hero-v2.jpg')).toBe(true)
})
