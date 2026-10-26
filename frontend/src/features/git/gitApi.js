export async function fetchGitStatus(project) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/status`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to read Git status.')
  return data
}

export async function fetchGitDiff(project, filePath) {
  const query = filePath ? `?path=${encodeURIComponent(filePath)}` : ''
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/diff${query}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to read Git changes.')
  return data
}

export async function fetchGitHistory(project, limit) {
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : ''
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/history${query}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read Git history (${response.status}).`)
  return data
}

export async function fetchGitStashes(project, limit) {
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : ''
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/stashes${query}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read Git stashes (${response.status}).`)
  return data
}

export async function fetchGitStashDetails(project, index) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/stash/${encodeURIComponent(index)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read Git stash (${response.status}).`)
  return data
}

async function mutateStash(project, path, method, body) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to update Git stash (${response.status}).`)
  return data
}

export const createGitStash = (project, message) => mutateStash(project, 'stash', 'POST', message ? { message } : undefined)
export const applyGitStash = (project, index) => mutateStash(project, `stash/${encodeURIComponent(index)}/apply`, 'POST')
export const dropGitStash = (project, index) => mutateStash(project, `stash/${encodeURIComponent(index)}`, 'DELETE')

export async function fetchGitBranches(project) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/branches`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read Git branches (${response.status}).`)
  return data
}

async function postBranchAction(project, action, name) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/branches${action ? `/${action}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to update Git branch (${response.status}).`)
  return data
}

export const createGitBranch = (project, name) => postBranchAction(project, '', name)
export const switchGitBranch = (project, name) => postBranchAction(project, 'switch', name)

export async function fetchGitCommitDetails(project, hash) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/commit/${encodeURIComponent(hash)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read commit details (${response.status}).`)
  return data
}

export async function fetchGitCommitDiff(project, hash, filePath) {
  const query = filePath ? `?path=${encodeURIComponent(filePath)}` : ''
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/commit/${encodeURIComponent(hash)}/diff${query}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read commit diff (${response.status}).`)
  return data
}

export async function fetchGitFileHistory(project, filePath) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/file-history?path=${encodeURIComponent(filePath)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read file history (${response.status}).`)
  return data
}

export async function fetchGitFileHistoryDiff(project, filePath, hash) {
  const query = `?path=${encodeURIComponent(filePath)}&commit=${encodeURIComponent(hash)}`
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/file-history/diff${query}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Unable to read file history diff (${response.status}).`)
  return data
}

async function postGitAction(project, action, path) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/${action}`, {
    method: 'POST',
    headers: path ? { 'Content-Type': 'application/json' } : undefined,
    body: path ? JSON.stringify({ path }) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Git staging request failed (${response.status}).`)
  }
  return data
}

export const stageGitFile = (project, filePath) => postGitAction(project, 'stage', filePath)
export const unstageGitFile = (project, filePath) => postGitAction(project, 'unstage', filePath)
export const stageAllGitFiles = (project) => postGitAction(project, 'stage-all')
export const unstageAllGitFiles = (project) => postGitAction(project, 'unstage-all')

export async function commitGitChanges(project, message) {
  const response = await fetch(`/api/git/${encodeURIComponent(project)}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || `Git commit request failed (${response.status}).`)
  return data
}
