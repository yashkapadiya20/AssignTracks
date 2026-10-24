const path = require('path');

// Load settings (DATABASE_URL, JWT_SECRET, PORT) from server/.env if it exists.
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  /* no .env file: fall back to the environment */
}

const { createPool } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

function describeDatabase(url) {
  try {
    const u = new URL(url);
    return `PostgreSQL at ${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return 'PostgreSQL';
  }
}

createPool()
  .then((pool) => {
    if (process.env.DATABASE_URL) {
      console.log(`Database: ${describeDatabase(process.env.DATABASE_URL)} (data is saved)`);
    } else {
      console.warn('Database: IN-MEMORY. DATABASE_URL not set, data resets on restart. See server/.env');
    }
    const server = createApp(pool).listen(PORT, (err) => {
      // Express 5 also passes listen errors here; those are reported by the 'error' handler below.
      if (!err) console.log(`API listening on http://localhost:${PORT}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use: another backend is still running. Close it and retry.`);
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    if (/password authentication failed/i.test(err.message)) {
      console.error('Check the password in DATABASE_URL (server/.env).');
    } else if (/does not exist/i.test(err.message)) {
      console.error('Create the database first, e.g. in pgAdmin or with createdb.');
    } else if (/ECONNREFUSED/i.test(err.message)) {
      console.error('PostgreSQL is not reachable. Check the port in DATABASE_URL (yours is 2509).');
    }
    process.exit(1);
  });
