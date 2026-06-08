import { execSync } from 'node:child_process';
import type pg from 'pg';
import { seedDemoAccountsIfNeeded } from './demoSeed';

/** Tracks production schema bootstrap for /api/setup/status. */
export let dbBootstrapState: 'idle' | 'running' | 'done' | 'failed' = 'idle';

async function schemaReady(pool: pg.Pool): Promise<boolean> {
  const { rows } = await pool.query<{ users: string | null; has_email: boolean }>(`
    SELECT
      to_regclass('public.users')::text AS users,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
      ) AS has_email
  `);
  return Boolean(rows[0]?.users && rows[0]?.has_email);
}

async function demoUserCount(pool: pg.Pool): Promise<number> {
  try {
    const { rows } = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users WHERE username LIKE 'demo_%'`,
    );
    return rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

function runDrizzlePush(): void {
  console.log('[INIT] Running drizzle-kit push to sync schema...');
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  });
}

/**
 * Bootstrap Postgres schema + demo accounts on Railway production.
 */
export async function bootstrapDatabaseIfNeeded(pool: pg.Pool): Promise<void> {
  if (process.env.SKIP_DB_BOOTSTRAP === '1') {
    return;
  }

  dbBootstrapState = 'running';

  try {
    if (!(await schemaReady(pool))) {
      runDrizzlePush();
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await seedDemoAccountsIfNeeded();
      } catch (seedErr) {
        console.error('[INIT] Demo seed attempt failed:', seedErr);
      }

      if ((await demoUserCount(pool)) >= 4) {
        console.log('[INIT] Demo accounts verified in database');
        dbBootstrapState = 'done';
        return;
      }

      if (attempt === 0) {
        runDrizzlePush();
      }
    }

    console.error('[INIT] Warning: demo accounts missing after bootstrap (expected 4)');
    dbBootstrapState = 'done';
  } catch (error) {
    console.error('[INIT] Database bootstrap failed:', error);
    dbBootstrapState = 'failed';
    throw error;
  }
}

/** Static list for login UI when DB read fails (matches demoSeed.ts). */
export const FALLBACK_DEMO_USERS = [
  { label: 'Client Journey', note: 'See what trainees track daily', email: 'demo_client@demo.naioshfit.com', name: 'Amelia Adel' },
  { label: 'Coach Console', note: 'Review roster & plans', email: 'demo_coach@demo.naioshfit.com', name: 'Naiosh Coach' },
  { label: 'Gym Owner', note: 'Test gym analytics', email: 'demo_gym@demo.naioshfit.com', name: 'Naiosh Gym' },
  { label: 'Admin Overview', note: 'Manage platform settings', email: 'demo_admin@demo.naioshfit.com', name: 'Naiosh Admin' },
];
