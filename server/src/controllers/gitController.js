const gitService = require('../services/gitService');

async function status(req, res) {
  try {
    return res.json({ success: true, ...await gitService.getStatus(req.params.project) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function diff(req, res) {
  try {
    return res.json({ success: true, ...await gitService.getDiff(req.params.project, req.query.path) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function stage(req, res) {
  return mutate(req, res, () => gitService.stage(req.params.project, req.body?.path));
}

async function unstage(req, res) {
  return mutate(req, res, () => gitService.unstage(req.params.project, req.body?.path));
}

async function stageAll(req, res) {
  return mutate(req, res, () => gitService.stageAll(req.params.project));
}

async function unstageAll(req, res) {
  return mutate(req, res, () => gitService.unstageAll(req.params.project));
}

async function commit(req, res) {
  try {
    return res.json({ success: true, ...await gitService.commit(req.params.project, req.body?.message) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function history(req, res) {
  try {
    return res.json({ success: true, ...await gitService.history(req.params.project, req.query.limit) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function stashes(req, res) {
  try { return res.json({ success: true, ...await gitService.stashes(req.params.project, req.query.limit) }); }
  catch (error) { const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400; return res.status(statusCode).json({ success: false, error: error.message }); }
}

async function stash(req, res) { return mutate(req, res, () => gitService.stash(req.params.project, req.body?.message)); }
async function stashDetails(req, res) {
  try { return res.json({ success: true, ...await gitService.stashDetails(req.params.project, req.params.index) }); }
  catch (error) { const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400; return res.status(statusCode).json({ success: false, error: error.message }); }
}
async function applyStash(req, res) { return mutate(req, res, () => gitService.applyStash(req.params.project, req.params.index)); }
async function dropStash(req, res) { return mutate(req, res, () => gitService.dropStash(req.params.project, req.params.index)); }

async function branches(req, res) {
  try {
    return res.json({ success: true, ...await gitService.branches(req.params.project) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function createBranch(req, res) {
  return mutate(req, res, () => gitService.createBranch(req.params.project, req.body?.name));
}

async function switchBranch(req, res) {
  return mutate(req, res, () => gitService.switchBranch(req.params.project, req.body?.name));
}

async function commitDetails(req, res) {
  try {
    return res.json({ success: true, ...await gitService.getCommitDetails(req.params.project, req.params.hash) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function commitDiff(req, res) {
  try {
    return res.json({ success: true, ...await gitService.getCommitDiff(req.params.project, req.params.hash, req.query.path) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function fileHistory(req, res) {
  try {
    return res.json({ success: true, ...await gitService.getFileHistory(req.params.project, req.query.path) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function fileHistoryDiff(req, res) {
  try {
    return res.json({ success: true, ...await gitService.getFileHistoryDiff(req.params.project, req.query.path, req.query.commit) });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function mutate(req, res, operation) {
  try {
    await operation();
    return res.json({ success: true });
  } catch (error) {
    const statusCode = error.code === 'PROJECT_NOT_FOUND' ? 404 : error.code === 'GIT_NOT_INSTALLED' ? 503 : 400;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}

module.exports = { status, diff, stage, unstage, stageAll, unstageAll, commit, history, stashes, stash, stashDetails, applyStash, dropStash, branches, createBranch, switchBranch, commitDetails, commitDiff, fileHistory, fileHistoryDiff };
