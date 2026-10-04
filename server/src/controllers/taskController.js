const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

class TaskController {
  async getAllTasks(req, res) {
    try {
      const { status, priority, search, assigned_to } = req.query;

      let queryText = 'SELECT * FROM tasks WHERE 1=1';
      const params = [];
      let pIdx = 1;

      if (status) {
        queryText += ` AND status = $${pIdx++}`;
        params.push(status);
      }
      if (priority) {
        queryText += ` AND priority = $${pIdx++}`;
        params.push(priority);
      }
      if (assigned_to) {
        queryText += ` AND assigned_to = $${pIdx++}`;
        params.push(assigned_to);
      }
      if (search) {
        queryText += ` AND (title LIKE $${pIdx} OR machine_name LIKE $${pIdx} OR location LIKE $${pIdx})`;
        params.push(`%${search}%`);
        pIdx++;
      }

      queryText += ' ORDER BY updated_at DESC';

      const tasksRes = await db.query(queryText, params);
      const tasks = tasksRes.rows;

      // Attach checklist items for each task
      const taskIds = tasks.map(t => t.id);
      let checklistsByTask = {};

      if (taskIds.length > 0) {
        // Query all checklists for these tasks
        const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
        const chkRes = await db.query(
          `SELECT * FROM task_checklists WHERE task_id IN (${placeholders}) ORDER BY order_index ASC`,
          taskIds
        );
        for (const item of chkRes.rows) {
          if (!checklistsByTask[item.task_id]) {
            checklistsByTask[item.task_id] = [];
          }
          checklistsByTask[item.task_id].push({
            ...item,
            is_completed: Boolean(item.is_completed)
          });
        }
      }

      const tasksWithChecklists = tasks.map(t => ({
        ...t,
        checklists: checklistsByTask[t.id] || []
      }));

      res.json({
        tasks: tasksWithChecklists,
        count: tasksWithChecklists.length
      });
    } catch (err) {
      console.error('Error fetching tasks:', err);
      res.status(500).json({ error: 'Failed to retrieve tasks' });
    }
  }

  async getTaskById(req, res) {
    try {
      const { id } = req.params;
      const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);

      if (taskRes.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskRes.rows[0];

      // Fetch checklist items
      const chkRes = await db.query(
        'SELECT * FROM task_checklists WHERE task_id = $1 ORDER BY order_index ASC',
        [id]
      );

      // Fetch version history
      const histRes = await db.query(
        'SELECT * FROM task_updates WHERE task_id = $1 ORDER BY version DESC',
        [id]
      );

      // Check if any open conflict exists on this task
      const conflictRes = await db.query(
        "SELECT * FROM conflicts WHERE entity_id = $1 AND status = 'UNRESOLVED'",
        [id]
      );

      res.json({
        task: {
          ...task,
          checklists: chkRes.rows.map(item => ({ ...item, is_completed: Boolean(item.is_completed) })),
          history: histRes.rows,
          activeConflict: conflictRes.rows[0] || null
        }
      });
    } catch (err) {
      console.error('Error fetching task details:', err);
      res.status(500).json({ error: 'Failed to retrieve task details' });
    }
  }

