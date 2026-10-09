import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { ProjectHome } from './ProjectHome'
import { projectApi } from './api'
import { createApiClient, createIntentKey } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { coldIndustrialFixture, solaraSummaryFixture } from '../../mocks/projectSummary'
import { ApiResponseSchema, ProjectSummarySchema } from '../../../packages/contracts/src'

const base = 'http://localhost:3001/api/v1'
const client = createApiClient(base)
const id = solaraSummaryFixture.project.id
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
function renderHome() { return render(<ProjectHome client={client} projectId={id} isMockApi />) }

describe('project summary contract', () => {
  it('validates the seed summary and exact active revision identity', async () => {
    expect(ProjectSummarySchema.parse(solaraSummaryFixture).activeDirection?.revision.id).toBe('00000000-0000-4000-8000-000000000031')
    expect(coldIndustrialFixture.id).toBe('00000000-0000-4000-8000-000000000030')
    const result = await projectApi(client).summary(id)
    expect(ApiResponseSchema(ProjectSummarySchema).parse(result).data).toEqual(solaraSummaryFixture)
    expect(result.data.assetCounts.total).toBe(4)
  })
  it('returns empty summaries for newly created projects and rejects missing IDs', async () => {
    const api = projectApi(client)
    const created = await api.create({ name: 'Empty campaign', template: 'BLANK' }, createIntentKey())
    const summary = (await api.summary(created.data.id)).data
    expect(summary.activeDirection).toBeNull()
    expect(summary.assetCounts.total).toBe(0)
    expect(summary.recentDecisions).toEqual([])
    await expect(api.summary(crypto.randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(api.summary('invalid')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('Project Home', () => {
  it('shows direction, status counts, empty assessment and decision states', async () => {
    renderHome()
    expect(screen.getByText('Loading project overview…')).toBeInTheDocument()
    const home = await screen.findByRole('article', { name: 'Project overview' })
    expect(within(home).getByText(/Cold Industrial/)).toBeInTheDocument()
    expect(within(home).getByText('steel blue, graphite, cool white')).toBeInTheDocument()
    expect(within(home).getByText('No assessment has been run yet.')).toBeInTheDocument()
    expect(within(home).getByText('No decisions recorded yet.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: solaraSummaryFixture.project.name })).toHaveFocus())
    fireEvent.click(screen.getByRole('link', { name: 'Review active direction' }))
    expect(document.getElementById('active-direction')).toHaveFocus()
  })
  it('displays server-provided counts without recalculating them', async () => {
    server.use(http.get(`${base}/projects/${id}/summary`, () => HttpResponse.json({ data: { ...solaraSummaryFixture, assetCounts: { ...solaraSummaryFixture.assetCounts, total: 19 }, unresolvedRecommendationCount: 7, staleCollectionItemCount: 2 } })))
    renderHome()
    await screen.findByRole('article')
    expect(screen.getByText('Total assets').nextElementSibling).toHaveTextContent('19')
    expect(screen.getByText('Unresolved recommendations').nextElementSibling).toHaveTextContent('7')
    expect(screen.getByText('Collection items with newer versions').nextElementSibling).toHaveTextContent('2')
  })
  it('shows honest empty states for a blank project', async () => {
    const created = await projectApi(client).create({ name: 'Blank project', template: 'BLANK' }, createIntentKey())
    render(<ProjectHome client={client} projectId={created.data.id} isMockApi />)
    expect(await screen.findByText('No active direction yet.')).toBeInTheDocument()
    expect(screen.getByText('No assets registered yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Review project setup' }))
    expect(document.getElementById('project-setup')).toHaveFocus()
  })
  it('shows recent decision actors, rationale, and the simulated assessment badge', async () => {
    server.use(http.get(`${base}/projects/${id}/summary`, () => HttpResponse.json({ data: {
      ...solaraSummaryFixture,
      latestAssessment: { id: crypto.randomUUID(), status: 'COMPLETED', startedAt: '2026-10-10T08:00:00.000Z', isSimulated: true },
      recentDecisions: [{ id: crypto.randomUUID(), projectId: id, assessmentItemId: null, assetId: null, assetVersionId: null, directionRevisionId: coldIndustrialFixture.latestRevision.id, collectionRevisionId: null, decisionType: 'CHANGE_DIRECTION', selectedAction: null, rationale: 'Use the agreed campaign direction.', previousRecommendation: null, newRecommendation: null, supersedesDecisionId: null, supersededByDecisionId: null, createdBy: solaraSummaryFixture.project.owner, createdAt: '2026-10-10T08:00:00.000Z' }],
    } })))
    renderHome()
    expect(await screen.findByText('Simulated')).toBeInTheDocument()
    expect(screen.getByText('Direction changed')).toBeInTheDocument()
    expect(screen.getByText('Use the agreed campaign direction.')).toBeInTheDocument()
    expect(screen.getAllByText(/Demo Owner/).length).toBeGreaterThan(0)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
  it('preserves an unknown assessment status for generic display', async () => {
    server.use(http.get(`${base}/projects/${id}/summary`, () => HttpResponse.json({ data: { ...solaraSummaryFixture, latestAssessment: { id: crypto.randomUUID(), status: 'NEW_STATUS', startedAt: '2026-10-10T08:00:00.000Z', isSimulated: false } } })))
    renderHome()
    expect(await screen.findByText('Unknown assessment status')).toBeInTheDocument()
    expect(screen.queryByText('Simulated')).not.toBeInTheDocument()
  })
  it('shows request IDs and retries a failed summary request', async () => {
    server.use(http.get(`${base}/projects/${id}/summary`, () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to load overview.', requestId: 'summary-request', details: [] } }, { status: 500 })))
    renderHome()
    expect(await screen.findByRole('alert')).toHaveTextContent('summary-request')
    server.resetHandlers(...createHandlers(base))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('article')).toHaveTextContent('Cold Industrial')
  })
  it('aborts the pending request when the page unmounts', async () => {
    server.use(http.get(`${base}/projects/${id}/summary`, async () => { await delay(30); return HttpResponse.json({ data: solaraSummaryFixture }) }))
    const view = renderHome()
    expect(screen.getByText('Loading project overview…')).toBeInTheDocument()
    view.unmount()
    await delay(40)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
