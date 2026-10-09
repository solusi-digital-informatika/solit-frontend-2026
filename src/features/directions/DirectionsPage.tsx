import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { type DirectionRevisionInput } from '../../../packages/contracts/src'
import { projectApi, type ProjectView } from '../projects/api'
import { directionApi, type DirectionView, type Revision, type DiffView } from './api'
import { DirectionForm } from './DirectionForm'
import { directionCopy as c } from './copy'
import './directions.css'

type Data = { project: ProjectView; directions: DirectionView[]; histories: Record<string, Revision[]> }
type Editor = { kind: 'new' } | { kind: 'clone' | 'revise'; direction: DirectionView; revision: Revision }
const failure = (value: unknown) => value instanceof ApiClientError ? value : new ApiClientError('Unable to load directions.', { code: 'UNKNOWN' })
export function DirectionsPage({ client, projectId }: { client: ApiClient; projectId: string }) {
  const api = useMemo(() => directionApi(client), [client]); const projects = useMemo(() => projectApi(client), [client])
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState<ApiClientError | null>(null)
  const [attempt, setAttempt] = useState(0); const [loading, setLoading] = useState(true)
  const [directionId, setDirectionId] = useState(''); const [revisionId, setRevisionId] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null); const [notice, setNotice] = useState('')
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [diff, setDiff] = useState<DiffView | null>(null); const [comparing, setComparing] = useState(false)
  const [reason, setReason] = useState(''); const [reasonError, setReasonError] = useState(''); const [activationError, setActivationError] = useState<ApiClientError | null>(null); const [activating, setActivating] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null); const activateButton = useRef<HTMLButtonElement>(null); const busy = useRef(false); const compareGeneration = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null); const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  async function read(signal?: AbortSignal) {
    const [metadata, directions] = await Promise.all([projects.get(projectId, signal), api.list(projectId, signal)])
    const entries = await Promise.all(directions.map(async direction => [direction.id, await api.revisions(direction.id, signal)] as const))
    return { project: metadata.data, directions, histories: Object.fromEntries(entries) }
  }
  useEffect(() => {
    const controller = new AbortController()
    read(controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result); setLoading(false)
      const initial = result.directions.find(value => value.isActive) ?? result.directions[0]
      if (initial) { setDirectionId(initial.id); setRevisionId(initial.latestRevision.id); setTo(initial.latestRevision.id) }
      setFrom(result.project.activeDirectionRevisionId ?? '')
    }).catch((value: unknown) => { if (!controller.signal.aborted) { setError(failure(value)); setLoading(false) } })
    return () => controller.abort()
    // API instances and route identity define the request; read only combines these services.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [api, projects, projectId, attempt])
  useEffect(() => { if (!loading) heading.current?.focus() }, [loading])
  const direction = data?.directions.find(value => value.id === directionId)
  const revision = data?.histories[directionId]?.find(value => value.id === revisionId)
  const canEdit = data && ['OWNER', 'REVIEWER', 'EDITOR'].includes(data.project.currentUserRole)
  const options = data?.directions.flatMap(value => (data.histories[value.id] ?? []).map(item => ({ id: item.id, label: `${value.name} · ${c.revision} ${item.revisionNumber}` }))) ?? []
  async function refresh(selectedDirection: string, selectedRevision: string) { try { const result = await read(); if (live.current) { setData(result); setDirectionId(selectedDirection); setRevisionId(selectedRevision); setTo(selectedRevision); setFrom(result.project.activeDirectionRevisionId ?? ''); setDiff(null) } } catch (value) { if (live.current) setError(failure(value)) } }
  async function save(name: string, description: string, input: DirectionRevisionInput) {
    if (!editor) return
    if (editor.kind === 'revise') { const result = await api.revise(editor.direction.id, input); if (live.current) { setEditor(null); setNotice(c.saved); await refresh(editor.direction.id, result.data.id) } }
    else { const result = await api.create(projectId, { name, description: description || undefined, revision: input, cloneFromDirectionRevisionId: editor.kind === 'clone' ? editor.revision.id : undefined }); if (live.current) { setEditor(null); setNotice(c.saved); await refresh(result.data.id, result.data.latestRevision.id) } }
  }
  async function compare() {
    const generation = ++compareGeneration.current; setComparing(true); setError(null); setDiff(null)
    try { const result = await api.diff(from || undefined, to); if (live.current && compareGeneration.current === generation) setDiff(result.data) }
    catch (value) { if (live.current && compareGeneration.current === generation) setError(failure(value)) }
    finally { if (live.current && compareGeneration.current === generation) setComparing(false) }
  }
  function changeComparison(set: (value: string) => void, value: string) { compareGeneration.current++; setComparing(false); setDiff(null); set(value) }
  async function activate(event: React.FormEvent) {
    event.preventDefault(); if (!revision || busy.current) return
    if (reason.trim().length < 3 || reason.trim().length > 1000) { setReasonError(c.reasonError); return }
    busy.current = true; setActivating(true); setActivationError(null)
    try { await api.activate(projectId, revision.id, reason.trim()); if (live.current) { dialog.current?.close(); setNotice(c.activated); await refresh(directionId, revision.id) } }
    catch (value) { if (live.current) setActivationError(failure(value)) }
    finally { busy.current = false; if (live.current) setActivating(false) }
  }
  return <section className="directions-page" aria-label={c.heading}><a href={`#/projects/${projectId}`}>← {c.back}</a><h2 ref={heading} tabIndex={-1}>{c.heading}{data && <span className="note"> · {data.project.name}</span>}</h2>
    {loading && <p role="status">{c.loading}</p>}{notice && <p role="status">{notice}</p>}
    {error && <div className="project-error" role="alert"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: <code>{error.requestId}</code></p>}<button type="button" onClick={() => { setError(null); setLoading(true); setAttempt(value => value + 1) }}>{c.retry}</button></div>}
    {!loading && data && <>
      <p className="note">{c.activeRevision}: {options.find(value => value.id === data.project.activeDirectionRevisionId)?.label ?? c.none}</p>
      {!canEdit && <p>{c.role}</p>}
      {editor ? <DirectionForm key={editor.kind} revisionMode={editor.kind === 'revise'} initial={editor.kind === 'new' ? undefined : { ...editor.revision, changeSummary: null }} initialName={editor.kind === 'clone' ? `${editor.direction.name} copy` : ''} save={save} cancel={() => setEditor(null)} /> : <>
        {canEdit && <button type="button" onClick={() => setEditor({ kind: 'new' })}>{c.create}</button>}
        {data.directions.length === 0 ? <p>{c.empty}</p> : <>
          <div className="direction-selectors"><label>{c.selectDirection}<select value={directionId} onChange={event => { const selected = data.directions.find(value => value.id === event.target.value)!; setDirectionId(selected.id); setRevisionId(selected.latestRevision.id) }}>{data.directions.map(value => <option key={value.id} value={value.id}>{value.name} · {Object.hasOwn(c.statuses, value.status) ? c.statuses[value.status as keyof typeof c.statuses] : c.unknown}</option>)}</select></label><label>{c.selectRevision}<select value={revisionId} onChange={event => setRevisionId(event.target.value)}>{data.histories[directionId]?.map(value => <option key={value.id} value={value.id}>{c.revision} {value.revisionNumber}</option>)}</select></label></div>
          {direction && revision && <article className="home-panel" aria-label={direction.name}><h3>{direction.name} · {c.revision} {revision.revisionNumber}</h3><p>{c.branchStatus}: <span aria-hidden="true">●</span> {Object.hasOwn(c.statuses, direction.status) ? c.statuses[direction.status as keyof typeof c.statuses] : c.unknown}</p><p>{revision.summary}</p><dl className="direction-attributes"><dt>{c.palette}</dt><dd>{revision.palette.map(value => [value.name, value.hex, value.role].filter(Boolean).join(' · ')).join(', ') || c.none}</dd><dt>{c.quality}</dt><dd>{revision.lighting.quality ?? c.none}</dd><dt>{c.direction}</dt><dd>{revision.lighting.direction ?? c.none}</dd><dt>{c.temperature}</dt><dd>{revision.lighting.temperature ?? c.none}</dd><dt>{c.lightingNotes}</dt><dd>{revision.lighting.notes ?? c.none}</dd><dt>{c.framing}</dt><dd>{revision.composition.framing ?? c.none}</dd><dt>{c.layout}</dt><dd>{revision.composition.layout ?? c.none}</dd><dt>{c.compositionNotes}</dt><dd>{revision.composition.notes ?? c.none}</dd><dt>{c.materials}</dt><dd>{revision.materials.join(', ') || c.none}</dd><dt>{c.mood}</dt><dd>{revision.mood.join(', ') || c.none}</dd><dt>{c.families}</dt><dd>{revision.typography.families.join(', ') || c.none}</dd><dt>{c.typographyNotes}</dt><dd>{revision.typography.notes ?? c.none}</dd><dt>{c.changeSummary}</dt><dd>{revision.changeSummary ?? c.none}</dd></dl>
            {(['requiredAttributes', 'forbiddenAttributes'] as const).map(group => <section key={group}><h4>{c[group]}</h4>{revision[group].length ? <ul>{revision[group].map(value => <li key={value.id}>{value.label}: {value.value} · {value.category} · {value.hard ? c.hard : c.guideline}</li>)}</ul> : <p>{c.none}</p>}</section>)}<h4>{c.stylePrompt}</h4><pre className="preserve-text">{revision.stylePrompt ?? c.none}</pre><p className="note">{revision.createdBy.displayName} · <time dateTime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString()}</time></p>
            {canEdit && <div className="direction-actions"><button type="button" onClick={() => setEditor({ kind: 'clone', direction, revision })}>{c.clone}</button><button type="button" onClick={() => setEditor({ kind: 'revise', direction, revision: direction.latestRevision })}>{c.revise}</button>{direction.status !== 'ARCHIVED' && data.project.activeDirectionRevisionId !== revision.id && <button ref={activateButton} type="button" onClick={() => { setReason(''); setReasonError(''); setActivationError(null); dialog.current?.showModal() }}>{c.activate}</button>}</div>}
          </article>}
          <section className="home-panel" aria-label={c.comparison}><h3>{c.compare}</h3><p className="note">{c.diffNote}</p><div className="direction-selectors"><label>{c.from}<select value={from} onChange={event => changeComparison(setFrom, event.target.value)}><option value="">{c.noFrom}</option>{options.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label>{c.to}<select value={to} onChange={event => changeComparison(setTo, event.target.value)}>{options.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label></div><button type="button" disabled={comparing || !to} onClick={() => void compare()}>{comparing ? c.loading : c.compare}</button>{diff && <><p>{diff.summary}</p>{diff.changes.length === 0 && <p>{c.noChange}</p>}<ul className="direction-diff">{diff.changes.map(change => <li key={change.field}><h4>{Object.hasOwn(c, change.field) ? String(c[change.field as keyof typeof c]) : Object.hasOwn(c.categories, change.category) ? c.categories[change.category as keyof typeof c.categories] : c.otherAttributes}</h4><p><strong>{c.before}:</strong> {change.from ?? c.none}</p><p><strong>{c.after}:</strong> {change.to ?? c.none}</p></li>)}</ul></>}</section>
        </>}
      </>}
    </>}
    <dialog ref={dialog} className="activation-dialog" aria-labelledby="activation-heading" onCancel={event => { if (activating) event.preventDefault() }} onClose={() => activateButton.current?.focus()}><form onSubmit={activate}><h3 id="activation-heading">{c.confirm}</h3><p>{direction?.name} · {c.revision} {revision?.revisionNumber}</p><p>{c.activationNote}</p><label htmlFor="activation-reason">{c.reason}</label><textarea autoFocus id="activation-reason" disabled={activating} value={reason} maxLength={1000} aria-invalid={Boolean(reasonError)} aria-describedby="activation-reason-error" onChange={event => setReason(event.target.value)} /><p id="activation-reason-error" className="field-error">{reasonError}</p>{activationError && <div role="alert"><p>{activationError.message}</p><p>{c.requestId}: {activationError.requestId}</p></div>}<div className="project-actions"><button type="submit" disabled={activating}>{activating ? c.saving : c.confirm}</button><button type="button" disabled={activating} onClick={() => dialog.current?.close()}>{c.cancel}</button></div></form></dialog>
  </section>
}
