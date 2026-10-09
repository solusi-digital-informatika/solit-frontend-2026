import { projectCopy as c } from './copy'
export function ProjectStatus({ status }: { status: string }) {
  const label = status === 'ACTIVE' ? c.active : status === 'ARCHIVED' ? c.archived : c.unknown
  return <span className="project-status"><span aria-hidden="true">{status === 'ACTIVE' ? '●' : status === 'ARCHIVED' ? '▣' : '?'}</span> {label}</span>
}
