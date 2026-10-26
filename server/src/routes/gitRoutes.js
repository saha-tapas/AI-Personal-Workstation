const express = require('express');
const { status, diff, stage, unstage, stageAll, unstageAll, commit, history, stashes, stash, stashDetails, applyStash, dropStash, branches, createBranch, switchBranch, commitDetails, commitDiff, fileHistory, fileHistoryDiff } = require('../controllers/gitController');

const router = express.Router();

router.get('/:project/status', status);
router.get('/:project/diff', diff);
router.post('/:project/stage', stage);
router.post('/:project/unstage', unstage);
router.post('/:project/stage-all', stageAll);
router.post('/:project/unstage-all', unstageAll);
router.post('/:project/commit', commit);
router.get('/:project/history', history);
router.get('/:project/stashes', stashes);
router.post('/:project/stash', stash);
router.get('/:project/stash/:index', stashDetails);
router.post('/:project/stash/:index/apply', applyStash);
router.delete('/:project/stash/:index', dropStash);
router.get('/:project/branches', branches);
router.post('/:project/branches', createBranch);
router.post('/:project/branches/switch', switchBranch);
router.get('/:project/commit/:hash/diff', commitDiff);
router.get('/:project/commit/:hash', commitDetails);
router.get('/:project/file-history/diff', fileHistoryDiff);
router.get('/:project/file-history', fileHistory);

module.exports = router;
