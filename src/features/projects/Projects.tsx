import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, createIntentKey, type ApiClient } from '../../lib/api/client'
import { projectApi, type ProjectView } from './api'
import { ProjectHome } from './ProjectHome'
import { ProjectStatus } from './ProjectStatus'
export { ProjectStatus } from './ProjectStatus'
import { projectCopy as c } from './copy'
import './projects.css'

function asError(error: unknown) { return error instanceof ApiClientError ? error : new ApiClientError('The request failed. Please try again.', { code: 'UNKNOWN' }) }
function ErrorMessage({ error, retry }: { error: ApiClientError; retry?: () => void }) {
  return <div className="project-error" role="alert"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: <code>{error.requestId}</code></p>}{retry && <button type="button" onClick={retry}>{c.retry}</button>}</div>
}

export function Projects({ client, isMockApi }: { client: ApiClient; isMockApi: boolean }) {
  const api = useMemo(() => projectApi(client), [client])
  const [hash, setHash] = useState(window.location.hash)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sort, setSort] = useState('updatedAt:desc')
  const [items, setItems] = useState<ProjectView[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<ApiClientError | null>(null)
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const intent = useRef<string | null>(null)
  const busy = useRef(false)
  const pageBusy = useRef(false)
  const generation = useRef(0)
  const nameInput = useRef<HTMLInputElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const projectId = /^#\/projects\/([^/]+)$/.exec(hash)?.[1] ?? null
  useEffect(() => {
    const update = () => { setHash(window.location.hash); setFormOpen(false); setNotice('') }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => { if (formOpen) nameInput.current?.focus() }, [formOpen])
  useEffect(() => {
    const controller = new AbortController()
    const current = ++generation.current
    pageBusy.current = false
    // oxlint-disable-next-line react/set-state-in-effect -- Reset request state when synchronizing a changed route/filter with the external API.
    setLoadingMore(false); setLoading(true); setError(null); setItems([])
    if (!projectId) {
      api.list({ q, status: status || undefined, sort }, controller.signal).then(result => {
        if (!controller.signal.aborted && generation.current === current) { setItems(result.data); setCursor(result.page.nextCursor); setLoading(false) }
      }).catch((value: unknown) => { if (!controller.signal.aborted) { setError(asError(value)); setLoading(false) } })
    }
    return () => controller.abort()
  }, [api, projectId, q, status, sort, attempt])
  async function more() {
    if (!cursor || pageBusy.current) return
    pageBusy.current = true; setLoadingMore(true); setError(null)
    const current = generation.current
    try {
      const result = await api.list({ q, status: status || undefined, sort, cursor })
      if (current === generation.current) { setItems(previous => [...previous, ...result.data]); setCursor(result.page.nextCursor) }
    } catch (value) { if (current === generation.current) setError(asError(value)) }
    finally { if (current === generation.current) { pageBusy.current = false; setLoadingMore(false) } }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    if (!name.trim() || name.trim().length > 160) { setNameError(c.nameError); nameInput.current?.focus(); return }
    busy.current = true; setSaving(true); setFormError(null); setNameError('')
    try {
      const result = await api.create({ name: name.trim(), description: description.trim() || undefined, template: 'BLANK' }, intent.current ?? (intent.current = createIntentKey()))
      setFormOpen(false); setName(''); setDescription(''); intent.current = null; setNotice(c.created)
      window.location.hash = `/projects/${result.data.id}`
    } catch (value) { setFormError(asError(value)) }
    finally { busy.current = false; setSaving(false) }
  }
  return <section className="projects" aria-label={c.heading}>
    {isMockApi && <p className="mock-notice">{c.mock}</p>}
    {notice && <p role="status">{notice}</p>}
    {projectId ? <ProjectHome key={projectId} client={client} projectId={projectId} isMockApi={isMockApi} /> : <>
      <div className="projects-heading"><div><h2>{c.heading}</h2><p>{c.intro}</p></div><button ref={createButton} type="button" disabled={saving} onClick={() => { setFormOpen(true); setFormError(null); setNameError(''); intent.current = createIntentKey() }}>{c.create}</button></div>
      {formOpen && <form className="project-form" onSubmit={create} aria-label={c.create}>
        <p>{c.blank}</p><label htmlFor="project-name">{c.name}</label><input ref={nameInput} id="project-name" disabled={saving} value={name} maxLength={160} aria-invalid={Boolean(nameError || formError?.details.some(value => value.path === 'body.name'))} aria-describedby="project-name-error" onChange={event => { setName(event.target.value); intent.current = createIntentKey() }} />
        <p id="project-name-error">{nameError || formError?.details.find(value => value.path === 'body.name')?.message}</p>
        <label htmlFor="project-description">{c.description}</label><textarea id="project-description" disabled={saving} value={description} onChange={event => { setDescription(event.target.value); intent.current = createIntentKey() }} />
        {formError && <ErrorMessage error={formError} />}
        <div className="project-actions"><button type="submit" disabled={saving}>{saving ? c.saving : c.create}</button><button type="button" disabled={saving} onClick={() => { setFormOpen(false); intent.current = null; createButton.current?.focus() }}>{c.cancel}</button></div>
      </form>}
      <div className="project-filters"><label>{c.search}<input type="search" value={q} onChange={event => setQ(event.target.value)} /></label><label>{c.status}<select value={status} onChange={event => setStatus(event.target.value)}><option value="">{c.all}</option><option value="ACTIVE">{c.active}</option><option value="ARCHIVED">{c.archived}</option></select></label><label>{c.sort}<select value={sort} onChange={event => setSort(event.target.value)}><option value="updatedAt:desc">{c.recent}</option><option value="name:asc">{c.alphabetical}</option></select></label></div>
      {loading ? <p role="status">{c.loading}</p> : <>
        {error && <ErrorMessage error={error} retry={() => loadingMore ? undefined : setAttempt(value => value + 1)} />}
        {!error && items.length === 0 && <p role="status">{q || status === 'ARCHIVED' ? c.noResults : c.empty}</p>}
        <ul className="project-grid">{items.map(project => <li key={project.id} className="project-card"><ProjectStatus status={project.status} /><h3><a href={`#/projects/${project.id}`}>{project.name}</a></h3><p>{project.description ?? c.noDescription}</p><p className="note">{c.owner}: {project.owner.displayName}</p><a href={`#/projects/${project.id}`}>{c.open} →</a></li>)}</ul>
        {cursor && <button type="button" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? c.loading : c.loadMore}</button>}
      </>}
    </>}
  </section>
}
