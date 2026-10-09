import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { createHandlers } from '../../mocks/handlers'
import { referenceFixtures } from '../../mocks/references'
import { createApiClient, ApiClientError } from '../../lib/api/client'
import { ApiListSchema, ReferenceSchema, ApiResponseSchema, ReferenceAttributeSchema } from '../../../packages/contracts/src'
import { referenceApi, ReferenceViewSchema } from './api'
import { projectApi } from '../projects/api'
import { directionApi } from '../directions/api'
import { ReferenceBoard } from './ReferenceBoard'
import { ReferenceForm } from './ReferenceForm'
import { ReferenceDetail } from './ReferenceDetail'
import { ReferencePreview } from './SafeMedia'
import { safeUrl } from './display'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = referenceApi(client); const projectId = referenceFixtures[0].projectId; const id = referenceFixtures[0].id
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
const create = () => api.create(projectId, { title: 'Reference source', sourceType: 'PUBLIC_URL', sourceUrl: 'https://example.com/material', usageRightsNote: 'Permission pending', tags: ['metal'] })
it('validates canonical fixtures and paginates/filter references', async () => {
  referenceFixtures.forEach(value => ReferenceSchema.parse(value))
  const first = await client.request(`/projects/${projectId}/references`, ApiListSchema(ReferenceSchema), { query: { limit: 1 } })
  const second = await api.list(projectId, { cursor: first.page.nextCursor! })
  expect(second.data[0].id).not.toBe(first.data[0].id)
  expect((await api.list(projectId, { tag: 'organic' })).data[0].title).toBe('Warm timber studio')
  expect((await api.list(projectId, { q: 'steel', sourceType: 'DEMO_ASSET' })).data).toHaveLength(1)
})
it('registers URL metadata without fetching or generating a preview', async () => {
  const value = (await create()).data
  expect(value).toMatchObject({ sourceType: 'PUBLIC_URL', thumbnailUrl: null, fileUrl: null, usageRightsNote: 'Permission pending' })
  await expect(api.create(projectId, { title: 'Unsafe', sourceType: 'PUBLIC_URL', sourceUrl: 'javascript:alert(1)' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
})
it('rejects stale metadata and preserves the confirmed copy', async () => {
  const before = (await api.get(id)).data
  const metadata = { title: 'Updated steel', description: null, usageRightsNote: 'Permission reviewed', tags: [], expectedUpdatedAt: before.updatedAt }
  await api.edit(id, metadata)
  await expect(api.edit(id, { ...metadata, title: 'Stale overwrite' })).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
  expect((await api.get(id)).data.title).toBe('Updated steel')
})
it('adds confirmed human attributes and retains provenance on correction', async () => {
  const item = (await api.addAttribute(id, 'MATERIAL', 'Steel', null)).data
  expect(item).toMatchObject({ origin: 'USER_PROVIDED', reviewStatus: 'CONFIRMED' })
  const corrected = await client.request(`/reference-attributes/${item.id}`, ApiResponseSchema(ReferenceAttributeSchema), { method: 'PATCH', body: { value: { text: 'Brushed steel' } } })
  expect(corrected.data).toMatchObject({ origin: 'USER_PROVIDED', reviewStatus: 'CORRECTED' })
  expect((await api.list(projectId, { attributeType: 'MATERIAL', q: 'brushed' })).data).toHaveLength(1)
})
it('links exact revisions/assets/versions idempotently without changing their records', async () => {
  const before = await directionApi(client).list(projectId)
  const targets = await api.targets(projectId)
  expect(new Set(targets.map(value => value.type)).size).toBe(3)
  const version = targets.find(value => value.id.endsWith('060'))!
  const input = { targetType: version.type, targetId: version.id }
  await api.link(id, input); const linked = (await api.link(id, input)).data
  expect(linked.links.filter(value => value.targetId === version.id)).toHaveLength(1)
  expect(await directionApi(client).list(projectId)).toEqual(before)
  expect((await api.unlink(id, version.type, version.id)).data.links.some(value => value.targetId === version.id)).toBe(false)
})
it('rejects cross-project links and missing targets', async () => {
  const other = (await projectApi(client).create({ name: 'Other', template: 'BLANK' }, crypto.randomUUID())).data
  const ref = (await api.create(other.id, { title: 'Other ref', sourceType: 'PUBLIC_URL', sourceUrl: 'https://example.com' })).data
  await expect(api.link(ref.id, { targetType: 'ASSET', targetId: '00000000-0000-4000-8000-000000000050' })).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  await expect(api.link(id, { targetType: 'ASSET', targetId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
it('archives/restores without discarding metadata or links', async () => {
  const before = (await api.get(id)).data; const archived = (await api.archive(before, true)).data
  expect((await api.list(projectId, {})).data.some(value => value.id === id)).toBe(false)
  expect((await api.list(projectId, { includeArchived: true })).data.some(value => value.id === id)).toBe(true)
  const restored = (await api.archive(archived, false)).data
  expect(restored.links).toEqual(before.links); expect(restored.archivedAt).toBeNull()
})
it('loads board rights and permits inspection', async () => {
  render(<ReferenceBoard client={client} projectId={projectId} />)
  await screen.findByText('Brushed steel macro')
  expect(screen.getAllByText(referenceFixtures[0].usageRightsNote!)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Inspect reference: Brushed steel macro' }))
  await screen.findByRole('button', { name: 'Back to reference board' })
  expect(screen.getByText('Cold Industrial · Revision 1', { exact: true })).toBeVisible()
})
it('hides write controls for a viewer', async () => {
  const data = (await projectApi(client).get(projectId)).data
  server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...data, currentUserRole: 'VIEWER' } })))
  render(<ReferenceBoard client={client} projectId={projectId} />)
  await screen.findByText('Your role can inspect references but cannot change them.')
  expect(screen.queryByRole('button', { name: 'Register reference' })).toBeNull()
})
it('retains drafts after conflict and allows comparison before saving again', async () => {
  const save = vi.fn().mockRejectedValueOnce(new ApiClientError('Conflict', { code: 'CONFLICT' })).mockResolvedValue(undefined)
  render(<ReferenceForm reference={referenceFixtures[0]} save={save} cancel={() => {}} reload={async () => ({ ...referenceFixtures[0], title: 'Server title', updatedAt: '2026-10-10T00:00:00Z' })} />)
  fireEvent.change(screen.getByLabelText('Reference title'), { target: { value: 'My draft' } }); fireEvent.click(screen.getByRole('button', { name: 'Save reference' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Load latest metadata' }))
  await screen.findByText('Server title'); expect(screen.getByLabelText('Reference title')).toHaveValue('My draft')
  fireEvent.click(screen.getByRole('button', { name: 'Save reference' }))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'My draft', expectedUpdatedAt: '2026-10-10T00:00:00Z' }))
})
it('rejects relative/unsafe URL input and handles missing/broken images', async () => {
  const save = vi.fn(); const view = render(<ReferenceForm save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Reference title'), { target: { value: 'Source' } }); fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: '/local' } }); fireEvent.click(screen.getByRole('button', { name: 'Save reference' }))
  expect(save).not.toHaveBeenCalled(); view.unmount()
  expect(safeUrl('javascript:alert(1)')).toBeNull(); expect(safeUrl('https://user:pass@example.com')).toBeNull()
  const preview = render(<ReferencePreview url={null} title="Texture" />); expect(screen.getByText('No preview available')).toBeVisible(); preview.unmount()
  render(<ReferencePreview url="/missing.jpg" title="Texture" />); fireEvent.error(screen.getByRole('img')); expect(screen.getByText('Preview could not be loaded')).toBeVisible()
})
it('displays AI provenance and unknown enum fallback as text', () => {
  const reference = ReferenceViewSchema.parse({ ...referenceFixtures[0], sourceType: 'FUTURE_SOURCE', attributes: [{ id: crypto.randomUUID(), referenceId: id, attributeType: 'MOOD', value: { text: 'Calm', hex: null }, origin: 'AI_INFERRED', reviewStatus: 'UNREVIEWED', createdBy: referenceFixtures[0].addedBy, createdAt: referenceFixtures[0].createdAt, updatedAt: referenceFixtures[0].updatedAt }] })
  render(<ReferenceDetail reference={reference} api={api} targets={[]} canEdit={false} updated={() => {}} close={() => {}} />)
  expect(screen.getByText(/AI-inferred/)).toBeVisible(); expect(screen.getByText('Unknown')).toBeVisible()
})
it('shows a failed list request and retries the read', async () => {
  server.use(http.get(`${base}/projects/${projectId}/references`, () => HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Access denied', details: [], requestId: 'ref-request' } }, { status: 403 }), { once: true }))
  render(<ReferenceBoard client={client} projectId={projectId} />)
  await screen.findByText('Access denied'); expect(screen.getByText(/ref-request/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('Brushed steel macro')
})
it('keeps an attribute draft on a failed write', async () => {
  server.use(http.post(`${base}/references/${id}/attributes`, () => HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Check the supplied attribute', details: [], requestId: 'attribute-request' } }, { status: 400 })))
  render(<ReferenceDetail reference={referenceFixtures[0]} api={api} targets={[]} canEdit updated={() => {}} close={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add attribute' })); fireEvent.change(screen.getByLabelText('Attribute value'), { target: { value: 'My material draft' } }); fireEvent.click(screen.getByRole('button', { name: 'Save attribute' }))
  await screen.findByText(/Check the supplied attribute/); expect(screen.getByLabelText('Attribute value')).toHaveValue('My material draft')
})
