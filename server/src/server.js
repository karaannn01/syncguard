require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createSchema } = require('./models/schema');
const { seedData } = require('./models/seed');
const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const syncRoutes = require('./routes/syncRoutes');
const conflictRoutes = require('./routes/conflictRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-user-id']
}));

app.use(express.json({ limit: '10mb' }));

// Request logging for observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/api/health')) {
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'SyncGuard Core Sync Engine',
    databaseEngine: db.getDbType(),
    timestamp: new Date().toISOString()
  });
});

// Register API modules
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/activity', adminRoutes);

// Serve static frontend in production
const path = require('path');
const fs = require('fs');
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Initialize Schema, Seed Data & Launch
async function bootstrap() {
  try {
    console.log('--- Initializing SyncGuard Server ---');
    await createSchema();
    await seedData();
    app.listen(PORT, () => {
      console.log(`SyncGuard API Server running on port ${PORT}`);
      console.log(`Ready for offline sync operations and conflict resolution.`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();

module.exports = app;
