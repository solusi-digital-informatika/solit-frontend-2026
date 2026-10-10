import { decisionApi } from '../decisions/api'
import { DecisionHistory } from '../decisions/DecisionHistory'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { projectApi, type ProjectView } from '../projects/api'
import { assetApi } from '../assets/api'
import { versionContextApi, type VersionOptions } from '../assets/versionApi'
import { impactApi, type AssessmentView, type StartInput } from './api'
import { AssessmentForm } from './AssessmentForm'
import { ImpactResults } from './ImpactResults'
import { useAssessment } from './useAssessment'
import { impactCopy as c } from './copy'
import { label } from '../references/display'
import '../assets/assets.css'
import './impact.css'

export function ImpactPage({ client, projectId, assessmentId }: { client: ApiClient; projectId: string; assessmentId?: string }) {
  const decisions = useMemo(() => decisionApi(client), [client]); const [decisionNotice, setDecisionNotice] = useState(''); const [historyRefresh, setHistoryRefresh] = useState(0)
  const api = useMemo(() => impactApi(client), [client]); const projects = useMemo(() => projectApi(client), [client]); const assets = useMemo(() => assetApi(client), [client]); const context = useMemo(() => versionContextApi(client), [client])
  const [project, setProject] = useState<ProjectView | null>(null); const [options, setOptions] = useState<VersionOptions | null>(null); const [versions, setVersions] = useState<{ id: string; label: string }[]>([]); const [contextError, setContextError] = useState<ApiClientError | null>(null)
  const [history, setHistory] = useState<AssessmentView[]>([]); const [status, setStatus] = useState(''); const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [historyError, setHistoryError] = useState<ApiClientError | null>(null)
  const [attempt, setAttempt] = useState(0); const [detailAttempt, setDetailAttempt] = useState(0); const [recommendation, setRecommendation] = useState(''); const [resolution, setResolution] = useState(''); const [form, setForm] = useState<Partial<StartInput> | null>(null); const [actionError, setActionError] = useState<ApiClientError | null>(null); const [busy, setBusy] = useState(false); const actionBusy = useRef(false); const paging = useRef(false); const generation = useRef(0)
  const detail = useAssessment(api, assessmentId, recommendation, resolution, detailAttempt)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const [project, values, scope] = await Promise.all([projects.get(projectId, controller.signal), context.options(projectId, controller.signal), (async () => {
        const scope: { id: string; label: string }[] = []; let cursor: string | undefined
        do { const result = await assets.list(projectId, { includeArchived: true, cursor }, controller.signal); const entries = await Promise.all(result.data.map(async asset => (await assets.versions(asset.id, controller.signal)).map(version => ({ id: version.id, label: `${asset.title} · Version ${version.versionNumber}${asset.status === 'ARCHIVED' ? ' · Archived asset' : ''}` })))); scope.push(...entries.flat()); cursor = result.page.nextCursor ?? undefined } while (cursor)
        return scope
      })()])
      if (!controller.signal.aborted) { setProject(project.data); setOptions(values); setVersions(scope); setContextError(null) }
    }
    void load().catch(value => { if (!controller.signal.aborted) setContextError(asError(value)) }); return () => controller.abort()
  }, [projects, context, assets, projectId, attempt])
  useEffect(() => {
    const controller = new AbortController(); const current = ++generation.current; paging.current = false
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize assessment history with server filters.
    setLoading(true); setHistoryError(null); setMoreLoading(false)
    api.list(projectId, status || undefined, undefined, controller.signal).then(result => { if (!controller.signal.aborted && current === generation.current) { setHistory(result.data); setCursor(result.page.nextCursor); setLoading(false) } }).catch(value => { if (!controller.signal.aborted) { setHistoryError(asError(value)); setLoading(false) } }); return () => controller.abort()
  }, [api, projectId, status, attempt])
  const canEdit = Boolean(project && ['OWNER', 'EDITOR', 'REVIEWER'].includes(project.currentUserRole))
  const record = detail.data?.projectId === projectId && detail.data.id === assessmentId ? detail.data : null
  const crossProject = detail.data && detail.data.id === assessmentId && detail.data.projectId !== projectId ? new ApiClientError('This assessment belongs to another project.', { code: 'CROSS_PROJECT_REFERENCE' }) : null
  async function more() { if (!cursor || paging.current) return; paging.current = true; setMoreLoading(true); const current = generation.current; try { const result = await api.list(projectId, status || undefined, cursor); if (current === generation.current) { setHistory(previous => [...previous, ...result.data]); setCursor(result.page.nextCursor); setHistoryError(null) } } catch (value) { if (current === generation.current) setHistoryError(asError(value)) } finally { if (current === generation.current) { paging.current = false; setMoreLoading(false) } } }
  async function change(action: 'retry' | 'cancel') { if (!record || actionBusy.current) return; actionBusy.current = true; setBusy(true); setActionError(null); try { await api[action](record.id); setDetailAttempt(value => value + 1); setAttempt(value => value + 1) } catch (value) { setActionError(asError(value)) } finally { actionBusy.current = false; setBusy(false) } }
  return <><div className="projects-heading"><div><h2>{c.heading}</h2><p>{project?.name}</p></div>{canEdit && options && !contextError && !form && <button onClick={() => setForm({})}>{c.start}</button>}</div>
    {decisionNotice && <p role="status">{decisionNotice}</p>}{contextError && <ErrorMessage error={contextError} retry={() => setAttempt(value => value + 1)} />}{project && !canEdit && <p>{c.readOnly}</p>}
    {form && options && canEdit && <AssessmentForm options={options} versions={versions} initial={form} cancel={() => setForm(null)} save={async (input, key) => { const result = await api.start(projectId, input, key); setForm(null); setAttempt(value => value + 1); setDetailAttempt(value => value + 1); window.location.hash = `/projects/${projectId}/impact/${result.data.id}` }} />}
    {history.length > 0 && <section className="home-panel"><h3>{c.history}</h3><label>{c.status}<select value={status} onChange={event => setStatus(event.target.value)}><option value="">{c.allStatuses}</option>{Object.entries(c.statuses).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>{loading ? <p role="status">{c.loading}</p> : <>{historyError && <ErrorMessage error={historyError} retry={() => setAttempt(value => value + 1)} />}{!historyError && !history.length && <p>{status ? 'No assessments match this status.' : c.empty}</p>}<ol className="impact-history">{history.map(value => <li key={value.id}><a href={`#/projects/${projectId}/impact/${value.id}`} aria-current={value.id === assessmentId ? 'page' : undefined}>{c.open} · <time dateTime={value.startedAt}>{new Date(value.startedAt).toLocaleString()}</time></a><p>◷ {label(c.statuses, value.status)} {value.isSimulated && <span className="simulated">{c.simulated}</span>}</p><code>{value.id}</code></li>)}</ol>{cursor && <button disabled={moreLoading} onClick={() => void more()}>{moreLoading ? c.loading : c.more}</button>}</>}</section>}
    {!assessmentId ? <p>{c.noSelection}</p> : <section className="impact-detail" aria-label="Assessment results"><h3>Assessment results</h3><button disabled={busy || detail.loading} onClick={() => { setActionError(null); setDetailAttempt(value => value + 1) }}>{c.refresh}</button>{detail.loading && <p role="status">{c.loading}</p>}{(detail.error || crossProject) && <ErrorMessage error={(detail.error || crossProject)!} retry={() => setDetailAttempt(value => value + 1)} />}
      {record && <><p>◷ {label(c.statuses, record.status)}</p><code>{record.id}</code>{['PENDING', 'RUNNING'].includes(record.status) && <><p role="status">{detail.stillRunning ? c.stillRunning : c.running}</p>{canEdit && <button disabled={busy} onClick={() => void change('cancel')}>{c.cancel}</button>}</>}{record.status === 'FAILED' && <div role="alert"><p>{c.failed}</p><p>{record.errorCode} · {record.errorSummary}</p>{canEdit && <><button disabled={busy} onClick={() => void change('retry')}>{c.retryRun}</button>{record.mode !== 'RULES_ONLY' && <button disabled={busy || !options} onClick={() => setForm({ oldDirectionRevisionId: record.oldDirectionRevisionId, newDirectionRevisionId: record.newDirectionRevisionId, briefRevisionId: record.briefRevisionId ?? undefined, mode: 'RULES_ONLY' })}>{c.fallback}</button>}</>}</div>}{record.status === 'CANCELLED' && <p>{c.cancelled}</p>}{actionError && <ErrorMessage error={actionError} retry={() => { setActionError(null); setDetailAttempt(value => value + 1) }} />}
      {record.status === 'COMPLETED' && <div className="impact-filters"><label>{c.recommendation}<select value={recommendation} onChange={event => setRecommendation(event.target.value)}><option value="">{c.allRecommendations}</option>{Object.entries(c.recommendations).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>{c.resolution}<select value={resolution} onChange={event => setResolution(event.target.value)}><option value="">{c.allResolutions}</option>{Object.entries(c.resolutions).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><p>{c.filterNote}</p></div>}
      <ImpactResults assessment={record} names={options?.directions ?? []} refresh={() => setHistoryRefresh(value => value + 1)} resolve={canEdit && record.status === 'COMPLETED' ? async (item, input) => { const result = await decisions.resolve(record.id, item.id, input); if (result.data.item.id !== item.id || result.data.item.assessmentId !== record.id || result.data.decision.projectId !== projectId || result.data.decision.assessmentItemId !== item.id || result.data.decision.assetVersionId !== item.assetVersion.id || result.data.item.latestDecision?.id !== result.data.decision.id) throw new ApiClientError('The decision response does not match this item. Refresh history before retrying.', { code: 'CONTRACT_MISMATCH' }); setDecisionNotice('Decision saved. The API confirmed the recorded intent.'); setHistoryRefresh(value => value + 1); setDetailAttempt(value => value + 1); setAttempt(value => value + 1) } : undefined} /><DecisionHistory key={record.id} client={client} projectId={projectId} assessmentId={record.id} refresh={historyRefresh} />{record.status === 'COMPLETED' && (record.items === null ? <p role="alert">The API returned no result items. Refresh to retrieve the completed assessment.</p> : !record.items.length && <p>{record.counts.total === 0 ? c.noItems : c.noResults}</p>)}</>}
    </section>}
  </>
}
function asError(value: unknown) { return value instanceof ApiClientError ? value : new ApiClientError('Unable to load impact assessment.', { code: 'UNKNOWN' }) }
function ErrorMessage({ error, retry }: { error: ApiClientError; retry: () => void }) { return <div className="project-error" role="alert"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: {error.requestId}</p>}<button onClick={retry}>{c.retryRead}</button></div> }
