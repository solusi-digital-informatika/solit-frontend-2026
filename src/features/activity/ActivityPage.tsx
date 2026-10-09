import { useEffect, useMemo, useRef, useState } from 'react'
import { UUIDSchema, type ActivityEvent } from '../../../packages/contracts/src'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { projectApi, type ProjectView } from '../projects/api'
import { activityApi, type ActivityQuery } from './api'
import { activityCopy as c, eventLabels, eventLabel } from './copy'
import { ActivityError, ExportPanel } from './ExportPanel'
import './activity.css'
const emptyFilters = { from: '', to: '', actorId: '', eventType: '', entityType: '', entityId: '' }
function asError(value: unknown) { return value instanceof ApiClientError ? value : new ApiClientError('Unable to load activity.', { code: 'UNKNOWN' }) }
function assertProject(items: ActivityEvent[], projectId: string) { if (items.some(value => value.projectId !== projectId)) throw new ApiClientError('Activity belongs to another project.', { code: 'CROSS_PROJECT_REFERENCE' }) }
export function ActivityPage({ client, projectId }: { client: ApiClient; projectId: string }) {
  const api = useMemo(() => activityApi(client), [client]); const projects = useMemo(() => projectApi(client), [client])
  const [project, setProject] = useState<ProjectView | null>(null); const [filters, setFilters] = useState(emptyFilters); const [query, setQuery] = useState<ActivityQuery>({}); const [validation, setValidation] = useState('')
  const [items, setItems] = useState<ActivityEvent[]>([]); const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState<ApiClientError | null>(null); const [attempt, setAttempt] = useState(0)
  const generation = useRef(0); const paging = useRef(false); const reader = useRef<AbortController | null>(null); const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const controller = new AbortController(); reader.current = controller; const current = ++generation.current; paging.current = false
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize API reads with project, applied filters and refresh.
    setLoading(true); setMoreLoading(false); setError(null); setItems([]); setCursor(null)
    Promise.all([projects.get(projectId, controller.signal), api.list(projectId, query, controller.signal)]).then(([context, response]) => {
      if (context.data.id !== projectId) throw new ApiClientError('Project context does not match this route.', { code: 'CROSS_PROJECT_REFERENCE' })
      assertProject(response.data, projectId)
      if (!controller.signal.aborted && generation.current === current) { setProject(context.data); setItems(response.data); setCursor(response.page.nextCursor); setLoading(false); heading.current?.focus() }
    }).catch(value => { if (!controller.signal.aborted && generation.current === current) { setError(asError(value)); setLoading(false) } })
    return () => controller.abort()
  }, [api, projects, projectId, query, attempt])
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const next: ActivityQuery = {}
    for (const field of ['from', 'to'] as const) if (filters[field]) { const date = new Date(filters[field]); if (!Number.isFinite(date.getTime())) { setValidation(c.invalidDate); return } next[field] = date.toISOString() }
    if (next.from && next.to && Date.parse(next.from) > Date.parse(next.to)) { setValidation(c.invalidDate); return }
    for (const field of ['actorId', 'entityId'] as const) if (filters[field].trim() && !UUIDSchema.safeParse(filters[field].trim()).success) { setValidation(c.invalidId); return }
    for (const field of ['actorId', 'entityId', 'eventType', 'entityType'] as const) if (filters[field].trim()) next[field] = filters[field].trim()
    setValidation(''); setQuery(next)
  }
  async function more() {
    if (!cursor || paging.current) return
    paging.current = true; setMoreLoading(true); const current = generation.current
    try { const response = await api.list(projectId, { ...query, cursor }, reader.current?.signal); assertProject(response.data, projectId); if (current === generation.current && !reader.current?.signal.aborted) { setItems(previous => [...previous, ...response.data]); setCursor(response.page.nextCursor); setError(null) } }
    catch (value) { if (current === generation.current && !reader.current?.signal.aborted) setError(asError(value)) }
    finally { if (current === generation.current) { paging.current = false; setMoreLoading(false) } }
  }
  return <div className="activity-page"><nav><a href={`#/projects/${projectId}`}>Project overview</a> · <a href={`#/projects/${projectId}/collections`}>View collections</a></nav><h2 ref={heading} tabIndex={-1}>{c.heading}</h2><p>{project?.name}</p><p>{c.intro}</p>
    <form className="home-panel activity-filters" aria-label="Activity filters" onSubmit={apply}><label>{c.event}<select aria-label={c.event} value={filters.eventType} onChange={event => setFilters(previous => ({ ...previous, eventType: event.target.value }))}><option value="">{c.all}</option>{Object.entries(eventLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>{(['from', 'to'] as const).map(field => <label key={field}>{c[field]}<input type="datetime-local" value={filters[field]} onChange={event => setFilters(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}<details><summary>Filter by actor and entity</summary>{(['actorId', 'entityType', 'entityId'] as const).map(field => <label key={field}>{field === 'actorId' ? c.actor : c[field]}<input value={filters[field]} onChange={event => setFilters(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}</details>{validation && <p role="alert">{validation}</p>}<div className="project-actions"><button>{c.apply}</button><button type="button" onClick={() => { setFilters(emptyFilters); setQuery({}); setValidation('') }}>{c.clear}</button></div></form>
    <section className="home-panel" aria-label="Recorded activity">
      <button disabled={loading} onClick={() => setAttempt(value => value + 1)}>{c.refresh}</button>
      {error && <ActivityError error={error} retry={() => setAttempt(value => value + 1)} />}
      {loading ? <p role="status">{c.loading}</p> : <>
        {!error && items.length === 0 && <p>{Object.keys(query).length ? c.noResults : c.empty}</p>}
        <ol className="activity-list">{items.map(value => <li key={value.id}>
          <h3><span aria-hidden="true">◷</span> {eventLabel(value.eventType)}</h3><p>{value.summary}</p>
          <p>{value.actor?.displayName ?? c.system} · <time dateTime={value.createdAt}>{new Date(value.createdAt).toLocaleString()}</time></p>
          <details><summary>Activity record details</summary><p>Event: {value.eventType}</p><p>Activity ID: <code>{value.id}</code></p><p>Entity: {value.entityType} · <code>{value.entityId ?? 'None'}</code></p>
            {value.requestId && <p>{c.requestId}: <code>{value.requestId}</code></p>}
            {typeof value.metadata.format === 'string' && <p>Export format: {value.metadata.format}</p>}
            {typeof value.metadata.decisionId === 'string' && UUIDSchema.safeParse(value.metadata.decisionId).success && <p>Decision ID: <code>{value.metadata.decisionId}</code></p>}
          </details>{eventLink(value, projectId)}
        </li>)}</ol>
        {cursor && <button disabled={moreLoading} onClick={() => void more()}>{moreLoading ? c.loading : c.more}</button>}
      </>}
    </section>
    {project && <ExportPanel api={api} projectId={projectId} canExport={['OWNER', 'REVIEWER', 'EDITOR', 'VIEWER'].includes(project.currentUserRole)} created={() => setAttempt(value => value + 1)} />}
  </div>
}
function eventLink(event: ActivityEvent, projectId: string) {
  if (!event.entityId) return null
  const sections: Record<string, string> = { ASSET: 'assets', COLLECTION: 'collections', IMPACT_ASSESSMENT: 'impact' }
  const section = Object.hasOwn(sections, event.entityType) ? sections[event.entityType] : undefined
  return section ? <a href={`#/projects/${projectId}/${section}/${event.entityId}`}>Inspect related record</a> : null
}
