/**
 * Diagnostic script — uses the SAME DATABASE_URL that server.js loads,
 * to compare against what the Neon SQL Editor sees.
 *
 * Run from your project root (where .env lives) with:
 *   node diagnose-db.js
 */

require('dotenv').config(); // loads .env exactly like server.js does
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

if (!connStr) {
  console.error('❌ DATABASE_URL is not set in .env — that itself could be the bug.');
  process.exit(1);
}

// Mask password before printing so it's safe to paste/share
function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '****';
    return u.toString();
  } catch {
    return '(could not parse URL)';
  }
}

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

(async () => {
  console.log('🔍 Using DATABASE_URL:', maskUrl(connStr));
  console.log('---');

  const client = await pool.connect();
  try {
    // 1. Which actual database/host/branch endpoint are we on?
    const identity = await client.query(`
      SELECT current_database() AS db,
             current_user       AS "user",
             inet_server_addr() AS server_ip,
             version()          AS pg_version
    `);
    console.table(identity.rows);

    // 2. Neon-specific: which branch/project this endpoint belongs to
    //    (works when connected via a Neon pooled/direct endpoint)
    try {
      const neonInfo = await client.query(`SELECT current_setting('neon.branch_id', true) AS branch_id`);
      console.log('Neon branch_id (if available):', neonInfo.rows[0].branch_id);
    } catch (e) {
      console.log('Could not read neon.branch_id (not fatal):', e.message);
    }

    // 3. Does the "schedules" table exist from THIS connection's point of view?
    const tables = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'schedules'
    `);

    if (tables.rows.length === 0) {
      console.log('❌ "schedules" table NOT found via this DATABASE_URL.');
    } else {
      console.log('✅ "schedules" table found via this DATABASE_URL:');
      console.table(tables.rows);
    }

    // 4. Bonus: list ALL tables this connection can see, for a fuller picture
    const allTables = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);
    console.log('\nAll tables visible to this connection:');
    console.table(allTables.rows);

  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error('🔥 Connection/query failed:', err.message);
  process.exit(1);
});
