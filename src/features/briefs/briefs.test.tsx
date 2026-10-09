import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { ApiListSchema, ApiResponseSchema, BriefRevisionSchema, type BriefRevisionInput } from '../../../packages/contracts/src'
import { createApiClient, createIntentKey } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { solaraBriefFixture } from '../../mocks/briefs'
import { solaraProjectFixture } from '../../mocks/fixtures'
import { projectApi } from '../projects/api'
import { briefApi } from './api'
import { BriefPage } from './BriefPage'
import { BriefDetail } from './BriefDetail'

const base = 'http://localhost:3001/api/v1'
const server = setupServer()
const client = createApiClient(base)
const api = briefApi(client)
const projectId = solaraProjectFixture.id
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
function revisionInput(): BriefRevisionInput {
  return { title: 'Revised campaign brief', objective: 'A changed objective', targetAudience: null, deliverables: ['Hero'], requirements: [], constraints: [], forbiddenAttributes: [], acceptanceCriteria: [], sourceText: '<script>unsafe()</script>', changeSummary: 'Change campaign objective' }
}
function renderBrief(id = projectId) { return render(<BriefPage client={client} projectId={id} />) }

describe('brief API invariants', () => {
  it('uses the canonical seed revision and immutable append-only writes', async () => {
    expect(BriefRevisionSchema.parse(solaraBriefFixture).id).toBe('00000000-0000-4000-8000-000000000020')
    const before = (await api.get(solaraBriefFixture.id)).data
    const created = (await api.create(projectId, revisionInput())).data
    expect(created.revisionNumber).toBe(2)
    expect(created.id).not.toBe(before.id)
    expect((await api.get(before.id)).data).toEqual(before)
    expect((await api.latest(projectId))?.id).toBe(created.id)
    expect((await api.list(projectId)).data.map(value => value.revisionNumber)).toEqual([2, 1])
    expect(ApiResponseSchema(BriefRevisionSchema).parse({ data: created }).data).toEqual(created)
  })
  it('requires a change summary after the first revision', async () => {
    await expect(api.create(projectId, { ...revisionInput(), changeSummary: null })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'body.changeSummary' }] })
    expect((await api.list(projectId)).data).toHaveLength(1)
  })
  it('creates the first revision from minimal fields and assigns missing attribute IDs', async () => {
    const created = await projectApi(client).create({ name: 'Blank', template: 'BLANK' }, createIntentKey())
    expect(await api.latest(created.data.id)).toBeNull()
    const result = await client.request(`/projects/${created.data.id}/brief-revisions`, ApiResponseSchema(BriefRevisionSchema), { method: 'POST', body: { title: 'First brief', objective: 'First objective', requirements: [{ category: 'LIGHTING', label: 'Lighting', value: 'soft', hard: true }] } })
    expect(result.data.revisionNumber).toBe(1)
    expect(result.data.changeSummary).toBeNull()
    expect(result.data.constraints).toEqual([])
    expect(result.data.requirements[0].id).toBeTruthy()
  })
  it('handles missing records and pages through history', async () => {
    await api.create(projectId, revisionInput())
    const first = await client.request(`/projects/${projectId}/brief-revisions`, ApiListSchema(BriefRevisionSchema), { query: { limit: 1 } })
    expect(first.data[0].revisionNumber).toBe(2)
    const next = await client.request(`/projects/${projectId}/brief-revisions`, ApiListSchema(BriefRevisionSchema), { query: { limit: 1, cursor: first.page.nextCursor! } })
    expect(next.data[0].id).toBe(solaraBriefFixture.id)
    await expect(api.get(crypto.randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(api.list(crypto.randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('brief screens', () => {
  it('shows the brief, creates a revision and opens preserved history', async () => {
    renderBrief()
    expect(screen.getByText('Loading brief…')).toBeInTheDocument()
    await screen.findByRole('heading', { name: solaraBriefFixture.title })
    fireEvent.click(screen.getByRole('button', { name: 'Create new revision' }))
    fireEvent.change(screen.getByLabelText(/Brief title/), { target: { value: 'New campaign title' } })
    fireEvent.change(screen.getByLabelText(/Change summary/), { target: { value: 'Updated title' } })
    const form = screen.getByRole('form')
    fireEvent.submit(form); fireEvent.submit(form)
    expect(await screen.findByText('New brief revision saved. Earlier revisions are unchanged.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'New campaign title' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Revision 1' }))
    expect(await screen.findByRole('heading', { name: solaraBriefFixture.title })).toBeInTheDocument()
    expect(screen.getByText('Revision 1 · Historical revision')).toBeInTheDocument()
    expect((await api.list(projectId)).data).toHaveLength(2)
  })
  it('requires a summary and keeps the unsaved draft on validation failure', async () => {
    renderBrief()
    fireEvent.click(await screen.findByRole('button', { name: 'Create new revision' }))
    fireEvent.change(screen.getByLabelText(/Objective/), { target: { value: 'My changed draft' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Explain what changed')
    expect(screen.getByLabelText(/Objective/)).toHaveValue('My changed draft')
    expect((await api.list(projectId)).data).toHaveLength(1)
  })
  it('edits structured requirements and preserves IDs/metadata in the request', async () => {
    renderBrief()
    fireEvent.click(await screen.findByRole('button', { name: 'Create new revision' }))
    fireEvent.change(screen.getByLabelText(/Change summary/), { target: { value: 'Add lighting constraint' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add attribute · Required attributes' }))
    fireEvent.change(screen.getByLabelText('Attribute label'), { target: { value: 'Lighting quality' } })
    fireEvent.change(screen.getByLabelText('Attribute value'), { target: { value: 'soft' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'LIGHTING' } })
    fireEvent.click(screen.getByLabelText('Hard constraint'))
    fireEvent.submit(screen.getByRole('form'))
    await screen.findByText('New brief revision saved. Earlier revisions are unchanged.')
    expect((await api.latest(projectId))?.requirements[0]).toMatchObject({ label: 'Lighting quality', category: 'LIGHTING', value: 'soft', hard: true })
  })
  it('preserves input and maps backend validation errors into fields', async () => {
    server.use(http.post(`${base}/projects/${projectId}/brief-revisions`, () => HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Brief validation failed.', requestId: 'brief-request', details: [{ path: 'body.title', message: 'Choose a specific title.' }] } }, { status: 400 })))
    renderBrief()
    fireEvent.click(await screen.findByRole('button', { name: 'Create new revision' }))
    fireEvent.change(screen.getByLabelText(/Change summary/), { target: { value: 'Keep changes' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('brief-request')
    expect(screen.getByLabelText(/Change summary/)).toHaveValue('Keep changes')
    expect(screen.getByLabelText(/Brief title/)).toHaveAttribute('aria-invalid', 'true')
  })
  it('shows retry for a failed read and read-only controls for viewers', async () => {
    server.use(http.get(`${base}/projects/${projectId}/brief-revisions`, () => HttpResponse.error()))
    renderBrief()
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the API')
    server.resetHandlers(...createHandlers(base))
    server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...solaraProjectFixture, currentUserRole: 'VIEWER' } })))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Your role can view briefs but cannot create revisions.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create new revision' })).not.toBeInTheDocument()
  })
  it('handles a blank project and creates its initial brief', async () => {
    const project = await projectApi(client).create({ name: 'New project', template: 'BLANK' }, createIntentKey())
    renderBrief(project.data.id)
    expect(await screen.findByText('No brief yet. Capture the purpose and requirements of this project.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create brief' }))
    fireEvent.change(screen.getByLabelText(/Brief title/), { target: { value: 'First title' } })
    fireEvent.change(screen.getByLabelText(/Objective/), { target: { value: 'First objective' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('heading', { name: 'First title' })).toBeInTheDocument()
  })
  it('renders source text safely and unknown attribute categories without crashing', () => {
    const sourceText = '<img src=x onerror=alert(1)><script>unsafe()</script>'
    render(<BriefDetail latestId={solaraBriefFixture.id} revision={{ ...solaraBriefFixture, sourceText, requirements: [{ id: crypto.randomUUID(), category: 'FUTURE', label: 'Future attribute', value: 'value', hard: false }] }} />)
    const article = screen.getByRole('article')
    expect(within(article).getByText(sourceText)).toBeInTheDocument()
    expect(article.querySelector('script, img')).toBeNull()
    expect(within(article).getByText(/Unknown category/)).toBeInTheDocument()
  })
  it('keeps the form open and warns about ambiguous network save failures', async () => {
    server.use(http.post(`${base}/projects/${projectId}/brief-revisions`, () => HttpResponse.error()))
    renderBrief()
    fireEvent.click(await screen.findByRole('button', { name: 'Create new revision' }))
    fireEvent.change(screen.getByLabelText(/Change summary/), { target: { value: 'Unsaved change' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('check revision history before submitting again')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save new revision' })).toBeEnabled())
  })
})
