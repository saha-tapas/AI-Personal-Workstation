const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { getProjectPath } = require('./projectService');

const execFileAsync = promisify(execFile);
const WINDOWS_GIT_PATH = 'C:\\Program Files\\Git\\cmd\\git.exe';
const MAX_COMMIT_MESSAGE_LENGTH = 1000;
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;
const MAX_STASH_MESSAGE_LENGTH = 1000;
const DEFAULT_STASH_LIMIT = 20;
const MAX_STASH_LIMIT = 50;
const MAX_STASH_INDEX = 49;


function getGitExecutables({ platform = process.platform, gitPath = process.env.GIT_PATH, existsSync = require('fs').existsSync } = {}) {
  if (gitPath) return [gitPath];
  const executables = ['git'];
  if (platform === 'win32' && existsSync(WINDOWS_GIT_PATH)) executables.push(WINDOWS_GIT_PATH);
  return executables;
}

function parsePorcelainStatus(output) {
  const status = { staged: [], modified: [], deleted: [], renamed: [], untracked: [] };
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const index = line[0];
    const worktree = line[1];
    const file = line.slice(3);
    if (index === '?' && worktree === '?') status.untracked.push(file);
    else if (index === 'R' || worktree === 'R') status.renamed.push(file);
    else {
      if (index !== ' ') {
        if (index === 'D') status.deleted.push(file);
        else status.staged.push(file);
      }
      if (worktree !== ' ') {
        if (worktree === 'D') status.deleted.push(file);
        else status.modified.push(file);
      }
    }
  }
  return status;
}

function parseChangedFiles(output) {
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line[0];
    const worktree = line[1];
    const rawPath = line.slice(3);
    const filePath = rawPath.includes(' -> ') ? rawPath.slice(rawPath.lastIndexOf(' -> ') + 4) : rawPath;
    return {
      path: filePath,
      status: index === '?' && worktree === '?' ? 'untracked' : index === 'R' || worktree === 'R' ? 'renamed' : index === 'D' || worktree === 'D' ? 'deleted' : index !== ' ' ? 'staged' : 'modified',
      staged: index !== ' ' && index !== '?',
      unstaged: worktree !== ' ' && worktree !== '?'
    };
  });
}

async function runGit(args, projectPath) {
  const executables = getGitExecutables();
  for (let index = 0; index < executables.length; index += 1) {
    try {
      const result = await execFileAsync(executables[index], args, { cwd: projectPath, windowsHide: true, maxBuffer: 1024 * 1024 });
      return result.stdout;
    } catch (error) {
      if (error.code !== 'ENOENT' || index === executables.length - 1) {
        if (error.code === 'ENOENT') {
          const gitError = new Error('Git is not installed or is not available on PATH.');
          gitError.code = 'GIT_NOT_INSTALLED';
          throw gitError;
        }
        throw error;
      }
    }
  }
}

async function isProjectRepository(projectPath) {
  let gitRoot;
  try {
    gitRoot = (await runGit(['rev-parse', '--show-toplevel'], projectPath)).trim();
  } catch (error) {
    if (error.code === 128) return false;
    throw error;
  }

  const [realProjectPath, realGitRoot] = await Promise.all([
    fs.realpath(projectPath),
    fs.realpath(gitRoot)
  ]);

  const normalize = (value) => {
    const resolved = path.resolve(value);
    const root = path.parse(resolved).root;
    const normalizedPath = resolved === root
      ? resolved
      : resolved.replace(/[\\/]+$/, '');
    return process.platform === 'win32'
      ? normalizedPath.toLowerCase()
      : normalizedPath;
  };

  return normalize(realProjectPath) === normalize(realGitRoot);
}
async function getStatus(project) {
  const { projectName, projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  if (!(await isProjectRepository(projectPath))) return { isRepository: false };

  const branch = (await runGit(['branch', '--show-current'], projectPath)).trim();
  const parsed = parsePorcelainStatus(await runGit(['status', '--porcelain=v1'], projectPath));
  return { project: projectName, isRepository: true, branch, clean: Object.values(parsed).every((files) => files.length === 0), ...parsed };
}

function validateRelativeFilePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('File path is required.');
  const normalized = filePath.trim().replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || normalized.startsWith('//') || /^[a-zA-Z]:/.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('File path must remain inside the project.');
  }
  return normalized.replace(/^\/+/, '');
}

