const express = require('express');
const { listFiles, searchProject, createFolder, createFile, renameItem, deleteItem, uploadFiles, downloadFile, getEditableFile, saveEditableFile } = require('../controllers/fileController');

const router = express.Router();

router.get('/:project/search', searchProject);
router.get('/:project', listFiles);
router.post('/:project/folder', createFolder);
router.post('/:project/file', createFile);
router.patch('/:project/item', renameItem);
router.delete('/:project/item', deleteItem);
router.post('/:project/upload', uploadFiles);
router.get('/:project/download', downloadFile);
router.get('/:project/file', getEditableFile);
router.put('/:project/file', saveEditableFile);

module.exports = router;
