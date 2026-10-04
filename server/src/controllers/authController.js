const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const result = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Fetch user's registered devices
      const devices = await db.query('SELECT * FROM devices WHERE user_id = $1', [user.id]);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.full_name
        },
        devices: devices.rows
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error during authentication' });
    }
  }

  async me(req, res) {
    try {
      const userId = req.user.id;
      const result = await db.query(
        'SELECT id, username, email, role, full_name, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      const devices = await db.query('SELECT * FROM devices WHERE user_id = $1', [userId]);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.full_name
        },
        devices: devices.rows
      });
    } catch (err) {
      console.error('Me error:', err);
      res.status(500).json({ error: 'Failed to retrieve current user info' });
    }
  }

  async getUsers(req, res) {
    try {
      const result = await db.query(
        'SELECT id, username, email, role, full_name FROM users ORDER BY full_name ASC'
      );
      res.json({ users: result.rows });
    } catch (err) {
      console.error('Get users error:', err);
      res.status(500).json({ error: 'Failed to retrieve user list' });
    }
  }
}

module.exports = new AuthController();
