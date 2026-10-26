export const THEME_STORAGE_KEY = 'ai-workstation-theme'

export const DEFAULT_THEME = {
  preset: 'Default',
  primary: '#8ed1c2',
  appBackground: '#f4f6f9',
  sidebarBackground: '#202b40',
  headerBackground: '#172033',
  mainBackground: '#f4f6f9',
  textColor: '#172033',
  borderColor: '#dce3ec',
  gradientEnabled: false,
  gradientColorOne: '#fbfcfe',
  gradientColorTwo: '#f4f6f9',
  gradientDirection: 'diagonal',
}

export const THEME_PRESETS = {
  Default: { ...DEFAULT_THEME },
  Dark: { ...DEFAULT_THEME, primary: '#8ed1c2', appBackground: '#111827', sidebarBackground: '#0b1220', headerBackground: '#0b1220', mainBackground: '#111827', textColor: '#e5edf7', borderColor: '#30415e', gradientColorOne: '#1f2937', gradientColorTwo: '#111827' },
  Blue: { ...DEFAULT_THEME, primary: '#8db8f0', sidebarBackground: '#1d2d49', headerBackground: '#15243d', gradientColorOne: '#f8fbff', gradientColorTwo: '#e8f1fc' },
  Green: { ...DEFAULT_THEME, primary: '#8ed1a3', sidebarBackground: '#20382f', headerBackground: '#172b24', gradientColorOne: '#f8fdf9', gradientColorTwo: '#e8f5ec' },
}

const VALID_PRESETS = Object.keys(THEME_PRESETS)
const VALID_DIRECTIONS = ['left', 'top', 'diagonal']
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function validColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

export function normalizeTheme(value) {
  const preset = VALID_PRESETS.includes(value?.preset) ? value.preset : DEFAULT_THEME.preset
  const base = THEME_PRESETS[preset]
  return {
    preset,
    primary: validColor(value?.primary, base.primary),
    appBackground: validColor(value?.appBackground, base.appBackground),
    sidebarBackground: validColor(value?.sidebarBackground, base.sidebarBackground),
    headerBackground: validColor(value?.headerBackground, base.headerBackground),
    mainBackground: validColor(value?.mainBackground, base.mainBackground),
    textColor: validColor(value?.textColor, base.textColor),
    borderColor: validColor(value?.borderColor, base.borderColor),
    gradientEnabled: typeof value?.gradientEnabled === 'boolean' ? value.gradientEnabled : base.gradientEnabled,
    gradientColorOne: validColor(value?.gradientColorOne, base.gradientColorOne),
    gradientColorTwo: validColor(value?.gradientColorTwo, base.gradientColorTwo),
    gradientDirection: VALID_DIRECTIONS.includes(value?.gradientDirection) ? value.gradientDirection : base.gradientDirection,
  }
}

export function loadTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored ? normalizeTheme(JSON.parse(stored)) : { ...DEFAULT_THEME }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

export function saveTheme(theme) {
  const normalized = normalizeTheme(theme)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Theme remains usable for the current session when storage is unavailable.
  }
  return normalized
}
