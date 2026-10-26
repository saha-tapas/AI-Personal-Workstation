const fs = require('fs/promises');
const path = require('path');
const { getProjectPath, getProjectWorkingPath } = require('./projectService');

const MAX_OUTPUT_BYTES = 1024 * 1024;
const COMMANDS = new Set(['info', 'pwd', 'cd', 'dir', 'ls', 'type', 'cat']);
const SHELL_SYNTAX = /[&|<>;`$()\r\n]/;

function parseTerminalCommand(command) {
  if (typeof command !== 'string' || !command.trim()) throw new Error('Command is required.');
  if (SHELL_SYNTAX.test(command)) throw new Error('Shell syntax is not allowed.');
  const tokens = [];
  let token = '';
  let quote = '';
  for (const character of command) {
    if (quote) {
      if (character === quote) quote = '';
      else token += character;
    } else if (character === '"' || character === "'") quote = character;
    else if (/\s/.test(character)) { if (token) { tokens.push(token); token = ''; } }
    else token += character;
  }
  if (quote) throw new Error('Unterminated quoted argument.');
  if (token) tokens.push(token);
  const name = tokens.shift()?.toLowerCase();
  if (!COMMANDS.has(name)) throw new Error('Command is not allowed.');
  if (tokens.some((argument) => argument.startsWith('-'))) throw new Error('Command options are not allowed.');
  const limits = { info: 0, pwd: 0, cd: 1, dir: 1, ls: 1, type: 1, cat: 1 };
  if (tokens.length > limits[name]) throw new Error('Unsupported command arguments.');
  if (tokens.some((argument) => path.isAbsolute(argument) || argument.split(/[\\/]/).includes('..'))) throw new Error('Paths must remain inside the project.');
  return { name, args: tokens };
}

function assertInside(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path must remain inside the project.');
}

async function getSafeCwd(project, cwd) {
  const { projectPath } = getProjectPath(project);
  const context = getProjectWorkingPath(project, cwd);
  const [realRoot, realCwd] = await Promise.all([fs.realpath(projectPath), fs.realpath(context.workingPath).catch(() => null)]);
  if (!realCwd) throw new Error('Working directory was not found.');
  assertInside(realRoot, realCwd);
  if (!(await fs.stat(realCwd)).isDirectory()) throw new Error('Working directory was not found.');
  return { ...context, realRoot, realCwd };
}

async function getSafeEntry(context, relativePath, expectDirectory) {
  const target = path.resolve(context.realCwd, relativePath || '.');
  const realTarget = await fs.realpath(target).catch(() => null);
  if (!realTarget) throw new Error('Path was not found.');
  assertInside(context.realRoot, realTarget);
  const stats = await fs.stat(realTarget);
  if (expectDirectory !== undefined && stats.isDirectory() !== expectDirectory) throw new Error(expectDirectory ? 'Path is not a directory.' : 'Path is not a file.');
  return { realTarget, stats };
}

function limitOutput(value) {
  const buffer = Buffer.from(value);
  if (buffer.length <= MAX_OUTPUT_BYTES) return { value, limited: false };
  return { value: buffer.subarray(0, MAX_OUTPUT_BYTES).toString('utf8'), limited: true };
}

async function executeSafe(project, command, cwd) {
  const parsed = parseTerminalCommand(command);
  const context = await getSafeCwd(project, cwd);
  if (parsed.name === 'info') return { stdout: `Project: ${context.projectName}\nWorking directory: ${context.relativePath}\nPlatform: Windows\nShell: restricted\n`, stderr: '', exitCode: 0, cwd: context.relativePath };
  if (parsed.name === 'pwd') return { stdout: `${context.relativePath}\n`, stderr: '', exitCode: 0, cwd: context.relativePath };
  if (parsed.name === 'cd') {
    const next = await getSafeEntry(context, parsed.args[0] || '.', true);
    const relative = path.relative(context.realRoot, next.realTarget);
    return { stdout: '', stderr: '', exitCode: 0, cwd: relative ? `/${relative.replace(/\\/g, '/')}` : '/', changedDirectory: true };
  }
  const isDirectory = parsed.name === 'dir' || parsed.name === 'ls';
  const entry = await getSafeEntry(context, parsed.args[0] || '.', isDirectory ? true : false);
  const stdout = isDirectory
    ? (await fs.readdir(entry.realTarget, { withFileTypes: true })).map((item) => item.name).join('\n') + '\n'
    : await fs.readFile(entry.realTarget, 'utf8');
  const limited = limitOutput(stdout);
  return { stdout: limited.value, stderr: limited.limited ? 'Output exceeded the 1 MB limit.\n' : '', exitCode: limited.limited ? 124 : 0, cwd: context.relativePath, outputLimited: limited.limited };
}

async function executeCommand(project, command, cwd = '') {
  parseTerminalCommand(command);
  await getSafeCwd(project, cwd);
  try { return await executeSafe(project, command, cwd); }
  catch (error) { return { stdout: '', stderr: error.message, exitCode: 1, cwd: cwd || '/' }; }
}

async function executeCommandStream(project, command, onEvent, request, cwd = '') {
  if (request?.destroyed || request?.aborted) return;
  try {
    const result = await executeSafe(project, command, cwd);
    if (result.stdout) onEvent({ type: 'stdout', data: result.stdout });
    if (result.stderr) onEvent({ type: 'stderr', data: result.stderr });
    onEvent({ type: 'complete', exitCode: result.exitCode, cwd: result.cwd, timedOut: false, cancelled: false, ...(result.changedDirectory ? { changedDirectory: true } : {}), ...(result.outputLimited ? { outputLimited: true } : {}) });
  } catch (error) {
    onEvent({ type: 'error', message: error.message });
    onEvent({ type: 'complete', exitCode: 1, cwd: cwd || '/', timedOut: false, cancelled: false });
  }
}

module.exports = { executeCommand, executeCommandStream, parseTerminalCommand };
