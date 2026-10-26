const terminalService = require('../services/terminalService');

async function execute(req, res) {
  try {
    const result = await terminalService.executeCommand(req.body?.project, req.body?.command, req.body?.cwd);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

async function executeStream(req, res) {
  res.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event) => { if (!res.writableEnded) res.write(JSON.stringify(event) + '\n'); };
  try {
    await terminalService.executeCommandStream(req.body?.project, req.body?.command, send, req, req.body?.cwd);
  } catch (error) {
    send({ type: 'error', message: error.message });
    send({ type: 'complete', exitCode: 1, cwd: '', timedOut: false });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

module.exports = { execute, executeStream };
