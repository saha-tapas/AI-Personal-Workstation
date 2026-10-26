import { useState } from 'react'
import { DEFAULT_SETTINGS, saveSettings } from './settingsStorage'
import { DEFAULT_THEME, saveTheme, THEME_PRESETS } from './themeStorage'

const colorFields = [['primary', 'Primary/accent color'], ['appBackground', 'Application background'], ['sidebarBackground', 'Sidebar background'], ['headerBackground', 'Header background'], ['mainBackground', 'Main content background'], ['textColor', 'Text color'], ['borderColor', 'Border color']]

function Settings({ settings, theme, onSettingsChange, onThemeChange }) {
  const [savedMessage, setSavedMessage] = useState('')

  function handleDefaultViewChange(event) {
    const nextSettings = saveSettings({ ...settings, defaultWorkspaceView: event.target.value })
    onSettingsChange(nextSettings)
    setSavedMessage('Settings saved.')
  }

  function handleSidebarChange(event) {
    const nextSettings = saveSettings({ ...settings, sidebarOpen: event.target.checked })
    onSettingsChange(nextSettings)
    setSavedMessage('Settings saved.')
  }

  function handleReset() {
    const nextSettings = saveSettings(DEFAULT_SETTINGS)
    onSettingsChange(nextSettings)
    setSavedMessage('Settings reset to defaults.')
  }

  function updateTheme(changes) {
    onThemeChange(saveTheme({ ...theme, ...changes }))
    setSavedMessage('Theme saved.')
  }

  function handlePresetChange(event) {
    updateTheme(THEME_PRESETS[event.target.value])
  }

  function handleThemeReset() {
    updateTheme(DEFAULT_THEME)
    setSavedMessage('Theme reset to default.')
  }

  return <section className="settings-panel" aria-labelledby="settings-title">
    <div className="settings-heading">
      <div>
        <p className="eyebrow">Preferences</p>
        <h1 id="settings-title">Settings</h1>
        <p className="settings-description">Control local workstation preferences for this browser.</p>
      </div>
    </div>
    <div className="settings-card">
      <div className="settings-field">
        <label htmlFor="default-workspace-view">Default workspace view</label>
        <select id="default-workspace-view" value={settings.defaultWorkspaceView} onChange={handleDefaultViewChange}>
          <option value="Dashboard">Dashboard</option>
          <option value="AI Chat">AI Chat</option>
          <option value="Projects">Projects</option>
          <option value="Files">Files</option>
          <option value="Editor">Editor</option>
          <option value="Terminal">Terminal</option>
          <option value="Git">Git</option>
        </select>
        <span>Used the next time the workstation is opened.</span>
      </div>
      <label className="settings-checkbox">
        <input type="checkbox" checked={settings.sidebarOpen} onChange={handleSidebarChange} />
        <span>Open the sidebar when the workstation starts</span>
      </label>
    </div>
    <div className="settings-card">
      <div className="settings-field">
        <label htmlFor="theme-preset">Theme preset</label>
        <select id="theme-preset" value={theme.preset} onChange={handlePresetChange}>
          {Object.keys(THEME_PRESETS).map((preset) => <option key={preset} value={preset}>{preset}</option>)}
        </select>
        <span>Choose a starting palette, then customize individual colors below.</span>
      </div>
      <div className="theme-color-grid">
        {colorFields.map(([field, label]) => <label className="theme-color-field" key={field} htmlFor={`theme-${field}`}><span>{label}</span><span className="theme-color-control"><input id={`theme-${field}`} type="color" value={theme[field]} onChange={(event) => updateTheme({ [field]: event.target.value })} /><code>{theme[field]}</code></span></label>)}
      </div>
      <label className="settings-checkbox"><input type="checkbox" checked={theme.gradientEnabled} onChange={(event) => updateTheme({ gradientEnabled: event.target.checked })} /><span>Enable main content gradient</span></label>
      {theme.gradientEnabled && <div className="theme-gradient-options">
        <label className="theme-color-field" htmlFor="theme-gradient-color-one"><span>Gradient color one</span><span className="theme-color-control"><input id="theme-gradient-color-one" type="color" value={theme.gradientColorOne} onChange={(event) => updateTheme({ gradientColorOne: event.target.value })} /><code>{theme.gradientColorOne}</code></span></label>
        <label className="theme-color-field" htmlFor="theme-gradient-color-two"><span>Gradient color two</span><span className="theme-color-control"><input id="theme-gradient-color-two" type="color" value={theme.gradientColorTwo} onChange={(event) => updateTheme({ gradientColorTwo: event.target.value })} /><code>{theme.gradientColorTwo}</code></span></label>
        <div className="settings-field"><label htmlFor="theme-gradient-direction">Gradient direction</label><select id="theme-gradient-direction" value={theme.gradientDirection} onChange={(event) => updateTheme({ gradientDirection: event.target.value })}><option value="left">Left to right</option><option value="top">Top to bottom</option><option value="diagonal">Diagonal</option></select></div>
        <div className="theme-preview" style={{ background: `linear-gradient(${theme.gradientDirection === 'left' ? 'to right' : theme.gradientDirection === 'top' ? 'to bottom' : '135deg'}, ${theme.gradientColorOne}, ${theme.gradientColorTwo})`, color: theme.textColor, borderColor: theme.borderColor }}><strong>Theme preview</strong><span>Readable content on your selected gradient.</span></div>
      </div>}
      <button type="button" className="theme-reset-button" onClick={handleThemeReset}>Reset theme to default</button>
    </div>
    <div className="settings-actions">
      <button type="button" onClick={handleReset}>Reset to defaults</button>
      {savedMessage && <p className="settings-feedback" role="status">{savedMessage}</p>}
    </div>
  </section>
}

export default Settings
