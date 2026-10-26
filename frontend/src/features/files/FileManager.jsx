import { useEffect, useRef, useState } from 'react'
import { createFile, createFolder, deleteItem, fetchFiles, getDownloadUrl, isEditableFile, renameItem, uploadFiles } from './filesApi'

function EditIcon() {
  return <svg className="file-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 16.5-.8 3.3 3.3-.8L18 7.5 15.5 5z" /><path d="m14.5 6 2.5 2.5M4 20h16" /></svg>
}

function TrashIcon() {
  return <svg className="file-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
}

function UploadIcon() {
  return <svg className="file-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
}

function DownloadIcon() {
  return <svg className="file-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
}

function OpenFolderIcon() {
  return <svg className="file-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h5l1.5 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M8 13h8M13 10l3 3-3 3" /></svg>
}

function FileManager({ project, onOpenFile }) {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [creationType, setCreationType] = useState('')
  const [creationName, setCreationName] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [deletingItem, setDeletingItem] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    setCurrentPath('')
    setEditingItem(null)
    setDeletingItem(null)
  }, [project])

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setError('')

    fetchFiles(project, currentPath)
      .then((data) => {
        if (isCurrent) setItems(data.items)
      })
      .catch((requestError) => {
        if (isCurrent) setError(requestError.message)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [project, currentPath, refreshKey])

  async function handleCreate(event) {
    event.preventDefault()
    if (!creationName.trim() || !creationType) return

    setError('')
    try {
      if (creationType === 'file') await createFile(project, currentPath, creationName)
      else await createFolder(project, currentPath, creationName)
      setCreationName('')
      setCreationType('')
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleRename(event) {
    event.preventDefault()
    if (!editingItem || !editingName.trim()) return

    setError('')
    try {
      await renameItem(project, currentPath, editingItem.name, editingName)
      setEditingItem(null)
      setEditingName('')
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleDelete() {
    if (!deletingItem) return

    setError('')
    try {
      await deleteItem(project, currentPath, deletingItem.name)
      setDeletingItem(null)
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleUpload(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return

    setError('')
    setUploadStatus('Uploading ' + files.length + (files.length === 1 ? ' file...' : ' files...'))
    try {
      const result = await uploadFiles(project, currentPath, files)
      setUploadStatus(result.uploaded.length + (result.uploaded.length === 1 ? ' file uploaded successfully.' : ' files uploaded successfully.'))
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      const details = requestError.details
      const failedCount = details?.failed?.length || files.length
      setUploadStatus('')
      setError(requestError.message + (failedCount ? ' ' + failedCount + (failedCount === 1 ? ' file failed.' : ' files failed.') : ''))
      if (details?.uploaded?.length) setRefreshKey((current) => current + 1)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function openFolder(name) {
    setCurrentPath(currentPath ? currentPath + '/' + name : name)
  }

  function openFile(item) {
    if (isEditableFile(item.name)) {
      onOpenFile?.({ name: item.name, path: currentPath ? currentPath + '/' + item.name : item.name })
    } else {
      setError('This file cannot be edited as text.')
    }
  }

  function goToPath(path) {
    setCurrentPath(path)
  }

  function startRename(item) {
    setDeletingItem(null)
    setEditingItem(item)
    setEditingName(item.name)
  }

  const pathParts = currentPath ? currentPath.split('/') : []

  function renderItem(item) {
    if (editingItem?.name === item.name && editingItem.type === item.type) {
      return <form className="file-item file-item-editing" key={item.name} onSubmit={handleRename}><input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditingItem(null) }} aria-label={'Rename ' + item.name} /><button type="submit">Save</button><button type="button" onClick={() => setEditingItem(null)}>Cancel</button></form>
    }

    return <div className="file-item-row" key={item.name}><button className={'file-item file-item-main' + (item.type === 'folder' ? ' file-item--folder' : '') + (item.type === 'file' ? ' file-item--editable' : '')} type="button" onClick={() => item.type === 'folder' ? openFolder(item.name) : openFile(item)} aria-label={item.type === 'folder' ? 'Open folder ' + item.name : isEditableFile(item.name) ? 'Edit ' + item.name : item.name} title={item.type === 'folder' ? 'Open folder' : isEditableFile(item.name) ? 'Open in editor' : 'Unsupported text file'}><span className="file-kind-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{item.type === 'folder' ? <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h5l1.5 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" /> : <><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4" /></>}</svg></span><span className="file-item-name">{item.name}</span>{item.type === 'folder' && <span className="file-folder-affordance" aria-hidden="true">›</span>}</button><div className="file-item-actions">{item.type === 'folder' && <button className="file-open-action" type="button" onClick={() => openFolder(item.name)} aria-label={'Open folder ' + item.name}><OpenFolderIcon /><span>Open Folder</span></button>}{item.type === 'file' && isEditableFile(item.name) && <button className="file-icon-action" type="button" onClick={() => openFile(item)} aria-label={'Edit ' + item.name} title="Edit"><EditIcon /></button>}{item.type === 'file' && <a className="file-icon-action" href={getDownloadUrl(project, currentPath, item.name)} aria-label={'Download ' + item.name} title="Download"><DownloadIcon /></a>}<button className="file-icon-action" type="button" onClick={() => startRename(item)} aria-label={'Rename ' + item.name} title="Rename"><EditIcon /></button><button className="file-icon-action file-delete-action" type="button" onClick={() => { setEditingItem(null); setDeletingItem(item) }} aria-label={'Delete ' + item.name} title="Delete"><TrashIcon /></button></div></div>
  }

  return <section className="file-manager" aria-labelledby="files-title">
    <div className="file-manager-heading"><div><p className="eyebrow">Files</p><h2 id="files-title">Project files</h2></div><div className="file-manager-actions"><input ref={fileInputRef} className="file-upload-input" type="file" multiple onChange={(event) => handleUpload(event.target.files)} /><button className="file-upload-button" type="button" onClick={() => fileInputRef.current?.click()}><UploadIcon /> Upload Files</button><button type="button" onClick={() => { setCreationType('file'); setCreationName('') }}>+ New File</button><button type="button" onClick={() => { setCreationType('folder'); setCreationName('') }}>+ New Folder</button></div></div>
    {creationType && <form className="file-create-form" onSubmit={handleCreate}><label htmlFor="file-create-name">New {creationType === 'file' ? 'File' : 'Folder'}</label><input id="file-create-name" value={creationName} onChange={(event) => setCreationName(event.target.value)} placeholder={creationType === 'file' ? 'filename.txt' : 'folder-name'} autoFocus /><div><button type="button" onClick={() => setCreationType('')}>Cancel</button><button type="submit" disabled={!creationName.trim()}>Create {creationType === 'file' ? 'File' : 'Folder'}</button></div></form>}
    <nav className="file-breadcrumbs" aria-label="File path"><button type="button" onClick={() => goToPath('')}>{project}</button>{pathParts.map((part, index) => <span key={part + index}><span aria-hidden="true"> / </span><button type="button" onClick={() => goToPath(pathParts.slice(0, index + 1).join('/'))}>{part}</button></span>)}</nav>
    {currentPath && <button className="file-parent-button" type="button" onClick={() => goToPath(pathParts.slice(0, -1).join('/'))}>← Parent folder</button>}
    {error && <p className="projects-error" role="alert">{error}</p>}
    {deletingItem && <div className="file-delete-confirm" role="alertdialog" aria-labelledby="delete-title"><strong id="delete-title">Delete {deletingItem.type}?</strong><p>Are you sure you want to delete “{deletingItem.name}”?{deletingItem.type === 'folder' ? ' Its contents will also be deleted.' : ''}</p><div><button type="button" onClick={() => setDeletingItem(null)}>Cancel</button><button className="file-confirm-delete" type="button" onClick={handleDelete}>Delete</button></div></div>}
    {uploadStatus && <p className="file-upload-status" role="status">{uploadStatus}</p>}
    {isLoading ? <p className="projects-message">Loading files...</p> : items.length === 0 ? <div className={'file-empty-state' + (isDragging ? ' file-drop-active' : '')} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleUpload(event.dataTransfer.files) }}><p>{isDragging ? 'Drop files here to upload' : 'This folder is empty'}</p><span>Upload or create a file or folder to get started.</span><div><button type="button" onClick={() => fileInputRef.current?.click()}><UploadIcon /> Upload Files</button><button type="button" onClick={() => { setCreationType('file'); setCreationName('') }}>+ New File</button><button type="button" onClick={() => { setCreationType('folder'); setCreationName('') }}>+ New Folder</button></div></div> : <div className={'file-list file-drop-zone' + (isDragging ? ' file-drop-active' : '')} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleUpload(event.dataTransfer.files) }}>{items.map(renderItem)}</div>}
  </section>
}

export default FileManager
