export type IconName = 'projects' | 'overview' | 'brief' | 'directions' | 'references' | 'assets' | 'impact' | 'collections' | 'decisions' | 'activity' | 'arrow' | 'spark'
const paths: Record<IconName, string> = {
  projects: 'M3 7h7l2 2h9v10H3z M3 7V5h7l2 2',
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  brief: 'M6 3h9l3 3v15H6z M14 3v5h4 M9 12h6 M9 16h6',
  directions: 'M5 4v16 M5 8h8l4-4 M5 15h8l4 4 M14 4h3v3 M14 19h3v-3',
  references: 'M4 5h12v12H4z M8 9l2 3 2-2 4 5 M8 17v4h12V9h-4',
  assets: 'M3 4h18v16H3z M3 16l6-6 5 5 3-3 4 4 M16 8h.01',
  impact: 'M13 2L4 14h7l-1 8 10-12h-7z',
  collections: 'M3 5h18v15H3z M3 10h18 M8 5v15 M12 14h5 M12 17h3',
  decisions: 'M9 12l2 2 4-4 M5 4h14v16H5z',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
}
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
