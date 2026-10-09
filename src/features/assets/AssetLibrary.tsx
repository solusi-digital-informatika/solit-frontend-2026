import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiClient } from '../../lib/api/client'
import { ApiClientError } from '../../lib/api/client'
import { projectApi, type ProjectView } from '../projects/api'
import { directionApi, type DirectionView } from '../directions/api'
import { referenceApi, type ReferenceView } from '../references/api'
import { assetApi, type AssetDetailView, type AssetView } from './api'
import { AssetForm } from './AssetForm'
import { AssetDetail } from './AssetDetail'
import { AssetMedia, AssetStatus } from './AssetMedia'
import { assetCopy as c } from './copy'
import { label } from '../references/display'
import './assets.css'
export function AssetLibrary({ client, projectId, assetId }: { client: ApiClient; projectId: string; assetId?: string }) {
  const api = useMemo(() => assetApi(client), [client]); const projects = useMemo(() => projectApi(client), [client]); const directionsApi = useMemo(() => directionApi(client), [client]); const refs = useMemo(() => referenceApi(client), [client])
  const [project, setProject] = useState<ProjectView | null>(null); const [directions, setDirections] = useState<DirectionView[]>([])
  const [items, setItems] = useState<AssetView[]>([]); const [detail, setDetail] = useState<AssetDetailView | null>(null); const [references, setReferences] = useState<ReferenceView[]>([])
  const [query, setQuery] = useState({ q: '', status: '', assetType: '', directionId: '', tag: '', ownerUserId: '', sort: 'updatedAt:desc', includeArchived: false })
  const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [detailLoading, setDetailLoading] = useState(Boolean(assetId)); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState<ApiClientError | null>(null); const [contextError, setContextError] = useState<ApiClientError | null>(null); const [detailError, setDetailError] = useState<ApiClientError | null>(null)
  const [attempt, setAttempt] = useState(0); const [create, setCreate] = useState(false); const [notice, setNotice] = useState(''); const generation = useRef(0); const paging = useRef(false); const heading = useRef<HTMLHeadingElement>(null)
  const filters = useMemo(() => Object.fromEntries(Object.entries(query).map(([key, value]) => [key, value === '' ? undefined : value])), [query])
  useEffect(() => { const controller = new AbortController(); Promise.all([projects.get(projectId, controller.signal), directionsApi.list(projectId, controller.signal)]).then(([project, directions]) => { if (!controller.signal.aborted) { setProject(project.data); setDirections(directions); setContextError(null) } }).catch(value => { if (!controller.signal.aborted) setContextError(asError(value)) }); return () => controller.abort() }, [projects, directionsApi, projectId, attempt])
  useEffect(() => {
    const controller = new AbortController(); const current = ++generation.current; paging.current = false
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize server list with filters and refresh intent.
    setLoading(true); setError(null); setMoreLoading(false)
    api.list(projectId, filters, controller.signal).then(result => { if (!controller.signal.aborted && current === generation.current) { setItems(result.data); setCursor(result.page.nextCursor); setLoading(false) } }).catch(value => { if (!controller.signal.aborted) { setError(asError(value)); setLoading(false) } }); return () => controller.abort()
  }, [api, projectId, filters, attempt])
  useEffect(() => {
    if (!assetId) { heading.current?.focus(); return }
    const controller = new AbortController()
    // oxlint-disable-next-line react/set-state-in-effect -- Reset detail request on route change.
    setDetail(null); setDetailLoading(true); setDetailError(null); setCreate(false)
    async function load() {
      const result = await api.get(assetId!, controller.signal)
      if (result.data.projectId !== projectId) throw new ApiClientError('This asset belongs to a different project.', { code: 'CROSS_PROJECT_REFERENCE' })
      const values: ReferenceView[] = []
      // Fetch only references actually linked to the asset, not the entire reference board.
      await Promise.all([...new Set(result.data.referenceLinks.map(link => link.referenceId))].map(async id => values.push((await refs.get(id)).data)))
      if (!controller.signal.aborted) { setDetail(result.data); setReferences(values); setDetailLoading(false) }
    }
    void load().catch(value => { if (!controller.signal.aborted) { setDetailError(asError(value)); setDetailLoading(false) } })
    return () => controller.abort()
  }, [api, refs, assetId, projectId, attempt])
  const canEdit = Boolean(project && ['OWNER', 'EDITOR', 'REVIEWER'].includes(project.currentUserRole))
  const owners = [...new Map([...(project ? [project.owner] : []), ...items.flatMap(item => item.owner ? [item.owner] : [])].map(owner => [owner.id, owner])).values()]
  async function more() { if (!cursor || paging.current) return; paging.current = true; setMoreLoading(true); setError(null); const current = generation.current; try { const result = await api.list(projectId, { ...filters, cursor }); if (current === generation.current) { setItems(previous => [...previous, ...result.data]); setCursor(result.page.nextCursor) } } catch (value) { if (current === generation.current) setError(asError(value)) } finally { if (current === generation.current) { paging.current = false; setMoreLoading(false) } } }
  function updated(value: AssetView) { setDetail(previous => previous ? { ...previous, ...value } : null); setNotice(c.metadataSaved); setAttempt(previous => previous + 1) }
  const retry = () => setAttempt(value => value + 1)
  return <><nav><a href={`#/projects/${projectId}`}>{c.overview}</a> · <a href={`#/projects/${projectId}/references`}>{c.references}</a></nav>
    <div className="projects-heading"><div><h2 ref={heading} tabIndex={-1}>{c.heading}</h2><p>{project?.name}</p>{project && <p className="note">Active direction: {directions.find(direction => direction.isActive)?.name ?? 'No active direction'}</p>}</div>{canEdit && !assetId && <button onClick={() => { setCreate(true); setNotice('') }}>{c.create}</button>}</div>
    {notice && <p role="status">{notice}</p>}{project && !canEdit && <p>{c.readOnly}</p>}{contextError && <ErrorMessage error={contextError} retry={retry} />}
    {assetId ? detailLoading ? <p role="status">{c.loadingDetail}</p> : detailError ? <><a href={`#/projects/${projectId}/assets`}>{c.back}</a><ErrorMessage error={detailError} retry={retry} /></> : detail && project && <AssetDetail key={detail.id} asset={detail} api={api} client={client} projectId={projectId} owner={project.owner} canEdit={canEdit} references={references} updated={updated} versionCreated={() => { setNotice('New version saved.'); setAttempt(value => value + 1) }} /> : <>
      {create && project && <AssetForm owner={project.owner} cancel={() => { setCreate(false); heading.current?.focus() }} save={async (input, key) => { const result = await api.create(projectId, input, key); setCreate(false); setNotice(c.saved); setAttempt(value => value + 1); window.location.hash = `/projects/${projectId}/assets/${result.data.id}` }} />}
      <div className="asset-filters"><label>{c.search}<input type="search" value={query.q} onChange={event => setQuery(previous => ({ ...previous, q: event.target.value }))} /></label>
        {(['status', 'assetType', 'directionId', 'ownerUserId', 'sort'] as const).map(field => <label key={field}>{field === 'status' ? c.status : field === 'assetType' ? c.type : field === 'directionId' ? c.direction : field === 'ownerUserId' ? c.owner : c.sort}<select value={query[field]} onChange={event => setQuery(previous => ({ ...previous, [field]: event.target.value }))}>
          {field !== 'sort' && <option value="">{field === 'status' ? c.allStatuses : field === 'assetType' ? c.allTypes : field === 'directionId' ? c.allDirections : c.allOwners}</option>}
          {field === 'status' || field === 'assetType' || field === 'sort' ? Object.entries(field === 'status' ? c.statuses : field === 'assetType' ? c.types : c.sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>) : field === 'directionId' ? directions.map(direction => <option key={direction.id} value={direction.id}>{direction.name}</option>) : owners.map(owner => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
        </select></label>)}
        <label>{c.tag}<input value={query.tag} onChange={event => setQuery(previous => ({ ...previous, tag: event.target.value }))} /></label><label className="asset-checkbox"><input type="checkbox" checked={query.includeArchived} onChange={event => setQuery(previous => ({ ...previous, includeArchived: event.target.checked }))} />{c.includeArchived}</label>
      </div>
      {error && <ErrorMessage error={error} retry={retry} />}{loading ? <div className="asset-loading" role="status"><p>{c.loading}</p><div aria-hidden="true" /></div> : <>{!error && !items.length && <p role="status">{Object.entries(query).some(([key, value]) => key !== 'sort' && Boolean(value)) ? c.noResults : c.empty}</p>}<ul className="asset-grid">{items.map(asset => <li className="asset-card" key={asset.id}><AssetMedia key={asset.latestVersion?.thumbnailUrl} url={asset.latestVersion?.thumbnailUrl ?? null} title={asset.title} /><div className="asset-card-content"><AssetStatus status={asset.status} /><p className="eyebrow">{label(c.types, asset.assetType)}</p><h3><a href={`#/projects/${projectId}/assets/${asset.id}`}>{asset.title}</a></h3><p>{asset.description ?? c.noDescription}</p><p>{c.owner}: {asset.owner?.displayName ?? c.unassigned}</p><p>{asset.latestVersion ? <>{c.latest}: {asset.latestVersion.versionNumber} · <AssetStatus status={asset.latestVersion.status} version /></> : c.noVersion}</p><p>{c.versionCount}: {asset.versionCount} · {asset.tags.join(' · ')}</p><a aria-label={`${c.inspect}: ${asset.title}`} href={`#/projects/${projectId}/assets/${asset.id}`}>{c.inspect}</a></div></li>)}</ul>{cursor && <button disabled={moreLoading} onClick={() => void more()}>{moreLoading ? c.loading : c.more}</button>}</>}
    </>}
  </>
}
function asError(value: unknown) { return value instanceof ApiClientError ? value : new ApiClientError('Unable to load asset library.', { code: 'UNKNOWN' }) }
function ErrorMessage({ error, retry }: { error: ApiClientError; retry: () => void }) { return <div role="alert" className="project-error"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: {error.requestId}</p>}<button onClick={retry}>{c.retry}</button></div> }
