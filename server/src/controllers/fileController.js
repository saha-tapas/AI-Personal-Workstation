const fileService = require('../services/fileService');

async function listFiles(req, res) {
  try {
    const result = await fileService.listFiles(req.params.project, req.query.path || '');
    return res.json({ success: true, ...result });
  } catch (error) {
    const status = error.code === 'FILE_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function searchProject(req, res) {
  try {
    const results = await fileService.searchProject(req.params.project, req.query.q || '');
    return res.json({ success: true, results });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

async function createFolder(req, res) {
  try {
    const item = await fileService.createFolder(req.params.project, req.body?.path || '', req.body?.name);
    return res.status(201).json({ success: true, item });
  } catch (error) {
    const status = error.code === 'FILE_EXISTS' ? 409 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function createFile(req, res) {
  try {
    const item = await fileService.createFile(req.params.project, req.body?.path || '', req.body?.name);
    return res.status(201).json({ success: true, item });
  } catch (error) {
    const status = error.code === 'FILE_EXISTS' ? 409 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function renameItem(req, res) {
  try {
    const item = await fileService.renameItem(req.params.project, req.body?.path || '', req.body?.name, req.body?.newName);
    return res.json({ success: true, item });
  } catch (error) {
    const status = error.code === 'FILE_NOT_FOUND' ? 404 : error.code === 'FILE_EXISTS' ? 409 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function deleteItem(req, res) {
  try {
    await fileService.deleteItem(req.params.project, req.body?.path || '', req.body?.name);
    return res.json({ success: true });
  } catch (error) {
    const status = error.code === 'FILE_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function uploadFiles(req, res) {
  try {
    const result = await fileService.uploadFiles(req.params.project, req, req.headers['content-type'] || '');
    const status = result.failed.length ? 409 : 201;
    return res.status(status).json({ success: result.failed.length === 0, ...result });
  } catch (error) {
    return res.status(error.code === 'UPLOAD_TOO_LARGE' ? 413 : 400).json({ success: false, error: error.message });
  }
}

async function downloadFile(req, res) {
  try {
    const file = await fileService.getDownloadFile(req.params.project, req.query.path || '');
    return res.download(file.filePath, file.name);
  } catch (error) {
    const status = error.code === 'FILE_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function getEditableFile(req, res) {
  try {
    const result = await fileService.getEditableFile(req.params.project, req.query.path || '');
    return res.json({ success: true, ...result });
  } catch (error) {
    const status = error.code === 'FILE_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function saveEditableFile(req, res) {
  try {
    const result = await fileService.saveEditableFile(req.params.project, req.body?.path || '', req.body?.content);
    return res.json({ success: true, ...result });
  } catch (error) {
    const status = error.code === 'FILE_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

module.exports = { listFiles, searchProject, createFolder, createFile, renameItem, deleteItem, uploadFiles, downloadFile, getEditableFile, saveEditableFile };
