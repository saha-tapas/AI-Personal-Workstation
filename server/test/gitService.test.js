const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const gitService = require('../src/services/gitService');

const execFileAsync = promisify(execFile);
const projectName = `.git-test-${process.pid}`;
const projectPath = path.resolve(__dirname, '../../workspace', projectName);
const nonRepoName = `.non-git-test-${process.pid}`;
const nonRepoPath = path.resolve(__dirname, '../../workspace', nonRepoName);
const noHeadName = `.no-head-test-${process.pid}`;
const noHeadPath = path.resolve(__dirname, '../../workspace', noHeadName);
const commitName = `.commit-test-${process.pid}`;
const commitPath = path.resolve(__dirname, '../../workspace', commitName);
const emptyRepoName = `.empty-repo-test-${process.pid}`;
const emptyRepoPath = path.resolve(__dirname, '../../workspace', emptyRepoName);

test.before(async () => {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(nonRepoPath, { recursive: true });
  await fs.mkdir(noHeadPath, { recursive: true });
  await execFileAsync('git', ['init', '-q'], { cwd: noHeadPath });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: noHeadPath });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: noHeadPath });
  await fs.writeFile(path.join(noHeadPath, 'script.js'), 'console.log("test");\n');
  await fs.mkdir(commitPath, { recursive: true });
  await execFileAsync('git', ['init', '-q'], { cwd: commitPath });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: commitPath });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: commitPath });
  await fs.writeFile(path.join(commitPath, 'tracked.txt'), 'initial\n');
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: commitPath });
  await execFileAsync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], { cwd: commitPath });
  await fs.mkdir(emptyRepoPath, { recursive: true });
  await execFileAsync('git', ['init', '-q'], { cwd: emptyRepoPath });
  await execFileAsync('git', ['init', '-q'], { cwd: projectPath });
  await fs.writeFile(path.join(projectPath, 'tracked.txt'), 'initial\n');
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: projectPath });
  await execFileAsync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], { cwd: projectPath });
  await fs.writeFile(path.join(projectPath, 'tracked.txt'), 'modified\n');
  await fs.writeFile(path.join(projectPath, 'new.txt'), 'new\n');
});

test.after(async () => {
  await fs.rm(projectPath, { recursive: true, force: true });
  await fs.rm(nonRepoPath, { recursive: true, force: true });
  await fs.rm(noHeadPath, { recursive: true, force: true });
  await fs.rm(commitPath, { recursive: true, force: true });
  await fs.rm(emptyRepoPath, { recursive: true, force: true });
});

test('detects a Git repository and parses its status', async () => {
  const result = await gitService.getStatus(projectName);
  assert.equal(result.isRepository, true);
  assert.equal(result.clean, false);
  assert.ok(result.branch === 'master' || result.branch === 'main');
  assert.deepEqual(result.modified, ['tracked.txt']);
  assert.deepEqual(result.untracked, ['new.txt']);
});

test('respects configured GIT_PATH', () => {
  assert.deepEqual(gitService.getGitExecutables({ gitPath: 'C:\\custom\\git.exe' }), ['C:\\custom\\git.exe']);
});

test('includes the standard Windows Git fallback only when it exists', () => {
  assert.deepEqual(
    gitService.getGitExecutables({ platform: 'win32', existsSync: (candidate) => candidate === 'C:\\Program Files\\Git\\cmd\\git.exe' }),
    ['git', 'C:\\Program Files\\Git\\cmd\\git.exe']
  );
  assert.deepEqual(gitService.getGitExecutables({ platform: 'win32', existsSync: () => false }), ['git']);
});

test('reports the existing clean error when configured Git is missing', async () => {
  const previousGitPath = process.env.GIT_PATH;
  process.env.GIT_PATH = path.join(projectPath, 'missing-git.exe');
  try {
    await assert.rejects(
      () => gitService.getStatus(projectName),
      (error) => error.code === 'GIT_NOT_INSTALLED' && error.message === 'Git is not installed or is not available on PATH.'
    );
  } finally {
    if (previousGitPath === undefined) delete process.env.GIT_PATH;
    else process.env.GIT_PATH = previousGitPath;
  }
});

