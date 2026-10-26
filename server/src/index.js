const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
const chatRoutes = require('./routes/chatRoutes');
const projectRoutes = require('./routes/projectRoutes');
const fileRoutes = require('./routes/fileRoutes');
const terminalRoutes = require('./routes/terminalRoutes');
const gitRoutes = require('./routes/gitRoutes');

const app = express();
const port = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

function isDemoMode() {
  return String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
}

function demoModeGuard(req, res, next) {
  if (!isDemoMode() || req.method === 'GET') return next();
  return res.status(403).json({ error: 'This demo is read-only.' });
}

app.use('/api/chat', demoModeGuard, chatRoutes);
app.use('/api/projects', demoModeGuard, projectRoutes);
app.use('/api/files', demoModeGuard, fileRoutes);
app.use('/api/terminal', (req, res, next) => {
  if (!isDemoMode()) return next();
  return res.status(403).json({ error: 'This demo does not expose Terminal.' });
}, terminalRoutes);
app.use('/api/git', (req, res, next) => {
  if (!isDemoMode()) return next();
  return res.status(403).json({ error: 'This demo does not expose Git.' });
}, gitRoutes);

app.use(express.static(frontendDistPath));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(frontendDistPath, 'index.html'), (error) => {
    if (error) next();
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
