import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createProject, deleteProject, fetchProjects } from './projectsApi'
import FileManager from '../files/FileManager'
import CodeEditor from '../editor/CodeEditor'
import { searchProject } from '../files/filesApi'
import { clearCursorTargetAfterFailure, consumeTerminalFileRequest } from '../../components/terminalFileRequest'

function highlightSearchText(text, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return text

  const normalizedText = text.toLowerCase()
  const parts = []
  let cursor = 0
  let matchIndex = normalizedText.indexOf(normalizedQuery, cursor)
  while (matchIndex !== -1) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex))
    parts.push(<mark className="project-search-match" key={`${matchIndex}:${normalizedQuery}`}>{text.slice(matchIndex, matchIndex + normalizedQuery.length)}</mark>)
    cursor = matchIndex + normalizedQuery.length
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor)
  }
  if (!parts.length) return text
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function Projects({ activeProject = '', workspaceView = 'Projects', gitFileChanges, terminalFileRequest, onProjectOpen, onProjectClose }) {
  const [projects, setProjects] = useState([])
  const [projectName, setProjectName] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [editorFiles, setEditorFiles] = useState([])
  const [activeEditorPath, setActiveEditorPath] = useState('')
  const [editorCursorTarget, setEditorCursorTarget] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [completedSearchQuery, setCompletedSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedSearchResult, setSelectedSearchResult] = useState(null)
  const searchInputRef = useRef(null)
  const searchResultRefs = useRef([])
  const searchRequestId = useRef(0)
  const focusRestoredSearchResult = useRef(false)
  const consumedTerminalFileRequestId = useRef(null)

  useEffect(() => {
    if (workspaceView === 'Files') setIsEditorOpen(false)
    if (workspaceView === 'Editor') setIsEditorOpen(true)
  }, [workspaceView])

  async function loadProjects() {
    setIsLoading(true)
    setError('')
    try {
      setProjects(await fetchProjects())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    searchRequestId.current += 1
    setSearchQuery('')
    setCompletedSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
    setHasSearched(false)
    setSelectedSearchResult(null)
  }, [activeProject])

  async function runSearch(project, query, selectionToRestore = null) {
    if (!project || !query) return
    const requestId = ++searchRequestId.current
    focusRestoredSearchResult.current = false
    setIsSearching(true)
    setError('')
    setCompletedSearchQuery('')
    setSearchResults([])
    setHasSearched(true)
    setSelectedSearchResult(null)
    try {
      const results = await searchProject(project, query)
      if (requestId === searchRequestId.current) {
        setSearchResults(results)
        setCompletedSearchQuery(query)
        if (selectionToRestore) {
          const restoredIndex = results.findIndex((result) => result.path === selectionToRestore.path && result.line === selectionToRestore.line)
          if (restoredIndex !== -1) {
            setSelectedSearchResult(restoredIndex)
            focusRestoredSearchResult.current = selectionToRestore.shouldRestoreFocus
          }
        }
      }
    } catch (requestError) {
      if (requestId === searchRequestId.current) setError(requestError.message)
    } finally {
      if (requestId === searchRequestId.current) setIsSearching(false)
    }
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!activeProject || !searchQuery.trim()) return
    setSelectedSearchResult(null)
    runSearch(activeProject, searchQuery.trim())
  }

  function handleClearSearch() {
    searchRequestId.current += 1
    setSearchQuery('')
    setCompletedSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
    setHasSearched(false)
    setSelectedSearchResult(null)
    setError('')
    searchInputRef.current?.focus()
  }

  function handleEditorSaveSuccess(project) {
    if (project !== activeProject || !hasSearched || !completedSearchQuery) return
    const selectedResult = selectedSearchResult === null ? null : searchResults[selectedSearchResult]
    const resultListHasFocus = selectedResult && searchResultRefs.current[selectedSearchResult] === document.activeElement
    runSearch(activeProject, completedSearchQuery, selectedResult ? {
      path: selectedResult.path,
      line: selectedResult.line,
      shouldRestoreFocus: Boolean(resultListHasFocus),
    } : null)
  }

  useEffect(() => {
    if (!searchResults.length) {
      setSelectedSearchResult(null)
      return
    }
    setSelectedSearchResult((current) => current === null ? null : Math.min(current, searchResults.length - 1))
  }, [searchResults.length])

  useEffect(() => {
    if (selectedSearchResult === null) return
    if (!focusRestoredSearchResult.current) return
    const resultButton = searchResultRefs.current[selectedSearchResult]
    resultButton?.focus({ preventScroll: true })
    resultButton?.scrollIntoView({ block: 'nearest' })
    focusRestoredSearchResult.current = false
  }, [selectedSearchResult])

  async function handleCreate(event) {
    event.preventDefault()
    if (!projectName.trim()) return

    setError('')
    try {
      const project = await createProject(projectName)
      setProjects((current) => [...current, project])
      setProjectName('')
      setSelectedProject(project.name)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleDelete(name) {
    setError('')
    try {
      await deleteProject(name)
      setProjects((current) => current.filter((project) => project.name !== name))
      if (selectedProject === name) setSelectedProject('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function handleOpen(name) {
    setSelectedProject(name)
    onProjectOpen?.(name)
    window.localStorage.setItem('ai-workstation-open-project', name)
    setEditorFiles([])
    setActiveEditorPath('')
    setIsEditorOpen(false)
  }

  function handleOpenFile(file, line, column, requestId) {
    setEditorFiles((current) => current.some((item) => item.path === file.path) ? current : [...current, file])
    setActiveEditorPath(file.path)
    setEditorCursorTarget(line ? { project: activeProject, path: file.path, line, column, ...(requestId === undefined ? {} : { requestId }) } : null)
    setIsEditorOpen(true)
  }

  function handleEditorFileLoadError(failedTarget) {
    setEditorCursorTarget((current) => clearCursorTargetAfterFailure(current, failedTarget))
  }

  function openSearchResult(result, index) {
    setSelectedSearchResult(index)
    handleOpenFile({ name: result.path.split('/').pop(), path: result.path }, result.line)
  }

  function handleSearchResultKeyDown(event, index) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const nextIndex = event.key === 'ArrowDown'
      ? Math.min(index + 1, searchResults.length - 1)
      : Math.max(index - 1, 0)
    setSelectedSearchResult(nextIndex)
    const nextResultButton = searchResultRefs.current[nextIndex]
    nextResultButton?.focus({ preventScroll: true })
    nextResultButton?.scrollIntoView({ block: 'nearest' })
  }

  useLayoutEffect(() => {
    const consumption = consumeTerminalFileRequest(terminalFileRequest, activeProject, consumedTerminalFileRequestId.current)
    if (!consumption.shouldConsume) return
    consumedTerminalFileRequestId.current = consumption.consumedId
    handleOpenFile({ name: terminalFileRequest.path.split('/').pop(), path: terminalFileRequest.path }, terminalFileRequest.line, terminalFileRequest.column, terminalFileRequest.id)
  }, [terminalFileRequest?.id, activeProject])

  function handleCloseFile(path, nextPath) {
    setEditorFiles((current) => current.filter((file) => file.path !== path))
    setActiveEditorPath((current) => current === path ? nextPath || editorFiles.find((file) => file.path !== path)?.path || '' : current)
  }

  const searchResultGroups = searchResults.reduce((groups, result, index) => {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup?.path === result.path) lastGroup.results.push({ result, index })
    else groups.push({ path: result.path, results: [{ result, index }] })
    return groups
  }, [])

  if (activeProject) {
    return <section className={'projects-panel project-workspace' + (isEditorOpen ? ' project-workspace--editor' : '')} aria-labelledby="project-workspace-title">
      <button className="back-to-projects" type="button" onClick={() => onProjectClose?.()}>← Back to Projects</button>
      <p className="eyebrow">Project workspace</p>
      <h1 id="project-workspace-title">Project: {activeProject}</h1>
      {activeProject && <div className="workspace-search-scope">Search in: {activeProject}</div>}
      <form className="project-search-form" onSubmit={handleSearch}><input ref={searchInputRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search project files" aria-label="Search project files" />{searchQuery.trim() && <button className="project-search-clear" type="button" onClick={handleClearSearch} aria-label="Clear search">×</button>}<button type="submit" disabled={isSearching || !searchQuery.trim()}>{isSearching ? 'Searching…' : 'Search'}</button></form>{error && <p className="projects-error" role="alert">{error}</p>}{hasSearched && !isSearching && !error && searchResults.length > 0 && <p className="project-search-count" role="status">{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} · "{completedSearchQuery}"</p>}{searchResults.length > 0 && <div className="project-search-results" aria-label="Project search results">{searchResultGroups.map((group) => <div className="project-search-file-group" key={group.path}><h2>{group.path} <span className="project-search-file-count">· {group.results.length} {group.results.length === 1 ? 'match' : 'matches'}</span></h2>{group.results.map(({ result, index }) => <button ref={(element) => { searchResultRefs.current[index] = element }} type="button" className={'project-search-result' + (selectedSearchResult === index ? ' project-search-result--selected' : '')} key={`${result.path}:${result.line}:${index}`} onFocus={() => setSelectedSearchResult(index)} onKeyDown={(event) => handleSearchResultKeyDown(event, index)} onClick={() => openSearchResult(result, index)}><strong>Line {result.line}</strong><div className="project-search-context">{(result.context || [{ line: result.line, text: result.preview }]).map((contextLine) => <span className={contextLine.line === result.line ? 'project-search-context-line project-search-context-line--match' : 'project-search-context-line'} key={contextLine.line}><em>{contextLine.line}</em><span>{highlightSearchText(contextLine.text, searchQuery)}</span></span>)}</div></button>)}</div>)}</div>}{hasSearched && !isSearching && !error && searchResults.length === 0 && <p className="project-workspace-message">No matches found for "{completedSearchQuery}".</p>}{isEditorOpen ? <CodeEditor project={activeProject} files={editorFiles} activePath={activeEditorPath} gitFileChanges={gitFileChanges} editorCursorTarget={editorCursorTarget} onSelectFile={setActiveEditorPath} onCloseFile={handleCloseFile} onBack={() => setIsEditorOpen(false)} onSaveSuccess={handleEditorSaveSuccess} onFileLoadError={handleEditorFileLoadError} /> : <FileManager project={activeProject} onOpenFile={handleOpenFile} />}
    </section>
  }

  return <section className="projects-panel" aria-labelledby="projects-title">
    <div className="projects-heading"><div><p className="eyebrow">Projects</p><h1 id="projects-title">Workspace projects</h1></div><span className="projects-count">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span></div>
    <form className="project-create-form" onSubmit={handleCreate}><input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" aria-label="Project name" /><button type="submit" disabled={!projectName.trim()}>Create Project</button></form>
    {error && <p className="projects-error" role="alert">{error}</p>}
    {isLoading ? <p className="projects-message">Loading projects...</p> : projects.length === 0 ? <div className="projects-empty"><p>No projects yet.</p><span>Create a project to get started.</span></div> : <div className="project-list">{projects.map((project) => <div className="project-card" key={project.name}><div><strong>{project.name}</strong>{selectedProject === project.name && <span className="selected-label">Selected</span>}</div><div className="project-actions"><button type="button" onClick={() => handleOpen(project.name)}>Open</button><button className="project-delete" type="button" onClick={() => handleDelete(project.name)}>Delete</button></div></div>)}</div>}
    {selectedProject && <p className="selected-project">Selected project: <strong>{selectedProject}</strong></p>}
  </section>
}

export default Projects