test('returns non-repository status for a normal project', async () => {
  const result = await gitService.getStatus(nonRepoName);
  assert.deepEqual(result, { isRepository: false });
});

test('parses staged, modified, deleted, renamed, and untracked porcelain entries', () => {
  const result = gitService.parsePorcelainStatus(' M modified.js\nM  staged.js\nA  added.js\n D deleted.js\nR  old.js -> new.js\n?? new.txt\n');
  assert.deepEqual(result.staged, ['staged.js', 'added.js']);
  assert.deepEqual(result.modified, ['modified.js']);
  assert.deepEqual(result.deleted, ['deleted.js']);
  assert.deepEqual(result.renamed, ['old.js -> new.js']);
  assert.deepEqual(result.untracked, ['new.txt']);
});

test('parses changed files with staged and unstaged flags', () => {
  assert.deepEqual(gitService.parseChangedFiles(' M modified.js\nM  staged.js\n?? new.txt\nD  deleted.js\nR  old.js -> new.js\n'), [
    { path: 'modified.js', status: 'modified', staged: false, unstaged: true },
    { path: 'staged.js', status: 'staged', staged: true, unstaged: false },
    { path: 'new.txt', status: 'untracked', staged: false, unstaged: false },
    { path: 'deleted.js', status: 'deleted', staged: true, unstaged: false },
    { path: 'new.js', status: 'renamed', staged: true, unstaged: false }
  ]);
});

test('returns repository changes and a specific unstaged diff', async () => {
  const changes = await gitService.getDiff(projectName);
  assert.equal(changes.project, projectName);
  assert.deepEqual(changes.files, [
    { path: 'tracked.txt', status: 'modified', staged: false, unstaged: true },
    { path: 'new.txt', status: 'untracked', staged: false, unstaged: false }
  ]);

  const diff = await gitService.getDiff(projectName, 'tracked.txt');
  assert.equal(diff.path, 'tracked.txt');
  assert.equal(diff.staged, false);
  assert.match(diff.diff.unstaged, /-initial/);
  assert.match(diff.diff.unstaged, /\+modified/);
  assert.equal(diff.diff.staged, '');
});

test('rejects traversal and absolute diff paths', async () => {
  await assert.rejects(() => gitService.getDiff(projectName, '../outside'), /File path must remain inside the project/);
  await assert.rejects(() => gitService.getDiff(projectName, 'C:\\outside.txt'), /File path must remain inside the project/);
});

test('stages and unstages one file', async () => {
  await gitService.stage(projectName, 'new.txt');
  let changes = await gitService.getDiff(projectName);
  assert.deepEqual(changes.files.find((file) => file.path === 'new.txt'), { path: 'new.txt', status: 'staged', staged: true, unstaged: false });

  await gitService.unstage(projectName, 'new.txt');
  changes = await gitService.getDiff(projectName);
  assert.deepEqual(changes.files.find((file) => file.path === 'new.txt'), { path: 'new.txt', status: 'untracked', staged: false, unstaged: false });
});

test('stages all and unstages all changes', async () => {
  await gitService.stageAll(projectName);
  let changes = await gitService.getDiff(projectName);
  assert.ok(changes.files.every((file) => file.staged));

  await gitService.unstageAll(projectName);
  changes = await gitService.getDiff(projectName);
  assert.ok(changes.files.some((file) => file.path === 'tracked.txt' && file.unstaged));
  assert.ok(changes.files.some((file) => file.path === 'new.txt' && file.status === 'untracked'));
});

test('unstages staged files without HEAD while preserving the working tree', async () => {
  await gitService.stage(noHeadName, 'script.js');
  let changes = await gitService.getDiff(noHeadName);
  assert.deepEqual(changes.files, [{ path: 'script.js', status: 'staged', staged: true, unstaged: false }]);

  await gitService.unstage(noHeadName, 'script.js');
  changes = await gitService.getDiff(noHeadName);
  assert.deepEqual(changes.files, [{ path: 'script.js', status: 'untracked', staged: false, unstaged: false }]);
  assert.equal(await fs.readFile(path.join(noHeadPath, 'script.js'), 'utf8'), 'console.log("test");\n');
});

