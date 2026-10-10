import { useRef, useState } from 'react'
import { BriefRevisionInputSchema, type BriefRevisionInput } from '../../../packages/contracts/src'
import { ApiClientError } from '../../lib/api/client'
import type { BriefView } from './api'
import { briefCopy as c } from './copy'

const textFields = ['title', 'objective', 'targetAudience', 'deliverables', 'constraints', 'acceptanceCriteria', 'sourceText', 'changeSummary'] as const
type TextField = typeof textFields[number]
const arrays = ['deliverables', 'constraints', 'acceptanceCriteria'] as const
type Requirement = BriefView['requirements'][number]
type Group = 'requirements' | 'forbiddenAttributes'
const initialText = (latest: BriefView | null): Record<TextField, string> => ({
  title: latest?.title ?? '', objective: latest?.objective ?? '', targetAudience: latest?.targetAudience ?? '',
  deliverables: latest?.deliverables.join('\n') ?? '', constraints: latest?.constraints.join('\n') ?? '', acceptanceCriteria: latest?.acceptanceCriteria.join('\n') ?? '',
  sourceText: latest?.sourceText ?? '', changeSummary: '',
})
export function BriefForm({ latest, save, cancel }: { latest: BriefView | null; save: (input: BriefRevisionInput) => Promise<void>; cancel: () => void }) {
  const [text, setText] = useState(() => initialText(latest))
  const [groups, setGroups] = useState<Record<Group, Requirement[]>>(() => ({ requirements: structuredClone(latest?.requirements ?? []), forbiddenAttributes: structuredClone(latest?.forbiddenAttributes ?? []) }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<ApiClientError | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const summary = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)
  function setAttribute(group: Group, id: string, updates: Partial<Requirement>) { setGroups(previous => ({ ...previous, [group]: previous[group].map(value => value.id === id ? { ...value, ...updates } : value) })) }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const issues: Record<string, string> = {}
    if (!text.title.trim()) issues.title = c.required
    if (!text.objective.trim()) issues.objective = c.required
    if (latest && !text.changeSummary.trim()) issues.changeSummary = c.summaryRequired
    for (const group of ['requirements', 'forbiddenAttributes'] as const) groups[group].forEach((attribute, index) => {
      if (!attribute.label.trim()) issues[`${group}.${index}.label`] = c.required
      if (!attribute.value.trim()) issues[`${group}.${index}.value`] = c.required
    })
    const input = BriefRevisionInputSchema.safeParse({ ...text, ...groups, title: text.title.trim(), objective: text.objective.trim(), targetAudience: text.targetAudience.trim() || null, sourceText: text.sourceText.trim() || null, changeSummary: text.changeSummary.trim() || null, ...Object.fromEntries(arrays.map(field => [field, text[field].split('\n').map(value => value.trim()).filter(Boolean)])) })
    if (!input.success) for (const issue of input.error.issues) issues[issue.path.join('.')] = issue.message
    if (Object.keys(issues).length || !input.success) { setErrors(issues); queueMicrotask(() => summary.current?.focus()); return }
    busy.current = true; setSaving(true); setErrors({}); setError(null)
    try { await save(input.data) }
    catch (value) {
      const failure = value instanceof ApiClientError ? value : new ApiClientError('Unable to save the brief.', { code: 'UNKNOWN' })
      setError(failure)
      setErrors(Object.fromEntries(failure.details.map(detail => [detail.path.replace(/^body\./, ''), detail.message])))
      queueMicrotask(() => summary.current?.focus())
    } finally { busy.current = false; setSaving(false) }
  }
  return <form ref={form} className="brief-form" aria-label={latest ? c.revise : c.first} onSubmit={submit} noValidate>
    <h3>{latest ? c.revise : c.first}</h3><p>{c.immutable}</p>
    {(Object.keys(errors).length > 0 || error) && <div ref={summary} tabIndex={-1} className="project-error" role="alert"><p>{error?.message ?? c.validation}</p>{Object.entries(errors).map(([path, message]) => <p key={path}><a href={`#brief-${path}`} onClick={event => { event.preventDefault(); Array.from(form.current?.querySelectorAll<HTMLElement>('[data-field]') ?? []).find(element => element.getAttribute('data-field') === path)?.focus() }}>{message}</a></p>)}{error?.requestId && <p>{c.requestId}: <code>{error.requestId}</code></p>}{error && ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE'].includes(error.code) && <p>{c.uncertainSave}</p>}</div>}
    <fieldset disabled={saving}><legend className="sr-only">{c.heading}</legend>
      {textFields.map(field => <div className="brief-field" key={field}><label htmlFor={`brief-${field}`}>{c[field]}{(field === 'title' || field === 'objective' || (field === 'changeSummary' && latest)) && <span className="required-star"> *</span>}</label>{field === 'title' ? <input autoFocus id={`brief-${field}`} data-field={field} value={text[field]} aria-required aria-invalid={Boolean(errors[field])} aria-describedby={`error-${field}`} onChange={event => setText(previous => ({ ...previous, [field]: event.target.value }))} /> : <textarea id={`brief-${field}`} data-field={field} value={text[field]} aria-required={field === 'objective' || (field === 'changeSummary' && Boolean(latest))} aria-invalid={Boolean(errors[field])} aria-describedby={`error-${field}`} onChange={event => setText(previous => ({ ...previous, [field]: event.target.value }))} />}{arrays.some(value => value === field) && <p className="note">{c.lines}</p>}<p id={`error-${field}`} className="field-error">{errors[field]}</p></div>)}
      {(['requirements', 'forbiddenAttributes'] as const).map(group => <fieldset className="attribute-group" key={group}><legend>{c[group]}</legend>{groups[group].map((attribute, index) => <div className="attribute-row" key={attribute.id}>
        {(['label', 'value'] as const).map(field => { const path = `${group}.${index}.${field}`; return <div key={field}><label htmlFor={`brief-${attribute.id}-${field}`}>{c[field]} <span className="required-star">*</span></label><input id={`brief-${attribute.id}-${field}`} data-field={path} value={attribute[field]} aria-invalid={Boolean(errors[path])} aria-describedby={`error-${attribute.id}-${field}`} onChange={event => setAttribute(group, attribute.id, { [field]: event.target.value })} /><p id={`error-${attribute.id}-${field}`} className="field-error">{errors[path]}</p></div> })}
        <label htmlFor={`category-${attribute.id}`}>{c.category}</label><select id={`category-${attribute.id}`} data-field={`${group}.${index}.category`} value={attribute.category} onChange={event => setAttribute(group, attribute.id, { category: event.target.value })}>{!Object.hasOwn(c.categories, attribute.category) && <option value={attribute.category}>{c.unknownCategory}</option>}{Object.entries(c.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label className="attribute-checkbox"><input type="checkbox" checked={attribute.hard} onChange={event => setAttribute(group, attribute.id, { hard: event.target.checked })} />{c.hard}</label><button type="button" aria-label={`${c.remove} ${index + 1} ${c[group]}`} onClick={() => setGroups(previous => ({ ...previous, [group]: previous[group].filter(value => value.id !== attribute.id) }))}>{c.remove}</button>
      </div>)}<button type="button" onClick={() => setGroups(previous => ({ ...previous, [group]: [...previous[group], { id: crypto.randomUUID(), category: 'OTHER', label: '', value: '', hard: false }] }))}>{c.add} · {c[group]}</button></fieldset>)}
      <div className="project-actions"><button type="submit">{saving ? c.saving : c.save}</button><button type="button" onClick={cancel}>{c.cancel}</button></div>
    </fieldset>
  </form>
}
