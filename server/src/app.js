const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

function createApp(pool) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', require('./routes/auth')(pool));
  app.use('/api/courses', require('./routes/courses')(pool));
  app.use('/api/assignments', require('./routes/assignments')(pool));
  app.use('/api/submissions', require('./routes/submissions')(pool));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app when present, so one process hosts everything.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
