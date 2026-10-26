const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const app = require('../src/index');

function request(server, method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const request = http.request({
      port: server.address().port,
      method,
      path: requestPath,
      headers: body === undefined ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    }, (response) => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: responseBody }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

test('demo mode permits health and read-only project listing but blocks mutations, Terminal, and Git', async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'true';
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    assert.equal((await request(server, 'GET', '/api/health')).status, 200);
    assert.equal((await request(server, 'GET', '/api/projects')).status, 200);
    const listed = JSON.parse((await request(server, 'GET', '/api/projects')).body);
    assert.deepEqual(listed.projects, [{ name: 'SampleProject' }]);
    assert.equal((await request(server, 'GET', '/api/files/SampleProject')).status, 200);
    const file = await request(server, 'GET', '/api/files/SampleProject/file?path=README.md');
    assert.equal(file.status, 200);
    assert.match(file.body, /safe sample content/);
    assert.equal((await request(server, 'GET', '/api/files/New/file?path=script.js')).status, 400);
    assert.equal((await request(server, 'GET', '/api/files/SampleProject/file?path=..%2F..%2Fserver%2F.env')).status, 400);
    assert.equal((await request(server, 'POST', '/api/projects', { name: 'blocked-demo-project' })).status, 403);
    assert.equal((await request(server, 'POST', '/api/terminal/execute', { project: 'New', command: 'pwd' })).status, 403);
    assert.equal((await request(server, 'GET', '/api/git/New/status')).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
  }
});

test('demo mode fails safely when demo data is unavailable', async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'true';
  const demoRoot = path.resolve(__dirname, '../../demo-data');
  const backupRoot = `${demoRoot}.test-backup`;
  await fs.rename(demoRoot, backupRoot);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    assert.equal((await request(server, 'GET', '/api/projects')).status, 500);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rename(backupRoot, demoRoot);
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
  }
});

test('disabled demo mode preserves existing route behavior', async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  delete process.env.DEMO_MODE;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    assert.notEqual((await request(server, 'POST', '/api/projects', {})).status, 403);
    assert.notEqual((await request(server, 'POST', '/api/terminal/execute', {})).status, 403);
    assert.notEqual((await request(server, 'GET', '/api/git/New/status')).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
  }
});
