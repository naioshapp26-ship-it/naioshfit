import fs from 'node:fs';
import path from 'node:path';
import type { ProvisioningStep, ProvisioningStepResult, TenantRecord } from './types';
import bcrypt from 'bcryptjs';
import { getCentralPool } from './centralDb';
import {
  createAdminPool,
  getTenantIsolationMode,
  renderTenantDatabaseUrl,
  withDbRetry,
  withTenantClient,
} from './tenantConnection';
import { encryptTenantDatabaseUrl } from './tenantUrlEncryption';
import { sanitizeMigrationSql } from './migrationSanitizer';
import { resolveTenantDatabaseTemplate, resolveTenantEncryptionKey } from './tenantEnv';

const PROVISIONING_ADMIN_DATABASE_URL = process.env.PROVISIONING_ADMIN_DATABASE_URL;

function resolveProvisioningAdminUrl(): string | undefined {
  return PROVISIONING_ADMIN_DATABASE_URL || process.env.CENTRAL_DATABASE_URL || process.env.DATABASE_URL;
}

function createPoolWithSSL(connectionString: string) {
  return createAdminPool(connectionString);
}

export async function dropTenantDatabase(databaseName: string) {
  const adminDatabaseUrl = resolveProvisioningAdminUrl();
  if (!adminDatabaseUrl) {
    throw new Error('PROVISIONING_ADMIN_DATABASE_URL must be set to drop tenant databases.');
  }

  console.log('[SAAS] Dropping tenant database:', databaseName);
  const adminPool = createPoolWithSSL(adminDatabaseUrl);

  try {
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    console.log('[SAAS] Successfully dropped database:', databaseName);
  } finally {
    await adminPool.end();
  }
}

function requireTenantEncryptionKey() {
  return resolveTenantEncryptionKey();
}

function requireTenantDatabaseTemplate() {
  return resolveTenantDatabaseTemplate();
}

function getTenantMigrationsPath(): string {
  // Prefer source directory (dev), fall back to dist (production build)
  const candidates = [
    path.resolve(process.cwd(), 'saas', 'migrations', 'tenant'),
    path.resolve(process.cwd(), 'dist', 'saas', 'migrations', 'tenant'),
  ];
  
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  
  throw new Error('Tenant migrations directory not found');
}

function resolveSchemaTenantDatabaseUrl(databaseName: string): string {
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

async function ensureTenantStorage(databaseName: string): Promise<'database' | 'schema'> {
  const adminDatabaseUrl = resolveProvisioningAdminUrl();
  if (!adminDatabaseUrl) {
    throw new Error('PROVISIONING_ADMIN_DATABASE_URL must be set to create tenant databases.');
  }

  const isolation = getTenantIsolationMode();
  console.log('[SAAS] Ensuring tenant storage:', databaseName, 'mode:', isolation);
  console.log('[SAAS] Admin database URL:', adminDatabaseUrl.replace(/:[^:@]+@/, ':****@'));

  const adminPool = createPoolWithSSL(adminDatabaseUrl);

  try {
    if (isolation === 'schema') {
      await withDbRetry('createTenantSchema', async () => {
        await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${databaseName}"`);
      });
      console.log('[SAAS] Successfully ensured tenant schema:', databaseName);
      return 'schema';
    }

    try {
      await adminPool.query(`CREATE DATABASE "${databaseName}"`);
      console.log('[SAAS] Successfully created database:', databaseName);
      return 'database';
    } catch (error: any) {
      if (error?.code === '42P04') {
        console.log('[SAAS] Database already exists:', databaseName);
        return 'database';
      }

      const permissionDenied =
        error?.code === '42501' ||
        /permission denied/i.test(String(error?.message || ''));

      if (permissionDenied) {
        console.warn('[SAAS] CREATE DATABASE denied; falling back to schema isolation for', databaseName);
        await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${databaseName}"`);
        return 'schema';
      }

      console.error('[SAAS] Failed to create database:', databaseName, error);
      throw error;
    }
  } finally {
    await adminPool.end();
  }
}

async function logStep(tenantId: string, step: ProvisioningStep, status: ProvisioningStepResult['status'], errorMessage?: string) {
  const pool = getCentralPool();
  await pool.query(
    `INSERT INTO provisioning_logs (tenant_id, step, status, error_message, started_at, completed_at)
     VALUES ($1, $2, $3, $4, NOW(), CASE WHEN $3 IN ('success', 'failed') THEN NOW() ELSE NULL END)`,
    [tenantId, step, status, errorMessage || null]
  );
}

async function encryptDatabaseUrl(databaseUrl: string): Promise<Buffer> {
  return encryptTenantDatabaseUrl(databaseUrl);
}

async function ensureTenantDatabase(databaseName: string) {
  return ensureTenantStorage(databaseName);
}

export async function runTenantMigrations(databaseUrl: string) {
  const migrationsDir = getTenantMigrationsPath();
  console.log('[SAAS] Running tenant migrations from:', migrationsDir);

  await withDbRetry('runTenantMigrations', async () => {
    await withTenantClient(databaseUrl, async (client) => {
      await client.query(
        `CREATE TABLE IF NOT EXISTS tenant_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT NOW()
        )`
      );

      const appliedResult = await client.query<{ filename: string }>(
        'SELECT filename FROM tenant_migrations'
      );
      const applied = new Set(appliedResult.rows.map((row) => row.filename));

      const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
      console.log('[SAAS] Found', files.length, 'migration files');

      for (const file of files) {
        if (applied.has(file)) {
          console.log('[SAAS] Skipping already applied migration:', file);
          continue;
        }
        console.log('[SAAS] Running migration:', file);
        const sql = sanitizeMigrationSql(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
        if (sql.trim()) {
          try {
            await client.query(sql);
            await client.query(
              'INSERT INTO tenant_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
              [file]
            );
          } catch (error: any) {
            console.error('[SAAS] Migration failed:', file, error);
            throw error;
          }
        }
      }
      console.log('[SAAS] All tenant migrations completed successfully');
    });
  });
}

async function createTenantAdmin(databaseUrl: string, adminEmail: string, adminName: string, adminPhone: string, adminPassword: string) {
  await withDbRetry('createTenantAdmin', async () => {
    await withTenantClient(databaseUrl, async (client) => {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const [firstName, ...rest] = adminName.split(' ');
      const lastName = rest.join(' ') || 'Admin';

      const normalizedPhone = adminPhone.replace(/\D/g, '');
      const emailLocalPart = adminEmail.split('@')[0]?.replace(/[^a-zA-Z0-9._-]/g, '') || '';
      const username = normalizedPhone || emailLocalPart || `admin_${Date.now()}`;

      const existingAdmin = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, adminEmail]
      );

      if (existingAdmin.rows.length > 0) {
        console.log('[SAAS] Admin user already exists, updating password and details');
        await client.query(
          `UPDATE users 
           SET password = $1, email = $2, first_name = $3, last_name = $4, phone = $5, role = 'admin'
           WHERE username = $6 OR email = $2`,
          [passwordHash, adminEmail, firstName || adminName, lastName, adminPhone || null, username]
        );
      } else {
        await client.query(
          `INSERT INTO users (username, password, phone, email, first_name, last_name, role, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'admin', NOW())`,
          [username, passwordHash, adminPhone || null, adminEmail, firstName || adminName, lastName]
        );
      }
    });
  });
}

