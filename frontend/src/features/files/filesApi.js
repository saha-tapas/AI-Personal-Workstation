export async function fetchFiles(project, currentPath = '') {
  const query = currentPath ? '?path=' + encodeURIComponent(currentPath) : ''
  const response = await fetch('/api/files/' + encodeURIComponent(project) + query)
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Unable to load project files.')
  }

  return data
}

export async function searchProject(project, query) {
  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/search?q=' + encodeURIComponent(query))
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to search the project.')
  return data.results || []
}

async function createItem(project, type, currentPath, name) {
  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/' + type, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name }),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Unable to create the item.')
  }

  return data.item
}

export function createFile(project, currentPath, name) {
  return createItem(project, 'file', currentPath, name)
}

export function createFolder(project, currentPath, name) {
  return createItem(project, 'folder', currentPath, name)
}

export async function renameItem(project, currentPath, name, newName) {
  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/item', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name, newName }),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Unable to rename the item.')
  }

  return data.item
}

export async function deleteItem(project, currentPath, name) {
  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/item', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name }),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Unable to delete the item.')
  }
}

export async function uploadFiles(project, currentPath, files) {
  const formData = new FormData()
  formData.append('path', currentPath)
  for (const file of files) formData.append('files', file)

  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/upload', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    const error = new Error(
      data.failed?.[0]?.error || data.error || 'Unable to upload the selected files.',
    )
    error.details = data
    throw error
  }

  return data
}

export function getDownloadUrl(project, currentPath, name) {
  const path = currentPath ? currentPath + '/' + name : name
  return '/api/files/' + encodeURIComponent(project) + '/download?path=' + encodeURIComponent(path)
}

export function isEditableFile(name) {
  return ['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'md', 'txt', 'vue', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'xml', 'yaml', 'yml'].includes(name.split('.').pop()?.toLowerCase())
}
