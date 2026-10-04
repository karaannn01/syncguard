const syncEngine = require('../services/syncEngine');
const db = require('../config/db');

class SyncController {
  async syncBatch(req, res) {
    try {
      const { operations = [], deviceId } = req.body;
      const userId = req.user?.id || 'usr-tech-01';

      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations must be an array' });
      }

      console.log(`Sync request received from device [${deviceId || 'unknown'}] with ${operations.length} operations.`);

      const result = await syncEngine.processBatch({
        operations,
        userId,
        deviceId: deviceId || req.headers['x-device-id'] || 'dev-unknown'
      });

      res.json(result);
    } catch (err) {
      console.error('Batch sync failure:', err);
      res.status(500).json({ error: 'Failed to process sync batch', details: err.message });
    }
  }

  async getSyncStatus(req, res) {
    try {
      const deviceId = req.query.deviceId || req.headers['x-device-id'];

      // Query counts
      const tasksCountRes = await db.query('SELECT COUNT(*) as count FROM tasks');
      const conflictsCountRes = await db.query("SELECT COUNT(*) as count FROM conflicts WHERE status = 'UNRESOLVED'");
      const operationsCountRes = await db.query('SELECT COUNT(*) as count FROM sync_operations');
      const devicesRes = await db.query('SELECT * FROM devices ORDER BY last_sync_at DESC LIMIT 10');

      let deviceStatus = null;
      if (deviceId) {
        const dRes = await db.query('SELECT * FROM devices WHERE device_id = $1', [deviceId]);
        deviceStatus = dRes.rows[0] || null;
      }

      // Recent 10 operations
      const recentOps = await db.query('SELECT * FROM sync_operations ORDER BY processed_at DESC LIMIT 10');

      res.json({
        online: true,
        serverTime: new Date().toISOString(),
        totalTasks: parseInt(tasksCountRes.rows[0].count, 10),
        unresolvedConflicts: parseInt(conflictsCountRes.rows[0].count, 10),
        totalSyncOperations: parseInt(operationsCountRes.rows[0].count, 10),
        device: deviceStatus,
        registeredDevices: devicesRes.rows,
        recentOperations: recentOps.rows
      });
    } catch (err) {
      console.error('Error getting sync status:', err);
      res.status(500).json({ error: 'Failed to fetch sync status' });
    }
  }
}

module.exports = new SyncController();
