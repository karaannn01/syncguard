const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/', authenticate, (req, res) => syncController.syncBatch(req, res));
router.get('/status', authenticate, (req, res) => syncController.getSyncStatus(req, res));

module.exports = router;
