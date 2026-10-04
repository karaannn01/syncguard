const db = require('../config/db');
const { seedData } = require('../models/seed');
const { createSchema } = require('../models/schema');

class AdminController {
  async getOverview(req, res) {
    try {
      const devices = await db.query('SELECT * FROM devices ORDER BY last_sync_at DESC');
      const users = await db.query('SELECT id, username, email, role, full_name FROM users');
      const conflictSummary = await db.query(`
        SELECT status, count(*) as count 
        FROM conflicts 
        GROUP BY status
      `);
      const operationStats = await db.query(`
        SELECT status, count(*) as count 
        FROM sync_operations 
        GROUP BY status
      `);
      const recentActivity = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 25');

      res.json({
        devices: devices.rows,
        users: users.rows,
        conflictSummary: conflictSummary.rows,
        operationStats: operationStats.rows,
        recentActivity: recentActivity.rows
      });
    } catch (err) {
      console.error('Error fetching admin overview:', err);
      res.status(500).json({ error: 'Failed to retrieve admin overview' });
    }
  }

  async getActivityLogs(req, res) {
    try {
      const { limit = 50, entityId } = req.query;
      let queryText = 'SELECT * FROM activity_logs WHERE 1=1';
      const params = [];
      let pIdx = 1;

      if (entityId) {
        queryText += ` AND entity_id = $${pIdx++}`;
        params.push(entityId);
      }

      queryText += ` ORDER BY timestamp DESC LIMIT $${pIdx}`;
      params.push(parseInt(limit, 10));

      const result = await db.query(queryText, params);
      res.json({
        activity: result.rows.map(r => ({
          ...r,
          details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : r.details
        }))
      });
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      res.status(500).json({ error: 'Failed to retrieve activity logs' });
    }
  }

  async resetDemoData(req, res) {
    try {
      console.log('Resetting demo environment to default baseline...');

      // Clear operational tables
      await db.query('DELETE FROM conflicts');
      await db.query('DELETE FROM sync_operations');
      await db.query('DELETE FROM task_updates');
      await db.query('DELETE FROM task_checklists');
      await db.query('DELETE FROM tasks');
      await db.query('DELETE FROM devices');
      await db.query('DELETE FROM users');
      await db.query('DELETE FROM activity_logs');

      // Re-seed
      await seedData();

      res.json({
        success: true,
        message: 'SyncGuard demo database reset to default baseline (Task 7701 at version 7). Ready for multi-device test run.'
      });
    } catch (err) {
      console.error('Error resetting demo:', err);
      res.status(500).json({ error: 'Failed to reset demo data', details: err.message });
    }
  }
}

module.exports = new AdminController();
