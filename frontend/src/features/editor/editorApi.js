export async function fetchEditorFile(project, filePath) {
  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/file?path=' + encodeURIComponent(filePath))
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to open file.')
  return data
}

export async function saveEditorFile(project, filePath, content) {
  const response = await fetch('/api/files/' + encodeURIComponent(project) + '/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save file.')
  return data
}
