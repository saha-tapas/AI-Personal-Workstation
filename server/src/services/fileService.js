const fs = require('fs/promises');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../../../workspace');
const demoWorkspaceRoot = path.resolve(__dirname, '../../../demo-data');
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
// Prevent excessive memory use while reading files for workspace search.
const MAX_SEARCH_FILE_SIZE = 2 * 1024 * 1024;
const searchableExtensions = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'md', 'txt', 'vue', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'xml', 'yaml', 'yml']);

function isDemoMode() {
  return String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
}

function getWorkspaceRoot() {
  return isDemoMode() ? demoWorkspaceRoot : workspaceRoot;
}

async function assertDemoPath(root, candidate) {
  if (!isDemoMode()) return;
  const [realRoot, realCandidate] = await Promise.all([fs.realpath(root), fs.realpath(candidate).catch(() => null)]);
  if (!realCandidate) throw new Error('Demo data path was not found.');
  const relative = path.relative(realRoot, realCandidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Demo data path must remain inside the demo data directory.');
}

function getProjectRoot(project) {
  if (typeof project !== 'string' || !project.trim()) {
    throw new Error('Project name is required.');
  }

  const projectName = project.trim();
  if (
    projectName !== project ||
    projectName === '.' ||
    projectName === '..' ||
    path.isAbsolute(projectName) ||
    path.basename(projectName) !== projectName ||
    projectName.includes('/') ||
    projectName.includes('\\')
  ) {
    throw new Error('Project path must be a direct folder inside workspace.');
  }

  const root = getWorkspaceRoot();
  const projectRoot = path.resolve(root, projectName);
  const relativeProject = path.relative(root, projectRoot);
  if (!relativeProject || relativeProject.startsWith('..') || path.isAbsolute(relativeProject)) {
    throw new Error('Project path must remain inside workspace.');
  }

  return { projectName, projectRoot };
}

function getFolderPath(projectRoot, relativePath) {
  if (typeof relativePath !== 'string') {
    throw new Error('Folder path must be text.');
  }

  if (relativePath.split(/[\\/]/).some((part) => part === '..')) {
    throw new Error('Folder path must remain inside the selected project.');
  }

  const folderPath = path.resolve(projectRoot, relativePath);
  const relativeFolder = path.relative(projectRoot, folderPath);
  if (relativeFolder.startsWith('..') || path.isAbsolute(relativeFolder)) {
    throw new Error('Folder path must remain inside the selected project.');
  }

  return folderPath;
}

function getEntryPath(projectRoot, relativePath, name) {
  const folderPath = getFolderPath(projectRoot, relativePath);
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('File or folder name is required.');
  }

  const entryName = name.trim();
  if (
    entryName !== name ||
    entryName === '.' ||
    entryName === '..' ||
    path.isAbsolute(entryName) ||
    path.basename(entryName) !== entryName ||
    entryName.includes('/') ||
    entryName.includes('\\')
  ) {
    throw new Error('File or folder name must be a single name in the current folder.');
  }

  const entryPath = path.resolve(folderPath, entryName);
  const relativeEntry = path.relative(projectRoot, entryPath);
  if (!relativeEntry || relativeEntry.startsWith('..') || path.isAbsolute(relativeEntry)) {
    throw new Error('File or folder path must remain inside the selected project.');
  }

  return { entryName, entryPath, folderPath };
}

async function listFiles(project, relativePath = '') {
  const { projectName, projectRoot } = getProjectRoot(project);
  await assertDemoPath(demoWorkspaceRoot, projectRoot);
  const folderPath = getFolderPath(projectRoot, relativePath);
  await assertDemoPath(demoWorkspaceRoot, folderPath);

  let entries;
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch (error) {
    const notFoundError = new Error('Project folder or requested path was not found.');
    notFoundError.code = 'FILE_NOT_FOUND';
    throw notFoundError;
  }

  return {
    project: projectName,
    path: relativePath,
    items: entries
      .sort((first, second) => first.name.localeCompare(second.name))
      .filter((entry) => !entry.isSymbolicLink())
      .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'folder' : 'file' })),
  };
}

