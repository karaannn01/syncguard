const express = require('express');
const router = express.Router();
const conflictController = require('../controllers/conflictController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, (req, res) => conflictController.getAllConflicts(req, res));
router.get('/:id', authenticate, (req, res) => conflictController.getConflictById(req, res));
router.post('/:id/resolve', authenticate, (req, res) => conflictController.resolveConflict(req, res));

module.exports = router;
