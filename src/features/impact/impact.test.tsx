import { beforeAll, afterAll, beforeEach, afterEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { ImpactAssessmentSchema } from '../../../packages/contracts/src'
import { createApiClient, ApiClientError } from '../../lib/api/client'
import { createHandlers } from '../../mocks/handlers'
import { projectApi } from '../projects/api'
import { assetApi } from '../assets/api'
import { versionContextApi } from '../assets/versionApi'
import { impactApi, AssessmentViewSchema } from './api'
import { AssessmentForm } from './AssessmentForm'
import { ImpactResults } from './ImpactResults'
import { ImpactPage } from './ImpactPage'
import { useAssessment } from './useAssessment'
const base = 'http://localhost:3001/api/v1'; const client = createApiClient(base); const api = impactApi(client); const assets = assetApi(client)
const id = (suffix: string) => `00000000-0000-4000-8000-000000000${suffix}`
const projectId = id('010'); const input = { newDirectionRevisionId: id('041'), mode: 'RULES_ONLY' as const, includeImages: false }
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => server.resetHandlers(...createHandlers(base)))
afterEach(() => vi.useRealTimers())
afterAll(() => server.close())
async function start() { return (await api.start(projectId, input, crypto.randomUUID())).data }
it('opens the impact page before an assessment is selected', async () => {
  render(<ImpactPage client={client} projectId={projectId} />)
  await screen.findByRole('button', { name: 'Start assessment' })
  expect(screen.getByText('Select an assessment to inspect its exact scope and results.')).toBeVisible()
})
it('produces the canonical demo outcomes in server priority order with exact evidence IDs and no images', async () => {
  const record = ImpactAssessmentSchema.parse(await start())
  expect(record).toMatchObject({ status: 'COMPLETED', isSimulated: true, providerName: 'mock', rulesVersion: 'rules-v1', imagesSent: 0, oldDirectionRevisionId: id('031'), briefRevisionId: id('020'), counts: { total: 4, unresolved: 4 } })
  expect(record.items!.map(item => [item.assetVersion.id, item.recommendation, item.uncertaintyLevel, item.priority])).toEqual([[id('063'), 'REVIEW_REQUIRED', 'HIGH', 1], [id('064'), 'RECREATE_CANDIDATE', 'LOW', 2], [id('062'), 'ADAPT_CANDIDATE', 'MEDIUM', 3], [id('061'), 'REUSE_CANDIDATE', 'MEDIUM', 4]])
  expect(Object.values(record.counts.byRecommendation)).toEqual([1, 1, 1, 1])
  for (const item of record.items!) for (const evidence of [...item.supportingEvidence, ...item.conflictingEvidence]) { expect(evidence.sourceId).toBe(item.assetVersion.id); expect(evidence.source).not.toBe('IMAGE_OBSERVATION') }
  expect(record.items![3].requiresHumanReview).toBe(false)
  expect(record.items![0].missingInformation).toEqual(['Recorded lighting', 'Recorded mood'])
  expect((await assets.version(id('064'))).data.recordedAttributes.materials).toContain('polished')
})
it('does not activate a direction or change versions, statuses or collection pins when assessing', async () => {
  const before = await Promise.all([projectApi(client).get(projectId), assets.version(id('061')), assets.get(id('050'))])
  await start()
  expect(await Promise.all([projectApi(client).get(projectId), assets.version(id('061')), assets.get(id('050'))])).toEqual(before)
  const summary = (await projectApi(client).summary(projectId)).data
  expect(summary.latestAssessment?.status).toBe('COMPLETED'); expect(summary.unresolvedRecommendationCount).toBe(4)
})
it('replays the same start intent and rejects a changed body with the same key', async () => {
  const key = crypto.randomUUID(); const first = await api.start(projectId, input, key)
  expect(await api.start(projectId, input, key)).toEqual(first)
  await expect(api.start(projectId, { ...input, mode: 'HYBRID' }, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', status: 422 })
  expect((await api.list(projectId)).data).toHaveLength(1)
  const missing = await fetch(`${base}/projects/${projectId}/impact-assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); expect(missing.status).toBe(400)
})
it('filters result items on the server while retaining full counts and omits items in history', async () => {
  const record = await start(); const filtered = (await api.get(record.id, { recommendation: 'REVIEW_REQUIRED' })).data
  expect(filtered.items).toHaveLength(1); expect(filtered.counts).toEqual(record.counts)
  expect((await api.get(record.id, { resolutionStatus: 'ACCEPTED' })).data.items).toEqual([])
  expect((await api.list(projectId, 'COMPLETED')).data[0].items).toBeNull()
  await expect(api.get(record.id, { recommendation: 'invalid' })).rejects.toMatchObject({ status: 400 })
  await expect(api.cancel(record.id)).rejects.toMatchObject({ status: 409 })
  await expect(api.retry(record.id)).rejects.toMatchObject({ status: 409 })
})
it('paginates history without duplicates and rejects invalid cursors', async () => {
  const first = await start(); const second = await start()
  const response = await fetch(`${base}/projects/${projectId}/impact-assessments?limit=1`); const page = await response.json()
  expect(page.data[0].id).toBe(second.id)
  const next = await fetch(`${base}/projects/${projectId}/impact-assessments?limit=1&cursor=${encodeURIComponent(page.page.nextCursor)}`); const body = await next.json()
  expect(body.data[0].id).toBe(first.id); expect(body.page.nextCursor).toBeNull()
  await expect(api.list(projectId, undefined, 'invalid')).rejects.toMatchObject({ status: 400 })
})
it('keeps assessment snapshots after a new version and excludes archived assets from default scope', async () => {
  const first = await start(); const next = (await assets.createVersion(id('050'), { metadataOnly: true, revisionRationale: 'New authored metadata', recordedAttributes: { mood: ['calm'] } }, crypto.randomUUID())).data
  expect((await api.get(first.id, {})).data).toEqual(first)
  const asset = (await assets.get(id('053'))).data; await assets.status(asset, 'ARCHIVED')
  const fresh = await start(); expect(fresh.counts.total).toBe(3); expect(fresh.items!.map(item => item.assetVersion.id)).toContain(next.id); expect(fresh.items!.map(item => item.assetVersion.id)).not.toContain(id('064'))
  const exact = (await api.start(projectId, { ...input, assetVersionIds: [id('060'), id('060')] }, crypto.randomUUID())).data
  expect(exact.items).toHaveLength(1); expect(exact.items![0].assetVersion.versionNumber).toBe(1); expect(exact.items![0].recommendation).toBe('REVIEW_REQUIRED')
})
it('rejects foreign direction, brief and version references', async () => {
  const foreign = (await projectApi(client).create({ name: 'Another project', template: 'BLANK' }, crypto.randomUUID())).data
  for (const body of [input, { ...input, newDirectionRevisionId: id('031') }, { ...input, briefRevisionId: id('020') }]) await expect(api.start(foreign.id, body, crypto.randomUUID())).rejects.toMatchObject({ code: 'CROSS_PROJECT_REFERENCE' })
  await expect(api.start(projectId, { ...input, newDirectionRevisionId: id('031') }, crypto.randomUUID())).rejects.toMatchObject({ status: 400 })
  await expect(api.start(projectId, { ...input, assetVersionIds: [crypto.randomUUID()] }, crypto.randomUUID())).rejects.toMatchObject({ status: 404 })
})
it('offers an explicit rules-only fallback and preserves the intent key for unchanged failed starts', async () => {
  const options = await versionContextApi(client).options(projectId); const save = vi.fn().mockRejectedValue(new ApiClientError('AI not configured', { code: 'AI_NOT_CONFIGURED', status: 422, requestId: 'request-123' }))
  render(<AssessmentForm options={options} versions={[]} save={save} cancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('New direction revision'), { target: { value: id('041') } }); fireEvent.change(screen.getByLabelText('Assessment mode'), { target: { value: 'AI_ASSISTED' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run assessment' })); await screen.findByText(/request-123/)
  fireEvent.click(screen.getByRole('button', { name: 'Run assessment' })); await waitFor(() => expect(save).toHaveBeenCalledTimes(2)); expect(save.mock.calls[0][1]).toBe(save.mock.calls[1][1])
  fireEvent.click(await screen.findByRole('button', { name: 'Run rules-only instead' })); await waitFor(() => expect(save).toHaveBeenCalledTimes(3)); expect(save.mock.calls[2][0]).toMatchObject({ mode: 'RULES_ONLY', includeImages: false }); expect(save.mock.calls[2][1]).not.toBe(save.mock.calls[0][1])
})
it('renders honest metadata labels, unknown enums and exact-version links without mutation controls', async () => {
  const record = await start(); record.items![0].recommendation = 'FUTURE_RECOMMENDATION'; record.items![0].uncertaintyLevel = 'FUTURE'
  render(<ImpactResults assessment={AssessmentViewSchema.parse(record)} names={[]} />)
  expect(screen.getByText('No images were inspected.')).toBeVisible(); expect(screen.getByText('Simulated')).toBeVisible(); expect(screen.getByText('These are recommendations, not an objective quality judgment. A person decides.')).toBeVisible()
  expect(screen.getAllByText('Unknown', { exact: false })).toHaveLength(2)
  expect(screen.getAllByRole('link', { name: 'Inspect exact asset version' })[0]).toHaveAttribute('href', `#/projects/${projectId}/assets/${id('052')}/versions/${id('063')}`)
  expect(screen.queryByRole('button', { name: /Accept|Override/ })).not.toBeInTheDocument()
})
it('prevents assessment creation for a viewer and rejects detail context from another project', async () => {
  const record = await start(); const project = (await projectApi(client).get(projectId)).data
  server.use(http.get(`${base}/projects/${projectId}`, () => HttpResponse.json({ data: { ...project, currentUserRole: 'VIEWER' } })), http.get(`${base}/impact-assessments/${record.id}`, () => HttpResponse.json({ data: { ...record, projectId: crypto.randomUUID() } })))
  render(<ImpactPage client={client} projectId={projectId} assessmentId={record.id} />)
  await screen.findByText('This assessment belongs to another project.'); await screen.findByText('Your role can inspect assessments but cannot start or change runs.')
  expect(screen.queryByRole('button', { name: 'Start assessment' })).not.toBeInTheDocument(); expect(screen.queryByText('No images were inspected.')).not.toBeInTheDocument()
})
it('retries a failed assessment with the same ID and renders only confirmed results', async () => {
  const record = await start(); let retried = false; const retry = vi.fn(() => { retried = true; return HttpResponse.json({ data: { ...record, status: 'RUNNING', items: null } }) })
  server.use(http.get(`${base}/impact-assessments/${record.id}`, () => HttpResponse.json({ data: retried ? record : { ...record, status: 'FAILED', items: null, errorCode: 'PROVIDER_UNAVAILABLE', errorSummary: 'Provider unavailable' } })), http.post(`${base}/impact-assessments/${record.id}/retry`, retry))
  render(<ImpactPage client={client} projectId={projectId} assessmentId={record.id} />)
  await screen.findByText('Assessment failed. No recommendations were produced.')
  expect(screen.queryAllByRole('link', { name: 'Inspect exact asset version' })).toHaveLength(0)
  fireEvent.click(await screen.findByRole('button', { name: 'Retry failed assessment' })); await waitFor(() => expect(screen.getAllByRole('link', { name: 'Inspect exact asset version' })).toHaveLength(4)); expect(retry).toHaveBeenCalledTimes(1)
})
it('cancels a running assessment without displaying recommendations', async () => {
  const record = await start(); let cancelled = false
  server.use(http.get(`${base}/impact-assessments/${record.id}`, () => HttpResponse.json({ data: { ...record, status: cancelled ? 'CANCELLED' : 'RUNNING', items: null } })), http.post(`${base}/impact-assessments/${record.id}/cancel`, () => { cancelled = true; return HttpResponse.json({ data: { ...record, status: 'CANCELLED', items: null } }) }))
  render(<ImpactPage client={client} projectId={projectId} assessmentId={record.id} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel assessment' })); await screen.findByText('Assessment cancelled. No recommendations are shown.')
  expect(screen.queryAllByRole('link', { name: 'Inspect exact asset version' })).toHaveLength(0)
})
it('polls GET with backoff and stops on completion without posting again', async () => {
  const record = await start(); vi.useFakeTimers(); const get = vi.fn().mockResolvedValueOnce({ data: { ...record, status: 'RUNNING', items: null } }).mockResolvedValueOnce({ data: { ...record, status: 'RUNNING', items: null } }).mockResolvedValue({ data: record }); const stub = { ...api, get, start: vi.fn() }
  const hook = renderHook(() => useAssessment(stub, record.id, '', '', 0)); await act(async () => {})
  expect(get).toHaveBeenCalledTimes(1); await act(async () => { await vi.advanceTimersByTimeAsync(1499) }); expect(get).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(1) }); expect(get).toHaveBeenCalledTimes(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(2250) }); expect(hook.result.current.data?.status).toBe('COMPLETED')
  await act(async () => { await vi.advanceTimersByTimeAsync(20000) }); expect(get).toHaveBeenCalledTimes(3); expect(stub.start).not.toHaveBeenCalled(); hook.unmount()
})
it('bounds polling at 120 seconds and aborts reads on unmount', async () => {
  const record = await start(); vi.useFakeTimers(); const get = vi.fn().mockResolvedValue({ data: { ...record, status: 'PENDING', items: null } }); const stub = { ...api, get }; const hook = renderHook(() => useAssessment(stub, record.id, '', '', 0))
  await act(async () => {}); await act(async () => { await vi.advanceTimersByTimeAsync(120000) }); expect(hook.result.current.stillRunning).toBe(true)
  const calls = get.mock.calls.length; await act(async () => { await vi.advanceTimersByTimeAsync(30000) }); expect(get).toHaveBeenCalledTimes(calls)
  const signal = get.mock.calls[0][2] as AbortSignal; hook.unmount(); expect(signal.aborted).toBe(true)
})
it('stops polling on a read error and permits a fresh manual read', async () => {
  const record = await start(); vi.useFakeTimers(); const get = vi.fn().mockRejectedValueOnce(new ApiClientError('Read failed', { code: 'OFFLINE' })).mockResolvedValue({ data: record }); const stub = { ...api, get }
  const hook = renderHook(({ attempt }) => useAssessment(stub, record.id, '', '', attempt), { initialProps: { attempt: 0 } }); await act(async () => {}); expect(hook.result.current.error?.code).toBe('OFFLINE')
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) }); expect(get).toHaveBeenCalledTimes(1)
  hook.rerender({ attempt: 1 }); await act(async () => {}); expect(hook.result.current.data?.status).toBe('COMPLETED'); hook.unmount()
})
