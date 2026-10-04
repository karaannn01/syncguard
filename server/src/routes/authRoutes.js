const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/login', (req, res) => authController.login(req, res));
router.get('/me', authenticate, (req, res) => authController.me(req, res));
router.get('/users', authenticate, (req, res) => authController.getUsers(req, res));

module.exports = router;
