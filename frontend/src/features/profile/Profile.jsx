import { useState } from 'react'
import { DEFAULT_PROFILE, getProfileInitials, loadProfile, normalizeProfile, saveProfile } from './profileStorage'

function Profile({ onProfileChange }) {
  const [profile, setProfile] = useState(loadProfile)
  const [draftName, setDraftName] = useState(profile.displayName)
  const [feedback, setFeedback] = useState(null)

  function handleSave(event) {
    event.preventDefault()
    const normalizedProfile = normalizeProfile({ displayName: draftName })
    if (normalizedProfile.displayName === profile.displayName) {
      setDraftName(normalizedProfile.displayName)
      setFeedback({ type: 'info', message: 'No profile changes to save.' })
      return
    }
    const result = saveProfile({ displayName: draftName })
    setProfile(result.profile)
    setDraftName(result.profile.displayName)
    if (result.saved) onProfileChange(result.profile)
    setFeedback(result.saved ? { type: 'success', message: 'Profile saved.' } : { type: 'error', message: 'Profile could not be saved in this browser.' })
  }

  function handleDraftNameChange(event) {
    setDraftName(event.target.value)
    setFeedback(null)
  }

  function handleReset() {
    const result = saveProfile(DEFAULT_PROFILE)
    setProfile(result.profile)
    setDraftName(result.profile.displayName)
    if (result.saved) onProfileChange(result.profile)
    setFeedback(result.saved ? { type: 'success', message: 'Profile reset to default.' } : { type: 'error', message: 'Profile could not be reset in this browser.' })
  }

  return <section className="profile-panel" aria-labelledby="profile-title">
    <div className="profile-heading">
      <div>
        <p className="eyebrow">Local profile</p>
        <h1 id="profile-title">Profile</h1>
        <p className="profile-description">Personalize the name shown in this browser.</p>
      </div>
      <div className="profile-avatar" aria-label={`Avatar initials ${getProfileInitials(profile.displayName)}`}>{getProfileInitials(profile.displayName)}</div>
    </div>
    <form className="profile-card" onSubmit={handleSave}>
      <div className="profile-field">
        <label htmlFor="profile-display-name">Display name</label>
        <input id="profile-display-name" type="text" value={draftName} onChange={handleDraftNameChange} maxLength="80" autoComplete="name" />
        <span>Blank names are saved as “User”.</span>
      </div>
      <div className="profile-actions">
        <button type="submit">Save profile</button>
        <button type="button" className="profile-reset-button" onClick={handleReset}>Reset to default</button>
      </div>
      {feedback && <p className={`profile-feedback profile-feedback--${feedback.type}`} role="status">{feedback.message}</p>}
    </form>
  </section>
}

export default Profile