async function getDiff(project, filePath) {
  const { projectName, projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  if (!(await isProjectRepository(projectPath))) {
    return { project: projectName, isRepository: false, files: [] };
  }
  if (filePath !== undefined) {
    const validatedPath = validateRelativeFilePath(filePath);
    const [unstaged, staged] = await Promise.all([
      runGit(['diff', '--', validatedPath], projectPath),
      runGit(['diff', '--cached', '--', validatedPath], projectPath)
    ]);
    return { project: projectName, path: validatedPath, staged: Boolean(staged), unstaged: Boolean(unstaged), diff: { staged, unstaged } };
  }
  const files = parseChangedFiles(await runGit(['status', '--porcelain=v1'], projectPath));
  return { project: projectName, files };
}

async function changeStage(project, action, filePath) {
  const { projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  if (!(await isProjectRepository(projectPath))) {
    throw new Error('This project is not a git repository.');
  }
  const validatedPath = validateRelativeFilePath(filePath);
  let args;
  if (action === 'stage') args = ['add', '--', validatedPath];
  else if (await hasHead(projectPath)) args = ['restore', '--staged', '--', validatedPath];
  else args = ['rm', '--cached', '--ignore-unmatch', '--', validatedPath];
  await runGit(args, projectPath);
}

async function hasHead(projectPath) {
  try {
    await runGit(['rev-parse', '--verify', 'HEAD'], projectPath);
    return true;
  } catch (error) {
    if (error.code === 128) return false;
    throw error;
  }
}

async function stage(project, filePath) {
  return changeStage(project, 'stage', filePath);
}

async function unstage(project, filePath) {
  return changeStage(project, 'unstage', filePath);
}

async function stageAll(project) {
  const { projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  if (!(await isProjectRepository(projectPath))) {
    throw new Error('This project is not a git repository.');
  }
  await runGit(['add', '--all'], projectPath);
}

async function unstageAll(project) {
  const { projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  if (!(await isProjectRepository(projectPath))) {
    throw new Error('This project is not a git repository.');
  }
  const args = await hasHead(projectPath) ? ['restore', '--staged', '--', '.'] : ['rm', '--cached', '--ignore-unmatch', '-r', '--', '.'];
  await runGit(args, projectPath);
}

function validateCommitMessage(message) {
  if (typeof message !== 'string') throw new Error('Commit message is required.');
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Commit message is required.');
  if (trimmed.length > MAX_COMMIT_MESSAGE_LENGTH) throw new Error(`Commit message must be ${MAX_COMMIT_MESSAGE_LENGTH} characters or fewer.`);
  return trimmed;
}

async function commit(project, message) {
  const { projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  if (!(await isProjectRepository(projectPath))) {
    throw new Error('This project is not a git repository.');
  }
  const validatedMessage = validateCommitMessage(message);
  try {
    await runGit(['diff', '--cached', '--quiet'], projectPath);
  } catch (error) {
    if (error.code !== 1) throw error;
  }
  let stagedChanges;
  try {
    stagedChanges = await runGit(['diff', '--cached', '--name-only'], projectPath);
  } catch (error) {
    throw error;
  }
  if (!stagedChanges.trim()) {
    const error = new Error('No staged changes to commit.');
    error.code = 'NO_STAGED_CHANGES';
    throw error;
  }
  await runGit(['commit', '-m', validatedMessage], projectPath);
  const hash = (await runGit(['rev-parse', 'HEAD'], projectPath)).trim();
  const branch = (await runGit(['branch', '--show-current'], projectPath)).trim();
  return { hash, message: validatedMessage, branch };
}

function validateHistoryLimit(value) {
  if (value === undefined) return DEFAULT_HISTORY_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) throw new Error(`History limit must be an integer between 1 and ${MAX_HISTORY_LIMIT}.`);
  return limit;
}

function validateStashLimit(value) {
  if (value === undefined) return DEFAULT_STASH_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_STASH_LIMIT) throw new Error(`Stash limit must be an integer between 1 and ${MAX_STASH_LIMIT}.`);
  return limit;
}

function validateStashIndex(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error(`Stash index must be an integer between 0 and ${MAX_STASH_INDEX}.`);
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index > MAX_STASH_INDEX) throw new Error(`Stash index must be an integer between 0 and ${MAX_STASH_INDEX}.`);
  return index;
}

function validateStashMessage(message) {
  if (message === undefined || message === null || message === '') return '';
  if (typeof message !== 'string') throw new Error('Stash message must be text.');
  const trimmed = message.trim();
  if (!trimmed) return '';
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('Stash message contains invalid control characters.');
  if (trimmed.length > MAX_STASH_MESSAGE_LENGTH) throw new Error(`Stash message must be ${MAX_STASH_MESSAGE_LENGTH} characters or fewer.`);
  return trimmed;
}

function stashReference(index) {
  return `stash@{${index}}`;
}

async function stash(project, message) {
  const repository = await ensureRepository(project);
  const validatedMessage = validateStashMessage(message);
  if (!repository.isRepository) throw new Error('This project is not a Git repository.');
  const statusOutput = await runGit(['status', '--porcelain=v1'], repository.projectPath);
  if (!statusOutput.trim()) {
    const error = new Error('No local changes to stash.');
    error.code = 'NO_CHANGES_TO_STASH';
    throw error;
  }
  const args = validatedMessage ? ['stash', 'push', '-m', validatedMessage] : ['stash', 'push'];
  const output = await runGit(args, repository.projectPath);
  const reference = (await runGit(['stash', 'list', '-1', '--format=%gd'], repository.projectPath)).trim();
  return { project: repository.projectName, message: output.trim() || 'Changes stashed.', reference };
}

async function stashes(project, requestedLimit) {
  const repository = await ensureRepository(project);
  const limit = validateStashLimit(requestedLimit);
  if (!repository.isRepository) return { project: repository.projectName, isRepository: false, stashes: [] };
  const format = '%gd%x09%H%x09%cd%x09%s';
  const output = await runGit(['stash', 'list', '-n', String(limit), '--date=iso-strict', `--format=${format}`], repository.projectPath);
  const list = output.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const [reference, commit, date, ...messageParts] = line.split('\t');
    return { index, reference, commit, date, message: messageParts.join('\t') };
  });
  return { project: repository.projectName, isRepository: true, stashes: list };
}

