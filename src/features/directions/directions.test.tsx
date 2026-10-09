import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { ApiResponseSchema, DirectionSchema, DirectionRevisionSchema, DirectionRevisionInputSchema } from '../../../packages/contracts/src'
import { createApiClient, createIntentKey } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { warmOrganicFixture } from '../../mocks/directions'
import { coldIndustrialFixture } from '../../mocks/projectSummary'
import { solaraProjectFixture } from '../../mocks/fixtures'
import { projectApi } from '../projects/api'
import { briefApi } from '../briefs/api'
import { directionApi } from './api'
import { DirectionsPage } from './DirectionsPage'

const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = directionApi(client); const projectId = solaraProjectFixture.id
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
const input = () => DirectionRevisionInputSchema.parse({ ...coldIndustrialFixture.latestRevision, changeSummary: 'Change lighting quality', lighting: { ...coldIndustrialFixture.latestRevision.lighting, quality: 'soft' } })

describe('direction API integrity', () => {
  it('validates both canonical seed directions and their UUIDs', async () => {
    expect(DirectionSchema.parse(warmOrganicFixture).latestRevision.id).toBe('00000000-0000-4000-8000-000000000041')
    expect((await api.list(projectId)).map(value => value.name)).toEqual(['Cold Industrial', 'Warm Organic'])
  })
  it('appends immutable revisions without moving the active project revision', async () => {
    const original = (await api.revisions(coldIndustrialFixture.id))[0]
    const revised = (await api.revise(coldIndustrialFixture.id, input())).data
    expect(revised.revisionNumber).toBe(2)
    expect((await api.revisions(coldIndustrialFixture.id)).find(value => value.id === original.id)).toEqual(original)
    const summary = (await projectApi(client).summary(projectId)).data
    expect(summary.project.activeDirectionRevisionId).toBe(original.id)
    expect(summary.activeDirection?.revision.id).toBe(original.id)
    expect(summary.activeDirection?.direction.latestRevision.id).toBe(revised.id)
  })
  it('clones attributes to a new draft with new revision identity', async () => {
    const cloned = (await api.create(projectId, { name: 'Alternative', revision: DirectionRevisionInputSchema.parse(warmOrganicFixture.latestRevision), cloneFromDirectionRevisionId: warmOrganicFixture.latestRevision.id })).data
    expect(cloned.status).toBe('DRAFT'); expect(cloned.isActive).toBe(false)
    expect(cloned.id).not.toBe(warmOrganicFixture.id)
    expect(cloned.latestRevision.palette).toEqual(warmOrganicFixture.latestRevision.palette)
    expect(cloned.latestRevision.id).not.toBe(warmOrganicFixture.latestRevision.id)
    expect((await api.list(projectId)).find(value => value.id === warmOrganicFixture.id)).toEqual(warmOrganicFixture)
  })
  it('activates an exact revision and records a human decision without changing the brief or counts', async () => {
    const before = (await projectApi(client).summary(projectId)).data
    const briefBefore = await briefApi(client).latest(projectId)
    const versionsBefore = await api.revisions(coldIndustrialFixture.id)
    const result = (await api.activate(projectId, warmOrganicFixture.latestRevision.id, 'Move to the organic campaign direction')).data
    expect(result.previousDirectionRevisionId).toBe(coldIndustrialFixture.latestRevision.id)
    expect(result.decisionId).toBeTruthy()
    const after = (await projectApi(client).summary(projectId)).data
    expect(after.activeDirection?.direction.name).toBe('Warm Organic')
    expect(after.recentDecisions[0].rationale).toBe('Move to the organic campaign direction')
    expect(after.assetCounts).toEqual(before.assetCounts)
    expect(await briefApi(client).latest(projectId)).toEqual(briefBefore)
    expect(await api.revisions(coldIndustrialFixture.id)).toEqual(versionsBefore)
    expect((await api.list(projectId)).find(value => value.id === coldIndustrialFixture.id)?.status).toBe('SUPERSEDED')
  })
  it('compares two revisions on the mock server', async () => {
    const result = (await api.diff(coldIndustrialFixture.latestRevision.id, warmOrganicFixture.latestRevision.id)).data
    expect(result.fromRevisionId).toBe(coldIndustrialFixture.latestRevision.id)
    expect(result.changes.find(value => value.field === 'materials')).toMatchObject({ from: 'metal; glass; polished surfaces', to: 'wood; paper; stone; natural textures' })
    expect((await api.diff(warmOrganicFixture.latestRevision.id, warmOrganicFixture.latestRevision.id)).data.changes).toEqual([])
  })
  it('requires change summaries and activation reasons', async () => {
    await expect(api.revise(coldIndustrialFixture.id, { ...input(), changeSummary: null })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await expect(api.activate(projectId, warmOrganicFixture.latestRevision.id, 'x')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
  it('supports clone-only requests with a partial revision override', async () => {
    const result = await client.request(`/projects/${projectId}/directions`, ApiResponseSchema(DirectionSchema), { method: 'POST', body: { name: 'Clone override', cloneFromDirectionRevisionId: warmOrganicFixture.latestRevision.id, revision: { summary: 'An alternative warm style' } } })
    expect(result.data.latestRevision.summary).toBe('An alternative warm style')
    expect(result.data.latestRevision.palette).toEqual(warmOrganicFixture.latestRevision.palette)
  })
  it('blocks cross-project activation and cloning', async () => {
    const project = (await projectApi(client).create({ name: 'Other', template: 'BLANK' }, createIntentKey())).data
    await expect(api.activate(project.id, warmOrganicFixture.latestRevision.id, 'Change direction')).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
    await expect(api.create(project.id, { name: 'Invalid clone', revision: input(), cloneFromDirectionRevisionId: warmOrganicFixture.latestRevision.id })).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  })
  it('enforces optimistic concurrency and archived activation rules', async () => {
    await expect(client.request(`/directions/${warmOrganicFixture.id}`, ApiResponseSchema(DirectionSchema), { method: 'PATCH', body: { name: 'Changed', expectedUpdatedAt: 'stale' } })).rejects.toMatchObject({ code: 'CONFLICT' })
    await client.request(`/directions/${warmOrganicFixture.id}`, ApiResponseSchema(DirectionSchema), { method: 'PATCH', body: { status: 'ARCHIVED', expectedUpdatedAt: warmOrganicFixture.updatedAt } })
    await expect(api.activate(projectId, warmOrganicFixture.latestRevision.id, 'Change direction')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    await expect(client.request(`/directions/${coldIndustrialFixture.id}`, ApiResponseSchema(DirectionSchema), { method: 'PATCH', body: { status: 'ARCHIVED', expectedUpdatedAt: coldIndustrialFixture.updatedAt } })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
  })
  it('validates the revision detail response and leaves unknown request fields out', async () => {
    const result = await client.request(`/direction-revisions/${warmOrganicFixture.latestRevision.id}`, ApiResponseSchema(DirectionRevisionSchema))
    expect(result.data).toEqual(warmOrganicFixture.latestRevision)
  })
})

describe('direction screens', () => {
  it('creates a new direction and preserves typed spaces', async () => {
    render(<DirectionsPage client={client} projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Create direction' }))
    fireEvent.change(screen.getByLabelText('Direction name'), { target: { value: 'Natural studio' } })
    fireEvent.change(screen.getByLabelText('Visual principles / summary'), { target: { value: 'Calm visual style' } })
    fireEvent.change(screen.getByLabelText('Style prompt'), { target: { value: 'Soft ' } })
    expect(screen.getByLabelText('Style prompt')).toHaveValue('Soft ')
    const form = screen.getByRole('form'); fireEvent.submit(form); fireEvent.submit(form)
    expect(await screen.findByText('Direction saved.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('article', { name: 'Natural studio' })).toBeInTheDocument())
    expect((await api.list(projectId)).filter(value => value.name === 'Natural studio')).toHaveLength(1)
  })
  it('preserves a failed form and displays request ID', async () => {
    server.use(http.post(`${base}/projects/${projectId}/directions`, () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Save failed.', requestId: 'direction-request', details: [] } }, { status: 500 })))
    render(<DirectionsPage client={client} projectId={projectId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Create direction' }))
    fireEvent.change(screen.getByLabelText('Direction name'), { target: { value: 'Keep my input' } })
    fireEvent.change(screen.getByLabelText('Visual principles / summary'), { target: { value: 'Draft attributes' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('direction-request')
    expect(screen.getByLabelText('Direction name')).toHaveValue('Keep my input')
  })
  it('shows read-only controls for viewers and retries a failed list request', async () => {
    server.use(http.get(`${base}/projects/${projectId}/directions`, () => HttpResponse.error()))
    render(<DirectionsPage client={client} projectId={projectId} />)
    await screen.findByRole('alert')
    server.resetHandlers(...createHandlers(base))
    server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...solaraProjectFixture, currentUserRole: 'VIEWER' } })))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Your role can view directions but cannot change them.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create direction' })).not.toBeInTheDocument()
  })
})
