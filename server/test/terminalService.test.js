const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const terminalService = require('../src/services/terminalService');

test('accepts only reviewed workspace commands', () => {
  assert.deepEqual(terminalService.parseTerminalCommand('pwd'), { name: 'pwd', args: [] });
  assert.deepEqual(terminalService.parseTerminalCommand('cd src'), { name: 'cd', args: ['src'] });
  assert.deepEqual(terminalService.parseTerminalCommand('dir "src folder"'), { name: 'dir', args: ['src folder'] });
  assert.deepEqual(terminalService.parseTerminalCommand('cat src/app.js'), { name: 'cat', args: ['src/app.js'] });
});

test('rejects shell syntax, interpreters, options, and traversal', () => {
  for (const command of ['dir && whoami', 'cat > out.txt', 'node -e "x"', 'powershell Get-ChildItem', 'dir ..', 'dir C:\\outside', 'dir -la']) {
    assert.throws(() => terminalService.parseTerminalCommand(command), /not allowed|unsupported|inside|options/);
  }
});

test('info returns only safe project and terminal context', async () => {
  const result = await terminalService.executeCommand('New', 'info', '/test3');

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'Project: New\nWorking directory: /test3\nPlatform: Windows\nShell: restricted\n');
  assert.equal(result.cwd, '/test3');
  assert.equal(result.stderr, '');
});

test('lists only the validated workspace directory', async () => {
  const result = await terminalService.executeCommand('New', 'dir test3', '/');

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /nested/);
  assert.equal(result.cwd, '/');
});

test('info reports the cwd established by cd', async () => {
  const changed = await terminalService.executeCommand('New', 'cd test3', '/');
  const result = await terminalService.executeCommand('New', 'info', changed.cwd);

  assert.equal(changed.changedDirectory, true);
  assert.equal(changed.cwd, '/test3');
  assert.match(result.stdout, /Working directory: \/test3\n/);
  assert.equal(result.cwd, '/test3');
});

test('reads a nested path containing spaces and reports safe failures', async () => {
  const result = await terminalService.executeCommand('New', 'cat "src/other file.js"', '/');
  assert.equal(result.stdout, '');
  assert.equal(result.exitCode, 0);

  const missing = await terminalService.executeCommand('New', 'cat missing.js', '/');
  assert.equal(missing.exitCode, 1);
  assert.match(missing.stderr, /not found/i);
});

test('rejects invalid projects, cwd traversal, and cancelled streams', async () => {
  await assert.rejects(() => terminalService.executeCommand('missing-project', 'pwd'), /project/i);

  const events = [];
  await terminalService.executeCommandStream('New', 'pwd', (event) => events.push(event), { destroyed: true }, '/');
  assert.deepEqual(events, []);
});

test('limits safe command output', async () => {
  const filePath = path.resolve(__dirname, '../../workspace/New/.terminal-output-test.txt');
  await fs.writeFile(filePath, 'x'.repeat(1024 * 1024 + 10));
  try {
    const result = await terminalService.executeCommand('New', 'cat .terminal-output-test.txt');
    assert.equal(result.exitCode, 124);
    assert.equal(result.outputLimited, true);
    assert.match(result.stderr, /1 MB/);
    assert.equal(Buffer.byteLength(result.stdout), 1024 * 1024);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});
