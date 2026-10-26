const express = require('express');
const { execute, executeStream } = require('../controllers/terminalController');

const router = express.Router();
router.post('/execute', execute);
router.post('/execute-stream', executeStream);

module.exports = router;