async function stashDetails(project, requestedIndex) {
  const repository = await ensureRepository(project);
  const index = validateStashIndex(requestedIndex);
  if (!repository.isRepository) return { project: repository.projectName, isRepository: false };
  const reference = stashReference(index);
  const format = '%gd%x09%H%x09%cd%x09%s';
  const metadata = (await runGit(['stash', 'list', '-1', `--format=${format}`, '--date=iso-strict', reference], repository.projectPath)).trim();
  if (!metadata) throw new Error('Stash does not exist.');
  const [stashRef, commit, date, ...messageParts] = metadata.split('\t');
  const diff = await runGit(['stash', 'show', '--format=', '--patch', reference], repository.projectPath);
  return { project: repository.projectName, isRepository: true, stash: { index, reference: stashRef, commit, date, message: messageParts.join('\t'), diff } };
}

async function applyStash(project, requestedIndex) {
  const repository = await ensureRepository(project);
  const index = validateStashIndex(requestedIndex);
  if (!repository.isRepository) throw new Error('This project is not a Git repository.');
  await runGit(['stash', 'apply', stashReference(index)], repository.projectPath);
}

async function dropStash(project, requestedIndex) {
  const repository = await ensureRepository(project);
  const index = validateStashIndex(requestedIndex);
  if (!repository.isRepository) throw new Error('This project is not a Git repository.');
  await runGit(['stash', 'drop', stashReference(index)], repository.projectPath);
}

async function history(project, requestedLimit) {
  const { projectName, projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  if (!(await isProjectRepository(projectPath))) {
    return { project: projectName, isRepository: false, commits: [] };
  }
  const limit = validateHistoryLimit(requestedLimit);
  try {
    await runGit(['rev-parse', '--verify', 'HEAD'], projectPath);
  } catch (error) {
    if (error.code === 128) return { project: projectName, isRepository: true, commits: [] };
    throw error;
  }
  const output = await runGit(['log', '-n', String(limit), '--date=iso-strict', '--pretty=format:%H%x09%h%x09%an%x09%ae%x09%ad%x09%s'], projectPath);
  const commits = output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [hash, shortHash, authorName, authorEmail, date, ...messageParts] = line.split('\t');
    return { hash, shortHash, authorName, authorEmail, date, message: messageParts.join('\t') };
  });
  return { project: projectName, isRepository: true, commits };
}

function validateBranchName(name) {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() || name.startsWith('-') || /[\u0000-\u001f\u007f]/.test(name) || name.split(/[\\/]/).includes('..')) throw new Error('Invalid branch name.');
  return name;
}

function validateCommitHash(hash) {
  if (typeof hash !== 'string' || !/^[0-9a-fA-F]{4,64}$/.test(hash)) throw new Error('Invalid commit hash.');
  return hash;
}

function validateHistoryFilePath(filePath) {
  const validatedPath = validateRelativeFilePath(filePath);
  if (/^[\u0000-\u001f\u007f]/.test(validatedPath) || validatedPath.startsWith('-')) throw new Error('File path must remain inside the project.');
  return validatedPath;
}

async function ensureRepository(project) {
  const { projectName, projectPath } = getProjectPath(project);
  const stats = await fs.stat(projectPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    const error = new Error('Project not found.');
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  const isRepository = await isProjectRepository(projectPath);
  return { projectName, projectPath, isRepository };
}

async function branches(project) {
  const repository = await ensureRepository(project);
  if (!repository.isRepository) return { project: repository.projectName, isRepository: false, currentBranch: '', branches: [] };
  const currentBranch = (await runGit(['branch', '--show-current'], repository.projectPath)).trim();
  const output = await runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], repository.projectPath);
  const branchList = output.split(/\r?\n/).filter(Boolean).map((name) => ({ name, current: name === currentBranch }));
  return { project: repository.projectName, isRepository: true, currentBranch, branches: branchList };
}

