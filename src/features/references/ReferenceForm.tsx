import { useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../../lib/api/client'
import { referenceCopy as c } from './copy'
import type { ReferenceView, MetadataInput, ReferenceInput } from './api'
import { safeUrl } from './display'
export function ReferenceForm({ reference, save, cancel, reload }: { reference?: ReferenceView; save: (input: ReferenceInput | MetadataInput) => Promise<void>; cancel: () => void; reload?: () => Promise<ReferenceView> }) {
  const [fields, setFields] = useState({ title: reference?.title ?? '', description: reference?.description ?? '', usageRightsNote: reference?.usageRightsNote ?? '', tags: reference?.tags.join('\n') ?? '', sourceUrl: '' })
  const [timestamp, setTimestamp] = useState(reference?.updatedAt ?? '')
  const [latest, setLatest] = useState<ReferenceView | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null); const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false); const busy = useRef(false); const form = useRef<HTMLFormElement>(null); const summary = useRef<HTMLDivElement>(null)
  useEffect(() => { form.current?.querySelector<HTMLElement>('input')?.focus() }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return
    const issues: Record<string, string> = {}
    if (!fields.title.trim()) issues.title = c.required
    if (!reference && (!/^https?:\/\//i.test(fields.sourceUrl.trim()) || !safeUrl(fields.sourceUrl))) issues.sourceUrl = c.invalidUrl
    if (Object.keys(issues).length) { setErrors(issues); queueMicrotask(() => summary.current?.focus()); return }
    busy.current = true; setSaving(true); setError(null); setErrors({})
    const common = { title: fields.title.trim(), description: fields.description.trim() || null, usageRightsNote: fields.usageRightsNote.trim() || null, tags: fields.tags.split('\n').map(value => value.trim()).filter(Boolean) }
    try { await save(reference ? { ...common, expectedUpdatedAt: timestamp } : { ...common, sourceType: 'PUBLIC_URL', sourceUrl: fields.sourceUrl.trim() }) }
    catch (value) { const failure = value instanceof ApiClientError ? value : new ApiClientError('Unable to save reference.', { code: 'UNKNOWN' }); setError(failure); setErrors(Object.fromEntries(failure.details.map(detail => [detail.path.replace(/^body\./, ''), detail.message]))); queueMicrotask(() => summary.current?.focus()) }
    finally { busy.current = false; setSaving(false) }
  }
  async function reloadLatest() { if (!reload || busy.current) return; busy.current = true; setSaving(true); try { const value = await reload(); setLatest(value); setTimestamp(value.updatedAt); setError(null) } catch (value) { setError(value instanceof ApiClientError ? value : new ApiClientError('Unable to refresh metadata.', { code: 'UNKNOWN' })) } finally { busy.current = false; setSaving(false) } }
  return <form ref={form} className="reference-form" aria-label={reference ? c.edit : c.create} onSubmit={submit} noValidate><h3>{reference ? c.edit : c.create}</h3>{!reference && <p>{c.urlNote}</p>}{(error || Object.keys(errors).length > 0) && <div ref={summary} tabIndex={-1} role="alert" className="project-error"><p>{error?.message ?? c.validation}</p>{Object.values(errors).map((message, index) => <p key={index}>{message}</p>)}{error?.requestId && <p>{c.requestId}: <code>{error.requestId}</code></p>}{error?.code === 'CONFLICT' ? <><p>{c.conflict}</p><button type="button" disabled={saving} onClick={() => void reloadLatest()}>{c.reload}</button></> : error && <p>{c.uncertain}</p>}</div>}
    {latest && <aside className="home-panel"><h4>{c.latest}</h4><p>{latest.title}</p><p>{latest.description}</p><p>{latest.usageRightsNote ?? c.noRights}</p></aside>}
    <fieldset disabled={saving}><legend className="sr-only">{reference ? c.edit : c.create}</legend>{(['title', 'description', 'usageRightsNote', 'tags', ...(!reference ? ['sourceUrl'] : [])] as (keyof typeof fields)[]).map(field => <div className="reference-field" key={field}><label htmlFor={`reference-${field}`}>{field === 'usageRightsNote' ? c.rights : c[field]}{(field === 'title' || field === 'sourceUrl') && <span className="required-star"> *</span>}</label>{['title', 'sourceUrl'].includes(field) ? <input id={`reference-${field}`} value={fields[field]} aria-invalid={Boolean(errors[field])} aria-describedby={`reference-error-${field}`} onChange={event => setFields(previous => ({ ...previous, [field]: event.target.value }))} /> : <textarea id={`reference-${field}`} value={fields[field]} aria-invalid={Boolean(errors[field])} aria-describedby={`reference-error-${field}`} onChange={event => setFields(previous => ({ ...previous, [field]: event.target.value }))} />}<p id={`reference-error-${field}`} className="field-error">{errors[field]}</p>{field === 'tags' && <p className="note">{c.tagsHelp}</p>}</div>)}<div className="project-actions"><button type="submit">{saving ? c.saving : c.save}</button><button type="button" onClick={cancel}>{c.cancel}</button></div></fieldset></form>
}