test('stages and unstages all files without HEAD', async () => {
  await gitService.stageAll(noHeadName);
  assert.deepEqual((await gitService.getDiff(noHeadName)).files, [{ path: 'script.js', status: 'staged', staged: true, unstaged: false }]);

  await gitService.unstageAll(noHeadName);
  assert.deepEqual((await gitService.getDiff(noHeadName)).files, [{ path: 'script.js', status: 'untracked', staged: false, unstaged: false }]);
  assert.equal(await fs.readFile(path.join(noHeadPath, 'script.js'), 'utf8'), 'console.log("test");\n');
});

test('validates commit messages and rejects commits with no staged changes', async () => {
  await assert.rejects(() => gitService.commit(commitName, ''), /Commit message is required/);
  await assert.rejects(() => gitService.commit(commitName, '   '), /Commit message is required/);
  await assert.rejects(() => gitService.commit(commitName, 'x'.repeat(1001)), /1000 characters or fewer/);
  await assert.rejects(() => gitService.commit(commitName, 'nothing staged'), (error) => error.code === 'NO_STAGED_CHANGES' && error.message === 'No staged changes to commit.');
});

test('creates commits with special characters and supports a first commit without HEAD', async () => {
  await fs.writeFile(path.join(commitPath, 'tracked.txt'), 'changed\n');
  await gitService.stage(commitName, 'tracked.txt');
  const result = await gitService.commit(commitName, '  fix: spaces & "quotes"  ');
  assert.match(result.hash, /^[0-9a-f]{40}$/);
  assert.equal(result.message, 'fix: spaces & "quotes"');
  assert.equal(result.branch === 'master' || result.branch === 'main', true);

  await gitService.stage(noHeadName, 'script.js');
  const firstCommit = await gitService.commit(noHeadName, 'first commit');
  assert.match(firstCommit.hash, /^[0-9a-f]{40}$/);
  assert.equal((await gitService.getStatus(noHeadName)).clean, true);
});

test('returns parsed commit history with default and bounded limits', async () => {
  const result = await gitService.history(commitName);
  assert.equal(result.isRepository, true);
  assert.ok(result.commits.length >= 2);
  assert.match(result.commits[0].hash, /^[0-9a-f]{40}$/);
  assert.match(result.commits[0].shortHash, /^[0-9a-f]{7,}$/);
  assert.equal(result.commits[0].authorName, 'Test');
  assert.equal(result.commits[0].authorEmail, 'test@example.com');
  assert.equal(result.commits[0].message, 'fix: spaces & "quotes"');
  assert.doesNotThrow(() => new Date(result.commits[0].date).toISOString());
  assert.ok((await gitService.history(commitName, 50)).commits.length <= 50);
  await assert.rejects(() => gitService.history(commitName, 0), /between 1 and 50/);
  await assert.rejects(() => gitService.history(commitName, 51), /between 1 and 50/);
  await assert.rejects(() => gitService.history(commitName, 'not-a-number'), /between 1 and 50/);
});

test('returns empty history for no-commit and non-repository projects', async () => {
  assert.deepEqual(await gitService.history(emptyRepoName), { project: emptyRepoName, isRepository: true, commits: [] });
  assert.deepEqual(await gitService.history(nonRepoName), { project: nonRepoName, isRepository: false, commits: [] });
});

test('lists, creates, and switches local branches', async () => {
  let result = await gitService.branches(commitName);
  assert.equal(result.currentBranch === 'master' || result.currentBranch === 'main', true);
  assert.ok(result.branches.some((branch) => branch.current));

  await gitService.createBranch(commitName, 'feature-test');
  result = await gitService.branches(commitName);
  assert.ok(result.branches.some((branch) => branch.name === 'feature-test' && !branch.current));

  await gitService.switchBranch(commitName, 'feature-test');
  assert.equal((await gitService.branches(commitName)).currentBranch, 'feature-test');
  await gitService.switchBranch(commitName, result.currentBranch);
});

test('rejects invalid, duplicate, and nonexistent branches safely', async () => {
  await assert.rejects(() => gitService.createBranch(commitName, ''), /Invalid branch name/);
  await assert.rejects(() => gitService.createBranch(commitName, 'bad..name'), /Invalid branch name/);
  await assert.rejects(() => gitService.createBranch(commitName, '-bad'), /Invalid branch name/);
  await assert.rejects(() => gitService.createBranch(commitName, 'feature-test'), /already exists/);
  await assert.rejects(() => gitService.switchBranch(commitName, 'does-not-exist'), /does not exist/);
  await assert.rejects(() => gitService.createBranch(commitName, '--format=%(refname)'), /Invalid branch name/);
});

