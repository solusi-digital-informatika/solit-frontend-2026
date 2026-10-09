import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { DecisionSchema } from '../../../packages/contracts/src'
import { createApiClient, ApiClientError } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { impactApi } from '../impact/api'
import { ImpactPage } from '../impact/ImpactPage'
import { assetApi } from '../assets/api'
import { projectApi } from '../projects/api'
import { decisionApi } from './api'
import { DecisionForm } from './DecisionForm'
import { DecisionHistory } from './DecisionHistory'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = decisionApi(client); const impact = impactApi(client); const assets = assetApi(client)
const id = (suffix: string) => `00000000-0000-4000-8000-000000000${suffix}`; const projectId = id('010')
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterAll(() => server.close())
async function start() { return (await impact.start(projectId, { newDirectionRevisionId: id('041'), mode: 'RULES_ONLY' }, crypto.randomUUID())).data }
it('records all resolutions and keeps deferred items unresolved', async () => {
  const assessment = await start(); const items = assessment.items!
  const accept = await api.resolve(assessment.id, items[3].id, { resolution: 'ACCEPT' }); expect(accept.data.decision.rationale).toBe('Accepted without comment'); expect(accept.data.item.resolutionStatus).toBe('ACCEPTED')
  const defer = await api.resolve(assessment.id, items[0].id, { resolution: 'DEFER' }); expect(defer.data.decision.rationale).toBe('Deferred without comment'); expect(defer.data.item.resolutionStatus).toBe('DEFERRED')
  await api.resolve(assessment.id, items[1].id, { resolution: 'OVERRIDE', overrideRecommendation: 'REVIEW_REQUIRED', rationale: 'Keep the polished concept for review', selectedAction: 'Ask art director to review the exact version' })
  await api.resolve(assessment.id, items[2].id, { resolution: 'DISMISS', rationale: 'Outside this campaign scope' })
  const after = (await impact.get(assessment.id, {})).data
  expect(after.counts).toMatchObject({ total: 4, unresolved: 1, byRecommendation: assessment.counts.byRecommendation })
  expect((await projectApi(client).summary(projectId)).data.unresolvedRecommendationCount).toBe(1)
})
it('supersedes decisions while retaining the original recommendation, evidence and previous decision content', async () => {
  const assessment = await start(); const item = assessment.items![1]
  const first = (await api.resolve(assessment.id, item.id, { resolution: 'OVERRIDE', overrideRecommendation: 'REVIEW_REQUIRED', rationale: 'Material can work after review' })).data
  expect(first.item).toMatchObject({ recommendation: 'RECREATE_CANDIDATE', effectiveRecommendation: 'REVIEW_REQUIRED', resolutionStatus: 'OVERRIDDEN' })
  const second = (await api.resolve(assessment.id, item.id, { resolution: 'ACCEPT', rationale: 'Return to the original recommendation' })).data
  expect(second.decision).toMatchObject({ supersedesDecisionId: first.decision.id, previousRecommendation: 'REVIEW_REQUIRED', newRecommendation: 'RECREATE_CANDIDATE' }); expect(second.item.effectiveRecommendation).toBe(item.recommendation)
  const history = (await api.list(projectId, { assessmentId: assessment.id })).data
  expect(history).toHaveLength(2); const prior = history.find(value => value.id === first.decision.id)!
  expect(prior).toEqual({ ...first.decision, supersededByDecisionId: second.decision.id }); expect((await api.list(projectId, { currentOnly: true })).data.map(value => value.id)).toEqual([second.decision.id])
  const after = (await impact.get(assessment.id, {})).data.items!.find(value => value.id === item.id)!
  for (const field of ['recommendation', 'rationale', 'supportingEvidence', 'conflictingEvidence', 'missingInformation', 'priority', 'uncertaintyLevel'] as const) expect(after[field]).toEqual(item[field])
})
it('records intent without changing version content, approval, lineage, asset metadata or collection pins', async () => {
  const assessment = await start(); const item = assessment.items![3]; const beforeVersion = (await assets.version(item.assetVersion.id)).data; const beforeAsset = (await assets.get(item.assetVersion.assetId)).data
  const decision = (await api.resolve(assessment.id, item.id, { resolution: 'OVERRIDE', overrideRecommendation: 'REVIEW_REQUIRED', rationale: 'Review collection use first' })).data.decision
  expect((await assets.version(item.assetVersion.id)).data).toEqual(beforeVersion)
  const afterAsset = (await assets.get(item.assetVersion.assetId)).data; expect(afterAsset).toEqual({ ...beforeAsset, recentDecisions: [DecisionSchema.parse(decision)] })
  expect((await projectApi(client).summary(projectId)).data.recentDecisions[0].id).toBe(decision.id)
})
it('uses the latest completed assessment for overview counts rather than summing historical runs', async () => {
  const first = await start(); await api.resolve(first.id, first.items![0].id, { resolution: 'ACCEPT' }); const second = await start()
  expect((await projectApi(client).summary(projectId)).data.unresolvedRecommendationCount).toBe(4)
  await api.resolve(second.id, second.items![0].id, { resolution: 'ACCEPT' }); expect((await projectApi(client).summary(projectId)).data.unresolvedRecommendationCount).toBe(3)
})
it('validates mandatory rationale, unchanged overrides and item membership', async () => {
  const assessment = await start(); const item = assessment.items![0]
  await expect(api.resolve(assessment.id, item.id, { resolution: 'DISMISS', rationale: 'no' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
  await expect(api.resolve(assessment.id, item.id, { resolution: 'OVERRIDE', overrideRecommendation: 'REVIEW_REQUIRED', rationale: 'Same recommendation is invalid' })).rejects.toMatchObject({ status: 400 })
  await expect(api.resolve(assessment.id, crypto.randomUUID(), { resolution: 'ACCEPT' })).rejects.toMatchObject({ status: 404 })
  const other = await start(); await expect(api.resolve(other.id, item.id, { resolution: 'ACCEPT' })).rejects.toMatchObject({ status: 404 })
  expect((await api.list(projectId, {})).data).toEqual([])
})
it('filters and paginates decisions on the server with full supersession history', async () => {
  const assessment = await start(); const item = assessment.items![0]
  const first = (await api.resolve(assessment.id, item.id, { resolution: 'DEFER' })).data.decision
  const second = (await api.resolve(assessment.id, item.id, { resolution: 'DISMISS', rationale: 'No longer needed' })).data.decision
  expect((await api.list(projectId, { assetId: item.assetVersion.assetId, assetVersionId: item.assetVersion.id, decisionType: 'DISMISS_RECOMMENDATION', currentOnly: true })).data[0].id).toBe(second.id)
  const response = await fetch(`${base}/projects/${projectId}/decisions?limit=1`); const page = await response.json(); expect(page.data[0].id).toBe(second.id)
  expect((await api.list(projectId, { cursor: page.page.nextCursor })).data[0].id).toBe(first.id)
  await expect(api.list(projectId, { assetId: 'invalid' })).rejects.toMatchObject({ status: 400 })
  await expect(api.list(projectId, { cursor: 'invalid' })).rejects.toMatchObject({ status: 400 })
})
it('validates the form before submitting and preserves a failed draft without automatic retry', async () => {
  const assessment = await start(); const item = assessment.items![1]; const save = vi.fn().mockRejectedValue(new ApiClientError('Not confirmed', { code: 'NETWORK_ERROR', requestId: 'decision-request' })); const refresh = vi.fn()
  render(<DecisionForm item={item} save={save} cancel={() => {}} refresh={refresh} />)
  fireEvent.change(screen.getByLabelText('Decision', { exact: true }), { target: { value: 'OVERRIDE' } }); fireEvent.click(screen.getByRole('button', { name: 'Save decision' }))
  expect(save).not.toHaveBeenCalled(); await screen.findAllByText('Provide a rationale of at least 5 characters.')
  fireEvent.change(screen.getByLabelText('Replacement recommendation'), { target: { value: 'REVIEW_REQUIRED' } }); fireEvent.change(screen.getByLabelText('Decision rationale'), { target: { value: 'Keep this draft after a failure' } }); fireEvent.change(screen.getByLabelText('Selected next action'), { target: { value: 'Ask reviewer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' })); await screen.findByText(/decision-request/)
  expect(save).toHaveBeenCalledTimes(1); expect(screen.getByLabelText('Decision rationale')).toHaveValue('Keep this draft after a failure')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh decision history' })); expect(refresh).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1)
})
it('shows request errors rather than empty history and supports explicit read retry', async () => {
  server.use(http.get(`${base}/projects/${projectId}/decisions`, () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'History unavailable', details: [], requestId: 'history-request' } }, { status: 503 })))
  render(<DecisionHistory client={client} projectId={projectId} />); await screen.findByText('History unavailable'); expect(screen.queryByText('No decisions recorded yet.')).not.toBeInTheDocument()
  server.resetHandlers(...createHandlers(base)); fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByText('No decisions recorded yet.')
})
it('renders unknown decision types safely and rejects history from another project', async () => {
  const assessment = await start(); const decision = (await api.resolve(assessment.id, assessment.items![0].id, { resolution: 'DEFER' })).data.decision
  server.use(http.get(`${base}/projects/${projectId}/decisions`, () => HttpResponse.json({ data: [{ ...decision, decisionType: 'FUTURE_TYPE' }], page: { limit: 25, nextCursor: null } })))
  const view = render(<DecisionHistory client={client} projectId={projectId} />); await screen.findByRole('heading', { name: 'Unknown' }); view.unmount()
  server.use(http.get(`${base}/projects/${projectId}/decisions`, () => HttpResponse.json({ data: [{ ...decision, projectId: crypto.randomUUID() }], page: { limit: 25, nextCursor: null } })))
  render(<DecisionHistory client={client} projectId={projectId} />); await screen.findByText('Decision history belongs to another project.'); expect(screen.queryByText(decision.rationale)).not.toBeInTheDocument()
})
it('prevents duplicate in-flight submissions without presenting a decision before confirmation', async () => {
  const assessment = await start(); let confirm!: () => void; const save = vi.fn(() => new Promise<void>(resolve => { confirm = resolve }))
  render(<DecisionForm item={assessment.items![0]} save={save} refresh={() => {}} cancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' })); fireEvent.submit(screen.getByRole('form'))
  expect(save).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Saving decision…' })).toBeDisabled(); expect(screen.queryByText('Decision saved. The API confirmed the recorded intent.')).not.toBeInTheDocument()
  confirm(); await waitFor(() => expect(screen.getByRole('button', { name: 'Save decision' })).toBeEnabled())
})
it.each(['VIEWER', 'FUTURE_ROLE'])('hides decision mutation controls for %s', async role => {
  const assessment = await start(); const project = (await projectApi(client).get(projectId)).data
  server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...project, currentUserRole: role } })))
  render(<ImpactPage client={client} projectId={projectId} assessmentId={assessment.id} />); await screen.findByText('Your role can inspect assessments but cannot start or change runs.'); await screen.findByRole('region', { name: 'Decision history' })
  expect(screen.queryByRole('button', { name: 'Record decision' })).not.toBeInTheDocument()
})
it('refreshes confirmed decisions and counts and retains a visible original recommendation', async () => {
  const assessment = await start(); render(<ImpactPage client={client} projectId={projectId} assessmentId={assessment.id} />)
  await screen.findAllByRole('button', { name: 'Record decision' }); const results = screen.getByRole('region', { name: 'Assessment results' }); const item = results.querySelectorAll('.impact-item')[1] as HTMLElement
  fireEvent.click(within(item).getByRole('button', { name: 'Record decision' })); const form = within(item).getByRole('form', { name: 'Record decision: Metal Texture Detail' })
  fireEvent.change(within(form).getByLabelText('Decision'), { target: { value: 'OVERRIDE' } }); fireEvent.change(within(form).getByLabelText('Replacement recommendation'), { target: { value: 'REVIEW_REQUIRED' } }); fireEvent.change(within(form).getByLabelText('Decision rationale'), { target: { value: 'Keep the metal option for review' } }); fireEvent.click(within(form).getByRole('button', { name: 'Save decision' }))
  await screen.findByText('Decision saved. The API confirmed the recorded intent.'); await waitFor(() => expect(screen.getByRole('region', { name: 'Decision history' })).toHaveTextContent('Keep the metal option for review'))
  const updated = results.querySelectorAll('.impact-item')[1] as HTMLElement; expect(updated).toHaveTextContent('Original recommendation:'); expect(updated).toHaveTextContent('Recreate candidate'); expect(updated).toHaveTextContent('Effective recommendation: Review required')
})
