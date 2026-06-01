import type { Request } from 'express';
import type { Pool } from 'pg';
import { getCentralPool } from '../saas/centralDb';
import { decryptKey, encryptKey, isEncrypted } from '../payment/encryption';

export interface EmailSettingsInput {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_to?: string | null;
  use_tls?: boolean;
}

export interface EmailSettingsSafe {
  id?: number;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_from: string | null;
  smtp_to: string | null;
  use_tls: boolean;
  has_password: boolean;
  configured: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmailSendConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string | null;
  useTls: boolean;
}

export interface EmailScopeContext {
  tenantPool?: Pool | null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePort(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 65535) return null;
  return num;
}

function decryptIfNeeded(value: string | null): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  return decryptKey(value);
}

function readTenantPoolFromContext(context?: Request | EmailScopeContext): Pool | undefined {
  if (!context) return undefined;
  const fromReq = (context as Request as any).tenantPool as Pool | undefined;
  if (fromReq) return fromReq;
  const fromScope = (context as EmailScopeContext).tenantPool || undefined;
  return fromScope || undefined;
}

async function ensurePlatformEmailSettingsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_email_settings (
      id SERIAL PRIMARY KEY,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL DEFAULT 465,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL,
      smtp_from TEXT NOT NULL,
      smtp_to TEXT,
      use_tls BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_by INTEGER
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_email_settings_singleton
    ON platform_email_settings ((true))
  `);
}

async function ensureTenantEmailSettingsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_email_settings (
      id SERIAL PRIMARY KEY,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL DEFAULT 465,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL,
      smtp_from TEXT NOT NULL,
      smtp_to TEXT,
      use_tls BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_email_settings_singleton
    ON tenant_email_settings ((true))
  `);
}

