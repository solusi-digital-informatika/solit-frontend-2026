import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { CollectionDetailSchema, CollectionRevisionSchema } from '../../../packages/contracts/src'
import { createApiClient, ApiClientError } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { projectApi } from '../projects/api'
import { assetApi } from '../assets/api'
import { decisionApi } from '../decisions/api'
import { directionApi } from '../directions/api'
import { collectionApi } from './api'
import { CollectionsPage } from './CollectionsPage'
import { CollectionForm, PinForm, ReviewForm, RevisionForm } from './CollectionForms'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = collectionApi(client); const assets = assetApi(client)
const id = (suffix: string) => `00000000-0000-4000-8000-000000000${suffix}`; const projectId = id('010'); const collectionId = id('070'); const revisionId = id('071')
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => { server.resetHandlers(...createHandlers(base)); vi.restoreAllMocks() })
afterAll(() => server.close())
async function draft() { return (await api.revise(collectionId, { basedOnRevisionId: revisionId, changeSummary: 'Adapt campaign deliverable' }, crypto.randomUUID())).data }
it('validates the seeded approved collection and exact ordered pins', async () => {
  const collection = CollectionDetailSchema.parse((await api.get(collectionId)).data); expect(collection).toMatchObject({ status: 'APPROVED', approvedRevisionId: revisionId })
  const revision = CollectionRevisionSchema.parse((await api.revision(revisionId)).data); expect(revision.items.map(item => [item.position, item.pinnedVersion.id, item.isStale])).toEqual([[1, id('061'), false], [2, id('062'), false], [3, id('063'), false]])
  expect(revision.approvals[0].decision).toBe('APPROVED')
})
it('preserves approved pins after new versions and clones exact stale pins into a draft', async () => {
  const old = (await assets.version(id('061'))).data; const next = (await assets.createVersion(id('050'), { metadataOnly: true, revisionRationale: 'Warm composition variation' }, crypto.randomUUID())).data
  const first = (await api.revision(revisionId)).data; expect(first.items[0]).toMatchObject({ pinnedVersion: { id: id('061') }, latestVersion: { id: next.id }, isStale: true, newerVersionCount: 1 })
  const copy = await draft(); expect(copy.items.map(item => item.pinnedVersion.id)).toEqual(first.items.map(item => item.pinnedVersion.id)); expect(copy.items[0].id).not.toBe(first.items[0].id); expect(copy.staleItemCount).toBe(1)
  const after = (await assets.version(id('061'))).data; expect(after.status).toBe(old.status); expect(after.pinnedIn.map(pin => pin.collectionRevisionId)).toContain(revisionId); expect(after.pinnedIn.map(pin => pin.collectionRevisionId)).toContain(copy.id)
  expect((await projectApi(client).summary(projectId)).data.staleCollectionItemCount).toBe(1)
})
it('requires a same-asset explicit replacement rationale and records the exact pin decision', async () => {
  const revision = await draft(); const item = revision.items[0]; const next = (await assets.createVersion(id('050'), { metadataOnly: true, revisionRationale: 'New campaign hero' }, crypto.randomUUID())).data
  await expect(api.item(item.id, { assetVersionId: next.id })).rejects.toMatchObject({ status: 400 })
  await expect(api.item(item.id, { assetVersionId: id('062'), rationale: 'Wrong asset replacement' })).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  const changed = (await api.item(item.id, { assetVersionId: next.id, rationale: 'Use the warm hero in this draft only' })).data; expect(changed.pinnedVersion.id).toBe(next.id); expect(changed.isStale).toBe(false)
  expect((await api.revision(revisionId)).data.items[0].pinnedVersion.id).toBe(id('061'))
  const decisions = (await decisionApi(client).list(projectId, { collectionRevisionId: revision.id, decisionType: 'REPLACE_PINNED_VERSION' })).data; expect(decisions[0]).toMatchObject({ assetVersionId: next.id, rationale: 'Use the warm hero in this draft only' })
})
it('reviews the draft, freezes items and supersedes the previous approval without approving asset versions', async () => {
  const revision = await draft(); const candidate = (await assets.version(id('064'))).data
  await api.add(revision.id, { assetVersionId: id('064') }); await api.review(revision.id, 'submit-review')
  await expect(api.item(revision.items[0].id, { note: 'Frozen edit' })).rejects.toMatchObject({ code: 'REVISION_FROZEN' })
  await expect(api.remove(revision.items[0].id)).rejects.toMatchObject({ code: 'REVISION_FROZEN' })
  const approved = (await api.review(revision.id, 'approve', { comment: 'Approved exact deliverable pins' })).data; expect(approved.status).toBe('APPROVED'); expect(approved.approvals[0]).toMatchObject({ decision: 'APPROVED', comment: 'Approved exact deliverable pins' })
  expect((await api.revision(revisionId)).data.status).toBe('SUPERSEDED'); expect((await api.get(collectionId)).data.approvedRevisionId).toBe(revision.id)
  expect((await assets.version(id('064'))).data.status).toBe(candidate.status); expect((await assets.version(id('061'))).data.pinnedIn.find(pin => pin.collectionRevisionId === revisionId)?.revisionStatus).toBe('SUPERSEDED')
  await expect(api.review(revision.id, 'approve')).rejects.toMatchObject({ status: 409 })
})
it('rejects an empty submit and continues changes-requested work in a new immutable revision', async () => {
  const collection = (await api.create(projectId, { name: 'Review round', collectionType: 'REVIEW_ROUND' }, crypto.randomUUID())).data; const rev = collection.latestRevision.id
  await expect(api.review(rev, 'submit-review')).rejects.toMatchObject({ status: 400 }); await api.add(rev, { assetVersionId: id('061') }); await api.review(rev, 'submit-review')
  const rejected = (await api.review(rev, 'reject', { decision: 'CHANGES_REQUESTED', comment: 'Please refine the collection sequence' })).data; expect(rejected.status).toBe('REJECTED'); expect(rejected.approvals[0].decision).toBe('CHANGES_REQUESTED')
  const next = (await api.revise(collection.id, { changeSummary: 'Apply reviewer feedback' }, crypto.randomUUID())).data; expect(next.items[0].pinnedVersion.id).toBe(id('061')); expect(next.approvals).toEqual([]); expect((await api.revision(rev)).data).toEqual(rejected)
})
it('creates and replays collections and revisions without duplicate pins or open drafts', async () => {
  const key = crypto.randomUUID(); const input = { name: 'Pitch', collectionType: 'PRESENTATION' as const, items: [{ assetVersionId: id('061') }] }
  const first = await api.create(projectId, input, key); expect(await api.create(projectId, input, key)).toEqual(first); await expect(api.create(projectId, { ...input, name: 'Changed intent' }, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  const revisionKey = crypto.randomUUID(); const body = { basedOnRevisionId: revisionId, changeSummary: 'Exact pin copy' }; const revision = await api.revise(collectionId, body, revisionKey); expect(await api.revise(collectionId, body, revisionKey)).toEqual(revision)
  await expect(api.revise(collectionId, body, crypto.randomUUID())).rejects.toMatchObject({ code: 'OPEN_REVISION_EXISTS' })
  expect((await api.revisions(collectionId))).toHaveLength(2)
})
it('keeps positions gapless after insertion, reordering and removal and rejects duplicate assets', async () => {
  const revision = await draft(); await api.add(revision.id, { assetVersionId: id('064'), position: 2 }); await expect(api.add(revision.id, { assetVersionId: id('060') })).rejects.toMatchObject({ code: 'ASSET_ALREADY_PINNED' })
  await api.item(revision.items[2].id, { position: 1, role: 'Background', note: 'Opening context' }); const reordered = (await api.revision(revision.id)).data; expect(reordered.items.map(item => item.position)).toEqual([1, 2, 3, 4]); expect(reordered.items[0].pinnedVersion.id).toBe(id('063'))
  const removed = (await api.remove(reordered.items[1].id)).data; expect(removed.items.map(item => item.position)).toEqual([1, 2, 3])
  await expect(api.item(removed.items[0].id, { position: 20 })).rejects.toMatchObject({ status: 400 })
})
it('rejects foreign-project versions and metadata conflicts while preserving revisions', async () => {
  const foreign = (await projectApi(client).create({ name: 'Other project', template: 'BLANK' }, crypto.randomUUID())).data
  await expect(api.create(foreign.id, { name: 'Foreign pins', collectionType: 'OTHER', items: [{ assetVersionId: id('061') }] }, crypto.randomUUID())).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  const before = (await api.revision(revisionId)).data; const collection = (await api.get(collectionId)).data; await api.edit(collectionId, { name: 'Updated metadata', expectedUpdatedAt: collection.updatedAt })
  await expect(api.edit(collectionId, { name: 'Stale edit', expectedUpdatedAt: collection.updatedAt })).rejects.toMatchObject({ code: 'CONFLICT' })
  expect((await api.revision(revisionId)).data.items).toEqual(before.items)
})
it('filters and paginates collections and archives without removing pin history', async () => {
  const collection = (await api.create(projectId, { name: 'Another set', collectionType: 'OTHER' }, crypto.randomUUID())).data
  expect((await api.list(projectId, { collectionType: 'OTHER' })).data.map(value => value.id)).toEqual([collection.id]); const response = await fetch(`${base}/projects/${projectId}/collections?limit=1`); const page = await response.json(); expect((await api.list(projectId, { cursor: page.page.nextCursor })).data).toHaveLength(1)
  const seed = (await api.get(collectionId)).data; const archived = (await api.edit(collectionId, { archived: true, expectedUpdatedAt: seed.updatedAt })).data; expect((await api.list(projectId, {})).data.map(value => value.id)).not.toContain(collectionId); expect((await api.list(projectId, { includeArchived: true, status: 'ARCHIVED' })).data[0].id).toBe(collectionId)
  expect((await api.revision(revisionId)).data.items).toHaveLength(3); await api.edit(collectionId, { archived: false, expectedUpdatedAt: archived.updatedAt }); expect((await api.get(collectionId)).data.status).toBe('APPROVED')
})
it('preserves collection records when the active direction changes', async () => {
  const before = await Promise.all([api.get(collectionId), api.revision(revisionId)])
  await directionApi(client).activate(projectId, id('041'), 'Switch campaign direction')
  expect(await Promise.all([api.get(collectionId), api.revision(revisionId)])).toEqual(before)
})
it('preserves creation intent and draft on unconfirmed writes', async () => {
  const save = vi.fn().mockRejectedValue(new ApiClientError('Unconfirmed creation', { code: 'NETWORK_ERROR', requestId: 'collection-request' })); render(<CollectionForm versions={[]} save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Collection name'), { target: { value: 'My draft collection' } }); fireEvent.click(screen.getByRole('button', { name: 'Save collection' })); await screen.findByText(/collection-request/); expect(screen.getByLabelText('Collection name')).toHaveValue('My draft collection')
  fireEvent.click(screen.getByRole('button', { name: 'Save collection' })); await waitFor(() => expect(save).toHaveBeenCalledTimes(2)); expect(save.mock.calls[1][1]).toBe(save.mock.calls[0][1])
})
it('loads conflicting metadata for comparison without discarding the draft', async () => {
  const collection = (await api.get(collectionId)).data; const save = vi.fn().mockRejectedValue(new ApiClientError('Conflict', { code: 'CONFLICT' })); render(<CollectionForm collection={collection} versions={[]} save={save} cancel={() => {}} reload={async () => ({ ...collection, name: 'Server name', updatedAt: '2026-10-10T00:00:00Z' })} />)
  fireEvent.change(screen.getByLabelText('Collection name'), { target: { value: 'Preserved draft' } }); fireEvent.click(screen.getByRole('button', { name: 'Save collection' })); await screen.findByText('Conflict'); fireEvent.click(screen.getByRole('button', { name: 'Reload collection' })); await screen.findByText(/Latest server metadata: Server name/); expect(screen.getByLabelText('Collection name')).toHaveValue('Preserved draft')
})
it('requires replacement rationale and explicit confirmation before saving a different pin', async () => {
  const item = (await api.revision(revisionId)).data.items[0]; const save = vi.fn().mockResolvedValue(undefined); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<PinForm item={item} count={3} versions={[{ id: id('061'), assetId: id('050'), title: 'Hero', label: 'Hero v2' }, { id: id('060'), assetId: id('050'), title: 'Hero', label: 'Hero v1' }]} save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Asset version'), { target: { value: id('060') } }); fireEvent.click(screen.getByRole('button', { name: 'Save item' })); expect(save).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText('Replacement rationale'), { target: { value: 'Use the exact earlier composition' } }); fireEvent.click(screen.getByRole('button', { name: 'Save item' })); expect(confirm).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled()
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Save item' })); await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ assetVersionId: id('060'), rationale: 'Use the exact earlier composition' })))
})
it('requires review comments and confirms consequential review operations', async () => {
  const save = vi.fn(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); render(<ReviewForm action="reject" save={save} cancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm review decision' })); expect(save).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText('Review comment'), { target: { value: 'Adjust the presentation sequence' } }); fireEvent.click(screen.getByRole('button', { name: 'Confirm review decision' })); await waitFor(() => expect(save).toHaveBeenCalledWith({ decision: 'CHANGES_REQUESTED', comment: 'Adjust the presentation sequence' })); expect(confirm).toHaveBeenCalledTimes(1)
})
it('retains an unchanged draft revision intent key on recoverable errors', async () => {
  const collection = (await api.get(collectionId)).data; const save = vi.fn().mockRejectedValue(new ApiClientError('Try later', { code: 'NETWORK_ERROR' })); render(<RevisionForm revisions={collection.revisions} selectedId={revisionId} save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Revision change summary'), { target: { value: 'Draft with unchanged pins' } }); fireEvent.click(screen.getByRole('button', { name: 'Create draft revision' })); await screen.findByText('Try later'); fireEvent.click(screen.getByRole('button', { name: 'Create draft revision' })); await waitFor(() => expect(save).toHaveBeenCalledTimes(2)); expect(save.mock.calls[0][1]).toBe(save.mock.calls[1][1])
})
it.each(['VIEWER', 'FUTURE_ROLE'])('shows exact pins but hides collection editing for %s', async role => {
  const project = (await projectApi(client).get(projectId)).data; server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...project, currentUserRole: role } })))
  render(<CollectionsPage client={client} projectId={projectId} collectionId={collectionId} />); await screen.findByText('Your role can inspect collections but cannot edit them.'); await screen.findAllByRole('link', { name: 'Inspect pinned version' }); expect(screen.queryByRole('button', { name: 'Create draft revision' })).not.toBeInTheDocument()
})
it('rejects collection detail from another project and displays read errors with request IDs', async () => {
  const collection = (await api.get(collectionId)).data; server.use(http.get(`${base}/collections/${collectionId}`, () => HttpResponse.json({ data: { ...collection, projectId: crypto.randomUUID() } })))
  render(<CollectionsPage client={client} projectId={projectId} collectionId={collectionId} />); await screen.findByText('This collection belongs to another project.'); expect(screen.queryByRole('link', { name: 'Inspect pinned version' })).not.toBeInTheDocument()
})
