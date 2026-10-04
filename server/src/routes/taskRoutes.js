const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, (req, res) => taskController.getAllTasks(req, res));
router.get('/:id', authenticate, (req, res) => taskController.getTaskById(req, res));
router.post('/', authenticate, (req, res) => taskController.createTask(req, res));
router.patch('/:id', authenticate, (req, res) => taskController.updateTask(req, res));
router.delete('/:id', authenticate, (req, res) => taskController.deleteTask(req, res));
router.get('/:id/history', authenticate, (req, res) => taskController.getTaskHistory(req, res));

module.exports = router;