  async createTask(req, res) {
    try {
      const {
        title,
        description,
        machine_name,
        location,
        priority = 'MEDIUM',
        status = 'PENDING',
        quantity = 0,
        notes = '',
        assigned_to,
        checklists = []
      } = req.body;

      if (!title || !machine_name || !location) {
        return res.status(400).json({ error: 'Title, machine_name, and location are required' });
      }

      const taskId = `tsk-${uuidv4().slice(0, 8)}`;
      const userId = req.user?.id || 'system';
      const now = new Date().toISOString();

      await db.query(
        `INSERT INTO tasks (id, title, description, machine_name, location, priority, status, quantity, notes, assigned_to, version, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12, $13)`,
        [taskId, title, description || '', machine_name, location, priority, status, Number(quantity), notes, assigned_to || userId, userId, now, now]
      );

      // Insert checklists if provided
      if (Array.isArray(checklists)) {
        for (let i = 0; i < checklists.length; i++) {
          const item = checklists[i];
          const chkId = `chk-${uuidv4().slice(0, 8)}`;
          await db.query(
            `INSERT INTO task_checklists (id, task_id, item_text, is_completed, order_index, version)
             VALUES ($1, $2, $3, $4, $5, 1)`,
            [chkId, taskId, item.item_text || item, item.is_completed ? 1 : 0, i + 1]
          );
        }
      }

      // Record snapshot
      const createdRes = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      const createdTask = createdRes.rows[0];

      await db.query(
        `INSERT INTO task_updates (id, task_id, version, changed_fields, snapshot, updated_by, device_id)
         VALUES ($1, $2, 1, $3, $4, $5, 'server-api')`,
        [
          `upd-${uuidv4()}`,
          taskId,
          JSON.stringify(['title', 'machine_name', 'location', 'priority', 'status', 'quantity']),
          JSON.stringify(createdTask),
          userId
        ]
      );

      // Audit log
      await db.query(
        `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, 'server-api', 'TASK_CREATED', 'task', $4, $5)`,
        [
          `act-${uuidv4()}`,
          userId,
          req.user?.fullName || 'Technician',
          taskId,
          JSON.stringify({ title, priority, status })
        ]
      );

      res.status(201).json({
        success: true,
        task: createdTask
      });
    } catch (err) {
      console.error('Error creating task:', err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async updateTask(req, res) {
    try {
      const { id } = req.params;
      const { baseVersion, changedFields, ...updates } = req.body;

      const currentRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const currentTask = currentRes.rows[0];

      // Optimistic concurrency check if baseVersion is provided
      if (baseVersion !== undefined && baseVersion !== currentTask.version) {
        return res.status(409).json({
          error: 'Version mismatch detected. Entity modified by another user.',
          currentVersion: currentTask.version,
          baseVersion
        });
      }

      const newVersion = currentTask.version + 1;
      const now = new Date().toISOString();
      const userId = req.user?.id || 'system';

      const allowedFields = ['title', 'description', 'machine_name', 'location', 'priority', 'status', 'quantity', 'notes', 'assigned_to'];
      const fieldsToUpdate = Object.keys(updates).filter(k => allowedFields.includes(k));

      if (fieldsToUpdate.length === 0) {
        return res.json({ task: currentTask, message: 'No modifiable fields sent' });
      }

      const setClauses = [];
      const values = [];
      let pIdx = 1;

      for (const field of fieldsToUpdate) {
        setClauses.push(`${field} = $${pIdx++}`);
        values.push(field === 'quantity' ? Number(updates[field]) : updates[field]);
      }

      setClauses.push(`version = $${pIdx++}`);
      values.push(newVersion);

      setClauses.push(`updated_at = $${pIdx++}`);
      values.push(now);

      setClauses.push(`updated_by = $${pIdx++}`);
      values.push(userId);

      values.push(id);

      await db.query(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${pIdx}`, values);

      const updatedRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
      const updatedTask = updatedRes.rows[0];

      // Record snapshot
      await db.query(
        `INSERT INTO task_updates (id, task_id, version, changed_fields, snapshot, updated_by, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'server-api')`,
        [
          `upd-${uuidv4()}`,
          id,
          newVersion,
          JSON.stringify(fieldsToUpdate),
          JSON.stringify(updatedTask),
          userId
        ]
      );

      // Audit log
      await db.query(
        `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, 'server-api', 'TASK_UPDATED', 'task', $4, $5)`,
        [
          `act-${uuidv4()}`,
          userId,
          req.user?.fullName || 'Technician',
          id,
          JSON.stringify({ version: newVersion, updatedFields: fieldsToUpdate })
        ]
      );

      res.json({
        success: true,
        task: updatedTask,
        version: newVersion
      });
    } catch (err) {
      console.error('Error updating task:', err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }

  async deleteTask(req, res) {
    try {
      const { id } = req.params;
      const currentRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      await db.query('DELETE FROM tasks WHERE id = $1', [id]);

      // Audit log
      await db.query(
        `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, 'server-api', 'TASK_DELETED', 'task', $4, $5)`,
        [
          `act-${uuidv4()}`,
          req.user?.id || 'system',
          req.user?.fullName || 'Technician',
          id,
          JSON.stringify({ title: currentRes.rows[0].title })
        ]
      );

      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (err) {
      console.error('Error deleting task:', err);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }

  async getTaskHistory(req, res) {
    try {
      const { id } = req.params;
      const histRes = await db.query(
        'SELECT * FROM task_updates WHERE task_id = $1 ORDER BY version DESC',
        [id]
      );
      res.json({ history: histRes.rows });
    } catch (err) {
      console.error('Error fetching task history:', err);
      res.status(500).json({ error: 'Failed to retrieve task history' });
    }
  }
}

module.exports = new TaskController();
