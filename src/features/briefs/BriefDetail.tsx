import type { BriefView } from './api'
import { briefCopy as c } from './copy'

export function BriefDetail({ revision, latestId }: { revision: BriefView; latestId: string | null }) {
  const labels = ['objective', 'targetAudience', 'changeSummary'] as const
  const lists = ['deliverables', 'constraints', 'acceptanceCriteria'] as const
  return <article className="brief-detail" aria-label={`${c.revision} ${revision.revisionNumber}`}>
    <p className="brief-version">{c.revision} {revision.revisionNumber} · {revision.id === latestId ? c.latest : c.historical}</p>
    <h3>{revision.title}</h3><p className="note">{revision.createdBy.displayName} · <time dateTime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString()}</time></p>
    {labels.map(field => <section key={field}><h4>{c[field]}</h4><p className="preserve-text">{revision[field] ?? c.none}</p></section>)}
    {lists.map(field => <section key={field}><h4>{c[field]}</h4>{revision[field].length ? <ul>{revision[field].map((value, index) => <li key={index}>{value}</li>)}</ul> : <p>{c.none}</p>}</section>)}
    {(['requirements', 'forbiddenAttributes'] as const).map(field => <section key={field}><h4>{c[field]}</h4>{revision[field].length ? <ul>{revision[field].map(value => <li key={value.id}><strong>{value.label}</strong> · {Object.hasOwn(c.categories, value.category) ? c.categories[value.category as keyof typeof c.categories] : c.unknownCategory}: {value.value} · {value.hard ? c.hard : c.soft}</li>)}</ul> : <p>{c.none}</p>}</section>)}
    <section><h4>{c.sourceText}</h4><pre className="brief-source">{revision.sourceText ?? c.none}</pre></section>
  </article>
}
