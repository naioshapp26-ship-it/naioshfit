import type { Pool } from 'pg';
import { decryptKey, isEncrypted } from './encryption';
import {
  createPaymobIntention,
  resolvePaymobSignature,
  verifyPaymobWebhookSignature,
  type PaymobAuthConfig,
  type PaymobCreateIntentionInput,
  type PaymobIntentionResponse,
} from './paymobClient';

function decryptIfNeeded(value: string | null): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decryptKey(value);
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes('bad decrypt') || message.includes('wrong final block length')) {
      throw new Error('TENANT_DB_ENCRYPTION_KEY is invalid or does not match encrypted payment keys');
    }
    throw error;
  }
}

export async function getTenantPaymobKeys(pool: Pool): Promise<{
  publicKey: string;
  secretKey: string;
  hmacSecret: string | null;
  integrationIds: string[];
  baseUrl: string | null;
  isLiveMode: boolean;
}> {
  const result = await pool.query(
    `SELECT paymob_public_key, paymob_secret_key, paymob_hmac_secret, paymob_integration_ids, paymob_base_url, paymob_is_live_mode
     FROM tenant_payment_settings LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('TENANT_PAYMOB_NOT_CONFIGURED');
  }

  const row = result.rows[0];
  if (!row.paymob_public_key || !row.paymob_secret_key) {
    throw new Error('TENANT_PAYMOB_NOT_CONFIGURED');
  }

  return {
    publicKey: row.paymob_public_key,
    secretKey: decryptIfNeeded(row.paymob_secret_key) as string,
    hmacSecret: decryptIfNeeded(row.paymob_hmac_secret),
    integrationIds: Array.isArray(row.paymob_integration_ids) ? row.paymob_integration_ids : [],
    baseUrl: row.paymob_base_url || null,
    isLiveMode: Boolean(row.paymob_is_live_mode),
  };
}

export async function getTenantPaymobPublicConfig(pool: Pool): Promise<{ publicKey: string | null; baseUrl: string | null }> {
  const tableExists = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenant_payment_settings'
    ) as exists`
  );

  if (!tableExists.rows[0].exists) {
    return { publicKey: null, baseUrl: null };
  }

  try {
    const result = await pool.query('SELECT paymob_public_key, paymob_base_url FROM tenant_payment_settings LIMIT 1');
    if (result.rows.length === 0) {
      return { publicKey: null, baseUrl: null };
    }
    return {
      publicKey: result.rows[0].paymob_public_key || null,
      baseUrl: result.rows[0].paymob_base_url || null,
    };
  } catch (error: any) {
    if (String(error?.message || '').includes('column')) {
      return { publicKey: null, baseUrl: null };
    }
    throw error;
  }
}

export async function isTenantPaymobConfigured(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM tenant_payment_settings WHERE paymob_public_key IS NOT NULL AND paymob_secret_key IS NOT NULL LIMIT 1'
    );
    return result.rows.length > 0;
  } catch (error: any) {
    if (String(error?.message || '').includes('column')) {
      return false;
    }
    throw error;
  }
}

export async function createTenantPaymobIntention(
  pool: Pool,
  options: Omit<PaymobCreateIntentionInput, 'auth'>
): Promise<PaymobIntentionResponse> {
  const keys = await getTenantPaymobKeys(pool);
  const auth: PaymobAuthConfig = {
    secretKey: keys.secretKey,
    publicKey: keys.publicKey,
    baseUrl: keys.baseUrl || undefined,
    isLiveMode: keys.isLiveMode,
  };

  return createPaymobIntention({ ...options, auth });
}

export async function verifyTenantPaymobWebhook(
  pool: Pool,
  payload: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  body: Record<string, any>
): Promise<boolean> {
  const keys = await getTenantPaymobKeys(pool);
  if (!keys.hmacSecret) {
    console.warn('[PAYMOB] Tenant webhook secret not configured - skipping verification (NOT RECOMMENDED for production)');
    return true;
  }

  const signature = resolvePaymobSignature(headers, body);
  if (!signature) {
    return false;
  }

  return verifyPaymobWebhookSignature(payload, signature, keys.hmacSecret);
}
