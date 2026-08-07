import { getCentralPool } from '../saas/centralDb';
import { decryptKey, isEncrypted } from './encryption';
import {
  createPayPalOrder,
  createPayPalSubscription,
  capturePayPalOrder,
  getPayPalSubscription,
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

export async function getPlatformPayPalKeys(): Promise<{
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  merchantId: string | null;
  isLiveMode: boolean;
}> {
  const pool = getCentralPool();
  const result = await pool.query(
    `SELECT paypal_client_id, paypal_client_secret, paypal_webhook_id, paypal_merchant_id, paypal_is_live_mode
     FROM platform_payment_settings LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('PLATFORM_PAYPAL_NOT_CONFIGURED');
  }

  const row = result.rows[0];
  if (!row.paypal_client_id || !row.paypal_client_secret) {
    throw new Error('PLATFORM_PAYPAL_NOT_CONFIGURED');
  }

  return {
    clientId: row.paypal_client_id,
    clientSecret: decryptIfNeeded(row.paypal_client_secret) as string,
    webhookId: decryptIfNeeded(row.paypal_webhook_id),
    merchantId: row.paypal_merchant_id || null,
    isLiveMode: Boolean(row.paypal_is_live_mode),
  };
}

export async function getPlatformPayPalClientId(): Promise<string | null> {
  const pool = getCentralPool();
  const tableExists = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'platform_payment_settings'
    ) as exists`
  );

  if (!tableExists.rows[0].exists) {
    return null;
  }

  try {
    const result = await pool.query(
      'SELECT paypal_client_id FROM platform_payment_settings LIMIT 1'
    );

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

export async function isPlatformPayPalConfigured(): Promise<boolean> {
  const pool = getCentralPool();
  try {
    const result = await pool.query(
      'SELECT 1 FROM platform_payment_settings WHERE paypal_client_id IS NOT NULL AND paypal_client_secret IS NOT NULL LIMIT 1'
    );
    return result.rows.length > 0;
  } catch (error: any) {
    if (String(error?.message || '').includes('column')) {
      return false;
    }
    throw error;
  }
}

export async function testPlatformPayPalConnection(clientId: string, clientSecret: string, isLiveMode: boolean): Promise<boolean> {
  return testPayPalConnection({ clientId, clientSecret, isLiveMode });
}

export async function createPlatformPayPalOrder(options: Omit<PayPalCreateOrderInput, 'auth'>): Promise<{ id: string; status: string; links?: any[] }> {
  const keys = await getPlatformPayPalKeys();
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return createPayPalOrder({ ...options, auth });
}

export async function capturePlatformPayPalOrder(orderId: string): Promise<any> {
  const keys = await getPlatformPayPalKeys();
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return capturePayPalOrder(auth, orderId);
}

export async function createPlatformPayPalSubscription(options: Omit<PayPalCreateSubscriptionInput, 'auth'>): Promise<{ id: string; status: string; links?: any[] }> {
  const keys = await getPlatformPayPalKeys();
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return createPayPalSubscription({ ...options, auth });
}

export async function getPlatformPayPalSubscription(subscriptionId: string): Promise<any> {
  const keys = await getPlatformPayPalKeys();
  const auth: PayPalAuthConfig = {
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    isLiveMode: keys.isLiveMode,
  };

  return getPayPalSubscription(auth, subscriptionId);
}

export async function verifyPlatformPayPalWebhookSignature(headers: Record<string, string | string[] | undefined>, event: Record<string, any>): Promise<boolean> {
  const keys = await getPlatformPayPalKeys();
  if (!keys.webhookId) {
    console.warn('[PAYPAL] Platform webhook id not configured - skipping verification (NOT RECOMMENDED for production)');
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
