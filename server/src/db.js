const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Uses real PostgreSQL when DATABASE_URL is set; otherwise an in-memory
// Postgres (pg-mem) so the app and tests run with no database or cloud setup.
async function createPool(databaseUrl = process.env.DATABASE_URL) {
  let pool;
  if (databaseUrl) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: databaseUrl });
  } else {
    const { newDb } = require('pg-mem');
    const { Pool } = newDb().adapters.createPg();
    pool = new Pool();
  }
  await pool.query(schema);
  return pool;
}

module.exports = { createPool };
