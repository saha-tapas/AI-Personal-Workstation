export const PROFILE_STORAGE_KEY = 'ai-workstation-profile'

export const DEFAULT_PROFILE = {
  displayName: 'User',
}

export function normalizeProfile(value) {
  const displayName = typeof value?.displayName === 'string' ? value.displayName.trim() : ''

  return {
    displayName: displayName || DEFAULT_PROFILE.displayName,
  }
}

export function loadProfile() {
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    return stored ? normalizeProfile(JSON.parse(stored)) : { ...DEFAULT_PROFILE }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(profile) {
  const normalized = normalizeProfile(profile)

  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized))
    return { profile: normalized, saved: true }
  } catch {
    return { profile: normalized, saved: false }
  }
}

export function getProfileInitials(displayName) {
  const words = normalizeProfile({ displayName }).displayName.split(/\s+/)
  return words.length > 1 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase()
}
