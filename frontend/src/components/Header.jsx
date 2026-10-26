function Header({ onMenuToggle, isSidebarOpen, profileName, onSettings, onProfile }) {
  const displayedProfileName = typeof profileName === 'string' && profileName.trim() ? profileName.trim() : 'Profile'

  return <header className="app-header"><button className="menu-button" type="button" onClick={onMenuToggle} aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isSidebarOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button><p className="brand"><span className="brand-mark" aria-hidden="true">AI</span><span className="brand-name">AI Personal Workstation</span></p><div className="header-actions"><button className="header-button" type="button" onClick={onSettings} aria-label="Open Settings">⚙ Settings</button><button className="header-button header-profile-button" type="button" onClick={onProfile} aria-label={`Open Profile for ${displayedProfileName}`}><svg className="header-profile-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><span className="header-profile-name">{displayedProfileName}</span></button></div></header>
}

export default Header
