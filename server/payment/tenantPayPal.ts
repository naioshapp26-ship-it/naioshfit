import type { Pool } from 'pg';
import { decryptKey, isEncrypted } from './encryption';
import {
  createPayPalOrder,
  createPayPalSubscription,
  capturePayPalOrder,
  verifyPayPalWebhookSignature,
  testPayPalConnection,
  type PayPalAuthConfig,
  type PayPalCreateOrderInput,
  type PayPalCreateSubscriptionInput,
} from './paypalClient';

function decryptIfNeeded(value: string | null): string | null {
  if (!value) return null;
  return isEncrypted(value) ? decryptKey(value) : value;
}

export async function getTenantPayPalKeys(pool: Pool): Promise<{
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  merchantId: string | null;
  isLiveMode: boolean;
}> {
  const result = await pool.query(
    `SELECT paypal_client_id, paypal_client_secret, paypal_webhook_id, paypal_merchant_id, paypal_is_live_mode
     FROM tenant_payment_settings LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('TENANT_PAYPAL_NOT_CONFIGURED');
  }

  const row = result.rows[0];
  if (!row.paypal_client_id || !row.paypal_client_secret) {
    throw new Error('TENANT_PAYPAL_NOT_CONFIGURED');
  }

  return {
    clientId: row.paypal_client_id,
    clientSecret: decryptIfNeeded(row.paypal_client_secret) as string,
    webhookId: decryptIfNeeded(row.paypal_webhook_id),
    merchantId: row.paypal_merchant_id || null,
    isLiveMode: Boolean(row.paypal_is_live_mode),
  };
}

export async function getTenantPayPalClientId(pool: Pool): Promise<string | null> {
  const tableExists = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenant_payment_settings'
    ) as exists`
  );

  if (!tableExists.rows[0].exists) {
    return null;
  }

  try {
    const result = await pool.query('SELECT paypal_client_id FROM tenant_payment_settings LIMIT 1');
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].paypal_client_id || null;
  } catch (error: any) {
    if (String(error?.message || '').includes('column')) {
      return null;
    }
    throw error;
  }
}

export async function isTenantPayPalConfigured(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM tenant_payment_settings WHERE paypal_client_id IS NOT NULL AND paypal_client_secret IS NOT NULL LIMIT 1'
    );
    return result.rows.length > 0;
  } catch (error: any) {
    if (String(error?.message || '').includes('column')) {
      return false;
    }
    throw error;
  }
}

export async function testTenantPayPalConnection(clientId: string, clientSecret: string, isLiveMode: boolean): Promise<boolean> {
  return testPayPalConnection({ clientId, clientSecret, isLiveMode });
}

export async function createTenantPayPalOrder(pool: Pool, options: Omit<PayPalCreateOrderInput, 'auth'>): Promise<{ id: string; status: string; links?: any[] }> {
  const keys = await getTenantPayPalKeys(pool);
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return createPayPalOrder({ ...options, auth });
}

export async function captureTenantPayPalOrder(pool: Pool, orderId: string): Promise<any> {
  const keys = await getTenantPayPalKeys(pool);
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return capturePayPalOrder(auth, orderId);
}

export async function createTenantPayPalSubscription(pool: Pool, options: Omit<PayPalCreateSubscriptionInput, 'auth'>): Promise<{ id: string; status: string; links?: any[] }> {
  const keys = await getTenantPayPalKeys(pool);
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return createPayPalSubscription({ ...options, auth });
}

export async function verifyTenantPayPalWebhookSignature(pool: Pool, headers: Record<string, string | string[] | undefined>, event: Record<string, any>): Promise<boolean> {
  const keys = await getTenantPayPalKeys(pool);
  if (!keys.webhookId) {
    console.warn('[PAYPAL] Tenant webhook id not configured - skipping verification (NOT RECOMMENDED for production)');
    return true;
  }

  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return verifyPayPalWebhookSignature({
    auth,
    webhookId: keys.webhookId,
    headers,
    event,
  });
}