async function mapSafeSettings(pool: Pool, tableName: 'platform_email_settings' | 'tenant_email_settings'): Promise<EmailSettingsSafe | null> {
  const result = await pool.query(
    `SELECT id, smtp_host, smtp_port, smtp_user, smtp_from, smtp_to, use_tls,
            smtp_pass IS NOT NULL as has_password,
            created_at, updated_at
     FROM ${tableName}
     LIMIT 1`
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];
  const configured = Boolean(row.smtp_host && row.smtp_user && row.smtp_from && row.has_password);

  return {
    id: row.id,
    smtp_host: row.smtp_host || null,
    smtp_port: Number(row.smtp_port) || 465,
    smtp_user: row.smtp_user || null,
    smtp_from: row.smtp_from || null,
    smtp_to: row.smtp_to || null,
    use_tls: Boolean(row.use_tls),
    has_password: Boolean(row.has_password),
    configured,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getExistingStoredPassword(pool: Pool, tableName: 'platform_email_settings' | 'tenant_email_settings'): Promise<string | null> {
  const result = await pool.query(`SELECT smtp_pass FROM ${tableName} LIMIT 1`);
  if (!result.rows.length) return null;
  return result.rows[0].smtp_pass || null;
}

function validateRequiredSettings(input: {
  host: string | null;
  port: number | null;
  user: string | null;
  pass: string | null;
  from: string | null;
}) {
  if (!input.host || !input.port || !input.user || !input.pass || !input.from) {
    throw new Error('SMTP configuration is incomplete.');
  }
}

function resolveStoredPassword(newPassword: string | null, existingStoredPassword: string | null): string | null {
  if (newPassword) {
    return encryptKey(newPassword);
  }

  if (!existingStoredPassword) {
    return null;
  }

  if (isEncrypted(existingStoredPassword)) {
    return existingStoredPassword;
  }

  return encryptKey(existingStoredPassword);
}

export async function getPlatformEmailSettings(): Promise<EmailSettingsSafe> {
  const pool = getCentralPool();
  await ensurePlatformEmailSettingsTable(pool);
  const settings = await mapSafeSettings(pool, 'platform_email_settings');

  if (!settings) {
    return {
      smtp_host: null,
      smtp_port: 465,
      smtp_user: null,
      smtp_from: null,
      smtp_to: null,
      use_tls: true,
      has_password: false,
      configured: false,
    };
  }

  return settings;
}

export async function getTenantEmailSettings(pool: Pool): Promise<EmailSettingsSafe> {
  await ensureTenantEmailSettingsTable(pool);
  const settings = await mapSafeSettings(pool, 'tenant_email_settings');

  if (!settings) {
    return {
      smtp_host: null,
      smtp_port: 465,
      smtp_user: null,
      smtp_from: null,
      smtp_to: null,
      use_tls: true,
      has_password: false,
      configured: false,
    };
  }

  return settings;
}

export async function savePlatformEmailSettings(settings: EmailSettingsInput, userId?: number): Promise<void> {
  const pool = getCentralPool();
  await ensurePlatformEmailSettingsTable(pool);

  const existingStoredPassword = await getExistingStoredPassword(pool, 'platform_email_settings');

  const host = normalizeString(settings.smtp_host);
  const port = normalizePort(settings.smtp_port) ?? 465;
  const user = normalizeString(settings.smtp_user);
  const from = normalizeString(settings.smtp_from);
  const to = normalizeString(settings.smtp_to);
  const newPassword = normalizeString(settings.smtp_pass);
  const storedPassword = resolveStoredPassword(newPassword, existingStoredPassword);
  const useTls = typeof settings.use_tls === 'boolean' ? settings.use_tls : true;

  validateRequiredSettings({ host, port, user, pass: storedPassword, from });

  await pool.query(
    `INSERT INTO platform_email_settings
     (smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_to, use_tls, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT ((true)) DO UPDATE SET
       smtp_host = EXCLUDED.smtp_host,
       smtp_port = EXCLUDED.smtp_port,
       smtp_user = EXCLUDED.smtp_user,
       smtp_pass = EXCLUDED.smtp_pass,
       smtp_from = EXCLUDED.smtp_from,
       smtp_to = EXCLUDED.smtp_to,
       use_tls = EXCLUDED.use_tls,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [host, port, user, storedPassword, from, to, useTls, userId]
  );
}

export async function saveTenantEmailSettings(pool: Pool, settings: EmailSettingsInput, userId?: number): Promise<void> {
  await ensureTenantEmailSettingsTable(pool);

  const existingStoredPassword = await getExistingStoredPassword(pool, 'tenant_email_settings');

  const host = normalizeString(settings.smtp_host);
  const port = normalizePort(settings.smtp_port) ?? 465;
  const user = normalizeString(settings.smtp_user);
  const from = normalizeString(settings.smtp_from);
  const to = normalizeString(settings.smtp_to);
  const newPassword = normalizeString(settings.smtp_pass);
  const storedPassword = resolveStoredPassword(newPassword, existingStoredPassword);
  const useTls = typeof settings.use_tls === 'boolean' ? settings.use_tls : true;

  validateRequiredSettings({ host, port, user, pass: storedPassword, from });

  await pool.query(
    `INSERT INTO tenant_email_settings
     (smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_to, use_tls, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT ((true)) DO UPDATE SET
       smtp_host = EXCLUDED.smtp_host,
       smtp_port = EXCLUDED.smtp_port,
       smtp_user = EXCLUDED.smtp_user,
       smtp_pass = EXCLUDED.smtp_pass,
       smtp_from = EXCLUDED.smtp_from,
       smtp_to = EXCLUDED.smtp_to,
       use_tls = EXCLUDED.use_tls,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [host, port, user, storedPassword, from, to, useTls, userId]
  );
}

async function getPlatformEmailConfig(): Promise<EmailSendConfig | null> {
  const pool = getCentralPool();
  await ensurePlatformEmailSettingsTable(pool);
  const result = await pool.query(
    `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_to, use_tls
     FROM platform_email_settings
     LIMIT 1`
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];

  const host = normalizeString(row.smtp_host);
  const port = normalizePort(row.smtp_port);
  const user = normalizeString(row.smtp_user);
  const pass = decryptIfNeeded(normalizeString(row.smtp_pass));
  const from = normalizeString(row.smtp_from);
  const to = normalizeString(row.smtp_to);
  const useTls = typeof row.use_tls === 'boolean' ? row.use_tls : true;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    to,
    useTls,
  };
}

async function getTenantEmailConfig(pool: Pool): Promise<EmailSendConfig | null> {
  await ensureTenantEmailSettingsTable(pool);
  const result = await pool.query(
    `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_to, use_tls
     FROM tenant_email_settings
     LIMIT 1`
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];

  const host = normalizeString(row.smtp_host);
  const port = normalizePort(row.smtp_port);
  const user = normalizeString(row.smtp_user);
  const pass = decryptIfNeeded(normalizeString(row.smtp_pass));
  const from = normalizeString(row.smtp_from);
  const to = normalizeString(row.smtp_to);
  const useTls = typeof row.use_tls === 'boolean' ? row.use_tls : true;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    to,
    useTls,
  };
}

export async function getEmailConfigForScope(context?: Request | EmailScopeContext): Promise<EmailSendConfig | null> {
  const tenantPool = readTenantPoolFromContext(context);
  if (tenantPool) {
    return getTenantEmailConfig(tenantPool);
  }

  return getPlatformEmailConfig();
}
