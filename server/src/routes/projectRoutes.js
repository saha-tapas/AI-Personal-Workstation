const express = require('express');
const {
  listProjects,
  createProject,
  deleteProject,
} = require('../controllers/projectController');

const router = express.Router();

router.get('/', listProjects);
router.post('/', createProject);
router.delete('/:name', deleteProject);

module.exports = router;