test('handles no-commit and non-repository branch behavior', async () => {
  assert.deepEqual(await gitService.branches(emptyRepoName), { project: emptyRepoName, isRepository: true, currentBranch: 'master', branches: [] });
  await assert.rejects(() => gitService.createBranch(emptyRepoName, 'feature'), /Cannot create a branch/);
  assert.deepEqual(await gitService.branches(nonRepoName), { project: nonRepoName, isRepository: false, currentBranch: '', branches: [] });
  await assert.rejects(() => gitService.switchBranch(nonRepoName, 'feature'), /not a Git repository/);
});

test('does not switch branches when uncommitted changes would be overwritten', async () => {
  const originalBranch = (await gitService.branches(commitName)).currentBranch;
  await gitService.switchBranch(commitName, 'feature-test');
  await fs.writeFile(path.join(commitPath, 'tracked.txt'), 'feature-conflict\n');
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: commitPath });
  await execFileAsync('git', ['commit', '-qm', 'feature change'], { cwd: commitPath });
  await gitService.switchBranch(commitName, originalBranch);
  await fs.writeFile(path.join(commitPath, 'tracked.txt'), 'main-conflict\n');
  await assert.rejects(() => gitService.switchBranch(commitName, 'feature-test'), /local changes|would be overwritten|Please commit|stash/);
});

test('returns commit details and full/file-specific diffs', async () => {
  await fs.writeFile(path.join(commitPath, 'detail.txt'), 'detail\n');
  await gitService.stage(commitName, 'detail.txt');
  await gitService.commit(commitName, 'Add detail file');
  const latest = (await gitService.history(commitName, 1)).commits[0];
  const details = await gitService.getCommitDetails(commitName, latest.hash);
  assert.equal(details.commit.hash, latest.hash);
  assert.equal(details.commit.message, 'Add detail file');
  assert.equal(details.commit.authorName, 'Test');
  assert.ok(details.commit.files.some((file) => file.path === 'detail.txt' && file.status === 'added'));

  const fullDiff = await gitService.getCommitDiff(commitName, latest.hash);
  assert.match(fullDiff.diff, /\+detail/);
  const fileDiff = await gitService.getCommitDiff(commitName, latest.hash, 'detail.txt');
  assert.equal(fileDiff.path, 'detail.txt');
  assert.match(fileDiff.diff, /\+detail/);
});

test('handles initial commit details and rejects unsafe commit inputs', async () => {
  const initial = (await gitService.history(noHeadName, 1)).commits[0];
  const details = await gitService.getCommitDetails(noHeadName, initial.hash);
  assert.ok(details.commit.files.some((file) => file.path === 'script.js' && file.status === 'added'));
  assert.match((await gitService.getCommitDiff(noHeadName, initial.hash, 'script.js')).diff, /\+console/);
  await assert.rejects(() => gitService.getCommitDetails(commitName, '--format=oneline'), /Invalid commit hash/);
  await assert.rejects(() => gitService.getCommitDetails(commitName, 'not-a-commit'), /Invalid commit hash/);
  await assert.rejects(() => gitService.getCommitDetails(commitName, '0000000000000000000000000000000000000000'), /bad object|invalid object|unknown revision|ambiguous/i);
  await assert.rejects(() => gitService.getCommitDiff(commitName, initial.hash, '../outside'), /File path must remain inside the project/);
  assert.deepEqual(await gitService.getCommitDetails(nonRepoName, initial.hash), { project: nonRepoName, isRepository: false });
});

