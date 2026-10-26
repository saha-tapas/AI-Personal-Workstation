import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyGitStash, commitGitChanges, createGitBranch, createGitStash, dropGitStash, fetchGitBranches, fetchGitCommitDetails, fetchGitCommitDiff, fetchGitDiff, fetchGitFileHistory, fetchGitFileHistoryDiff, fetchGitHistory, fetchGitStashDetails, fetchGitStashes, fetchGitStatus, stageAllGitFiles, stageGitFile, switchGitBranch, unstageAllGitFiles, unstageGitFile } from './gitApi'

function FileGroup({ title, files }) {
  return <section className="git-file-group"><h3>{title}<span>{files.length}</span></h3>{files.length ? <ul>{files.map((file) => <li key={file}>{file}</li>)}</ul> : <p className="git-empty-list">None</p>}</section>
}

function Git({ project, scrollContainerRef, onGitFilesChanged }) {
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [changes, setChanges] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [diff, setDiff] = useState(null)
  const [action, setAction] = useState('')
  const [notice, setNotice] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [branchData, setBranchData] = useState(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchError, setBranchError] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchAction, setBranchAction] = useState('')
  const [commitDetails, setCommitDetails] = useState(null)
  const [commitFile, setCommitFile] = useState('')
  const [commitDiff, setCommitDiff] = useState(null)
  const [commitDetailsLoading, setCommitDetailsLoading] = useState(false)
  const [commitDetailsError, setCommitDetailsError] = useState('')
  const [fileHistory, setFileHistory] = useState(null)
  const [fileHistoryCommit, setFileHistoryCommit] = useState(null)
  const [fileHistoryDiff, setFileHistoryDiff] = useState(null)
  const [fileHistoryLoading, setFileHistoryLoading] = useState(false)
  const [fileHistoryError, setFileHistoryError] = useState('')
  const [stashes, setStashes] = useState(null)
  const [stashesLoading, setStashesLoading] = useState(false)
  const [stashesError, setStashesError] = useState('')
  const [stashMessage, setStashMessage] = useState('')
  const [stashAction, setStashAction] = useState('')
  const [stashDetails, setStashDetails] = useState(null)
  const preservedScrollRef = useRef(null)

  useLayoutEffect(() => {
    const preservedScroll = preservedScrollRef.current
    const scrollContainer = scrollContainerRef?.current
    if (!preservedScroll || !scrollContainer || !diff) return
    scrollContainer.scrollTop = preservedScroll.top
    scrollContainer.scrollLeft = preservedScroll.left
    preservedScrollRef.current = null
  }, [commitDiff, diff, fileHistoryDiff, selectedFile, scrollContainerRef])

  const loadStatus = useCallback(async ({ preserveSelection = false } = {}) => {
    if (!project) return
    setIsLoading(true)
    setError('')
    try {
      const nextStatus = await fetchGitStatus(project)
      setStatus(nextStatus)
      let nextChanges = null
      if (nextStatus.isRepository) {
        try {
          nextChanges = await fetchGitDiff(project)
          setChanges({ ...nextChanges, files: Array.isArray(nextChanges.files) ? nextChanges.files : [] })
        } catch (diffError) {
          setChanges({ files: [], error: diffError.message })
        }
      } else setChanges(null)
      if (!preserveSelection) {
        setSelectedFile(null)
        setDiff(null)
      }
      return nextChanges?.files || []
    } catch (requestError) {
      setStatus(null)
      setChanges(null)
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }, [project])

  const loadHistory = useCallback(async () => {
    if (!project) return
    setHistoryLoading(true)
    setHistoryError('')
    try {
      setHistory(await fetchGitHistory(project))
    } catch (requestError) {
      setHistory(null)
      setHistoryError(requestError.message)
    } finally {
      setHistoryLoading(false)
    }
  }, [project])

  const loadBranches = useCallback(async () => {
    if (!project) return
    setBranchLoading(true)
    setBranchError('')
    try { setBranchData(await fetchGitBranches(project)) } catch (requestError) { setBranchData(null); setBranchError(requestError.message) } finally { setBranchLoading(false) }
  }, [project])

  const loadStashes = useCallback(async () => {
    if (!project) return
    setStashesLoading(true)
    setStashesError('')
    try {
      const nextStashes = await fetchGitStashes(project)
      setStashes(nextStashes)
      return nextStashes
    } catch (requestError) { setStashes(null); setStashesError(requestError.message); throw requestError } finally { setStashesLoading(false) }
  }, [project])

  useEffect(() => {
    setStatus(null)
    setChanges(null)
    setSelectedFile(null)
    setDiff(null)
    setHistory(null)
    setHistoryError('')
    setBranchData(null)
    setBranchError('')
    setStashes(null)
    setStashesError('')
    setStashDetails(null)
    setError('')
    loadStatus()
    loadHistory()
    loadBranches()
    loadStashes()
  }, [loadBranches, loadHistory, loadStashes, loadStatus])

  const runStashAction = async (kind, index) => {
    if (stashAction) return
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setStashAction(kind)
    setStashesError('')
    try {
      if (kind === 'create') await createGitStash(project, stashMessage)
      else if (kind === 'apply') { if (!window.confirm('Apply this stash? Git may refuse if local changes conflict; no changes will be discarded.')) return; await applyGitStash(project, index) }
      else if (kind === 'drop') { if (!window.confirm('Drop this stash? This removes the saved stash permanently.')) return; await dropGitStash(project, index) }
      if (kind === 'create') {
        setStashMessage('')
        setStashesError('')
        setNotice('Stash created successfully.')
      }
      let changedFiles = []
      if (kind !== 'drop') changedFiles = await loadStatus({ preserveSelection: true })
      if (kind === 'apply') {
        if (selectedFile) setDiff(await fetchGitDiff(project, selectedFile))
        onGitFilesChanged?.({ project, paths: changedFiles.map((file) => file.path) })
      }
      await loadStashes()
      if (kind !== 'create') setNotice(kind === 'apply' ? 'Stash applied.' : 'Stash dropped.')
    } catch (requestError) {
      setStashesError(requestError.message)
    } finally { setStashAction('') }
  }

  const openStashDetails = async (index) => {
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setStashAction('view')
    setStashesError('')
    try { setStashDetails((await fetchGitStashDetails(project, index)).stash) } catch (requestError) { setStashesError(requestError.message) } finally { setStashAction('') }
  }

  const selectFile = async (file) => {
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setSelectedFile(file.path)
    setDiff(null)
    try {
      setDiff(await fetchGitDiff(project, file.path))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const runStageAction = async (actionName, filePath) => {
    if (action) return
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setAction(actionName)
    setNotice('')
    try {
      if (actionName === 'stage-all') await stageAllGitFiles(project)
      else if (actionName === 'unstage-all') await unstageAllGitFiles(project)
      else if (actionName === 'stage') await stageGitFile(project, filePath)
      else await unstageGitFile(project, filePath)
      await loadStatus({ preserveSelection: true })
      await loadHistory()
      if (selectedFile) setDiff(await fetchGitDiff(project, selectedFile))
      setNotice('Git changes updated.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAction('')
    }
  }

  const commitChanges = async (event) => {
    event.preventDefault()
    if (!commitMessage.trim() || action || !changes?.files.some((file) => file.staged)) return
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setAction('commit')
    setNotice('')
    try {
      const result = await commitGitChanges(project, commitMessage)
      setCommitMessage('')
      await loadStatus({ preserveSelection: true })
      if (selectedFile) setDiff(await fetchGitDiff(project, selectedFile))
      setNotice(`Committed successfully: ${result.hash.slice(0, 7)}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAction('')
    }
  }

  const createBranch = async (event) => {
    event.preventDefault()
    if (!branchName.trim() || branchAction) return
    setBranchAction('create')
    setBranchError('')
    try { await createGitBranch(project, branchName); setBranchName(''); await loadBranches() } catch (requestError) { setBranchError(requestError.message) } finally { setBranchAction('') }
  }

  const switchBranch = async (name) => {
    if (branchAction) return
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setBranchAction(name)
    setBranchError('')
    try {
      await switchGitBranch(project, name)
      await Promise.all([loadBranches(), loadStatus({ preserveSelection: true }), loadHistory()])
      if (selectedFile) setDiff(await fetchGitDiff(project, selectedFile))
    } catch (requestError) { setBranchError(requestError.message) } finally { setBranchAction('') }
  }

  const selectCommit = async (hash) => {
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setCommitDetailsLoading(true)
    setCommitDetailsError('')
    setCommitFile('')
    try {
      const details = await fetchGitCommitDetails(project, hash)
      setCommitDetails(details.commit)
      setCommitDiff(await fetchGitCommitDiff(project, hash))
    } catch (requestError) {
      setCommitDetails(null)
      setCommitDiff(null)
      setCommitDetailsError(requestError.message)
    } finally { setCommitDetailsLoading(false) }
  }

  const selectCommitFile = async (filePath) => {
    setCommitFile(filePath)
    try { setCommitDiff(await fetchGitCommitDiff(project, commitDetails.hash, filePath)) } catch (requestError) { setCommitDetailsError(requestError.message) }
  }

  const openFileHistory = async (filePath) => {
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setFileHistoryLoading(true)
    setFileHistoryError('')
    setFileHistoryCommit(null)
    setFileHistoryDiff(null)
    try { setFileHistory(await fetchGitFileHistory(project, filePath)) } catch (requestError) { setFileHistory(null); setFileHistoryError(requestError.message) } finally { setFileHistoryLoading(false) }
  }

  const selectFileHistoryCommit = async (commit) => {
    if (scrollContainerRef?.current) preservedScrollRef.current = { top: scrollContainerRef.current.scrollTop, left: scrollContainerRef.current.scrollLeft }
    setFileHistoryCommit(commit)
    setFileHistoryError('')
    try { setFileHistoryDiff(await fetchGitFileHistoryDiff(project, fileHistory.path, commit.hash)) } catch (requestError) { setFileHistoryError(requestError.message) }
  }

  if (!project) return <section className="git-panel"><p className="eyebrow">Git</p><h1>Git status</h1><p className="git-empty-state">Open a project to inspect its local Git status.</p></section>

  const changedFiles = changes?.files || []
  const hasUnstagedChanges = changedFiles.some((file) => file.unstaged || file.status === 'untracked')
  const hasStagedChanges = changedFiles.some((file) => file.staged)

  return <section className="git-panel" aria-labelledby="git-title">
    <div className="git-heading"><div><p className="eyebrow">Git</p><h1 id="git-title">Project: {project}</h1></div><button className="git-refresh" type="button" onClick={loadStatus} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</button></div>
    {isLoading && !status ? <p className="git-message">Reading Git status...</p> : error ? <p className="git-error" role="alert">{error}</p> : !status?.isRepository ? <p className="git-empty-state">This project is not a Git repository.</p> : <>
      <div className="git-summary"><span>Branch: <strong>{status.branch || 'Detached HEAD'}</strong></span><span className={status.clean ? 'git-clean' : 'git-changed'}>{status.clean ? 'Clean' : 'Changes present'}</span></div>
      <div className="git-groups"><FileGroup title="Staged" files={status.staged} /><FileGroup title="Modified" files={status.modified} /><FileGroup title="Deleted" files={status.deleted} /><FileGroup title="Renamed" files={status.renamed} /><FileGroup title="Untracked" files={status.untracked} /></div>
      <section className="git-changes">
        <div className="git-changes-heading"><h2>Changes</h2>{changedFiles.length > 0 && <div className="git-stage-actions">{hasUnstagedChanges && <button type="button" onClick={() => runStageAction('stage-all')} disabled={Boolean(action)}>Stage All</button>}{hasStagedChanges && <button type="button" onClick={() => runStageAction('unstage-all')} disabled={Boolean(action)}>Unstage All</button>}</div>}</div>
        {notice && <p className="git-action-notice" role="status">{notice}</p>}
        <form className="git-commit-form" onSubmit={commitChanges}><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message" aria-label="Commit message" disabled={action === 'commit'} /><button type="submit" disabled={!commitMessage.trim() || Boolean(action) || !changes?.files.some((file) => file.staged)}>{action === 'commit' ? 'Committing...' : 'Commit'}</button></form>
        {changes?.error && <p className="git-error" role="alert">{changes.error}</p>}
        {changes?.files.length ? <ul>{changes.files.map((file) => <li key={`${file.status}-${file.path}`} className="git-change-item">
          <button className={selectedFile === file.path ? 'git-change-button git-change-button--selected' : 'git-change-button'} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectFile(file)}>
            {file.status} — {file.path} ({file.staged ? 'Staged' : ''}{file.staged && file.unstaged ? ', ' : ''}{file.unstaged ? 'Unstaged' : ''}{file.status === 'untracked' ? 'No normal diff yet' : ''})
          </button>
          <div className="git-file-actions">{file.status !== 'untracked' && <button type="button" title="View file history" aria-label={`View file history for ${file.path}`} onMouseDown={(event) => event.preventDefault()} onClick={() => openFileHistory(file.path)}>File History</button>}{file.unstaged && <button type="button" onClick={() => runStageAction('stage', file.path)} disabled={Boolean(action)}>Stage</button>}{file.staged && <button type="button" onClick={() => runStageAction('unstage', file.path)} disabled={Boolean(action)}>Unstage</button>}</div>
        </li>)}</ul> : !changes?.error && <p className="git-empty-list">No changes</p>}
        {selectedFile && diff && <><h2>Diff: {selectedFile}</h2>{diff.staged && <><h3>Staged</h3><pre>{diff.diff.staged || 'No staged changes.'}</pre></>}{diff.unstaged && <><h3>Unstaged</h3><pre>{diff.diff.unstaged || 'No unstaged changes.'}</pre></>}</>}
      </section>
      <section className="git-stashes" aria-labelledby="git-stashes-title">
        <div className="git-history-heading"><h2 id="git-stashes-title">Stashes</h2><button type="button" onClick={loadStashes} disabled={stashesLoading}>{stashesLoading ? 'Refreshing...' : 'Refresh'}</button></div>
        <form className="git-stash-form" onSubmit={(event) => { event.preventDefault(); runStashAction('create') }}><input value={stashMessage} onChange={(event) => setStashMessage(event.target.value)} placeholder="Optional stash message" aria-label="Optional stash message" disabled={Boolean(stashAction)} /><button type="submit" disabled={Boolean(stashAction)}>{stashAction === 'create' ? 'Stashing...' : 'Create Stash'}</button></form>
        {stashesError && <p className="git-error" role="alert">{stashesError}</p>}
        {!stashes?.isRepository ? <p className="git-empty-state">This project is not a Git repository.</p> : !stashes.stashes.length ? <p className="git-empty-list">No stashes yet.</p> : <ul className="git-stash-list">{stashes.stashes.map((stash) => <li key={stash.reference}><div><strong>{stash.reference}</strong><span>{stash.message}</span><small>{new Date(stash.date).toLocaleString()}</small></div><div className="git-file-actions"><button type="button" onClick={() => openStashDetails(stash.index)} disabled={Boolean(stashAction)}>View</button><button type="button" onClick={() => runStashAction('apply', stash.index)} disabled={Boolean(stashAction)}>Apply</button><button type="button" onClick={() => runStashAction('drop', stash.index)} disabled={Boolean(stashAction)}>Drop</button></div></li>)}</ul>}
        {stashDetails && <section className="git-stash-details" aria-labelledby="git-stash-details-title"><div className="git-history-heading"><h3 id="git-stash-details-title">{stashDetails.reference} · {stashDetails.message}</h3><button type="button" onClick={() => setStashDetails(null)}>Back to Stashes</button></div><p>{new Date(stashDetails.date).toLocaleString()}</p><pre>{stashDetails.diff || 'No diff available.'}</pre></section>}
      </section>
      <section className="git-history" aria-labelledby="git-history-title"><div className="git-history-heading"><h2 id="git-history-title">Commit History</h2><button type="button" onClick={loadHistory} disabled={historyLoading}>{historyLoading ? 'Refreshing...' : 'Refresh'}</button></div>{historyError ? <p className="git-error" role="alert">{historyError}</p> : historyLoading && !history ? <p className="git-message">Reading commit history...</p> : !history?.isRepository ? <p className="git-empty-state">This project is not a Git repository.</p> : !history.commits.length ? <p className="git-empty-list">No commits yet.</p> : <ul className="git-history-list">{history.commits.map((commit) => <li key={commit.hash} title={commit.hash}><button className="git-history-item" type="button" onClick={() => selectCommit(commit.hash)}><strong>{commit.shortHash}</strong><span className="git-history-message">{commit.message}</span><span className="git-history-meta">{commit.authorName} · {new Date(commit.date).toLocaleString()}</span></button></li>)}</ul>}</section>
      {commitDetailsLoading && <p className="git-message">Reading commit details...</p>}{commitDetailsError && <p className="git-error" role="alert">{commitDetailsError}</p>}{commitDetails && <section className="git-commit-details" aria-labelledby="git-commit-details-title"><div className="git-history-heading"><h2 id="git-commit-details-title">{commitDetails.shortHash} · {commitDetails.message}</h2><button type="button" onClick={() => { setCommitDetails(null); setCommitDiff(null); setCommitFile('') }}>Back to History</button></div><dl><dt>Full hash</dt><dd>{commitDetails.hash}</dd><dt>Author</dt><dd>{commitDetails.authorName} · {commitDetails.authorEmail}</dd><dt>Date</dt><dd>{new Date(commitDetails.date).toLocaleString()}</dd></dl><h3>Changed Files</h3><ul className="git-commit-file-list"><li><button type="button" className={!commitFile ? 'git-commit-file--selected' : ''} onClick={() => { setCommitFile(''); fetchGitCommitDiff(project, commitDetails.hash).then(setCommitDiff).catch((requestError) => setCommitDetailsError(requestError.message)) }}>Full Commit Diff</button></li>{commitDetails.files.map((file) => <li key={file.path}><button type="button" className={commitFile === file.path ? 'git-commit-file--selected' : ''} onClick={() => selectCommitFile(file.path)}><span>{file.path}</span><strong>{file.status}</strong></button></li>)}</ul>{commitDiff && <pre className="git-commit-diff-viewer">{commitDiff.diff || 'No diff available.'}</pre>}</section>}
      <section className="git-branches" aria-labelledby="git-branches-title"><div className="git-history-heading"><h2 id="git-branches-title">Branches</h2><button type="button" onClick={loadBranches} disabled={branchLoading}>{branchLoading ? 'Refreshing...' : 'Refresh'}</button></div>{branchError && <p className="git-error" role="alert">{branchError}</p>}{branchData?.isRepository && <><p className="git-current-branch">Current: <strong>{branchData.currentBranch || 'No branch yet'}</strong></p><form className="git-branch-form" onSubmit={createBranch}><input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="New branch name" aria-label="New branch name" disabled={Boolean(branchAction)} /><button type="submit" disabled={!branchName.trim() || Boolean(branchAction)}>{branchAction === 'create' ? 'Creating...' : 'Create'}</button></form><ul className="git-branch-list">{branchData.branches.map((branch) => <li key={branch.name}><span>{branch.name}{branch.current && <strong> Current</strong>}</span>{!branch.current && <button type="button" onClick={() => switchBranch(branch.name)} disabled={Boolean(branchAction)}>{branchAction === branch.name ? 'Switching...' : 'Switch'}</button>}</li>)}</ul></>}{branchData && !branchData.isRepository && <p className="git-empty-state">This project is not a Git repository.</p>}</section>
      {fileHistory && <section className="git-file-history" aria-labelledby="git-file-history-title"><div className="git-history-heading"><h2 id="git-file-history-title">File History: {fileHistory.path}</h2><button type="button" onClick={() => { setFileHistory(null); setFileHistoryCommit(null); setFileHistoryDiff(null) }}>Back</button></div>{fileHistoryError && <p className="git-error" role="alert">{fileHistoryError}</p>}{fileHistoryLoading ? <p className="git-message">Reading file history...</p> : !fileHistory.commits.length ? <p className="git-empty-list">No history for this file.</p> : <ul className="git-file-history-list">{fileHistory.commits.map((commit) => <li key={commit.hash}><button type="button" className={fileHistoryCommit?.hash === commit.hash ? 'git-commit-file--selected' : ''} onClick={() => selectFileHistoryCommit(commit)}><strong>{commit.shortHash}</strong><span>{commit.message}</span><small>{commit.authorName} · {new Date(commit.date).toLocaleString()}</small></button></li>)}</ul>}{fileHistoryCommit && <div className="git-file-history-detail"><h3>{fileHistoryCommit.shortHash} · {fileHistoryCommit.message}</h3><p>{fileHistoryCommit.authorName} · {fileHistoryCommit.authorEmail} · {new Date(fileHistoryCommit.date).toLocaleString()}</p>{fileHistoryDiff && <pre className="git-commit-diff-viewer">{fileHistoryDiff.diff || 'No diff available.'}</pre>}</div>}</section>}
    </>}
  </section>
}

export default Git
