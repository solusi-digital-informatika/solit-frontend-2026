import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, type ApiClient } from '../../lib/api/client'
import { projectApi, type ProjectSummaryView } from './api'
import { ProjectStatus } from './ProjectStatus'
import { homeCopy as c } from './homeCopy'

type State = { kind: 'loading' } | { kind: 'error'; error: ApiClientError } | { kind: 'ready'; summary: ProjectSummaryView }
function knownLabel(labels: Record<string, string>, value: string, fallback: string) { return Object.hasOwn(labels, value) ? labels[value] : fallback }

export function ProjectHome({ client, projectId, isMockApi }: { client: ApiClient; projectId: string; isMockApi: boolean }) {
  const api = useMemo(() => projectApi(client), [client])
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [offline, setOffline] = useState(!navigator.onLine)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    api.summary(projectId, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setState({ kind: 'ready', summary: data })
    }).catch((value: unknown) => {
      if (!controller.signal.aborted) setState({ kind: 'error', error: value instanceof ApiClientError ? value : new ApiClientError('Unable to load project overview.', { code: 'UNKNOWN' }) })
    })
    return () => controller.abort()
  }, [api, projectId, attempt])
  useEffect(() => { if (state.kind === 'ready') heading.current?.focus() }, [state.kind])
  if (state.kind === 'loading') return <><p role="status">{c.loading}</p>{offline && !isMockApi && <p role="status">{c.offline}</p>}</>
  if (state.kind === 'error') return <>{offline && !isMockApi && <p role="status">{c.offline}</p>}<div className="project-error" role="alert"><p>{state.error.message}</p>{state.error.requestId && <p>{c.requestId}: <code>{state.error.requestId}</code></p>}<button type="button" onClick={() => { setState({ kind: 'loading' }); setAttempt(value => value + 1) }}>{c.retry}</button></div></>
  const { project, activeDirection, assetCounts, latestAssessment, recentDecisions } = state.summary
  return <>
    <article className="project-home" aria-label={c.overview}>
      <header className="home-header"><p className="eyebrow">{c.opened}</p><h2 ref={heading} tabIndex={-1}>{project.name}</h2><ProjectStatus status={project.status} /><p>{project.description ?? c.noDescription}</p><a className="home-primary" href={activeDirection ? '#active-direction' : '#project-setup'} onClick={event => { event.preventDefault(); document.getElementById(activeDirection ? 'active-direction' : 'project-setup')?.focus(); document.getElementById(activeDirection ? 'active-direction' : 'project-setup')?.scrollIntoView?.({ behavior: 'instant', block: 'start' }) }}>{activeDirection ? c.primary : c.primaryEmpty}</a></header>
      <dl className="home-metrics"><div><dt>{c.assets}</dt><dd>{assetCounts.total}</dd></div><div><dt>{c.unresolved}</dt><dd>{state.summary.unresolvedRecommendationCount}</dd></div><div><dt>{c.stale}</dt><dd>{state.summary.staleCollectionItemCount}</dd></div></dl>
      <section className="home-panel direction-panel" id="active-direction" tabIndex={-1} aria-labelledby="direction-heading"><h3 id="direction-heading">{c.activeDirection}</h3>{activeDirection ? <>
        <h4>{activeDirection.direction.name} <span className="note">· {c.revision} {activeDirection.revision.revisionNumber}</span></h4><p>{activeDirection.revision.summary}</p>
        <dl className="direction-attributes"><dt>{c.palette}</dt><dd>{activeDirection.revision.palette.map(color => color.name).join(', ') || c.noAttributes}</dd><dt>{c.lighting}</dt><dd>{[activeDirection.revision.lighting.quality, activeDirection.revision.lighting.direction, activeDirection.revision.lighting.temperature].filter(Boolean).join(' · ') || c.noAttributes}</dd><dt>{c.materials}</dt><dd>{activeDirection.revision.materials.join(', ') || c.noAttributes}</dd><dt>{c.mood}</dt><dd>{activeDirection.revision.mood.join(', ') || c.noAttributes}</dd></dl>
      </> : <><p>{c.noDirection}</p><p className="note">{c.noDirectionHelp}</p></>}</section>
      <div className="home-columns"><section className="home-panel" aria-labelledby="assets-heading"><h3 id="assets-heading">{c.assetStatuses}</h3>{assetCounts.total === 0 && <p>{c.noAssets}</p>}<dl className="asset-breakdown">{Object.entries(c.assetLabels).map(([status, label]) => <div key={status}><dt><span aria-hidden="true">●</span> {label}</dt><dd>{assetCounts.byStatus[status as keyof typeof c.assetLabels]}</dd></div>)}</dl></section>
      <section className="home-panel" aria-labelledby="assessment-heading"><h3 id="assessment-heading">{c.latestAssessment}</h3>{latestAssessment ? <><p className="assessment-status"><span aria-hidden="true">◷</span> {knownLabel(c.assessmentLabels, latestAssessment.status, c.unknownAssessment)}</p>{latestAssessment.isSimulated && <p className="simulated">{c.simulated}</p>}<time dateTime={latestAssessment.startedAt}>{new Date(latestAssessment.startedAt).toLocaleString()}</time></> : <p className="note">{c.noAssessment}</p>}</section></div>
      <section className="home-panel" aria-labelledby="decisions-heading"><h3 id="decisions-heading">{c.decisions}</h3>{recentDecisions.length === 0 ? <p className="note">{c.noDecisions}</p> : <ol className="home-decisions">{recentDecisions.map(decision => <li key={decision.id}><p><span aria-hidden="true">✓</span> <strong>{knownLabel(c.decisionLabels, decision.decisionType, c.unknownDecision)}</strong></p><p>{decision.rationale}</p><p className="note">{decision.createdBy.displayName} · <time dateTime={decision.createdAt}>{new Date(decision.createdAt).toLocaleString()}</time></p></li>)}</ol>}</section>
      <section className="home-panel" id="project-setup" tabIndex={-1} aria-label={c.primaryEmpty}><dl className="direction-attributes"><dt>{c.owner}</dt><dd>{project.owner.displayName}</dd><dt>{c.role}</dt><dd>{knownLabel({ OWNER: 'Owner', EDITOR: 'Editor', REVIEWER: 'Reviewer', VIEWER: 'Viewer' }, project.currentUserRole, c.unknownRole)}</dd><dt>{c.updated}</dt><dd><time dateTime={project.updatedAt}>{new Date(project.updatedAt).toLocaleString()}</time></dd></dl><p className="note">{c.next}</p></section>
    </article>
  </>
}
