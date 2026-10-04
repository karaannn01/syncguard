const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/overview', authenticate, (req, res) => adminController.getOverview(req, res));
router.get('/activity', authenticate, (req, res) => adminController.getActivityLogs(req, res));
router.post('/reset-demo', authenticate, (req, res) => adminController.resetDemoData(req, res));

module.exports = router;
