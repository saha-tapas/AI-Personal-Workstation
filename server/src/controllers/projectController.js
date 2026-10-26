const projectService = require('../services/projectService');

async function listProjects(req, res) {
  try {
    const projects = await projectService.listProjects();
    return res.json({ success: true, projects });
  } catch {
    return res.status(500).json({ success: false, error: 'Unable to list projects.' });
  }
}

async function createProject(req, res) {
  try {
    const project = await projectService.createProject(req.body?.name);
    return res.status(201).json({ success: true, project });
  } catch (error) {
    const status = error.code === 'PROJECT_EXISTS' ? 409 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

async function deleteProject(req, res) {
  try {
    await projectService.deleteProject(req.params.name);
    return res.json({ success: true });
  } catch (error) {
    const status = error.code === 'PROJECT_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
}

module.exports = { listProjects, createProject, deleteProject };
