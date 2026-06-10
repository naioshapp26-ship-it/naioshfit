import type pg from 'pg';
import { seedDemoAccountsIfNeeded } from './demoSeed';
import {
  runDrizzlePushWithTimeout,
  runPendingAppMigrations,
} from './appMigrations';

/** Tracks production schema bootstrap for /api/setup/status. */
export let dbBootstrapState: 'idle' | 'running' | 'done' | 'failed' = 'idle';
export let dbBootstrapError: string | null = null;

let bootstrapInFlight: Promise<void> | null = null;

export async function isAppSchemaReady(pool: pg.Pool): Promise<boolean> {
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
  if (!(await isAppSchemaReady(pool))) {
    return 0;
  }
  try {
    const { rows } = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users WHERE username LIKE 'demo_%'`,
    );
    return rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

function runDrizzlePush(): boolean {
  return runDrizzlePushWithTimeout(120_000);
}

async function ensureAppSchema(pool: pg.Pool): Promise<boolean> {
  if (await isAppSchemaReady(pool)) {
    return true;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[INIT] App schema missing — bootstrap attempt ${attempt}/3`);
    const pushOk = runDrizzlePush();
    if (!pushOk) {
      dbBootstrapError = 'drizzle-kit push failed or timed out';
    }

    try {
      await runPendingAppMigrations(pool);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[INIT] Pending SQL migrations pass failed:', message);
    }

    if (await isAppSchemaReady(pool)) {
      dbBootstrapError = null;
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return false;
}

/**
 * Bootstrap Postgres schema + demo accounts on Railway production.
 */
export async function bootstrapDatabaseIfNeeded(pool: pg.Pool): Promise<void> {
  if (process.env.SKIP_DB_BOOTSTRAP === '1') {
    return;
  }

  if (bootstrapInFlight) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = (async () => {
    dbBootstrapState = 'running';
    dbBootstrapError = null;

    try {
      const schemaOk = await ensureAppSchema(pool);
      if (!schemaOk) {
        dbBootstrapState = 'failed';
        dbBootstrapError = 'users table missing after drizzle-kit push';
        console.error('[INIT] Application schema bootstrap failed:', dbBootstrapError);
        return;
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

      console.warn('[INIT] Demo accounts missing after bootstrap (expected 4) — schema is ready');
      dbBootstrapState = 'done';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[INIT] Database bootstrap failed:', message);
      dbBootstrapState = 'failed';
      dbBootstrapError = message;
    } finally {
      bootstrapInFlight = null;
    }
  })();

  return bootstrapInFlight;
}

/** Block auth routes until app schema + demo seed have had a chance to run. */
export async function ensureAppReadyForAuth(pool: pg.Pool): Promise<{
  ready: boolean;
  message?: string;
}> {
  if (process.env.SKIP_DB_BOOTSTRAP === '1') {
    return { ready: await isAppSchemaReady(pool) };
  }

  if (await isAppSchemaReady(pool)) {
    return { ready: true };
  }

  await bootstrapDatabaseIfNeeded(pool);

  if (await isAppSchemaReady(pool)) {
    return { ready: true };
  }

  const message =
    dbBootstrapState === 'running'
      ? 'Database setup is still running. Please wait a moment and try again.'
      : dbBootstrapError || 'Application database is not ready yet.';

  return { ready: false, message };
}

/** Static list for login UI when DB read fails (matches demoSeed.ts). */
export const FALLBACK_DEMO_USERS = [
  { label: 'Client Journey', note: 'See what trainees track daily', email: 'demo_client@demo.naioshfit.com', name: 'Amelia Adel' },
  { label: 'Coach Console', note: 'Review roster & plans', email: 'demo_coach@demo.naioshfit.com', name: 'Naiosh Coach' },
  { label: 'Gym Owner', note: 'Test gym analytics', email: 'demo_gym@demo.naioshfit.com', name: 'Naiosh Gym' },
  { label: 'Admin Overview', note: 'Manage platform settings', email: 'demo_admin@demo.naioshfit.com', name: 'Naiosh Admin' },
];
