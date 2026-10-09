import { useEffect, useRef, useState } from 'react'
import type { UserSummary } from '../../../packages/contracts/src'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import type { AssetDetailView, AssetView, assetApi } from './api'
import type { ReferenceView } from '../references/api'
import { AssetForm } from './AssetForm'
import { AssetMedia, AssetStatus } from './AssetMedia'
import { assetCopy as c } from './copy'
import { label } from '../references/display'
import { VersionWorkspace } from './VersionWorkspace'
export function AssetDetail({ asset, api, client, projectId, owner, canEdit, references, updated, versionCreated }: { asset: AssetDetailView; api: ReturnType<typeof assetApi>; client: ApiClient; projectId: string; owner: UserSummary; canEdit: boolean; references: ReferenceView[]; updated: (value: AssetView) => void; versionCreated: () => void }) {
  const [edit, setEdit] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<ApiClientError | null>(null)
  const [versionEditing, setVersionEditing] = useState(false)
  const busy = useRef(false); const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (!edit) heading.current?.focus() }, [edit])
  async function archive() {
    if (busy.current || (asset.status !== 'ARCHIVED' && !window.confirm(c.archiveConfirm))) return
    busy.current = true; setPending(true); setError(null)
    try { updated((await api.status(asset, asset.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED')).data) }
    catch (value) { setError(value instanceof ApiClientError ? value : new ApiClientError('Unable to change asset status.', { code: 'UNKNOWN' })) }
    finally { busy.current = false; setPending(false) }
  }
  return <article className="asset-detail">
    <a href={`#/projects/${projectId}/assets`}>{c.back}</a><h3 ref={heading} tabIndex={-1}>{asset.title}</h3><AssetStatus status={asset.status} /><p>{label(c.types, asset.assetType)} · {asset.owner?.displayName ?? c.unassigned}</p>
    <AssetMedia key={asset.latestVersion?.thumbnailUrl} url={asset.latestVersion?.thumbnailUrl ?? null} title={asset.title} />
    <p>{asset.description ?? c.noDescription}</p><p>{asset.tags.join(' · ')}</p>
    <dl className="asset-metadata"><dt>{c.versionCount}</dt><dd>{asset.versionCount}</dd><dt>{c.latest}</dt><dd>{asset.latestVersion ? <>Version {asset.latestVersion.versionNumber} · <AssetStatus status={asset.latestVersion.status} version /></> : c.noVersion}</dd><dt>{c.createdBy}</dt><dd>{asset.createdBy.displayName}</dd><dt>{c.updated}</dt><dd><time dateTime={asset.updatedAt}>{new Date(asset.updatedAt).toLocaleString()}</time></dd></dl>
    {error && <div role="alert" className="project-error"><p>{error.message}</p>{error.requestId && <p>{c.requestId}: {error.requestId}</p>}<p>{c.failedWrite}</p><button disabled={pending} onClick={() => { void api.get(asset.id).then(result => { updated(result.data); setError(null) }).catch(value => setError(value instanceof ApiClientError ? value : error)) }}>{c.reload}</button></div>}
    {canEdit && !edit && <div className="project-actions"><button disabled={pending || versionEditing} onClick={() => setEdit(true)}>{c.edit}</button><button disabled={pending || versionEditing} onClick={() => void archive()}>{asset.status === 'ARCHIVED' ? c.restore : c.archive}</button></div>}
    {asset.status === 'ARCHIVED' && <p className="note">{c.restoreNote}</p>}
    {edit && <AssetForm asset={asset} owner={owner} cancel={() => setEdit(false)} reload={async () => (await api.get(asset.id)).data} save={async input => { if ('expectedUpdatedAt' in input) { const result = await api.edit(asset.id, input); updated(result.data); setEdit(false) } }} />}
    <section className="home-panel"><h4>{c.history}</h4><p className="note">{c.historyNote}</p>{!asset.versions.length ? <p>{c.noVersion}</p> : <ol className="asset-version-list">{asset.versions.map(version => <li key={version.id}><strong>Version {version.versionNumber}</strong> <AssetStatus status={version.status} version /><p><code>{version.id}</code></p><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time></li>)}</ol>}</section>
    <VersionWorkspace client={client} asset={asset} canEdit={canEdit && !edit && !pending} created={versionCreated} editingChanged={setVersionEditing} />
    <section className="home-panel"><h4>{c.linkedReferences}</h4>{!asset.referenceLinks.length && <p>{c.noReferences}</p>}<ul className="asset-reference-list">{asset.referenceLinks.map((link, index) => { const reference = references.find(value => value.id === link.referenceId); return <li key={`${link.referenceId}:${index}`}><strong>{reference?.title ?? c.unavailable}</strong><p>{link.relationshipType} · {link.note}</p><p className="asset-rights"><strong>{c.rights}</strong><br />{reference?.usageRightsNote ?? c.noRights}</p><a href={`#/projects/${projectId}/references`}>{c.references}</a></li> })}</ul></section>
    <section className="home-panel"><h4>{c.decisions}</h4>{!asset.recentDecisions.length ? <p>{c.noDecisions}</p> : <ol>{asset.recentDecisions.map(decision => <li key={decision.id}><strong>{label({ APPROVE_VERSION: 'Version approved', REJECT_VERSION: 'Version rejected', REQUEST_REVISION: 'Revision requested', ACCEPT_RECOMMENDATION: 'Recommendation accepted', OVERRIDE_RECOMMENDATION: 'Recommendation overridden' }, decision.decisionType)}</strong><p>{decision.rationale}</p><p>{decision.createdBy.displayName} · <time dateTime={decision.createdAt}>{new Date(decision.createdAt).toLocaleString()}</time></p></li>)}</ol>}</section>
  </article>
}
