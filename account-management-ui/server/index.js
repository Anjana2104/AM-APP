/**
 * EAM API Server
 * Run: node index.js   (from server/ directory)
 *
 * Endpoints:
 *   /api/finance/*   — finance revenue data
 *   /api/health      — health check
 */

const express = require('express');
const cors = require('cors');
const financeRoutes = require('./routes/finance');
const resourceRoutes = require('./routes/resources');
const requestRoutes = require('./routes/requests');
const processRoutes = require('./routes/process');

const PORT = process.env.PORT || 3001;

const app = express();

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dbConfig = require('./config/database');
  res.json({
    status: 'ok',
    database: dbConfig.client,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/finance', financeRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/process', processRoutes);

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const dbConfig = require('./config/database');
  console.log(`\n EAM API Server running on http://localhost:${PORT}`);
  console.log(` Database: ${dbConfig.client}`);
  if (dbConfig.client === 'sqlite3') {
    console.log(` SQLite file: ${dbConfig.filename}`);
  }
  console.log(`\n   GET    /api/health`);
  console.log(`   GET    /api/finance/projects`);
  console.log(`   GET    /api/finance/month-headers`);
  console.log(`   POST   /api/finance/projects/bulk`);
  console.log(`   PUT    /api/finance/projects/:id`);
  console.log(`   DELETE /api/finance/projects/:id\n`);
});
