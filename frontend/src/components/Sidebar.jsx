const navigationItems = [
  ['dashboard', 'Dashboard'],
  ['chat', 'AI Chat'],
  ['projects', 'Projects'],
  ['files', 'Files'],
  ['editor', 'Editor'],
  ['terminal', 'Terminal'],
  ['git', 'Git'],
]

function NavigationIcon({ name }) {
  const commonProps = { className: 'nav-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }

  if (name === 'dashboard') return <svg {...commonProps}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
  if (name === 'chat') return <svg {...commonProps}><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3v-3.2A2.5 2.5 0 0 1 5 12.5z" /><path d="M9 9.5h6M9 12h3" /></svg>
  if (name === 'projects') return <svg {...commonProps}><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4l1.5 2h7.5A1.5 1.5 0 0 1 20 9.5v7A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5z" /></svg>
  if (name === 'files') return <svg {...commonProps}><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M9 12h6M9 15h6" /></svg>
  if (name === 'editor') return <svg {...commonProps}><path d="m8 5-5 7 5 7M16 5l5 7-5 7M14 4l-4 16" /></svg>
  if (name === 'terminal') return <svg {...commonProps}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m7 10 3 2.5L7 15M13 15h4" /></svg>
  return <svg {...commonProps}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M8 6h8M6 8v4a4 4 0 0 0 4 4h2M18 8v4a4 4 0 0 1-4 4h-2" /></svg>
}

function Sidebar({ activeView, onSelect, isOpen, onClose }) {
  return <><div className={'sidebar-backdrop' + (isOpen ? ' sidebar-backdrop--visible' : '')} onClick={onClose} aria-hidden="true" /><aside className={'sidebar' + (isOpen ? ' sidebar--open' : '')}><div className="sidebar-heading"><p className="sidebar-label">Workspace</p><button className="sidebar-close" type="button" onClick={onClose} aria-label="Close navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div><nav className="navigation" aria-label="Primary navigation">{navigationItems.map(([icon, label]) => <button className={'nav-item' + (activeView === label ? ' nav-item--active' : '')} type="button" key={label} onClick={() => onSelect(label)} aria-current={activeView === label ? 'page' : undefined}><NavigationIcon name={icon} /><span>{label}</span></button>)}</nav></aside></>
}

export default Sidebar
