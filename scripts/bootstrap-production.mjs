import { execSync } from 'node:child_process';
import pg from 'pg';

/** Manual CLI bootstrap (local / Railway one-off). Production uses background bootstrap in server/index.ts. */

const { Pool } = pg;

function run(command) {
  console.log(`[BOOTSTRAP] ${command}`);
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  });
}

async function schemaReady(connectionString) {
  const needsSSL = /sslmode=require|ssl=true/i.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const { rows } = await pool.query(`
      SELECT to_regclass('public.users')::text AS users
    `);
    return Boolean(rows[0]?.users);
  } finally {
    await pool.end();
  }
}

async function main() {
  if (process.env.SKIP_DB_BOOTSTRAP === '1') {
    console.log('[BOOTSTRAP] Skipped (SKIP_DB_BOOTSTRAP=1)');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[BOOTSTRAP] DATABASE_URL is not set');
    process.exit(1);
  }

  if (!(await schemaReady(databaseUrl))) {
    try {
      run('npx drizzle-kit push --force');
    } catch (error) {
      console.error('[BOOTSTRAP] drizzle-kit push failed:', error);
      process.exit(1);
    }

    if (!(await schemaReady(databaseUrl))) {
      console.error('[BOOTSTRAP] users table still missing after drizzle-kit push');
      process.exit(1);
    }
  } else {
    console.log('[BOOTSTRAP] Database schema already present');
  }

  if (process.env.SKIP_DEMO_SEED === '1') {
    console.log('[BOOTSTRAP] Demo seed skipped (SKIP_DEMO_SEED=1)');
    return;
  }

  try {
    run('npx tsx -e "import { seedDemoAccountsIfNeeded } from \'./server/demoSeed.ts\'; seedDemoAccountsIfNeeded().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })"');
  } catch (error) {
    console.error('[BOOTSTRAP] Demo seed failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[BOOTSTRAP] Unexpected failure:', error);
  process.exit(1);
});
