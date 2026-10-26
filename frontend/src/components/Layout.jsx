import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import MainContent from './MainContent'
import StatusBar from './StatusBar'
import { loadSettings, saveSettings } from '../features/settings/settingsStorage'
import { loadTheme, saveTheme } from '../features/settings/themeStorage'
import { loadProfile } from '../features/profile/profileStorage'
import { createTerminalFileRequest } from './terminalFileRequest'
import '../App.css'

function Layout() {
  const [settings, setSettings] = useState(loadSettings)
  const [theme, setTheme] = useState(loadTheme)
  const [profile, setProfile] = useState(loadProfile)
  const [activeView, setActiveView] = useState(settings.defaultWorkspaceView)
  const [openedProject, setOpenedProject] = useState(() => window.localStorage.getItem('ai-workstation-open-project') || '')
  const [isSidebarOpen, setIsSidebarOpen] = useState(settings.sidebarOpen)
  const [gitFileChanges, setGitFileChanges] = useState(null)
  const [terminalFileRequest, setTerminalFileRequest] = useState(null)

  function handleSelect(view) {
    setActiveView(view)
    setIsSidebarOpen(false)
  }

  function openTerminalFile(request) {
    const nextRequest = createTerminalFileRequest(request, openedProject)
    const project = nextRequest.project
    setTerminalFileRequest(nextRequest)
    setOpenedProject(project)
    window.localStorage.setItem('ai-workstation-open-project', project)
    setActiveView('Projects')
    setIsSidebarOpen(false)
  }

  function openSettings() {
    setActiveView('Settings')
    setIsSidebarOpen(false)
  }

  function openProfile() {
    setActiveView('Profile')
    setIsSidebarOpen(false)
  }

  function handleSettingsChange(nextSettings) {
    const savedSettings = saveSettings(nextSettings)
    setSettings(savedSettings)
    setIsSidebarOpen(savedSettings.sidebarOpen)
  }

  function handleProfileChange(nextProfile) {
    setProfile(nextProfile)
  }

  function handleThemeChange(nextTheme) {
    setTheme(saveTheme(nextTheme))
  }

  const themeStyle = {
    '--theme-primary': theme.primary,
    '--theme-app-background': theme.appBackground,
    '--theme-sidebar-background': theme.sidebarBackground,
    '--theme-header-background': theme.headerBackground,
    '--theme-main-background': theme.mainBackground,
    '--theme-text': theme.textColor,
    '--theme-border': theme.borderColor,
    '--theme-gradient': theme.gradientEnabled ? `linear-gradient(${theme.gradientDirection === 'left' ? 'to right' : theme.gradientDirection === 'top' ? 'to bottom' : '135deg'}, ${theme.gradientColorOne}, ${theme.gradientColorTwo})` : theme.mainBackground,
  }

  return <div className="app-shell" style={themeStyle}><Header onMenuToggle={() => setIsSidebarOpen((open) => !open)} isSidebarOpen={isSidebarOpen} profileName={profile.displayName} onSettings={openSettings} onProfile={openProfile} /><div className="workspace-frame"><Sidebar activeView={activeView} onSelect={handleSelect} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} /><MainContent activeView={activeView} settings={settings} theme={theme} onSettingsChange={handleSettingsChange} onThemeChange={handleThemeChange} onProfileChange={handleProfileChange} openedProject={openedProject} gitFileChanges={gitFileChanges} terminalFileRequest={terminalFileRequest} onGitFilesChanged={setGitFileChanges} onTerminalFileOpen={openTerminalFile} onProjectOpen={(name) => { setOpenedProject(name); window.localStorage.setItem('ai-workstation-open-project', name) }} onProjectClose={() => { setOpenedProject(''); window.localStorage.removeItem('ai-workstation-open-project') }} /></div><StatusBar /></div>
}

export default Layout
