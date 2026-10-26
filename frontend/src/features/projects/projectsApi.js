async function request(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Unable to complete the project request.')
  }

  return data
}

export async function fetchProjects() {
  const data = await request('/api/projects')
  return data.projects
}

export async function createProject(name) {
  const data = await request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return data.project
}

export async function deleteProject(name) {
  await request('/api/projects/' + encodeURIComponent(name), { method: 'DELETE' })
}
