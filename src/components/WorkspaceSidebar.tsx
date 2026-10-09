import { Icon, type IconName } from './Icon'
const destinations: { route: string; title: string; icon: IconName; group: string }[] = [
  { route: '', title: 'Overview', icon: 'overview', group: 'Project' },
  { route: 'brief', title: 'Brief', icon: 'brief', group: 'Project' },
  { route: 'directions', title: 'Directions', icon: 'directions', group: 'Project' },
  { route: 'references', title: 'References', icon: 'references', group: 'Project' },
  { route: 'assets', title: 'Asset library', icon: 'assets', group: 'Production' },
  { route: 'impact', title: 'Impact map', icon: 'impact', group: 'Production' },
  { route: 'collections', title: 'Collections', icon: 'collections', group: 'Production' },
  { route: 'decisions', title: 'Decisions', icon: 'decisions', group: 'History' },
  { route: 'activity', title: 'Activity & export', icon: 'activity', group: 'History' },
]
export function WorkspaceSidebar({ projectId, section }: { projectId: string | null; section?: string }) {
  return <aside className="workspace-sidebar" aria-label="Workspace navigation">
    <a className={`sidebar-home ${!projectId ? 'selected' : ''}`} href="#/projects" aria-current={!projectId ? 'page' : undefined}><Icon name="projects" /><span>Projects</span><span className="sidebar-arrow">↗</span></a>
    {projectId ? <nav className="sidebar-nav" aria-label="Project sections">{destinations.map((item, index) => <div className="sidebar-nav-entry" key={item.route}>
      {(index === 0 || destinations[index - 1].group !== item.group) && <p className="sidebar-group">{item.group}</p>}
      <a href={`#/projects/${projectId}${item.route ? `/${item.route}` : ''}`} aria-label={`Navigate to ${item.title.toLowerCase()}`} aria-current={(section ?? '') === item.route ? 'page' : undefined} data-tone={item.icon}><span className="sidebar-icon"><Icon name={item.icon} /></span><span>{item.title}</span></a>
    </div>)}</nav> : <div className="sidebar-intro"><span className="sidebar-symbol"><Icon name="directions" /></span><h2>A little room<br />for big ideas.</h2><p>Your briefs, directions and creative work, all in one place.</p><div className="sidebar-swatches" aria-hidden="true"><span /><span /><span /><span /></div></div>}
    <div className="sidebar-note"><Icon name="spark" /><p>Change the direction.<br /><strong>Keep the work.</strong></p></div>
  </aside>
}
