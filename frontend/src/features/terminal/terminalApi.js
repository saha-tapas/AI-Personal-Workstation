export async function executeTerminalCommand(project, command, cwd = '') {
  const response = await fetch('/api/terminal/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, cwd, command }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to execute command.')
  return data
}

export async function streamTerminalCommand(project, command, onEvent, signal, cwd = '') {
  const response = await fetch('/api/terminal/execute-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, cwd, command }),
    signal,
  })
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Unable to start terminal command.')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    lines.forEach((line) => { if (line.trim()) { try { onEvent(JSON.parse(line)) } catch { onEvent({ type: 'error', message: 'Received malformed terminal output.' }) } } })
    if (done) break
  }
  if (buffer.trim()) {
    try { onEvent(JSON.parse(buffer)) } catch { onEvent({ type: 'error', message: 'Received malformed terminal output.' }) }
  }
}
