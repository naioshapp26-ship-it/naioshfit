import pg from 'pg';
import type { TenantRecord } from './types';
import { createTenantPool } from './tenantConnection';
import { decryptTenantDatabaseUrl } from './tenantUrlEncryption';

export { decryptTenantDatabaseUrl };

const { Pool } = pg;

interface PoolCacheEntry {
  pool: pg.Pool;
  expiresAt: number;
}

const poolCache = new Map<string, PoolCacheEntry>();
const POOL_TTL_MS = 1000 * 60 * 15;

export function cacheTenantPool(tenantId: string, pool: pg.Pool) {
  poolCache.set(tenantId, { pool, expiresAt: Date.now() + POOL_TTL_MS });
}

export async function getTenantPool(tenant: TenantRecord): Promise<pg.Pool> {
  const cached = poolCache.get(tenant.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pool;
  }

  if (cached) {
    cached.pool.end().catch(() => undefined);
    poolCache.delete(tenant.id);
  }

  const databaseUrl = await decryptTenantDatabaseUrl(tenant.database_url_encrypted);
  const pool = createTenantPool(databaseUrl);

  pool.on('error', (err) => {
    console.error(`[TENANT DB] Pool error for tenant ${tenant.subdomain}:`, err);
  });

  cacheTenantPool(tenant.id, pool);
  return pool;
}
