import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { assetApi, type AssetDetailView, type VersionView } from './api'
import { versionContextApi, type VersionOptions } from './versionApi'
import { VersionForm } from './VersionForm'
import { VersionInspection } from './VersionInspection'
import { versionCopy as c } from './versionCopy'
export function VersionWorkspace({ client, asset, canEdit, created, editingChanged, versionId }: { client: ApiClient; asset: AssetDetailView; canEdit: boolean; created: () => void; editingChanged?: (value: boolean) => void; versionId?: string }) {
  const api = useMemo(() => assetApi(client), [client]); const context = useMemo(() => versionContextApi(client), [client])
  const [selectedId, setSelectedId] = useState(versionId ?? asset.latestVersion?.id ?? ''); const [secondId, setSecondId] = useState(''); const [selected, setSelected] = useState<VersionView | null>(null); const [second, setSecond] = useState<VersionView | null>(null); const [options, setOptions] = useState<VersionOptions | null>(null); const [error, setError] = useState<ApiClientError | null>(null); const [contextError, setContextError] = useState<ApiClientError | null>(null); const [loading, setLoading] = useState(Boolean(selectedId)); const [editing, setEditing] = useState(false); const [comparing, setComparing] = useState(false); const [attempt, setAttempt] = useState(0); const [notice, setNotice] = useState(''); const heading = useRef<HTMLHeadingElement>(null); const userSelection = useRef(false)
  useEffect(() => { const controller = new AbortController(); context.options(asset.projectId, controller.signal).then(values => { if (!controller.signal.aborted) { setOptions(values); setContextError(null) } }).catch(value => { if (!controller.signal.aborted) setContextError(asError(value)) }); return () => controller.abort() }, [context, asset.projectId, attempt])
  const comparisonId = comparing ? secondId : ''
  useEffect(() => {
    const controller = new AbortController()
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize exact selected version IDs with the API.
    setSelected(null); setSecond(null); setError(null); setLoading(Boolean(selectedId)); setEditing(false)
    if (selectedId) Promise.all([api.version(selectedId, controller.signal), comparisonId && comparisonId !== selectedId ? api.version(comparisonId, controller.signal) : Promise.resolve(null)]).then(([first, next]) => {
      if (first.data.assetId !== asset.id || (next && next.data.assetId !== asset.id)) throw new ApiClientError('Select versions of this same asset.', { code: 'CROSS_PROJECT_REFERENCE' })
      if (!controller.signal.aborted) { setSelected(first.data); setSecond(next?.data ?? null); setLoading(false); if (userSelection.current) heading.current?.focus() }
    }).catch(value => { if (!controller.signal.aborted) { setError(asError(value)); setLoading(false) } })
    return () => controller.abort()
  }, [api, asset.id, selectedId, comparisonId, attempt])
  function inspect(id: string) { userSelection.current = true; setSelectedId(id); setComparing(false); setNotice(''); if (versionId) window.location.hash = `/projects/${asset.projectId}/assets/${asset.id}/versions/${id}` }
  const retry = () => setAttempt(value => value + 1)
  return <section className="home-panel version-workspace"><h4 ref={heading} tabIndex={-1}>{c.heading}</h4>{notice && <p role="status">{notice}</p>}{contextError && <ErrorMessage error={contextError} retry={retry} />}
    <div className="version-actions"><label>{c.select}<select disabled={editing} value={selectedId} onChange={event => inspect(event.target.value)}>{!asset.versions.length && <option value="">No versions yet</option>}{asset.versions.map(version => <option key={version.id} value={version.id}>Version {version.versionNumber} · {version.id}</option>)}</select></label>{canEdit && <button disabled={!options || loading || editing || Boolean(error || contextError)} onClick={() => { setEditing(true); editingChanged?.(true) }}>{c.create}</button>}</div>
    {editing && options && <VersionForm asset={asset} source={selected ?? undefined} options={options} cancel={() => { setEditing(false); editingChanged?.(false); heading.current?.focus() }} save={async (input, key) => { const result = await api.createVersion(asset.id, input, key); setEditing(false); editingChanged?.(false); setNotice(c.saved); setSelectedId(result.data.id); if (versionId) window.location.hash = `/projects/${asset.projectId}/assets/${asset.id}/versions/${result.data.id}`; created() }} />}
    {!editing && asset.versions.length > 1 && <div className="version-actions"><label>{c.to}<select value={secondId} onChange={event => { setSecondId(event.target.value); setComparing(false) }}><option value="">Choose a version</option>{asset.versions.map(version => <option key={version.id} value={version.id}>Version {version.versionNumber}</option>)}</select></label><button disabled={!secondId || selectedId === secondId || loading} onClick={() => setComparing(true)}>{c.compare}</button>{secondId === selectedId && <p>{c.same}</p>}</div>}
    {error && <ErrorMessage error={error} retry={retry} />}{loading ? <p role="status">{c.loading}</p> : selected && !editing && <><h5>{second ? c.comparison : 'Selected version'}</h5><div className={second ? 'version-comparison' : ''}><VersionInspection version={selected} options={options} inspect={inspect} prefix={second ? c.from : 'Selected version'} />{second && <VersionInspection version={second} options={options} inspect={inspect} prefix={c.to} />}</div></>}
  </section>
}
function asError(value: unknown) { return value instanceof ApiClientError ? value : new ApiClientError('Unable to load version.', { code: 'UNKNOWN' }) }
function ErrorMessage({ error, retry }: { error: ApiClientError; retry: () => void }) { return <div className="project-error" role="alert"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: {error.requestId}</p>}<button onClick={retry}>{c.retry}</button></div> }
