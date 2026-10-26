const fs = require('fs/promises');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../../../workspace');
const demoWorkspaceRoot = path.resolve(__dirname, '../../../demo-data');

function isDemoMode() {
  return String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
}

function getWorkspaceRoot() {
  return isDemoMode() ? demoWorkspaceRoot : workspaceRoot;
}

async function getValidatedWorkspaceRoot() {
  const root = getWorkspaceRoot();
  let stats;
  try {
    stats = await fs.lstat(root);
  } catch (error) {
    if (isDemoMode() && error.code === 'ENOENT') {
      const missingError = new Error('Demo data is unavailable.');
      missingError.code = 'DEMO_DATA_UNAVAILABLE';
      throw missingError;
    }
    throw error;
  }
  if (!stats.isDirectory()) {
    const invalidError = new Error('Demo data is unavailable.');
    invalidError.code = 'DEMO_DATA_UNAVAILABLE';
    throw invalidError;
  }
  const realRoot = await fs.realpath(root);
  if (realRoot !== root) {
    const invalidError = new Error('Demo data is unavailable.');
    invalidError.code = 'DEMO_DATA_UNAVAILABLE';
    throw invalidError;
  }
  return root;
}

function getProjectPath(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Project name is required.');
  }

  const projectName = name.trim();
  if (
    projectName !== name ||
    projectName === '.' ||
    projectName === '..' ||
    path.isAbsolute(projectName) ||
    path.basename(projectName) !== projectName ||
    projectName.includes('/') ||
    projectName.includes('\\')
  ) {
    throw new Error('Project name must be a single folder name inside workspace.');
  }

  const root = getWorkspaceRoot();
  const projectPath = path.resolve(root, projectName);
  const relativePath = path.relative(root, projectPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Project path must remain inside workspace.');
  }

  return { projectName, projectPath };
}

function getProjectWorkingPath(project, cwd = '', target) {
  const { projectName, projectPath } = getProjectPath(project);
  function normalizeRelative(value, label, allowParent = false) {
    let normalized = String(value || '').trim().replace(/\\/g, '/');
    if (path.isAbsolute(normalized) && !normalized.startsWith('/')) throw new Error(`${label} must remain inside the project.`);
    if (normalized.startsWith('//') || /^[a-zA-Z]:/.test(normalized)) throw new Error(`${label} must be project-relative.`);
    normalized = normalized.replace(/^\/+/, '');
    if (!allowParent && normalized.split('/').includes('..')) throw new Error(`${label} must remain inside the project.`);
    return normalized;
  }
  const current = normalizeRelative(cwd, 'Working directory');
  const destination = target === undefined ? current : normalizeRelative(target, 'Working directory', true);
  const resolved = path.resolve(projectPath, current || '.', target === undefined ? '.' : destination || '.');
  const relative = path.relative(projectPath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Working directory must remain inside the project.');
  return { projectName, projectPath, workingPath: resolved, relativePath: relative ? `/${relative.replace(/\\/g, '/')}` : '/' };
}

async function ensureWorkspace() {
  await fs.mkdir(workspaceRoot, { recursive: true });
  return workspaceRoot;
}

async function listProjects() {
  const root = isDemoMode() ? await getValidatedWorkspaceRoot() : await ensureWorkspace();
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !entry.isSymbolicLink()).map((entry) => ({ name: entry.name }));
}

async function createProject(name) {
  const { projectName, projectPath } = getProjectPath(name);
  await ensureWorkspace();

  try {
    await fs.mkdir(projectPath);
  } catch (error) {
    if (error.code === 'EEXIST') {
      const duplicateError = new Error('A project with that name already exists.');
      duplicateError.code = 'PROJECT_EXISTS';
      throw duplicateError;
    }
    throw error;
  }

  return { name: projectName };
}

async function deleteProject(name) {
  const { projectPath } = getProjectPath(name);

  let stats;
  try {
    stats = await fs.stat(projectPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFoundError = new Error('Project not found.');
      notFoundError.code = 'PROJECT_NOT_FOUND';
      throw notFoundError;
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error('Only project folders can be deleted.');
  }

  await fs.rm(projectPath, { recursive: true, force: false });
}

module.exports = { listProjects, createProject, deleteProject, getProjectPath, getProjectWorkingPath };
