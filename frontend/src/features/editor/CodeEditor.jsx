import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchEditorFile, saveEditorFile } from './editorApi'

function BackIcon() { return <svg className="editor-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg> }
function SaveIcon() { return <svg className="editor-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></svg> }
function FindIcon() { return <svg className="editor-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></svg> }
function CloseIcon() { return <svg className="editor-tab-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg> }
function PreviousIcon() { return <svg className="editor-find-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg> }
function NextIcon() { return <svg className="editor-find-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg> }

const editableExtensions = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'md', 'txt', 'vue', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'xml', 'yaml', 'yml'])
const LARGE_FILE_THRESHOLD = 1024 * 1024
function isEditable(filePath) { return editableExtensions.has(filePath.split('.').pop()?.toLowerCase()) }
function getEditorKey(project, filePath) { return JSON.stringify([project, filePath]) }

function escapeHtml(value) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

function findLiteralMatches(value, query, caseSensitive = false) {
  if (!query) return []
  if (caseSensitive) {
    const matches = []
    let fromIndex = 0
    while (fromIndex <= value.length) {
      const matchIndex = value.indexOf(query, fromIndex)
      if (matchIndex === -1) break
      matches.push({ index: matchIndex, length: query.length })
      fromIndex = matchIndex + query.length
    }
    return matches
  }

  const normalized = value.toLowerCase()
  const originalRanges = []
  for (let index = 0; index < value.length;) {
    const character = String.fromCodePoint(value.codePointAt(index))
    const lowered = character.toLowerCase()
    for (let offset = 0; offset < lowered.length; offset += 1) originalRanges.push({ index, length: character.length })
    index += character.length
  }

  const normalizedQuery = query.toLowerCase()
  const matches = []
  let fromIndex = 0
  while (fromIndex <= normalized.length) {
    const matchIndex = normalized.indexOf(normalizedQuery, fromIndex)
    if (matchIndex === -1) break
    const start = originalRanges[matchIndex]
    const end = originalRanges[matchIndex + normalizedQuery.length - 1]
    matches.push({ index: start.index, length: end.index + end.length - start.index })
    fromIndex = matchIndex + normalizedQuery.length
  }
  return matches
}

function highlightCode(value, filePath, findTerm = '', caseSensitive = false, activeFindIndex = 0) {
  const extension = filePath.split('.').pop()?.toLowerCase()
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|async|await|def|public|private|static|void|int|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b/g
  const tokenPattern = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b)/g
  const searchMatches = findLiteralMatches(value, findTerm, caseSensitive)
  const renderText = (text, offset, syntax = true) => {
    let rendered = ''
    let from = 0
    searchMatches.forEach((match, index) => {
      const matchEnd = match.index + match.length
      const start = Math.max(match.index, offset)
      const end = Math.min(matchEnd, offset + text.length)
      if (start >= end) return
      const localStart = start - offset
      const localEnd = end - offset
      const before = text.slice(from, localStart)
      rendered += syntax ? highlightKeywords(escapeHtml(before), keywords) : escapeHtml(before)
      const matched = text.slice(localStart, localEnd)
      const matchClass = index === activeFindIndex ? 'editor-search-match editor-search-match--active' : 'editor-search-match'
      rendered += `<mark class="${matchClass}">${escapeHtml(matched)}</mark>`
      from = localEnd
    })
    const remainder = text.slice(from)
    return rendered + (syntax ? highlightKeywords(escapeHtml(remainder), keywords) : escapeHtml(remainder))
  }
  let result = ''
  let lastIndex = 0
  for (const match of value.matchAll(tokenPattern)) {
    result += renderText(value.slice(lastIndex, match.index), lastIndex)
    const token = renderText(match[0], match.index, false)
    const type = /^\d/.test(match[0]) ? 'number' : /^[/#]/.test(match[0]) ? 'comment' : 'string'
    result += `<span class="code-token-${type}">${token}</span>`
    lastIndex = match.index + match[0].length
  }
  result += renderText(value.slice(lastIndex), lastIndex)
  if (extension === 'html' || extension === 'htm' || extension === 'xml') result = result.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="code-token-keyword">$2</span>')
  return result || ' '
}

function highlightKeywords(value, keywords) {
  return value.replace(keywords, '<span class="code-token-keyword">$1</span>')
}

function CodeEditor({ project, files = [], activePath = '', gitFileChanges, editorCursorTarget, onSelectFile, onCloseFile, onBack, onSaveSuccess, onFileLoadError }) {
  const [tabState, setTabs] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isFindOpenState, setIsFindOpen] = useState(false)
  const [isReplaceOpen, setIsReplaceOpen] = useState(false)
  const [findTerm, setFindTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [findIndex, setFindIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false)
  const [goToLineValue, setGoToLineValue] = useState('')
  const [goToLineError, setGoToLineError] = useState('')
  const findInputRef = useRef(null)
  const editorInputRef = useRef(null)
  const goToLineRef = useRef(null)
  const cursorPositionsRef = useRef({})
  const lastActivePathRef = useRef(`${project}:${activePath}:normal`)
  const controlsPathRef = useRef('')
  const tabsRef = useRef(tabState)
  const fileLoadRequestIdsRef = useRef({})
  const fileLoadInFlightRef = useRef({})
  const fileLoadCursorTargetsRef = useRef({})
  const currentProjectRef = useRef(project)
  const currentActivePathRef = useRef(activePath)
  const consumedCursorTargetRef = useRef(null)
  const editorCursorTargetRef = useRef(editorCursorTarget)
  const onFileLoadErrorRef = useRef(onFileLoadError)
  const activeFile = files.find((file) => file.path === activePath)
  const tabs = useMemo(() => new Proxy(tabState, { get: (target, key) => typeof key === 'string' && !key.startsWith('[') && !Object.prototype.hasOwnProperty.call(target, key) ? target[getEditorKey(project, key)] : target[key] }), [project, tabState])
  const activeTab = activePath ? tabState[getEditorKey(project, activePath)] : null

  tabsRef.current = tabState
  currentProjectRef.current = project
  currentActivePathRef.current = activePath
  editorCursorTargetRef.current = editorCursorTarget
  onFileLoadErrorRef.current = onFileLoadError

  const loadFile = useCallback(async (file, force = false) => {
    const editorKey = getEditorKey(project, file.path)
    const requestKey = editorKey
    const existingTab = tabState[editorKey]
    if (fileLoadInFlightRef.current[requestKey] || existingTab?.loading || (!force && existingTab && !existingTab.failed)) return
    if (!isEditable(file.path)) { setError('This file cannot be edited as text.'); return }
    const requestId = (fileLoadRequestIdsRef.current[requestKey] || 0) + 1
    fileLoadRequestIdsRef.current[requestKey] = requestId
    const loadTargetKey = `${requestKey}:${requestId}`
    const currentCursorTarget = editorCursorTargetRef.current
    if (currentCursorTarget?.project === project && currentCursorTarget.path === file.path && currentCursorTarget.requestId !== undefined) fileLoadCursorTargetsRef.current[loadTargetKey] = currentCursorTarget
    fileLoadInFlightRef.current[requestKey] = true
    setError('')
    setTabs((existing) => ({ ...existing, [editorKey]: { ...file, content: existingTab?.failed ? '' : existing[editorKey]?.content || '', savedContent: '', loading: true } }))
    try {
      const data = await fetchEditorFile(project, file.path)
      if (currentProjectRef.current !== project || fileLoadRequestIdsRef.current[requestKey] !== requestId) return
      setTabs((existing) => ({ ...existing, [editorKey]: { ...file, content: data.content, savedContent: data.content, loading: false } }))
    } catch (requestError) {
      if (currentProjectRef.current !== project || fileLoadRequestIdsRef.current[requestKey] !== requestId) return
      const failedTarget = fileLoadCursorTargetsRef.current[loadTargetKey]
      if (failedTarget) onFileLoadErrorRef.current?.(failedTarget)
      setError(requestError.message)
      setTabs((existing) => ({ ...existing, [editorKey]: { ...file, content: '', savedContent: '', loading: false, failed: true } }))
    } finally {
      delete fileLoadCursorTargetsRef.current[loadTargetKey]
      if (fileLoadRequestIdsRef.current[requestKey] === requestId) fileLoadInFlightRef.current[requestKey] = false
    }
  }, [project, tabState])

  useEffect(() => {
    async function refreshCleanTabs() {
      if (!gitFileChanges || gitFileChanges.project !== project) return
      const changedPaths = new Set((gitFileChanges.paths || []).map((filePath) => filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')))
      const openTabs = tabsRef.current
      await Promise.all(Object.entries(openTabs).map(async ([editorKey, tab]) => {
        const [, filePath] = JSON.parse(editorKey)
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
        if (changedPaths.size && !changedPaths.has(normalizedPath)) return
        if (tab.loading || tab.failed || tab.content !== tab.savedContent) return
        try {
          const data = await fetchEditorFile(project, filePath)
          setTabs((existing) => {
            const current = existing[editorKey]
            if (!current || current.content !== current.savedContent) return existing
            return { ...existing, [editorKey]: { ...current, content: data.content, savedContent: data.content } }
          })
        } catch (requestError) {
          setError(requestError.message)
        }
      }))
    }
    refreshCleanTabs()
  }, [gitFileChanges, project])

  useEffect(() => {
    if (!activeFile) return
    loadFile(activeFile)
  }, [activeFile, loadFile])

  useEffect(() => {
    if (editorCursorTarget?.project === project && editorCursorTarget.path === activePath) return
    const editorKey = getEditorKey(project, activePath)
    const saved = cursorPositionsRef.current[editorKey] || { line: 1, column: 1, offset: 0, selectionStart: 0, selectionEnd: 0 }
    setCursorPosition(saved)
    const timeoutId = setTimeout(() => {
      if (getEditorKey(currentProjectRef.current, currentActivePathRef.current) !== editorKey) return
      const textarea = editorInputRef.current
      if (!textarea) return
      const offset = Math.min(saved.offset || 0, textarea.value.length)
      const selectionStart = Math.min(saved.selectionStart ?? offset, textarea.value.length)
      const selectionEnd = Math.min(saved.selectionEnd ?? selectionStart, textarea.value.length)
      textarea.setSelectionRange(selectionStart, selectionEnd)
      textarea.scrollTop = Math.max(0, (saved.line - 1) * 23)
      updateCursorPosition(textarea)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [activePath, editorCursorTarget?.path, editorCursorTarget?.project, project])

  useEffect(() => {
    if (!editorCursorTarget || editorCursorTarget === consumedCursorTargetRef.current || editorCursorTarget.project !== project || editorCursorTarget.path !== activePath || !Number.isInteger(editorCursorTarget.line) || editorCursorTarget.line < 1) return
    const textarea = editorInputRef.current
    if (!textarea || !activeTab || activeTab.loading) return
    const lines = activeTab.content.split('\n')
    const line = Math.min(editorCursorTarget.line, lines.length)
    const lineStart = lines.slice(0, line - 1).reduce((total, value) => total + value.length + 1, 0)
    const column = Number.isInteger(editorCursorTarget.column) && editorCursorTarget.column > 0 ? Math.min(editorCursorTarget.column - 1, lines[line - 1].length) : 0
    const offset = lineStart + column
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(offset, offset)
    textarea.scrollTop = Math.max(0, (line - 1) * 23)
    textarea.scrollLeft = 0
    updateCursorPosition(textarea)
    consumedCursorTargetRef.current = editorCursorTarget
  }, [activePath, activeTab?.content, activeTab?.loading, editorCursorTarget, project])

  const hasChanges = Boolean(activeTab && activeTab.content !== activeTab.savedContent)
  const isLargeFile = Boolean(activeTab?.content && activeTab.content.length > LARGE_FILE_THRESHOLD)
  const controlIdentity = `${project}:${activePath}:${isLargeFile ? 'large' : 'normal'}`
  if (lastActivePathRef.current !== controlIdentity) {
    lastActivePathRef.current = controlIdentity
    controlsPathRef.current = ''
  }
  const isFindOpen = isFindOpenState && !isLargeFile && controlsPathRef.current === controlIdentity
  const title = activeFile ? activeFile.name + (hasChanges ? ' *' : '') : 'Code Editor'
  const statusText = useMemo(() => isLargeFile ? (hasChanges ? 'Unsaved changes · Large file: highlighting, search, replace, and Go to Line disabled' : 'Large file: highlighting, search, replace, and Go to Line disabled') : hasChanges ? 'Unsaved changes' : message || 'Saved', [hasChanges, isLargeFile, message])
  const lineCount = isLargeFile ? 0 : activeTab?.content ? activeTab.content.split('\n').length : 1
  const searchMatches = useMemo(() => {
    if (isLargeFile || !findTerm || !activeTab) return []
    return findLiteralMatches(activeTab.content, findTerm, caseSensitive)
  }, [activeTab?.content, caseSensitive, findTerm, isLargeFile])
  const matchCount = searchMatches.length

  useEffect(() => {
    const nextFindIndex = matchCount ? Math.min(findIndex, matchCount - 1) : 0
    if (nextFindIndex !== findIndex) setFindIndex(nextFindIndex)

    const textarea = editorInputRef.current
    if (!textarea) return
    const match = searchMatches[nextFindIndex]
    if (match === undefined) {
      textarea.setSelectionRange(0, 0)
      updateCursorPosition(textarea)
      return
    }
    textarea.setSelectionRange(match.index, match.index + match.length)
    updateCursorPosition(textarea)
  }, [findIndex, findTerm.length, matchCount, searchMatches])

  function updateContent(content) { const editorKey = getEditorKey(project, activePath); setTabs((existing) => ({ ...existing, [editorKey]: { ...existing[editorKey], content } })); setMessage('') }

  function updateCursorPosition(textarea = editorInputRef.current) {
    if (!textarea) return
    const beforeCursor = textarea.value.slice(0, textarea.selectionStart)
    const lines = beforeCursor.split('\n')
    const position = { line: lines.length, column: lines[lines.length - 1].length + 1, offset: textarea.selectionStart, selectionStart: textarea.selectionStart, selectionEnd: textarea.selectionEnd }
    setCursorPosition(position)
    if (activePath) cursorPositionsRef.current[getEditorKey(project, activePath)] = position
  }

  function applyEditorChange(content, selectionStart, selectionEnd = selectionStart) {
    const changeProject = project
    const changePath = activePath
    const changeTextarea = editorInputRef.current
    updateContent(content)
    setTimeout(() => {
      if (currentProjectRef.current !== changeProject || currentActivePathRef.current !== changePath) return
      const textarea = editorInputRef.current
      if (!textarea || textarea !== changeTextarea) return
      textarea.focus()
      textarea.setSelectionRange(selectionStart, selectionEnd)
      updateCursorPosition(textarea)
    }, 0)
  }

  function lineOperation(value, selectionStart, selectionEnd, operation) {
    const lines = value.split('\n')
    const offsets = []
    let offset = 0
    lines.forEach((line) => { offsets.push(offset); offset += line.length + 1 })
    const startLine = Math.max(0, offsets.findIndex((lineOffset, index) => selectionStart < lineOffset + lines[index].length + 1))
    let endLine = Math.max(0, offsets.findIndex((lineOffset, index) => selectionEnd <= lineOffset + lines[index].length))
    if (endLine === -1) endLine = lines.length - 1
    if (selectionStart !== selectionEnd && selectionEnd > 0 && value[selectionEnd - 1] === '\n') endLine = Math.max(startLine, endLine - 1)
    const hasSelection = selectionStart !== selectionEnd
    const blockEnd = endLine + 1
    const selectedLength = lines.slice(startLine, blockEnd).join('\n').length
    const relativeStart = hasSelection ? Math.max(0, selectionStart - offsets[startLine]) : selectionStart - offsets[startLine]
    const relativeEnd = hasSelection ? Math.min(selectedLength, selectionEnd - offsets[startLine]) : relativeStart
    const block = lines.slice(startLine, blockEnd)
    const result = operation(lines, startLine, endLine, block)
    if (!result) return
    const nextLines = result.lines
    const nextValue = nextLines.join('\n')
    const nextBlockStart = nextLines.slice(0, result.newStartLine).reduce((total, line) => total + line.length + 1, 0)
    const nextStart = nextBlockStart + relativeStart
    const nextEnd = nextBlockStart + (hasSelection ? relativeEnd : relativeStart)
    applyEditorChange(nextValue, nextStart, nextEnd)
  }

  function duplicateLines(value, selectionStart, selectionEnd, direction) {
    lineOperation(value, selectionStart, selectionEnd, (lines, startLine, endLine, block) => {
      const insertAt = direction === 'up' ? startLine : endLine + 1
      const nextLines = [...lines.slice(0, insertAt), ...block, ...lines.slice(insertAt)]
      return { lines: nextLines, newStartLine: direction === 'up' ? startLine : insertAt }
    })
  }

  function moveLines(value, selectionStart, selectionEnd, direction) {
    lineOperation(value, selectionStart, selectionEnd, (lines, startLine, endLine, block) => {
      if (direction === 'up' && startLine === 0) return null
      if (direction === 'down' && endLine === lines.length - 1) return null
      const nextLines = [...lines]
      nextLines.splice(startLine, block.length)
      const newStartLine = direction === 'up' ? startLine - 1 : startLine + 1
      nextLines.splice(newStartLine, 0, ...block)
      return { lines: nextLines, newStartLine }
    })
  }

  async function handleSave() {
    if (!activeTab || activeTab.loading || isSaving || !hasChanges) return
    const saveProject = project
    const savePath = activePath
    const contentSnapshot = activeTab.content
    setIsSaving(true); setError(''); setMessage('')
    const isCurrentSaveTarget = () => currentProjectRef.current === saveProject && currentActivePathRef.current === savePath
    try {
      await saveEditorFile(saveProject, savePath, contentSnapshot)
      setTabs((existing) => {
        if (currentProjectRef.current !== saveProject) return existing
        const editorKey = getEditorKey(saveProject, savePath)
        return { ...existing, [editorKey]: { ...existing[editorKey], savedContent: contentSnapshot } }
      })
      if (isCurrentSaveTarget()) setMessage('Saved')
      onSaveSuccess?.(saveProject, savePath)
    }
    catch (requestError) { if (isCurrentSaveTarget()) setError(requestError.message) }
    finally { setIsSaving(false) }
  }

  function openFind(replace = false) {
    if (isLargeFile) { setMessage('Search and replace are disabled for large files.'); return }
    controlsPathRef.current = controlIdentity
    setIsFindOpen(true)
    setIsReplaceOpen(replace)
    setTimeout(() => findInputRef.current?.focus(), 0)
  }

  function handleEditorKeyDown(event) {
    const textarea = event.currentTarget
    const { selectionStart, selectionEnd, value } = textarea
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      if (selectionStart === selectionEnd) {
        const wordPattern = /[\w$]/
        let start = selectionStart
        let end = selectionStart
        while (start > 0 && wordPattern.test(value[start - 1])) start -= 1
        while (end < value.length && wordPattern.test(value[end])) end += 1
        if (start !== end) textarea.setSelectionRange(start, end)
      } else {
        const selected = value.slice(selectionStart, selectionEnd)
        const nextStart = value.indexOf(selected, selectionEnd)
        const matchStart = nextStart === -1 ? value.indexOf(selected) : nextStart
        if (matchStart !== -1 && matchStart !== selectionStart) textarea.setSelectionRange(matchStart, matchStart + selected.length)
      }
      updateCursorPosition(textarea)
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const lineEndIndex = value.indexOf('\n', selectionStart)
      const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
      textarea.setSelectionRange(lineStart, lineEnd)
      updateCursorPosition(textarea)
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Home') {
      event.preventDefault()
      textarea.setSelectionRange(0, 0)
      textarea.scrollTop = 0
      updateCursorPosition(textarea)
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'End') {
      event.preventDefault()
      textarea.setSelectionRange(value.length, value.length)
      textarea.scrollTop = textarea.scrollHeight
      updateCursorPosition(textarea)
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === 'Home') {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const lineEnd = value.indexOf('\n', selectionStart) === -1 ? value.length : value.indexOf('\n', selectionStart)
      const firstContent = lineStart + (value.slice(lineStart, lineEnd).match(/^\s*/) || [''])[0].length
      const target = selectionStart === firstContent ? lineStart : firstContent
      textarea.setSelectionRange(target, target)
      updateCursorPosition(textarea)
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === 'End') {
      event.preventDefault()
      const lineEnd = value.indexOf('\n', selectionStart) === -1 ? value.length : value.indexOf('\n', selectionStart)
      textarea.setSelectionRange(lineEnd, lineEnd)
      updateCursorPosition(textarea)
      return
    }
    if (event.altKey && event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      duplicateLines(value, selectionStart, selectionEnd, event.key === 'ArrowUp' ? 'up' : 'down')
      return
    }
    if (event.altKey && !event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      moveLines(value, selectionStart, selectionEnd, event.key === 'ArrowUp' ? 'up' : 'down')
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      if (selectionStart !== selectionEnd && value.slice(selectionStart, selectionEnd).includes('\n')) {
        const selectedStart = value.lastIndexOf('\n', selectionStart - 1) + 1
        const selectedEnd = value[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd
        const blockEnd = value.indexOf('\n', selectedEnd)
        const end = blockEnd === -1 ? value.length : blockEnd
        const selectedBlock = value.slice(selectedStart, end)
        const lines = selectedBlock.split('\n')
        if (event.shiftKey) {
          let removedBeforeStart = 0
          let removedTotal = 0
          const unindentedLines = lines.map((line, index) => {
            const removeLength = line.startsWith('\t') ? 1 : line.startsWith('    ') ? 4 : line.match(/^ +/)?.[0].length || 0
            if (index === 0) removedBeforeStart = removeLength
            removedTotal += removeLength
            return line.slice(removeLength)
          })
          applyEditorChange(value.slice(0, selectedStart) + unindentedLines.join('\n') + value.slice(end), Math.max(selectedStart, selectionStart - removedBeforeStart), Math.max(selectedStart, selectionEnd - removedTotal))
        } else {
          const indented = lines.map((line) => '\t' + line).join('\n')
          const added = lines.length
          applyEditorChange(value.slice(0, selectedStart) + indented + value.slice(end), selectionStart + added, selectionEnd + added)
        }
        return
      }
      if (event.shiftKey) {
        const linePrefix = value.slice(lineStart, selectionStart)
        const removeLength = linePrefix.startsWith('\t') ? 1 : linePrefix.startsWith('    ') ? 4 : 0
        if (removeLength) applyEditorChange(value.slice(0, lineStart) + value.slice(lineStart + removeLength), Math.max(lineStart, selectionStart - removeLength), Math.max(lineStart, selectionEnd - removeLength))
      } else {
        applyEditorChange(value.slice(0, selectionStart) + '\t' + value.slice(selectionEnd), selectionStart + 1)
      }
      return
    }
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }
    if (pairs[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      const closing = pairs[event.key]
      if (selectionStart === selectionEnd && value[selectionStart] === closing) {
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1)
        updateCursorPosition(textarea)
        return
      }
      applyEditorChange(value.slice(0, selectionStart) + event.key + closing + value.slice(selectionEnd), selectionStart + 1)
      return
    }
    if (event.key === 'Backspace' && selectionStart === selectionEnd && selectionStart > 0 && pairs[value[selectionStart - 1]] === value[selectionStart]) {
      event.preventDefault()
      applyEditorChange(value.slice(0, selectionStart - 1) + value.slice(selectionStart + 1), selectionStart - 1)
      return
    }
    if (event.key === 'Enter' && selectionStart === selectionEnd) {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const currentIndent = value.slice(lineStart, selectionStart).match(/^\s*/)?.[0] || ''
      const before = value[selectionStart - 1]
      const after = value[selectionStart]
      if (before === '{' && after === '}') {
        event.preventDefault()
        const indent = currentIndent + '    '
        applyEditorChange(value.slice(0, selectionStart) + '\n' + indent + '\n' + currentIndent + value.slice(selectionEnd), selectionStart + indent.length + 1)
        return
      }
      if (before === '{') {
        event.preventDefault()
        const indent = currentIndent + '    '
        applyEditorChange(value.slice(0, selectionStart) + '\n' + indent + value.slice(selectionEnd), selectionStart + indent.length + 1)
        return
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      handleSave()
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      if (isLargeFile) setMessage('Search and replace are disabled for large files.')
      else openFind(false)
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
      event.preventDefault()
      if (isLargeFile) setMessage('Search and replace are disabled for large files.')
      else openFind(true)
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      openGoToLine()
    }
  }

  function openGoToLine() {
    if (isLargeFile) { setMessage('Go to Line is disabled for large files.'); return }
    controlsPathRef.current = controlIdentity
    setIsGoToLineOpen(true)
    setGoToLineValue('')
    setGoToLineError('')
    setTimeout(() => goToLineRef.current?.focus(), 0)
  }

  function goToLine() {
    if (isLargeFile) { setMessage('Go to Line is disabled for large files.'); return }
    const input = goToLineValue.trim()
    if (!/^[1-9]\d*$/.test(input) || !activeTab) {
      setGoToLineError('Enter a positive whole line number.')
      return
    }
    const requestedLine = Number(input)
    const lines = activeTab.content.split('\n')
    const line = Math.min(requestedLine, lines.length)
    const offset = lines.slice(0, line - 1).reduce((total, value) => total + value.length + 1, 0)
    const textarea = editorInputRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(offset, offset)
    textarea.scrollTop = Math.max(0, (line - 1) * 23)
    updateCursorPosition(textarea)
    setIsGoToLineOpen(false)
    setGoToLineError('')
  }

  function handleGoToLineKeyDown(event) {
    if (event.key === 'Enter') { event.preventDefault(); goToLine() }
    if (event.key === 'Escape') { event.preventDefault(); setIsGoToLineOpen(false); editorInputRef.current?.focus() }
  }

  function handleFindKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsFindOpen(false)
      setTimeout(() => editorInputRef.current?.focus(), 0)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      setFindIndex((current) => matchCount ? (current + (event.shiftKey ? matchCount - 1 : 1)) % matchCount : 0)
    }
  }

  function closeFind() {
    setIsFindOpen(false)
    setIsReplaceOpen(false)
    setTimeout(() => editorInputRef.current?.focus(), 0)
  }

  function replaceCurrent() {
    if (isLargeFile) { setMessage('Search and replace are disabled for large files.'); return }
    if (!activeTab || !findTerm || !matchCount) return
    const match = searchMatches[findIndex % matchCount]
    const content = activeTab.content.slice(0, match.index) + replaceTerm + activeTab.content.slice(match.index + match.length)
    updateContent(content)
    setFindIndex((current) => matchCount > 1 ? current % (matchCount - 1) : 0)
  }

  function replaceAll() {
    if (isLargeFile) { setMessage('Search and replace are disabled for large files.'); return }
    if (!activeTab || !findTerm || !matchCount) {
      setMessage('No matches')
      return
    }
    const matches = findLiteralMatches(activeTab.content, findTerm, caseSensitive)
    let result = ''
    let fromIndex = 0
    matches.forEach((match) => {
      result += activeTab.content.slice(fromIndex, match.index) + replaceTerm
      fromIndex = match.index + match.length
    })
    result += activeTab.content.slice(fromIndex)
    updateContent(result)
    setFindIndex(0)
    setMessage(`${matches.length} replacements`)
  }

  function syncScroll(event) {
    const codePane = event.currentTarget.parentElement
    const highlighted = codePane.querySelector('.editor-highlight')
    const gutter = codePane.parentElement.querySelector('.editor-line-gutter')
    if (highlighted) { highlighted.scrollTop = event.currentTarget.scrollTop; highlighted.scrollLeft = event.currentTarget.scrollLeft }
    if (gutter) gutter.scrollTop = event.currentTarget.scrollTop
  }

  function handleClose(file) {
    const editorKey = getEditorKey(project, file.path)
    const tab = tabState[editorKey]
    if (tab && tab.content !== tab.savedContent && !window.confirm('This file has unsaved changes. Close without saving?')) return
    const remaining = files.filter((item) => item.path !== file.path)
    const next = remaining[0]?.path || ''
    setTabs((existing) => { const copy = { ...existing }; delete copy[editorKey]; return copy })
    delete cursorPositionsRef.current[editorKey]
    onCloseFile?.(file.path, next)
  }

  const highlightedCode = activeTab && !activeTab.loading && !error && !isLargeFile ? highlightCode(activeTab.content, activeFile.path, findTerm, caseSensitive, findIndex) : ''
  const goToLineControl = isGoToLineOpen && !isLargeFile && controlsPathRef.current === controlIdentity && <div className="editor-go-to-line"><label htmlFor="editor-go-to-line-input">Go to Line</label><input id="editor-go-to-line-input" ref={goToLineRef} inputMode="numeric" value={goToLineValue} onChange={(event) => { setGoToLineValue(event.target.value); setGoToLineError('') }} onKeyDown={handleGoToLineKeyDown} aria-label="Go to Line" aria-invalid={Boolean(goToLineError)} aria-describedby="editor-go-to-line-error" /><p id="editor-go-to-line-error" className="editor-go-to-line-error" role="alert" hidden={!goToLineError}>{goToLineError}</p><button className="editor-replace-button" type="button" onClick={goToLine}>Go</button><button className="editor-icon-action" type="button" onClick={() => { setIsGoToLineOpen(false); editorInputRef.current?.focus() }} title="Close Go to Line" aria-label="Close Go to Line"><CloseIcon /></button></div>

  const replaceToggle = !isReplaceOpen && <button className="editor-replace-button" type="button" onClick={() => setIsReplaceOpen(true)} aria-label="Show Replace" aria-expanded={isReplaceOpen} aria-controls="editor-replace-row">Replace</button>
  const hideReplaceToggle = <button className="editor-replace-button" type="button" onClick={() => setIsReplaceOpen(false)} aria-label="Hide Replace" aria-expanded={isReplaceOpen} aria-controls="editor-replace-row">Hide Replace</button>

  return <section className="editor-panel" aria-labelledby="editor-title">
    <div className="editor-heading"><div>{onBack && <button className="editor-back-button" type="button" onClick={onBack} title="Back to Files"><BackIcon /><span>Files</span></button>}<p className="eyebrow">Editor</p><h1 id="editor-title">Code Editor</h1>{activeFile && <p className="editor-file-path">{activeFile.path}</p>}</div>{activeFile && <div className="editor-heading-status"><span className={'editor-status ' + (hasChanges ? 'editor-status--unsaved' : 'editor-status--saved')} role="status">â— {statusText}</span><span className="editor-cursor-position" aria-live="polite">Ln {cursorPosition.line}, Col {cursorPosition.column}</span></div>}</div>
    {files.length === 0 ? <p className="editor-empty">Open an editable file from a project to begin editing.</p> : <div className="editor-surface"><div className="editor-tabs" role="tablist" aria-label="Open files">{files.map((file) => { const dirty = tabs[file.path] && tabs[file.path].content !== tabs[file.path].savedContent; return <div className={'editor-tab' + (file.path === activePath ? ' editor-tab--active' : '')} key={file.path}><button className="editor-tab-name" type="button" role="tab" aria-selected={file.path === activePath} onClick={() => { if (file.path === activePath) return; if (hasChanges && !window.confirm('This file has unsaved changes. Close without saving?')) return; setMessage(''); setError(''); onSelectFile?.(file.path) }}>{file.name}{dirty ? ' *' : ''}</button><button className="editor-tab-close" type="button" title={'Close ' + file.name} aria-label={'Close ' + file.name} onClick={() => handleClose(file)}><CloseIcon /></button></div> })}</div><div className="editor-toolbar"><strong>{title}</strong><div className="editor-toolbar-actions">{activeTab && <button className="editor-find-button editor-toolbar-button" type="button" onClick={() => openFind(false)} title="Find in file (Ctrl/Cmd+F)" aria-label="Find in file"><FindIcon /><span>Find</span></button>} {activeTab && !isLargeFile && <button className="editor-toolbar-button" type="button" onClick={openGoToLine} title="Go to Line (Ctrl/Cmd+G)" aria-label="Go to Line">Go to Line</button>}<button className="editor-save-button editor-toolbar-button" type="button" onClick={handleSave} disabled={!activeTab || activeTab.loading || isSaving || !hasChanges} title="Save file (Ctrl/Cmd+S)" aria-label="Save file"><SaveIcon /><span>{isSaving ? 'Saving...' : 'Save'}</span></button></div></div>{goToLineControl}{isFindOpen && <div className="editor-find-bar"><div className="editor-find-row"><label htmlFor="editor-find-input">Find</label><input id="editor-find-input" ref={findInputRef} value={findTerm} onChange={(event) => { setFindTerm(event.target.value); setFindIndex(0); setMessage('') }} onKeyDown={handleFindKeyDown} placeholder="Search in file" aria-label="Find in file" /><span>{findTerm ? `${matchCount ? findIndex + 1 : 0} of ${matchCount}` : 'Type to search'}</span><button className="editor-icon-action" type="button" onClick={() => setFindIndex((current) => matchCount ? (current + matchCount - 1) % matchCount : 0)} aria-label="Previous match" title="Previous match"><PreviousIcon /></button><button className="editor-icon-action" type="button" onClick={() => setFindIndex((current) => matchCount ? (current + 1) % matchCount : 0)} aria-label="Next match" title="Next match"><NextIcon /></button>{replaceToggle}{!isReplaceOpen && <button className="editor-icon-action" type="button" onClick={closeFind} aria-label="Close Find" title="Close Find"><CloseIcon /></button>}</div>{isReplaceOpen && <div id="editor-replace-row" className="editor-find-row editor-replace-row"><label htmlFor="editor-replace-input">Replace</label><input id="editor-replace-input" value={replaceTerm} onChange={(event) => { setReplaceTerm(event.target.value); setMessage('') }} onKeyDown={handleFindKeyDown} placeholder="Replacement text" aria-label="Replacement text" /><button className="editor-replace-button" type="button" onClick={replaceCurrent}>Replace</button><button className="editor-replace-button" type="button" onClick={replaceAll}>Replace All</button><label className="editor-case-toggle"><input type="checkbox" checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.target.checked); setFindIndex(0) }} /> Case sensitive</label>{hideReplaceToggle}<button className="editor-icon-action" type="button" onClick={closeFind} aria-label="Close Find and Replace" title="Close Find and Replace"><CloseIcon /></button></div>}</div>}{activeTab?.loading ? <p className="projects-message">Loading file...</p> : error ? <><p className="projects-error" role="alert">{error}</p><button type="button" onClick={() => loadFile(activeFile, true)} disabled={!activeFile || activeTab?.loading}>Retry</button></> : activeTab && <div className="editor-code-layout"><div className="editor-line-gutter" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div><div className="editor-code-wrap"><pre className="editor-highlight" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightedCode }} /><textarea ref={editorInputRef} className="editor-textarea" value={activeTab.content} onChange={(event) => { updateContent(event.target.value); updateCursorPosition(event.currentTarget) }} onSelect={(event) => updateCursorPosition(event.currentTarget)} onKeyUp={(event) => updateCursorPosition(event.currentTarget)} onKeyDown={handleEditorKeyDown} onScroll={syncScroll} spellCheck="false" aria-label={'Editing ' + activeFile.path} /></div></div>}</div>}
  </section>
}

export default CodeEditor