async function createBranch(project, name) {
  const repository = await ensureRepository(project);
  const validatedName = validateBranchName(name);
  if (!repository.isRepository) throw new Error('This project is not a Git repository.');
  if (!(await hasHead(repository.projectPath))) throw new Error('Cannot create a branch until the repository has an initial commit.');
  try {
    await runGit(['check-ref-format', '--branch', validatedName], repository.projectPath);
  } catch (error) {
    if (error.code === 128) throw new Error('Invalid branch name.');
    throw error;
  }
  await runGit(['branch', '--', validatedName], repository.projectPath);
}

async function switchBranch(project, name) {
  const repository = await ensureRepository(project);
  const validatedName = validateBranchName(name);
  if (!repository.isRepository) throw new Error('This project is not a Git repository.');
  try {
    await runGit(['show-ref', '--verify', '--quiet', `refs/heads/${validatedName}`], repository.projectPath);
  } catch (error) {
    if (error.code === 1) throw new Error('Local branch does not exist.');
    throw error;
  }
  await runGit(['switch', validatedName], repository.projectPath);
}

function parseCommitFiles(output) {
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [rawStatus, ...pathParts] = line.split('\t');
    const statusCode = rawStatus[0];
    const status = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied' }[statusCode] || 'modified';
    return { path: pathParts[pathParts.length - 1], status };
  });
}

async function getCommitDetails(project, hash) {
  const repository = await ensureRepository(project);
  const validatedHash = validateCommitHash(hash);
  if (!repository.isRepository) return { project: repository.projectName, isRepository: false };
  const format = '%H%x09%h%x09%an%x09%ae%x09%ad%x09%s';
  const metadata = (await runGit(['show', '-s', `--format=${format}`, '--date=iso-strict', validatedHash], repository.projectPath)).trim();
  const [fullHash, shortHash, authorName, authorEmail, date, ...messageParts] = metadata.split('\t');
  const filesOutput = await runGit(['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M', '-C', validatedHash], repository.projectPath);
  return { project: repository.projectName, isRepository: true, commit: { hash: fullHash, shortHash, authorName, authorEmail, date, message: messageParts.join('\t'), files: parseCommitFiles(filesOutput) } };
}

async function getCommitDiff(project, hash, filePath) {
  const repository = await ensureRepository(project);
  const validatedHash = validateCommitHash(hash);
  if (!repository.isRepository) return { project: repository.projectName, isRepository: false };
  const validatedPath = filePath !== undefined ? validateRelativeFilePath(filePath) : undefined;
  await runGit(['rev-parse', '--verify', `${validatedHash}^{commit}`], repository.projectPath);
  const args = ['show', '--format=', '--patch', '--root', validatedHash];
  if (validatedPath !== undefined) args.push('--', validatedPath);
  return { project: repository.projectName, isRepository: true, commit: validatedHash, ...(validatedPath !== undefined ? { path: validatedPath } : {}), diff: await runGit(args, repository.projectPath) };
}

async function getFileHistory(project, filePath) {
  const repository = await ensureRepository(project);
  const validatedPath = validateHistoryFilePath(filePath);
  if (!repository.isRepository) return { project: repository.projectName, isRepository: false, path: validatedPath, commits: [] };
  const format = '%H%x09%h%x09%an%x09%ae%x09%ad%x09%s';
  const output = await runGit(['log', '--follow', `--format=${format}`, '--date=iso-strict', '--', validatedPath], repository.projectPath);
  const commits = output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [hash, shortHash, authorName, authorEmail, date, ...messageParts] = line.split('\t');
    return { hash, shortHash, authorName, authorEmail, date, message: messageParts.join('\t') };
  });
  return { project: repository.projectName, isRepository: true, path: validatedPath, commits };
}

async function getFileHistoryDiff(project, filePath, hash) {
  const validatedPath = validateHistoryFilePath(filePath);
  const result = await getCommitDiff(project, hash, validatedPath);
  return { ...result, ...(result.isRepository === false ? { path: validatedPath } : {}) };
}

module.exports = { getStatus, getDiff, stage, unstage, stageAll, unstageAll, commit, history, stashes, stash, stashDetails, applyStash, dropStash, branches, createBranch, switchBranch, getCommitDetails, getCommitDiff, getFileHistory, getFileHistoryDiff, validateCommitMessage, validateHistoryLimit, validateStashLimit, validateStashIndex, validateStashMessage, validateBranchName, validateCommitHash, validateHistoryFilePath, parsePorcelainStatus, parseChangedFiles, getGitExecutables, validateRelativeFilePath };
