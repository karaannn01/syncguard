const conflictResolver = require('../services/conflictResolver');
const db = require('../config/db');

class ConflictController {
  async getAllConflicts(req, res) {
    try {
      const { status = 'UNRESOLVED', entityId } = req.query;

      let queryText = 'SELECT * FROM conflicts WHERE 1=1';
      const params = [];
      let pIdx = 1;

      if (status && status !== 'ALL') {
        queryText += ` AND status = $${pIdx++}`;
        params.push(status);
      }

      if (entityId) {
        queryText += ` AND entity_id = $${pIdx++}`;
        params.push(entityId);
      }

      queryText += ' ORDER BY created_at DESC';

      const result = await db.query(queryText, params);

      // Parse JSON fields
      const conflicts = result.rows.map(c => ({
        ...c,
        server_values: typeof c.server_values === 'string' ? JSON.parse(c.server_values) : c.server_values,
        local_values: typeof c.local_values === 'string' ? JSON.parse(c.local_values) : c.local_values,
        conflicting_fields: typeof c.conflicting_fields === 'string' ? JSON.parse(c.conflicting_fields) : c.conflicting_fields,
        resolved_values: c.resolved_values && typeof c.resolved_values === 'string' ? JSON.parse(c.resolved_values) : c.resolved_values
      }));

      // Enrich with task title where entity_type === 'task'
      for (const c of conflicts) {
        if (c.entity_type === 'task') {
          const tRes = await db.query('SELECT title, machine_name FROM tasks WHERE id = $1', [c.entity_id]);
          if (tRes.rows.length > 0) {
            c.taskTitle = tRes.rows[0].title;
            c.machineName = tRes.rows[0].machine_name;
          }
        }
      }

      res.json({
        conflicts,
        count: conflicts.length
      });
    } catch (err) {
      console.error('Error fetching conflicts:', err);
      res.status(500).json({ error: 'Failed to retrieve conflicts' });
    }
  }

  async getConflictById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query('SELECT * FROM conflicts WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conflict not found' });
      }

      const c = result.rows[0];
      const conflict = {
        ...c,
        server_values: typeof c.server_values === 'string' ? JSON.parse(c.server_values) : c.server_values,
        local_values: typeof c.local_values === 'string' ? JSON.parse(c.local_values) : c.local_values,
        conflicting_fields: typeof c.conflicting_fields === 'string' ? JSON.parse(c.conflicting_fields) : c.conflicting_fields,
        resolved_values: c.resolved_values && typeof c.resolved_values === 'string' ? JSON.parse(c.resolved_values) : c.resolved_values
      };

      // Enrich with entity details
      if (conflict.entity_type === 'task') {
        const tRes = await db.query('SELECT * FROM tasks WHERE id = $1', [conflict.entity_id]);
        conflict.currentServerTask = tRes.rows[0] || null;
      }

      res.json({ conflict });
    } catch (err) {
      console.error('Error fetching conflict details:', err);
      res.status(500).json({ error: 'Failed to retrieve conflict details' });
    }
  }

  async resolveConflict(req, res) {
    try {
      const { id } = req.params;
      const { resolutionType, resolvedValues } = req.body;
      const userId = req.user?.id || 'usr-tech-01';

      if (!resolutionType || !['KEEP_SERVER', 'KEEP_LOCAL', 'MERGE'].includes(resolutionType)) {
        return res.status(400).json({
          error: "Invalid resolutionType. Must be 'KEEP_SERVER', 'KEEP_LOCAL', or 'MERGE'"
        });
      }

      console.log(`Resolving conflict ${id} with strategy [${resolutionType}] by user [${userId}]`);

      const outcome = await conflictResolver.resolve({
        conflictId: id,
        resolutionType,
        resolvedValues,
        userId
      });

      res.json(outcome);
    } catch (err) {
      console.error('Error resolving conflict:', err);
      res.status(500).json({ error: 'Failed to resolve conflict', details: err.message });
    }
  }
}

module.exports = new ConflictController();