async function searchProject(project, query) {
  const { projectName, projectRoot } = getProjectRoot(project);
  await assertDemoPath(demoWorkspaceRoot, projectRoot);
  if (typeof query !== 'string' || !query.trim()) return [];
  const normalizedQuery = query.toLowerCase();
  const results = [];

  async function walk(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      let entryStats;
      try {
        entryStats = await fs.lstat(entryPath);
      } catch {
        continue;
      }
      if (entryStats.isSymbolicLink()) continue;
      if (entryStats.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entryStats.isFile() || !searchableExtensions.has(path.extname(entry.name).slice(1).toLowerCase())) continue;
      if (entryStats.size > MAX_SEARCH_FILE_SIZE) continue;
      let contentBuffer;
      try {
        contentBuffer = await fs.readFile(entryPath);
      } catch {
        continue;
      }
      if (contentBuffer.includes(0)) continue;
      const relativePath = path.relative(projectRoot, entryPath).replaceAll(path.sep, '/');
      const content = contentBuffer.toString('utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((lineText, index) => {
        if (lineText.toLowerCase().includes(normalizedQuery)) {
          const context = lines
            .slice(Math.max(0, index - 2), Math.min(lines.length, index + 3))
            .map((text, contextIndex) => ({ line: Math.max(0, index - 2) + contextIndex + 1, text: text.trim().slice(0, 240) }));
          results.push({ project: projectName, path: relativePath, line: index + 1, preview: lineText.trim().slice(0, 240), context });
        }
      });
    }
  }

  await walk(projectRoot);
  results.sort((first, second) => {
    const firstPath = first.path.toLowerCase();
    const secondPath = second.path.toLowerCase();
    if (firstPath < secondPath) return -1;
    if (firstPath > secondPath) return 1;
    if (first.path < second.path) return -1;
    if (first.path > second.path) return 1;
    return first.line - second.line;
  });
  return results;
}

async function createFolder(project, relativePath, name) {
  const { projectRoot } = getProjectRoot(project);
  const { entryName, entryPath } = getEntryPath(projectRoot, relativePath, name);
  try {
    await fs.mkdir(entryPath);
  } catch (error) {
    if (error.code === 'EEXIST') {
      const existsError = new Error('An item with that name already exists.');
      existsError.code = 'FILE_EXISTS';
      throw existsError;
    }
    throw error;
  }
  return { name: entryName, type: 'folder' };
}

async function createFile(project, relativePath, name) {
  const { projectRoot } = getProjectRoot(project);
  const { entryName, entryPath } = getEntryPath(projectRoot, relativePath, name);
  try {
    await fs.writeFile(entryPath, '', { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') {
      const existsError = new Error('An item with that name already exists.');
      existsError.code = 'FILE_EXISTS';
      throw existsError;
    }
    throw error;
  }
  return { name: entryName, type: 'file' };
}

async function renameItem(project, relativePath, name, newName) {
  const { projectRoot } = getProjectRoot(project);
  const source = getEntryPath(projectRoot, relativePath, name);
  const destination = getEntryPath(projectRoot, relativePath, newName);

  try {
    await fs.stat(source.entryPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFoundError = new Error('The item to rename was not found.');
      notFoundError.code = 'FILE_NOT_FOUND';
      throw notFoundError;
    }
    throw error;
  }

  try {
    await fs.stat(destination.entryPath);
    const existsError = new Error('An item with the new name already exists.');
    existsError.code = 'FILE_EXISTS';
    throw existsError;
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'FILE_EXISTS') throw error;
    if (error.code === 'FILE_EXISTS') throw error;
  }

  await fs.rename(source.entryPath, destination.entryPath);
  const stats = await fs.stat(destination.entryPath);
  return { name: destination.entryName, type: stats.isDirectory() ? 'folder' : 'file' };
}

async function deleteItem(project, relativePath, name) {
  const { projectRoot } = getProjectRoot(project);
  const { entryPath } = getEntryPath(projectRoot, relativePath, name);
  let stats;

  try {
    stats = await fs.stat(entryPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFoundError = new Error('The item to delete was not found.');
      notFoundError.code = 'FILE_NOT_FOUND';
      throw notFoundError;
    }
    throw error;
  }

  await fs.rm(entryPath, { recursive: stats.isDirectory(), force: false });
}

function validateUploadName(name) {
  if (!name || path.isAbsolute(name) || path.basename(name) !== name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new Error('Uploaded filename must be a single safe filename.');
  }
  return name;
}

async function readMultipart(request, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('Upload must use multipart/form-data.');
  const boundary = Buffer.from('--' + (boundaryMatch[1] || boundaryMatch[2]));
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_UPLOAD_SIZE * 10) {
      const error = new Error('Upload request is too large.');
      error.code = 'UPLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }

  const bodyText = Buffer.concat(chunks).toString('latin1');
  const boundaryText = boundary.toString('latin1');
  const parts = [];
  for (const section of bodyText.split(boundaryText)) {
    const separator = section.indexOf('\r\n\r\n');
    if (separator === -1) continue;
    const headers = section.slice(0, separator);
    let rawContent = section.slice(separator + 4);
    if (rawContent.endsWith('--')) rawContent = rawContent.slice(0, -2);
    if (rawContent.endsWith('\r\n')) rawContent = rawContent.slice(0, -2);
    const disposition = headers.match(/content-disposition:[^\r\n]*/i)?.[0] || '';
    const fieldName = disposition.match(/\bname="([^"]*)"/i)?.[1];
    const fileName = disposition.match(/\bfilename="([^"]*)"/i)?.[1];
    if (fieldName) parts.push({ name: fieldName, filename: fileName, content: Buffer.from(rawContent, 'latin1') });
  }
  return parts;
}

