export const SETTINGS_STORAGE_KEY = 'ai-workstation-settings'

export const DEFAULT_SETTINGS = {
  defaultWorkspaceView: 'Dashboard',
  sidebarOpen: false,
}

const VALID_WORKSPACE_VIEWS = ['Dashboard', 'AI Chat', 'Projects', 'Files', 'Editor', 'Terminal', 'Git']

function isValidWorkspaceView(value) {
  return VALID_WORKSPACE_VIEWS.includes(value)
}

export function normalizeSettings(value) {
  return {
    defaultWorkspaceView: isValidWorkspaceView(value?.defaultWorkspaceView) ? value.defaultWorkspaceView : DEFAULT_SETTINGS.defaultWorkspaceView,
    sidebarOpen: typeof value?.sidebarOpen === 'boolean' ? value.sidebarOpen : DEFAULT_SETTINGS.sidebarOpen,
  }
}

export function loadSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    return stored ? normalizeSettings(JSON.parse(stored)) : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  const normalized = normalizeSettings(settings)

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Settings remain usable for the current session when storage is unavailable.
  }

  return normalized
}
