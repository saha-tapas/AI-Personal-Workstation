import { useRef } from 'react'
import Chat from '../features/chat/Chat'
import Projects from '../features/projects/Projects'
import Terminal from '../features/terminal/Terminal'
import Git from '../features/git/Git'
import Settings from '../features/settings/Settings'
import Profile from '../features/profile/Profile'

function MainContent({ activeView, settings, theme, onSettingsChange, onThemeChange, onProfileChange, openedProject, gitFileChanges, terminalFileRequest, onGitFilesChanged, onTerminalFileOpen, onProjectOpen, onProjectClose }) {
  const mainContentRef = useRef(null)
  const isChat = activeView === 'AI Chat'
  const isProjects = activeView === 'Projects'
  const isFiles = activeView === 'Files'
  const isEditor = activeView === 'Editor'
  const isTerminal = activeView === 'Terminal'
  const isGit = activeView === 'Git'
  const isSettings = activeView === 'Settings'
  const isProfile = activeView === 'Profile'
  const className = 'main-content' + (isChat ? ' main-content--chat' : '') + (isProjects ? ' main-content--projects' : '') + (isEditor ? ' main-content--editor' : '') + (isTerminal ? ' main-content--terminal' : '') + (isGit ? ' main-content--git' : '') + (isSettings ? ' main-content--settings' : '') + (isProfile ? ' main-content--profile' : '')

  return <main ref={mainContentRef} className={className}>{isChat ? <Chat /> : isProjects || isFiles || isEditor ? <Projects activeProject={openedProject} workspaceView={activeView} gitFileChanges={gitFileChanges} terminalFileRequest={terminalFileRequest} onProjectOpen={onProjectOpen} onProjectClose={onProjectClose} /> : isTerminal ? <Terminal project={openedProject} onOpenFile={onTerminalFileOpen} /> : isGit ? <Git project={openedProject} scrollContainerRef={mainContentRef} onGitFilesChanged={onGitFilesChanged} /> : isSettings ? <Settings settings={settings} theme={theme} onSettingsChange={onSettingsChange} onThemeChange={onThemeChange} /> : isProfile ? <Profile onProfileChange={onProfileChange} /> : <section className="dashboard" aria-labelledby="dashboard-title"><p className="eyebrow">{activeView}</p><h1 id="dashboard-title">Welcome to AI Personal Workstation</h1><p className="dashboard-description">This will be your central workspace for AI chat, projects, files, code, terminal, and Git — all in one focused place.</p></section>}</main>
}

export default MainContent
