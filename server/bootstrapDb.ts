import { execSync } from 'node:child_process';
import type pg from 'pg';

/**
 * Ensure core tables exist on first Railway deploy (empty Postgres).
 * Uses drizzle-kit push when users/products tables are missing.
 */
export async function bootstrapDatabaseIfNeeded(pool: pg.Pool): Promise<void> {
  if (process.env.SKIP_DB_BOOTSTRAP === '1') {
    return;
  }

  try {
    const { rows } = await pool.query<{ users: string | null; products: string | null }>(`
      SELECT
        to_regclass('public.users')::text AS users,
        to_regclass('public.products')::text AS products
    `);
    const hasUsers = Boolean(rows[0]?.users);
    const hasProducts = Boolean(rows[0]?.products);

    if (hasUsers && hasProducts) {
      return;
    }

    console.log('[INIT] Database schema incomplete — running drizzle-kit push (one-time bootstrap)');
    execSync('npx drizzle-kit push --force', {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[INIT] Database schema bootstrap complete');
  } catch (error) {
    console.error('[INIT] Database bootstrap failed:', error);
    throw error;
  }
}
