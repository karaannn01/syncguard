const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'syncguard_super_secret_jwt_key_2026';

function authenticate(req, res, next) {
  // Support Authorization header bearer token or fallback dev header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // If running in development demo mode with simulated device/user header
    const devUserId = req.headers['x-user-id'] || 'usr-tech-01';
    req.user = {
      id: devUserId,
      username: devUserId === 'usr-admin-01' ? 'admin' : (devUserId === 'usr-tech-02' ? 'tech2' : 'tech1'),
      role: devUserId === 'usr-admin-01' ? 'ADMIN' : 'TECHNICIAN'
    };
    return next();
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token', details: err.message });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || (req.user.role !== role && req.user.role !== 'ADMIN')) {
      return res.status(403).json({ error: `Forbidden: requires ${role} role privileges` });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  JWT_SECRET
};