export interface ProvisionTenantInput {
  subdomain: string;
  companyName: string;
  adminEmail: string;
  adminName: string;
  adminPhone: string;
  adminPassword: string;
  subscriptionPlan?: string;
}

export async function provisionTenant(input: ProvisionTenantInput) {
  const databaseName = `tenant_${input.subdomain}`;
  let databaseUrl = renderTenantDatabaseUrl(databaseName);
  const pool = getCentralPool();

  // Check if subdomain already exists
  const existingCheck = await pool.query<TenantRecord>(
    'SELECT * FROM tenants WHERE subdomain = $1',
    [input.subdomain]
  );

  let tenant: TenantRecord;

  if (existingCheck.rows.length > 0) {
    // Subdomain already exists - check if provisioning failed
    const existing = existingCheck.rows[0];
    const logs = await pool.query(
      `SELECT step, status FROM provisioning_logs 
       WHERE tenant_id = $1 AND status = 'failed'
       ORDER BY started_at DESC LIMIT 1`,
      [existing.id]
    );

    if (logs.rows.length > 0) {
      // Previous provisioning failed, reuse this tenant record
      console.log('[SAAS] Reusing failed tenant record:', existing.id, 'for subdomain:', input.subdomain);
      tenant = existing;
      
      // Update tenant details in case they changed
      await pool.query(
        `UPDATE tenants 
         SET name = $1, company_name = $1, subscription_plan = $2, database_name = $3, status = 'active'
         WHERE id = $4`,
        [input.companyName, input.subscriptionPlan || null, databaseName, tenant.id]
      );
    } else {
      // Subdomain exists and was successful or is in progress
      throw new Error('Tenant subdomain already exists.');
    }
  } else {
    // Create new tenant record
    const placeholderEncrypted = await encryptDatabaseUrl(databaseUrl);
    const tenantInsert = await pool.query<TenantRecord>(
      `INSERT INTO tenants (subdomain, name, company_name, subscription_plan, status, database_url_encrypted, database_name)
       VALUES ($1, $2, $2, $3, 'active', $4, $5)
       RETURNING *`,
      [input.subdomain, input.companyName, input.subscriptionPlan || null, placeholderEncrypted, databaseName]
    );
    tenant = tenantInsert.rows[0];
  }

  await logStep(tenant.id, 'CREATE_TENANT_RECORD', 'success');

  let currentStep: ProvisioningStep = 'CREATE_TENANT_DATABASE';

  try {
    const isolation = getTenantIsolationMode();
    await logStep(tenant.id, 'CREATE_TENANT_DATABASE', 'pending');

    if (isolation === 'schema') {
      // One fresh connection for schema + migrations + admin.
      // Opening multiple Railway proxy connections in a row causes ECONNRESET.
      await withDbRetry('provisionSchemaTenant', async () => {
        const adminUrl = resolveProvisioningAdminUrl();
        if (!adminUrl) {
          throw new Error('PROVISIONING_ADMIN_DATABASE_URL must be set to create tenant databases.');
        }
        const adminPool = createAdminPool(adminUrl);
        try {
          const client = await adminPool.connect();
          try {
            await client.query(`CREATE SCHEMA IF NOT EXISTS "${databaseName}"`);
            databaseUrl = resolveSchemaTenantDatabaseUrl(databaseName);
            await logStep(tenant.id, 'CREATE_TENANT_DATABASE', 'success');

            currentStep = 'STORE_DATABASE_SECRET';
            await logStep(tenant.id, 'STORE_DATABASE_SECRET', 'pending');
            const encryptedUrl = await encryptDatabaseUrl(databaseUrl);
            await pool.query('UPDATE tenants SET database_url_encrypted = $1 WHERE id = $2', [encryptedUrl, tenant.id]);
            await logStep(tenant.id, 'STORE_DATABASE_SECRET', 'success');

            currentStep = 'RUN_MIGRATIONS';
            await logStep(tenant.id, 'RUN_MIGRATIONS', 'pending');
            await client.query(`SET search_path TO "${databaseName}", public`);
            await runTenantMigrationsOnClient(client);
            await logStep(tenant.id, 'RUN_MIGRATIONS', 'success');

            currentStep = 'CREATE_ADMIN';
            await logStep(tenant.id, 'CREATE_ADMIN', 'pending');
            await createTenantAdminOnClient(
              client,
              input.adminEmail,
              input.adminName,
              input.adminPhone,
              input.adminPassword,
            );
            await logStep(tenant.id, 'CREATE_ADMIN', 'success');
          } finally {
            try {
              await client.query('SET search_path TO public');
            } catch {
              // ignore
            }
            client.release();
          }
        } finally {
          await adminPool.end().catch(() => undefined);
        }
      });
    } else {
      const storageMode = await ensureTenantStorage(databaseName);
      if (storageMode === 'schema') {
        databaseUrl = resolveSchemaTenantDatabaseUrl(databaseName);
      }
      await logStep(tenant.id, 'CREATE_TENANT_DATABASE', 'success');

      currentStep = 'STORE_DATABASE_SECRET';
      await logStep(tenant.id, 'STORE_DATABASE_SECRET', 'pending');
      const encryptedUrl = await encryptDatabaseUrl(databaseUrl);
      await pool.query('UPDATE tenants SET database_url_encrypted = $1 WHERE id = $2', [encryptedUrl, tenant.id]);
      await logStep(tenant.id, 'STORE_DATABASE_SECRET', 'success');

      currentStep = 'RUN_MIGRATIONS';
      await logStep(tenant.id, 'RUN_MIGRATIONS', 'pending');
      await runTenantMigrations(databaseUrl);
      await logStep(tenant.id, 'RUN_MIGRATIONS', 'success');

      currentStep = 'CREATE_ADMIN';
      await logStep(tenant.id, 'CREATE_ADMIN', 'pending');
      await createTenantAdmin(databaseUrl, input.adminEmail, input.adminName, input.adminPhone, input.adminPassword);
      await logStep(tenant.id, 'CREATE_ADMIN', 'success');
    }

    currentStep = 'CREATE_SUBSCRIPTION';
    await logStep(tenant.id, 'CREATE_SUBSCRIPTION', 'pending');
    const planKey = input.subscriptionPlan || 'default';

    const existingSub = await pool.query(
      'SELECT id FROM tenant_subscriptions WHERE tenant_id = $1',
      [tenant.id]
    );

    if (existingSub.rows.length > 0) {
      console.log('[SAAS] Tenant subscription already exists, updating');
      await pool.query(
        `UPDATE tenant_subscriptions
         SET plan_key = $1, status = 'active', current_period_start = NOW()
         WHERE tenant_id = $2`,
        [planKey, tenant.id]
      );
    } else {
      await pool.query(
        `INSERT INTO tenant_subscriptions (tenant_id, plan_key, status, current_period_start)
         VALUES ($1, $2, 'active', NOW())`,
        [tenant.id, planKey]
      );
    }
    await logStep(tenant.id, 'CREATE_SUBSCRIPTION', 'success');

    currentStep = 'SEND_WELCOME_EMAIL';
    await logStep(tenant.id, 'SEND_WELCOME_EMAIL', 'success');
  } catch (error: any) {
    await logStep(tenant.id, currentStep, 'failed', error?.message || 'Provisioning failed');
    throw error;
  }

  const updated = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE id = $1', [tenant.id]);
  return updated.rows[0];
}

export async function getProvisioningStatus(tenantId: string) {
  const normalizedId = tenantId?.trim();
  if (!normalizedId) {
    return [];
  }

  const pool = getCentralPool();
  const logs = await pool.query(
    'SELECT step, status, error_message, started_at, completed_at FROM provisioning_logs WHERE tenant_id::text = $1 ORDER BY started_at ASC',
    [normalizedId]
  );
  return logs.rows;
}
