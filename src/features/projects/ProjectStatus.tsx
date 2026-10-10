import { projectCopy as c } from './copy'
export function ProjectStatus({ status }: { status: string }) {
  const label = status === 'ACTIVE' ? c.active : status === 'ARCHIVED' ? c.archived : c.unknown
  return <span className={`project-status status-badge status-${status.toLowerCase()}`}><span className="status-dot" aria-hidden="true" /> {label}</span>
}
