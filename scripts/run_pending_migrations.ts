import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

async function ensureMigrationsTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️  No migration files detected.');
    return;
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await ensureMigrationsTable(pool);

    const executed = await pool
      .query<{ filename: string }>('SELECT filename FROM schema_migrations')
      .then((result) => new Set(result.rows.map((row) => row.filename)));

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`✅ Skipping ${file} (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      const client = await pool.connect();
      try {
        console.log(`\n📋 Running migration: ${file}`);
        console.log('─'.repeat(60));
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        console.log(`✅ Migration completed: ${file}`);
      } catch (error: any) {
        console.error(`\n❌ Migration failed for ${file}`);
        console.error(error.message);
        if (error.detail) console.error('Detail:', error.detail);
        if (error.hint) console.error('Hint:', error.hint);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('\n🎉 Database is up to date!');
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  process.exit(1);
});