async function uploadFiles(project, request, contentType) {
  const { projectRoot } = getProjectRoot(project);
  const parts = await readMultipart(request, contentType);
  const relativePath = parts.find((part) => part.name === 'path' && !part.filename)?.content.toString('utf8') || '';
  const folderPath = getFolderPath(projectRoot, relativePath);
  const uploaded = [];
  const failed = [];

  for (const part of parts.filter((entry) => entry.filename !== undefined)) {
    const name = path.basename(part.filename);
    try {
      validateUploadName(name);
      if (part.content.length > MAX_UPLOAD_SIZE) throw new Error('File exceeds the 25 MB upload limit.');
      const entryPath = path.resolve(folderPath, name);
      const relativeEntry = path.relative(projectRoot, entryPath);
      if (!relativeEntry || relativeEntry.startsWith('..') || path.isAbsolute(relativeEntry)) throw new Error('Upload path must remain inside the selected project.');
      await fs.writeFile(entryPath, part.content, { flag: 'wx' });
      uploaded.push({ name, type: 'file' });
    } catch (error) {
      failed.push({ name: name || part.filename, error: error.code === 'EEXIST' ? 'A file with this name already exists.' : error.message });
    }
  }

  return { uploaded, failed };
}

async function getDownloadFile(project, relativePath) {
  const { projectRoot } = getProjectRoot(project);
  await assertDemoPath(demoWorkspaceRoot, projectRoot);
  if (!relativePath || relativePath.split(/[\\/]/).some((part) => part === '..')) throw new Error('Download path must remain inside the selected project.');
  const filePath = path.resolve(projectRoot, relativePath);
  await assertDemoPath(demoWorkspaceRoot, filePath);
  const relativeFile = path.relative(projectRoot, filePath);
  if (!relativeFile || relativeFile.startsWith('..') || path.isAbsolute(relativeFile)) throw new Error('Download path must remain inside the selected project.');
  let stats;
  try { stats = await fs.stat(filePath) } catch { const error = new Error('File not found.'); error.code = 'FILE_NOT_FOUND'; throw error }
  if (!stats.isFile()) throw new Error('Only files can be downloaded.');
  return { filePath, name: path.basename(filePath) };
}

async function getEditableFile(project, relativePath) {
  const { projectRoot } = getProjectRoot(project);
  await assertDemoPath(demoWorkspaceRoot, projectRoot);
  if (typeof relativePath !== 'string' || !relativePath.trim() || relativePath.split(/[\\/]/).some((part) => part === '..')) {
    throw new Error('File path must remain inside the selected project.');
  }

  const filePath = path.resolve(projectRoot, relativePath);
  await assertDemoPath(demoWorkspaceRoot, filePath);
  const relativeFile = path.relative(projectRoot, filePath);
  if (!relativeFile || relativeFile.startsWith('..') || path.isAbsolute(relativeFile)) {
    throw new Error('File path must remain inside the selected project.');
  }

  let stats;
  try { stats = await fs.stat(filePath) } catch { const error = new Error('File not found.'); error.code = 'FILE_NOT_FOUND'; throw error }
  if (!stats.isFile()) throw new Error('Only files can be opened in the editor.');

  return { path: relativeFile.replaceAll(path.sep, '/'), content: await fs.readFile(filePath, 'utf8') };
}

async function saveEditableFile(project, relativePath, content) {
  const { projectRoot } = getProjectRoot(project);
  if (typeof relativePath !== 'string' || !relativePath.trim() || relativePath.split(/[\\/]/).some((part) => part === '..')) {
    throw new Error('File path must remain inside the selected project.');
  }
  if (typeof content !== 'string') throw new Error('File content must be text.');

  const filePath = path.resolve(projectRoot, relativePath);
  const relativeFile = path.relative(projectRoot, filePath);
  if (!relativeFile || relativeFile.startsWith('..') || path.isAbsolute(relativeFile)) {
    throw new Error('File path must remain inside the selected project.');
  }

  let stats;
  try { stats = await fs.stat(filePath) } catch { const error = new Error('File not found.'); error.code = 'FILE_NOT_FOUND'; throw error }
  if (!stats.isFile()) throw new Error('Only files can be saved from the editor.');
  await fs.writeFile(filePath, content, 'utf8');
  return { path: relativeFile.replaceAll(path.sep, '/') };
}

module.exports = { listFiles, searchProject, createFolder, createFile, renameItem, deleteItem, uploadFiles, getDownloadFile, getEditableFile, saveEditableFile };
