#!/usr/bin/env node
/**
 * Verify DATABASE_URL connectivity (local or Railway).
 * Usage: export $(grep -v '^#' .env | xargs) && node scripts/test-db-connection.mjs
 */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL is not set. Copy .env.example → .env and add your Railway connection string.');
  process.exit(1);
}

const needsSsl = /sslmode=require/i.test(url);
const pool = new pg.Pool({
  connectionString: url,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
});

try {
  const { rows } = await pool.query(`
    SELECT current_database() AS db,
           current_user AS user,
           (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') AS public_tables
  `);
  console.log('✅ Database connected');
  console.log(`   database: ${rows[0].db}`);
  console.log(`   user: ${rows[0].user}`);
  console.log(`   public tables: ${rows[0].public_tables}`);
} catch (err) {
  console.error('❌ Connection failed:', err.message);
  console.error('');
  console.error('Get a fresh URL from Railway: Postgres service → Connect → Public Network → DATABASE_URL');
  process.exit(1);
} finally {
  await pool.end();
}
