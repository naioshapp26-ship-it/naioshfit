import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';

const { Pool } = pg;

export type TenantIsolationMode = 'database' | 'schema';

export function getTenantIsolationMode(): TenantIsolationMode {
  const raw = (process.env.SAAS_TENANT_ISOLATION || '').trim().toLowerCase();
  return raw === 'schema' ? 'schema' : 'database';
}

export function parseTenantConnection(databaseUrl: string): {
  connectionString: string;
  schema?: string;
} {
  try {
    const url = new URL(databaseUrl);
    const schema = url.searchParams.get('tenant_schema') || undefined;
    url.searchParams.delete('tenant_schema');
    return { connectionString: url.toString(), schema };
  } catch {
    return { connectionString: databaseUrl };
  }
}

export function renderTenantDatabaseUrl(databaseName: string): string {
  const mode = getTenantIsolationMode();
  if (mode === 'schema') {
    const baseUrl =
      process.env.DATABASE_URL ||
      process.env.CENTRAL_DATABASE_URL ||
      process.env.PROVISIONING_ADMIN_DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL is required for schema-based tenant isolation.');
    }
    const url = new URL(baseUrl);
    url.searchParams.set('tenant_schema', databaseName);
    return url.toString();
  }

  const template = process.env.TENANT_DATABASE_URL_TEMPLATE;
  if (!template) {
    throw new Error('TENANT_DATABASE_URL_TEMPLATE must be set for database tenant isolation.');
  }
  return template.replace('{db}', databaseName);
}

function getSslConfig(connectionString: string): pg.PoolConfig['ssl'] {
  const needsSsl =
    /sslmode=require/.test(connectionString) ||
    /railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString);
  if (!needsSsl) {
    return undefined;
  }

  const allowSelfSigned =
    /railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString) ||
    process.env.TENANT_DB_SSL_ALLOW_SELF_SIGNED === '1' ||
    process.env.CENTRAL_DB_SSL_ALLOW_SELF_SIGNED === '1' ||
    process.env.DB_SSL_ALLOW_SELF_SIGNED === '1';

  if (allowSelfSigned) {
    return {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    };
  }

  return { rejectUnauthorized: true };
}

function resolveSchemaBaseUrl(): string {
  const baseUrl =
    process.env.PROVISIONING_ADMIN_DATABASE_URL ||
    process.env.CENTRAL_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL is required for schema-based tenant isolation.');
  }
  return baseUrl;
}

export function createTenantPool(databaseUrl: string): pg.Pool {
  const { connectionString, schema } = parseTenantConnection(databaseUrl);
  const config = parseConnectionString(connectionString);

  const pool = new Pool({
    ...config,
    ssl: getSslConfig(connectionString) as any,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
  } as pg.PoolConfig);

  if (schema) {
    pool.on('connect', (client) => {
      client.query(`SET search_path TO "${schema}", public`).catch((error) => {
        console.error('[SAAS] Failed to set tenant search_path:', schema, error);
      });
    });
  }

  return pool;
}

/** Fresh short-lived pool — same approach that succeeds for CREATE SCHEMA on Railway. */
export function createAdminPool(connectionString: string): pg.Pool {
  const config = parseConnectionString(connectionString);
  return new Pool({
    ...config,
    ssl: getSslConfig(connectionString) as any,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
  } as pg.PoolConfig);
}

export function isTransientDbError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const message = String(err?.message || error || '');
  return (
    err?.code === 'ECONNRESET' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === '57P01' ||
    /ECONNRESET|Connection terminated|timeout|server closed the connection/i.test(message)
  );
}

export async function withTenantClient<T>(
  databaseUrl: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const { schema } = parseTenantConnection(databaseUrl);
  const mode = getTenantIsolationMode();

  // Schema isolation: open a fresh single connection (matches working CREATE SCHEMA path).
  // Avoid the long-lived central pool — Railway public proxy often resets extra checkouts.
  if (schema && mode === 'schema') {
    const pool = createAdminPool(resolveSchemaBaseUrl());
    try {
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO "${schema}", public`);
        return await fn(client);
      } finally {
        try {
          await client.query('SET search_path TO public');
        } catch {
          // ignore
        }
        client.release();
      }
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  const pool = createTenantPool(databaseUrl);
  try {
    const client = await pool.connect();
    try {
      if (schema) {
        await client.query(`SET search_path TO "${schema}", public`);
      }
      return await fn(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function withDbRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts) {
        throw error;
      }
      const delayMs = Math.min(1500 * 2 ** (attempt - 1), 10000);
      console.warn(`[SAAS] ${label} failed (attempt ${attempt}/${attempts}):`, (error as Error)?.message || error);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
