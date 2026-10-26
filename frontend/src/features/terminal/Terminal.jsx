import { useEffect, useMemo, useRef, useState } from 'react'
import { streamTerminalCommand } from './terminalApi'

const sessionWorkingDirectories = new Map()
const sessionHistories = new Map()

const editableFilePattern = /\.(?:js|jsx|ts|tsx|css|html?|json|md|txt|vue|php|py|java|c|cpp|h|sql|xml|ya?ml)$/i

function parseLocalFileToken(token, project) {
  const cleaned = token
  if (!cleaned || /^(?:https?:\/\/|ftp:\/\/|mailto:)/i.test(cleaned)) return null
  const locationText = cleaned.replace(/^\.([\\/])/, '')
  const rangeMatch = locationText.match(/^(.+?):(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/)
  const parenthesizedRangeMatch = locationText.match(/^(.+?)\((\d+)(?:,(\d+))?(?:-(\d+)(?:,(\d+))?)?\)$/)
  const match = locationText.match(/^(.+?)(?::(\d+)(?::(\d+))?)?$/)
  const parenthesizedMatch = locationText.match(/^(.+?)\((\d+)(?:,(\d+))?\)$/)
  const locationMatch = parenthesizedRangeMatch || rangeMatch || parenthesizedMatch || match
  if (!locationMatch) return null
  const line = locationMatch[2] ? Number(locationMatch[2]) : null
  const column = locationMatch[3] ? Number(locationMatch[3]) : null
  if ((line !== null && line < 1) || (column !== null && column < 1)) return null
  let filePath = locationMatch[1].replace(/\\/g, '/').replace(/^([a-z]):/i, (_, drive) => `${drive.toUpperCase()}:`)
  const fileUriMatch = filePath.match(/^file:\/\/([^/]*)(\/.*)$/i)
  if (fileUriMatch) {
    if (fileUriMatch[1]) return null
    try {
      filePath = decodeURIComponent(fileUriMatch[2])
    } catch {
      return null
    }
  } else if (/^file:\/\//i.test(filePath)) return null

  const webpackMatch = filePath.match(/^webpack:\/\/([^/]+)\/(.*)$/i)
  if (webpackMatch) {
    if (!['project', project].some((name) => name.toLowerCase() === webpackMatch[1].toLowerCase())) return null
    filePath = webpackMatch[2]
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(filePath)) return null

  const escapedProject = project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const projectRootMatch = filePath.match(new RegExp(`(?:^|/)workspace/${escapedProject}/(.+)$`, 'i'))
  if (projectRootMatch) filePath = projectRootMatch[1]
  filePath = filePath.replace(/^(?:\.\/)+/, '')
  if (!filePath || filePath.startsWith('/') || filePath.startsWith('//') || /^[a-zA-Z]:/.test(filePath) || filePath.split('/').includes('..') || filePath.startsWith('-') || !editableFilePattern.test(filePath)) return null
  return { path: filePath, line, column }
}

function renderFileReferences(text, project, onOpenFile, source = 'unknown') {
  const parts = []
  let cursor = 0
  const trimmedEnd = text.replace(/\s+$/, '')
  const shellWrapped = trimmedEnd.startsWith("'") && trimmedEnd.endsWith("'") && !trimmedEnd.slice(1, -1).includes("'")
  const tokenText = shellWrapped ? text.slice(1, trimmedEnd.length - 1) + text.slice(trimmedEnd.length) : text
  const tokens = tokenText.match(/("[^"]*"|'[^']*'|[^\s,;]+\([^)]*\)|[,;]|\s+|[^\s,;]+)/g) || []
  if (shellWrapped) parts.push("'")
  tokens.forEach((token, index) => {
    const start = cursor
    cursor += token.length
    if (/^\s+$/.test(token)) { parts.push(token); return }

    const hasMatchingQuote = token.length > 1 && ((token[0] === '"' && token[token.length - 1] === '"') || (token[0] === "'" && token[token.length - 1] === "'"))
    const hasTrailingQuote = !hasMatchingQuote && token.length > 1 && (token[token.length - 1] === '"' || token[token.length - 1] === "'")
    const openingQuote = hasMatchingQuote || token[0] === '"' || token[0] === "'" ? token[0] : ''
    const closingQuote = hasMatchingQuote || hasTrailingQuote ? token[token.length - 1] : ''
    let tokenBody = hasMatchingQuote ? token.slice(1, -1) : hasTrailingQuote ? token.slice(0, -1) : openingQuote ? token.slice(1) : token
    if (hasMatchingQuote && tokenBody.length > 1 && ((tokenBody[0] === '"' && tokenBody[tokenBody.length - 1] === '"') || (tokenBody[0] === "'" && tokenBody[tokenBody.length - 1] === "'"))) tokenBody = tokenBody.slice(1, -1)
    tokenBody = tokenBody.replace(/^(?:at|in|from)\s+/i, '')
    const outerParens = tokenBody.startsWith('(') && tokenBody.endsWith(')') && parseLocalFileToken(tokenBody.slice(1, -1), project)
    if (outerParens) tokenBody = tokenBody.slice(1, -1)
    const trailingColon = tokenBody.endsWith(':') && parseLocalFileToken(tokenBody.slice(0, -1), project)
    if (trailingColon) tokenBody = tokenBody.slice(0, -1)
    const directFile = parseLocalFileToken(tokenBody, project)
    const match = tokenBody.match(/^([\[{<`]*)(.*?)([\]}>);,.!?\-:]*)$/)
    const prefix = match?.[1] || ''
    const candidate = match?.[2] || token
    const suffix = match?.[3] || ''
    const file = directFile || parseLocalFileToken(candidate, project)
    if (!file) { parts.push(token); return }

    if (openingQuote) parts.push(openingQuote)
    if (outerParens) parts.push('(')
    if (prefix) parts.push(prefix)
    parts.push(<button className="terminal-file-link" type="button" key={`${start}-${index}`} onClick={() => onOpenFile({ ...file, project })} title={`Open ${file.path}${file.line ? ` at line ${file.line}${file.column ? `, column ${file.column}` : ''}` : ''}`}>{candidate}</button>)
    if (suffix) parts.push(suffix)
    if (trailingColon) parts.push(':')
    if (outerParens) parts.push(')')
    if (closingQuote) parts.push(closingQuote)
  })
  if (shellWrapped) parts.push("'")
  return parts
}

function Terminal({ project, onOpenFile }) {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState(() => sessionHistories.get(project) || [])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [outputSearchOpen, setOutputSearchOpen] = useState(false)
  const [outputSearchQuery, setOutputSearchQuery] = useState('')
  const [outputSearchIndex, setOutputSearchIndex] = useState(0)
  const [copyState, setCopyState] = useState('')
  const [cwd, setCwd] = useState(() => sessionWorkingDirectories.get(project) || '')
  const cwdRef = useRef(sessionWorkingDirectories.get(project) || '')
  const historyDraftRef = useRef(null)
  const reverseSearchRef = useRef({ query: null, index: -1, original: '' })
  const abortRef = useRef(null)
  const isRunningRef = useRef(false)
  const cancelRequestedRef = useRef(false)
  const runningEntryRef = useRef(null)
  const outputRef = useRef(null)
  const inputRef = useRef(null)
  const outputSearchInputRef = useRef(null)

  const outputSearchMatches = useMemo(() => {
    if (!outputSearchQuery) return []
    const query = outputSearchQuery.toLocaleLowerCase()
    const matches = []
    entries.forEach((entry) => {
      ;[entry.command, entry.stdout, entry.stderr].forEach((value) => {
        let start = 0
        const text = value || ''
        const lower = text.toLocaleLowerCase()
        while (start < lower.length) {
          const match = lower.indexOf(query, start)
          if (match === -1) break
          matches.push(true)
          start = match + query.length
        }
      })
    })
    return matches
  }, [entries, outputSearchQuery])

  useEffect(() => {
    const next = sessionWorkingDirectories.get(project) || ''
    cwdRef.current = next
    setCwd(next)
    setHistory(sessionHistories.get(project) || [])
    setHistoryIndex(-1)
    historyDraftRef.current = null
    reverseSearchRef.current = { query: null, index: -1, original: '' }
  }, [project])

  useEffect(() => { outputRef.current?.scrollTo(0, outputRef.current.scrollHeight) }, [entries])

  useEffect(() => {
    if (!outputSearchOpen || !outputSearchMatches.length) return
    const nextIndex = Math.min(outputSearchIndex, outputSearchMatches.length - 1)
    if (nextIndex !== outputSearchIndex) setOutputSearchIndex(nextIndex)
    requestAnimationFrame(() => {
      const match = outputRef.current?.querySelector(`[data-search-match="${nextIndex}"]`)
      if (match && outputRef.current) outputRef.current.scrollTop = match.offsetTop - outputRef.current.offsetTop - 18
    })
  }, [entries, outputSearchOpen, outputSearchMatches.length, outputSearchIndex])

  useEffect(() => {
    if (outputSearchOpen) outputSearchInputRef.current?.focus()
  }, [outputSearchOpen])

  useEffect(() => {
    function handleGlobalShortcut(event) {
      if (!isRunningRef.current || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return
      event.preventDefault()
      cancelCommand()
    }
    window.addEventListener('keydown', handleGlobalShortcut)
    return () => window.removeEventListener('keydown', handleGlobalShortcut)
  }, [])

  async function runCommand(event) {
    event.preventDefault()
    if (isRunning || isRunningRef.current) return
    const value = command.trim()
    if (!value || !project) return
    setCommand(''); setHistoryIndex(-1); historyDraftRef.current = null; reverseSearchRef.current = { query: null, index: -1, original: '' }; setError('')
    setHistory((current) => {
      if (current[current.length - 1] === value) return current
      const next = [...current, value]
      sessionHistories.set(project, next)
      return next
    })
    setIsRunning(true)
    isRunningRef.current = true
    cancelRequestedRef.current = false
    const startedAt = performance.now()
    const controller = new AbortController()
    abortRef.current = controller
    const entryIndex = entries.length
    runningEntryRef.current = entryIndex
    setEntries((current) => [...current, { command: value, loading: true, stdout: '', stderr: '' }])
    try {
      await streamTerminalCommand(project, value, (event) => {
        if (event.type === 'stdout' || event.type === 'stderr') setEntries((current) => current.map((entry, index) => index === entryIndex ? { ...entry, [event.type]: entry[event.type] + event.data } : entry))
        if (event.type === 'error') { setError(event.message); setEntries((current) => current.map((entry, index) => index === entryIndex ? { ...entry, stderr: entry.stderr + event.message } : entry)) }
        if (event.type === 'complete') {
          if (event.changedDirectory) {
            cwdRef.current = event.cwd
            sessionWorkingDirectories.set(project, event.cwd)
            setCwd(event.cwd)
          }
          setEntries((current) => current.map((entry, index) => index === entryIndex ? { ...entry, ...event, duration: Math.round(performance.now() - startedAt), loading: false } : entry))
        }
      }, controller.signal, cwdRef.current)
    } catch (requestError) {
      if (controller.signal.aborted || cancelRequestedRef.current) setEntries((current) => current.map((entry, index) => index === entryIndex ? { ...entry, loading: false, cancelled: true, duration: Math.round(performance.now() - startedAt) } : entry))
      else { setEntries((current) => current.map((entry, index) => index === entryIndex ? { ...entry, loading: false, stderr: entry.stderr + requestError.message, exitCode: 1, duration: Math.round(performance.now() - startedAt) } : entry)); setError(requestError.message) }
    }
    finally { abortRef.current = null; runningEntryRef.current = null; isRunningRef.current = false; cancelRequestedRef.current = false; setIsRunning(false); inputRef.current?.focus() }
  }

  function cancelCommand() {
    if (!isRunningRef.current || !abortRef.current) return
    cancelRequestedRef.current = true
    const entryIndex = runningEntryRef.current
    setEntries((current) => current.map((entry, index) => index === entryIndex ? { ...entry, loading: false, cancelled: true, duration: entry.duration || 0 } : entry))
    setIsRunning(false)
    abortRef.current.abort()
  }

  async function copyText(text, key) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
      else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        if (!document.execCommand('copy')) throw new Error('Clipboard copy failed.')
        textarea.remove()
      }
      setCopyState(key)
      window.setTimeout(() => setCopyState((current) => current === key ? '' : current), 1400)
    } catch {
      setCopyState(`${key}-failed`)
      window.setTimeout(() => setCopyState((current) => current === `${key}-failed` ? '' : current), 1400)
    }
  }

  function entryCopyText(entry) {
    return [entry.command, entry.stdout, entry.stderr].filter(Boolean).join('\n')
  }

  function allCopyText() {
    return entries.map(entryCopyText).filter(Boolean).join('\n\n')
  }

  function openOutputSearch() {
    setOutputSearchOpen(true)
    requestAnimationFrame(() => outputSearchInputRef.current?.focus())
  }

  function moveOutputSearch(direction) {
    if (!outputSearchMatches.length) return
    setOutputSearchIndex((current) => (current + direction + outputSearchMatches.length) % outputSearchMatches.length)
  }

  function handleOutputSearchKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOutputSearchOpen(false)
      inputRef.current?.focus()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      moveOutputSearch(event.shiftKey ? -1 : 1)
    }
  }

  function renderSearchText(text, className, matchCursor, source = 'unknown') {
    if (source === 'command') return text
    if (!text || !outputSearchQuery) return onOpenFile ? renderFileReferences(text, project, onOpenFile, source) : text
    const query = outputSearchQuery.toLocaleLowerCase()
    const lower = text.toLocaleLowerCase()
    const parts = []
    let cursor = 0
    let match = lower.indexOf(query, cursor)
    while (match !== -1) {
      if (match > cursor) parts.push(text.slice(cursor, match))
      const index = matchCursor.current++
      parts.push(<mark className={index === outputSearchIndex ? 'terminal-search-match terminal-search-match--active' : 'terminal-search-match'} data-search-match={index} key={`${index}-${match}`}>{text.slice(match, match + query.length)}</mark>)
      cursor = match + query.length
      match = lower.indexOf(query, cursor)
    }
    if (cursor < text.length) parts.push(text.slice(cursor))
    return className ? <span className={className}>{parts}</span> : parts
  }

  function handleKeyDown(event) {
    if (event.ctrlKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      openOutputSearch()
      return
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'r') {
      event.preventDefault()
      const activeHistory = sessionHistories.get(project) || history
      const search = reverseSearchRef.current
      const query = search.query === null ? command : search.query
      if (search.query === null) search.original = command
      search.query = query
      const start = search.index === -1 ? activeHistory.length - 1 : search.index - 1
      const matchIndex = [...activeHistory].slice(0, start + 1).reverse().findIndex((entry) => entry.includes(query))
      if (matchIndex !== -1) {
        search.index = start - matchIndex
        setCommand(activeHistory[search.index])
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          const end = inputRef.current?.value.length || 0
          inputRef.current?.setSelectionRange(end, end)
        })
      }
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    if (!history.length) return
    reverseSearchRef.current = { query: null, index: -1, original: '' }
    if (event.key === 'ArrowUp') {
      if (historyIndex === -1) historyDraftRef.current = command
      const next = Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(next)
      setCommand(history[history.length - 1 - next])
      return
    }
    const next = historyIndex - 1
    setHistoryIndex(next)
    setCommand(next === -1 ? (historyDraftRef.current || '') : history[history.length - 1 - next])
  }

  const outputMatchCursor = { current: 0 }
  const outputSearchBar = <div className="terminal-search-bar"><input ref={outputSearchInputRef} value={outputSearchQuery} onChange={(event) => { setOutputSearchQuery(event.target.value); setOutputSearchIndex(0) }} onKeyDown={handleOutputSearchKeyDown} placeholder="Search output" aria-label="Search terminal output" autoFocus /><span>{outputSearchQuery ? `${outputSearchMatches.length ? outputSearchIndex + 1 : 0}/${outputSearchMatches.length}` : '0/0'}</span><button type="button" onClick={() => moveOutputSearch(-1)} aria-label="Previous output match">↑</button><button type="button" onClick={() => moveOutputSearch(1)} aria-label="Next output match">↓</button><button type="button" onClick={() => { setOutputSearchOpen(false); inputRef.current?.focus() }} aria-label="Close output search">×</button></div>

  if (!project) return <section className="terminal-panel"><p className="eyebrow">Terminal</p><h1>Terminal</h1><p className="terminal-empty">Open a project to use the terminal.</p></section>
  return <section className="terminal-panel" aria-labelledby="terminal-title"><div className="terminal-heading"><div><p className="eyebrow">Terminal</p><h1 id="terminal-title">Project: {project}</h1><p className="terminal-cwd">Working directory: {cwd || '/'}</p></div><div className="terminal-heading-actions"><button className="terminal-clear" type="button" onClick={() => setEntries([])} disabled={isRunning}>Clear</button><button className="terminal-copy-all" type="button" onClick={() => copyText(allCopyText(), 'all')} disabled={!allCopyText()}>{copyState === 'all' ? 'Copied' : copyState === 'all-failed' ? 'Copy failed' : 'Copy All'}</button>{isRunning && <button className="terminal-cancel" type="button" onClick={cancelCommand}>Cancel</button>}</div></div>{outputSearchOpen && outputSearchBar}<div className="terminal-output" ref={outputRef}>{entries.length === 0 && <p className="terminal-placeholder">Run a command in this project workspace.</p>}{entries.map((entry, index) => { const text = entryCopyText(entry); return <div className="terminal-entry" key={index}><p className="terminal-command">{project}:{cwd || '/'}&gt; {renderSearchText(entry.command, null, outputMatchCursor, 'command')}</p>{entry.loading && <p className="terminal-muted">Running...</p>}{entry.stdout && <pre className="terminal-stdout">{renderSearchText(entry.stdout, null, outputMatchCursor, 'stdout')}</pre>}{entry.stderr && <pre className="terminal-stderr">{renderSearchText(entry.stderr, null, outputMatchCursor, 'stderr')}</pre>}<div className="terminal-entry-footer">{!entry.loading && (entry.cancelled ? <p className="terminal-exit terminal-exit--error">Cancelled · {entry.duration} ms</p> : entry.timedOut ? <p className="terminal-exit terminal-exit--error">Timed out · {entry.duration} ms</p> : <p className={'terminal-exit ' + (entry.exitCode === 0 ? 'terminal-exit--ok' : 'terminal-exit--error')}>Exit code: {entry.exitCode} · {entry.duration} ms</p>)}<button className="terminal-copy" type="button" onClick={() => copyText(text, `entry-${index}`)} disabled={entry.loading || !text}>{copyState === `entry-${index}` ? 'Copied' : copyState === `entry-${index}-failed` ? 'Copy failed' : 'Copy'}</button></div></div>})}</div>{error && <p className="terminal-error" role="alert">{error}</p>}<form className="terminal-form" onSubmit={runCommand}><span className="terminal-prompt">{project}:{cwd || '/'}&gt;</span><input ref={inputRef} disabled={isRunning} value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={handleKeyDown} placeholder={isRunning ? 'Running...' : 'Enter a command'} aria-label="Terminal command" autoFocus /></form></section>
}

export default Terminal