test('returns file history in Git order and file-specific historical diffs', async () => {
  const history = await gitService.getFileHistory(commitName, 'detail.txt');
  assert.equal(history.path, 'detail.txt');
  assert.ok(history.commits.length >= 1);
  assert.equal(history.commits[0].message, 'Add detail file');
  assert.equal(history.commits[0].authorName, 'Test');
  assert.equal(history.commits[0].authorEmail, 'test@example.com');
  assert.doesNotThrow(() => new Date(history.commits[0].date).toISOString());
  const diff = await gitService.getFileHistoryDiff(commitName, 'detail.txt', history.commits[0].hash);
  assert.equal(diff.path, 'detail.txt');
  assert.match(diff.diff, /\+detail/);
  assert.deepEqual(await gitService.getFileHistory(commitName, 'does-not-exist.txt'), { project: commitName, isRepository: true, path: 'does-not-exist.txt', commits: [] });
  assert.deepEqual(await gitService.getFileHistory(nonRepoName, 'detail.txt'), { project: nonRepoName, isRepository: false, path: 'detail.txt', commits: [] });
});

test('rejects unsafe file-history paths and commit hashes', async () => {
  await assert.rejects(() => gitService.getFileHistory(commitName, '../outside'), /File path must remain inside the project/);
  await assert.rejects(() => gitService.getFileHistory(commitName, 'C:\\outside.txt'), /File path must remain inside the project/);
  await assert.rejects(() => gitService.getFileHistory(commitName, '-bad.txt'), /File path must remain inside the project/);
  await assert.rejects(() => gitService.getFileHistoryDiff(commitName, 'detail.txt', '--format=oneline'), /Invalid commit hash/);
  await assert.rejects(() => gitService.getFileHistoryDiff(commitName, 'detail.txt', '0000000000000000000000000000000000000000'), /bad object|invalid object|unknown revision|ambiguous|needed a single revision/i);
});

test('rejects invalid stage paths and surfaces Git failures', async () => {
  await assert.rejects(() => gitService.stage(projectName, '../outside'), /File path must remain inside the project/);
  await assert.rejects(() => gitService.unstage(projectName, 'C:\\outside.txt'), /File path must remain inside the project/);
  await assert.rejects(() => gitService.stage(nonRepoName, 'file.txt'), /not a git repository/);
});

test('creates, lists, details, applies, and drops stashes safely', async () => {
  const stashName = `.stash-test-${process.pid}`;
  const stashPath = path.resolve(__dirname, '../../workspace', stashName);
  await fs.mkdir(stashPath, { recursive: true });
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: stashPath });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: stashPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: stashPath });
    await fs.writeFile(path.join(stashPath, 'tracked.txt'), 'initial\n');
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: stashPath });
    await execFileAsync('git', ['commit', '-qm', 'initial'], { cwd: stashPath });
    await fs.writeFile(path.join(stashPath, 'tracked.txt'), 'changed\n');
    await fs.writeFile(path.join(stashPath, 'untracked.txt'), 'do not stash\n');
    const created = await gitService.stash(stashName, 'WIP test');
    assert.equal(created.reference, 'stash@{0}');
    assert.equal((await fs.readFile(path.join(stashPath, 'tracked.txt'), 'utf8')).replace(/\r/g, ''), 'initial\n');
    assert.equal((await fs.readFile(path.join(stashPath, 'untracked.txt'), 'utf8')), 'do not stash\n');
    const listed = await gitService.stashes(stashName);
    assert.equal(listed.stashes[0].message, 'On master: WIP test');
    const details = await gitService.stashDetails(stashName, '0');
    assert.match(details.stash.diff, /changed/);
    await gitService.applyStash(stashName, '0');
    assert.equal((await fs.readFile(path.join(stashPath, 'tracked.txt'), 'utf8')).replace(/\r/g, ''), 'changed\n');
    await gitService.dropStash(stashName, '0');
    assert.equal((await gitService.stashes(stashName)).stashes.length, 0);
    await assert.rejects(() => gitService.stashDetails(stashName, '-1'), /Stash index/);
    await assert.rejects(() => gitService.stashDetails(stashName, '50'), /Stash index/);
    await assert.rejects(() => gitService.stash(stashName, '\u0000bad'), /control characters/);
  } finally { await fs.rm(stashPath, { recursive: true, force: true }); }
});

test('returns non-repository diff status for a normal project', async () => {
  assert.deepEqual(await gitService.getDiff(nonRepoName), { project: nonRepoName, isRepository: false, files: [] });
});

test('rejects invalid project paths', async () => {
  await assert.rejects(() => gitService.getStatus('../outside'), /Project name must be a single folder name/);
});
