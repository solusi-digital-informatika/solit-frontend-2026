import { useEffect, useRef, useState } from 'react'
import { AssetTypeSchema, type UserSummary } from '../../../packages/contracts/src'
import { ApiClientError, createIntentKey } from '../../lib/api/client'
import { EditableAssetStatusSchema, type AssetView, type AssetInput, type AssetEdit } from './api'
import { assetCopy as c } from './copy'
export function AssetForm({ asset, owner, save, cancel, reload }: { asset?: AssetView; owner: UserSummary; save: (input: AssetInput | AssetEdit, key: string) => Promise<void>; cancel: () => void; reload?: () => Promise<AssetView> }) {
  const [title, setTitle] = useState(asset?.title ?? '')
  const [description, setDescription] = useState(asset?.description ?? '')
  const [type, setType] = useState(asset?.assetType ?? 'OTHER')
  const [tags, setTags] = useState(asset?.tags.join('\n') ?? '')
  const [ownerId, setOwnerId] = useState('')
  const [status, setStatus] = useState('')
  const [timestamp, setTimestamp] = useState(asset?.updatedAt ?? '')
  const [latest, setLatest] = useState<AssetView | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [validation, setValidation] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const intent = useRef<{ fingerprint: string; key: string } | null>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => { titleInput.current?.focus() }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return
    const parsedType = AssetTypeSchema.safeParse(type)
    if (!title.trim() || !parsedType.success) { setValidation(c.required); titleInput.current?.focus(); return }
    const parsedStatus = status ? EditableAssetStatusSchema.safeParse(status) : null
    if (parsedStatus && !parsedStatus.success) { setValidation(c.validation); return }
    if (status === 'ARCHIVED' && asset?.status !== 'ARCHIVED' && !window.confirm(c.archiveConfirm)) return
    const input = { title: title.trim(), description: description.trim() || null, assetType: parsedType.data, tags: tags.split('\n').map(value => value.trim()).filter(Boolean), ...(ownerId ? { ownerUserId: ownerId } : {}), ...(asset ? { expectedUpdatedAt: timestamp, ...(parsedStatus?.success ? { status: parsedStatus.data } : {}) } : {}) }
    const fingerprint = JSON.stringify(input)
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: createIntentKey() }
    busy.current = true; setSaving(true); setError(null); setValidation('')
    try { await save(input, intent.current.key) }
    catch (value) { setError(asError(value)); queueMicrotask(() => summary.current?.focus()) }
    finally { busy.current = false; setSaving(false) }
  }
  async function latestMetadata() {
    if (!reload || busy.current) return
    busy.current = true; setSaving(true)
    try { const value = await reload(); setLatest(value); setTimestamp(value.updatedAt); setError(null) }
    catch (value) { setError(asError(value)) }
    finally { busy.current = false; setSaving(false) }
  }
  const owners = asset?.owner && asset.owner.id !== owner.id ? [owner, asset.owner] : [owner]
  return <form className="asset-form" aria-label={asset ? c.edit : c.create} onSubmit={submit} noValidate>
    <h3>{asset ? c.edit : c.create}</h3>{!asset && <p>{c.createNote}</p>}
    {(error || validation) && <div role="alert" ref={summary} tabIndex={-1} className="project-error"><p>{error?.message ?? validation}</p>{error?.details.map((item, index) => <p key={index}>{item.message}</p>)}{error?.requestId && <p>{c.requestId}: {error.requestId}</p>}{error?.code === 'CONFLICT' ? <><p>{c.conflict}</p><button type="button" disabled={saving} onClick={() => void latestMetadata()}>{c.reload}</button></> : error && <p>{c.failedWrite}</p>}</div>}
    {latest && <aside className="home-panel"><h4>{c.latestMetadata}</h4><p>{latest.title}</p><p>{latest.description}</p><p>{latest.tags.join(' · ')}</p><p>{latest.owner?.displayName ?? c.unassigned}</p></aside>}
    <fieldset disabled={saving}><legend className="sr-only">{asset ? c.edit : c.create}</legend>
      <label>{c.title}<input ref={titleInput} value={title} aria-invalid={Boolean(validation || error?.details.some(item => item.path === 'body.title'))} onChange={event => setTitle(event.target.value)} /></label>
      <label>{c.description}<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label>{c.type}<select value={type} onChange={event => setType(event.target.value)}>{!AssetTypeSchema.safeParse(type).success && <option value={type}>{c.unknown}</option>}{Object.entries(c.types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>{c.tags}<textarea value={tags} onChange={event => setTags(event.target.value)} /></label><p className="note">{c.tagHelp}</p>
      <label>{c.owner}<select value={ownerId} onChange={event => setOwnerId(event.target.value)}><option value="">{asset ? c.preserveOwner : c.unassigned}</option>{owners.map(value => <option key={value.id} value={value.id}>{value.displayName}</option>)}</select></label>
      {asset && <><label>{c.status}<select value={status} onChange={event => setStatus(event.target.value)}><option value="">{c.preserveStatus}</option>{EditableAssetStatusSchema.options.map(value => <option key={value} value={value}>{c.statuses[value]}</option>)}</select></label><p className="note">{c.statusNote}</p></>}
      <div className="project-actions"><button>{saving ? c.saving : c.save}</button><button type="button" onClick={cancel}>{c.cancel}</button></div>
    </fieldset>
  </form>
}
function asError(value: unknown) { return value instanceof ApiClientError ? value : new ApiClientError('Unable to save asset.', { code: 'UNKNOWN' }) }
