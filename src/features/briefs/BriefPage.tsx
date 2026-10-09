import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { projectApi, type ProjectView } from '../projects/api'
import { briefApi, type BriefView } from './api'
import { BriefDetail } from './BriefDetail'
import { BriefForm } from './BriefForm'
import { briefCopy as c } from './copy'
import type { BriefRevisionInput } from '../../../packages/contracts/src'
import './briefs.css'

function asError(value: unknown) { return value instanceof ApiClientError ? value : new ApiClientError('Unable to load the brief.', { code: 'UNKNOWN' }) }
export function BriefPage({ client, projectId }: { client: ApiClient; projectId: string }) {
  const api = useMemo(() => briefApi(client), [client])
  const projects = useMemo(() => projectApi(client), [client])
  const [project, setProject] = useState<ProjectView | null>(null)
  const [latest, setLatest] = useState<BriefView | null>(null)
  const [selected, setSelected] = useState<BriefView | null>(null)
  const [history, setHistory] = useState<BriefView[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const selectionController = useRef<AbortController | null>(null)
  const pageBusy = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selectionController.current?.abort() } }, [])
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([projects.get(projectId, controller.signal), api.latest(projectId, controller.signal), api.list(projectId, undefined, controller.signal)]).then(([metadata, current, list]) => {
      if (!controller.signal.aborted) { setProject(metadata.data); setLatest(current); setSelected(current); setHistory(list.data); setCursor(list.page.nextCursor); setLoading(false) }
    }).catch((value: unknown) => { if (!controller.signal.aborted) { setError(asError(value)); setLoading(false) } })
    return () => controller.abort()
  }, [api, projects, projectId, attempt])
  useEffect(() => { if (!loading) heading.current?.focus() }, [loading])
  useEffect(() => {
    if (wasEditing.current && !editing) createButton.current?.focus()
    wasEditing.current = editing
  }, [editing])
  async function select(id: string) {
    selectionController.current?.abort()
    const controller = new AbortController(); selectionController.current = controller
    setSelectionLoading(true); setError(null)
    try { const result = await api.get(id, controller.signal); if (!controller.signal.aborted) setSelected(result.data) }
    catch (value) { if (!controller.signal.aborted) setError(asError(value)) }
    finally { if (!controller.signal.aborted) setSelectionLoading(false) }
  }
  async function loadMore() {
    if (!cursor || pageBusy.current) return
    pageBusy.current = true; setMoreLoading(true); setError(null)
    try { const result = await api.list(projectId, cursor); if (mounted.current) { setHistory(previous => [...previous, ...result.data]); setCursor(result.page.nextCursor) } }
    catch (value) { if (mounted.current) setError(asError(value)) }
    finally { if (mounted.current) { setMoreLoading(false); pageBusy.current = false } }
  }
  async function save(input: BriefRevisionInput) {
    const result = await api.create(projectId, input)
    if (!mounted.current) return
    selectionController.current?.abort(); setSelectionLoading(false)
    setLatest(result.data); setSelected(result.data); setEditing(false); setNotice(c.saved)
    // The write is confirmed. A history-refresh failure must not invite resubmitting it.
    try {
      const [current, list] = await Promise.all([api.latest(projectId), api.list(projectId)])
      if (mounted.current) { setLatest(current); setHistory(list.data); setCursor(list.page.nextCursor) }
    } catch (value) { if (mounted.current) setError(asError(value)) }
  }
  const canEdit = project !== null && ['OWNER', 'REVIEWER', 'EDITOR'].includes(project.currentUserRole)
  return <section className="brief-page" aria-label={c.heading}>
    <a href={`#/projects/${projectId}`}>← {c.back}</a><h2 ref={heading} tabIndex={-1}>{c.heading}{project && <span className="note"> · {project.name}</span>}</h2>
    {loading && <p role="status">{c.loading}</p>}
    {error && <div role="alert" className="project-error"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: <code>{error.requestId}</code></p>}<button type="button" onClick={() => { setError(null); setLoading(true); setAttempt(value => value + 1) }}>{c.retry}</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!loading && project && <>
      {!editing && canEdit && <button ref={createButton} type="button" onClick={() => { setEditing(true); setNotice('') }}>{latest ? c.revise : c.first}</button>}
      {!canEdit && <p>{c.readOnly}</p>}
      {editing ? <BriefForm latest={latest} save={save} cancel={() => { setEditing(false); createButton.current?.focus() }} /> : <>
        <p className="note">{c.immutable}</p>
        {!latest && <p>{c.empty}</p>}
        <div className="brief-layout"><section className="brief-history" aria-label={c.history}><h3>{c.history}</h3><ol>{history.map(revision => <li key={revision.id}><button type="button" aria-current={selected?.id === revision.id ? 'true' : undefined} onClick={() => void select(revision.id)}>{c.revision} {revision.revisionNumber}{revision.id === latest?.id ? ` · ${c.latest}` : ''}</button><p className="note">{revision.changeSummary ?? revision.title}</p></li>)}</ol>{cursor && <button disabled={moreLoading} type="button" onClick={() => void loadMore()}>{moreLoading ? c.loading : c.loadMore}</button>}</section>
        {selectionLoading ? <p role="status">{c.loadingRevision}</p> : selected && <BriefDetail revision={selected} latestId={latest?.id ?? null} />}</div>
      </>}
    </>}
  </section>
}
