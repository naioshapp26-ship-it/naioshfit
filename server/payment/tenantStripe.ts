/**
 * Tenant Stripe Service
 * 
 * Handles Stripe operations for individual tenants ({subdomain}.naioshfit.com).
 * Each tenant can configure their own Stripe account to receive payments
 * directly from their customers.
 */

import Stripe from 'stripe';
import type { Pool } from 'pg';
import { encryptKey, decryptKey } from './encryption';
import { buildStripeMetadata } from './metadata';

// Stripe API version
const STRIPE_API_VERSION = '2024-12-18.acacia' as const;

export interface TenantPaymentSettings {
  id: number;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  stripe_webhook_secret: string | null;
  is_live_mode: boolean;
  paypal_client_id?: string | null;
  paypal_client_secret?: string | null;
  paypal_webhook_id?: string | null;
  paypal_merchant_id?: string | null;
  paypal_is_live_mode?: boolean | null;
  paymob_public_key?: string | null;
  paymob_secret_key?: string | null;
  paymob_hmac_secret?: string | null;
  paymob_integration_ids?: string[] | null;
  paymob_base_url?: string | null;
  paymob_is_live_mode?: boolean | null;
  created_at: Date;
  updated_at: Date;
}

export interface TenantPaymentSettingsInput {
  stripe_publishable_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  is_live_mode?: boolean;
  paypal_client_id?: string;
  paypal_client_secret?: string;
  paypal_webhook_id?: string;
  paypal_merchant_id?: string;
  paypal_is_live_mode?: boolean;
  paymob_public_key?: string;
  paymob_secret_key?: string;
  paymob_hmac_secret?: string;
  paymob_integration_ids?: string[];
  paymob_base_url?: string;
  paymob_is_live_mode?: boolean;
}

/**
 * Get tenant Stripe keys from tenant database
 * @param pool - Tenant database pool
 * @returns Decrypted Stripe keys
 */
export async function getTenantStripeKeys(pool: Pool): Promise<{
  publishableKey: string;
  secretKey: string;
  webhookSecret: string | null;
  isLiveMode: boolean;
}> {
  const result = await pool.query(
    'SELECT stripe_publishable_key, stripe_secret_key, stripe_webhook_secret, is_live_mode FROM tenant_payment_settings LIMIT 1'
  );
  
  if (result.rows.length === 0) {
    throw new Error('TENANT_PAYMENT_NOT_CONFIGURED');
  }
  
  const row = result.rows[0];
  return {
    publishableKey: row.stripe_publishable_key,
    secretKey: decryptKey(row.stripe_secret_key),
    webhookSecret: row.stripe_webhook_secret ? decryptKey(row.stripe_webhook_secret) : null,
    isLiveMode: row.is_live_mode
  };
}

/**
 * Get tenant Stripe client instance
 * @param pool - Tenant database pool
 * @returns Configured Stripe client
 */
export async function getTenantStripeClient(pool: Pool): Promise<Stripe> {
  const keys = await getTenantStripeKeys(pool);
  return new Stripe(keys.secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

/**
 * Get tenant payment settings (for admin display)
 * Returns safe data without exposing secret keys
 */
export async function getTenantPaymentSettings(pool: Pool): Promise<{
  id: number;
  stripe_publishable_key: string;
  is_live_mode: boolean;
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  paypal_client_id: string | null;
  paypal_merchant_id: string | null;
  paypal_is_live_mode: boolean | null;
  has_paypal_client_secret: boolean;
  has_paypal_webhook_id: boolean;
  paymob_public_key: string | null;
  paymob_base_url: string | null;
  paymob_is_live_mode: boolean | null;
  paymob_integration_ids: string[] | null;
  has_paymob_secret_key: boolean;
  has_paymob_hmac_secret: boolean;
  created_at: Date;
  updated_at: Date;
} | null> {
  const paypalColumnsExist = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_payment_settings'
        AND column_name = 'paypal_client_id'
    ) as exists`
  );

  if (!paypalColumnsExist.rows[0].exists) {
    const stripeOnly = await pool.query(
      `SELECT id, stripe_publishable_key, is_live_mode, 
              stripe_secret_key IS NOT NULL as has_secret_key,
              stripe_webhook_secret IS NOT NULL as has_webhook_secret,
              created_at, updated_at 
       FROM tenant_payment_settings LIMIT 1`
    );

    if (!stripeOnly.rows.length) {
      return null;
    }

    return {
      ...stripeOnly.rows[0],
      paypal_client_id: null,
      paypal_merchant_id: null,
      paypal_is_live_mode: null,
      has_paypal_client_secret: false,
      has_paypal_webhook_id: false,
      paymob_public_key: null,
      paymob_base_url: null,
      paymob_is_live_mode: null,
      paymob_integration_ids: null,
      has_paymob_secret_key: false,
      has_paymob_hmac_secret: false,
    };
  }

  const paymobColumnsExist = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_payment_settings'
        AND column_name = 'paymob_public_key'
    ) as exists`
  );

  let result;
  try {
    result = await pool.query(
      `SELECT id, stripe_publishable_key, is_live_mode, 
              stripe_secret_key IS NOT NULL as has_secret_key,
              stripe_webhook_secret IS NOT NULL as has_webhook_secret,
              paypal_client_id,
              paypal_merchant_id,
              paypal_is_live_mode,
              paypal_client_secret IS NOT NULL as has_paypal_client_secret,
              paypal_webhook_id IS NOT NULL as has_paypal_webhook_id,
              ${paymobColumnsExist.rows[0].exists ? 'paymob_public_key,' : 'NULL as paymob_public_key,'}
              ${paymobColumnsExist.rows[0].exists ? 'paymob_base_url,' : 'NULL as paymob_base_url,'}
              ${paymobColumnsExist.rows[0].exists ? 'paymob_is_live_mode,' : 'NULL as paymob_is_live_mode,'}
              ${paymobColumnsExist.rows[0].exists ? 'paymob_integration_ids,' : 'NULL as paymob_integration_ids,'}
              ${paymobColumnsExist.rows[0].exists ? 'paymob_secret_key IS NOT NULL as has_paymob_secret_key,' : 'false as has_paymob_secret_key,'}
              ${paymobColumnsExist.rows[0].exists ? 'paymob_hmac_secret IS NOT NULL as has_paymob_hmac_secret,' : 'false as has_paymob_hmac_secret,'}
              created_at, updated_at 
       FROM tenant_payment_settings LIMIT 1`
    );
  } catch (error: any) {
    if (!String(error?.message || '').includes('column')) {
      throw error;
    }

    result = await pool.query(
      `SELECT id, stripe_publishable_key, is_live_mode, 
              stripe_secret_key IS NOT NULL as has_secret_key,
              stripe_webhook_secret IS NOT NULL as has_webhook_secret,
              created_at, updated_at 
       FROM tenant_payment_settings LIMIT 1`
    );

    if (!result.rows.length) {
      return null;
    }

    return {
      ...result.rows[0],
      paypal_client_id: null,
      paypal_merchant_id: null,
      paypal_is_live_mode: null,
      has_paypal_client_secret: false,
      has_paypal_webhook_id: false,
      paymob_public_key: null,
      paymob_base_url: null,
      paymob_is_live_mode: null,
      paymob_integration_ids: null,
      has_paymob_secret_key: false,
      has_paymob_hmac_secret: false,
    };
  }
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
}

/**
 * Save or update tenant payment settings
 * @param pool - Tenant database pool
 * @param settings - Payment settings to save
 * @param userId - User making the change (for audit)
 */
export async function saveTenantPaymentSettings(
  pool: Pool,
  settings: TenantPaymentSettingsInput,
  userId?: number
): Promise<void> {
  // Encrypt sensitive keys only if provided
  const encryptedSecretKey = settings.stripe_secret_key ? encryptKey(settings.stripe_secret_key) : null;
  const encryptedWebhookSecret = settings.stripe_webhook_secret 
    ? encryptKey(settings.stripe_webhook_secret) 
    : null;
  const encryptedPaypalSecret = settings.paypal_client_secret
    ? encryptKey(settings.paypal_client_secret)
    : null;
  const encryptedPaypalWebhook = settings.paypal_webhook_id
    ? encryptKey(settings.paypal_webhook_id)
    : null;
  const encryptedPaymobSecret = settings.paymob_secret_key
    ? encryptKey(settings.paymob_secret_key)
    : null;
  const encryptedPaymobHmac = settings.paymob_hmac_secret
    ? encryptKey(settings.paymob_hmac_secret)
    : null;
  
  // Upsert - insert or update if exists
  await pool.query(
    `INSERT INTO tenant_payment_settings 
     (stripe_publishable_key, stripe_secret_key, stripe_webhook_secret, is_live_mode, paypal_client_id, paypal_client_secret, paypal_webhook_id, paypal_merchant_id, paypal_is_live_mode, paymob_public_key, paymob_secret_key, paymob_hmac_secret, paymob_integration_ids, paymob_base_url, paymob_is_live_mode, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
     ON CONFLICT ((true)) DO UPDATE SET
       stripe_publishable_key = EXCLUDED.stripe_publishable_key,
       stripe_secret_key = EXCLUDED.stripe_secret_key,
       stripe_webhook_secret = EXCLUDED.stripe_webhook_secret,
       is_live_mode = EXCLUDED.is_live_mode,
      paypal_client_id = EXCLUDED.paypal_client_id,
      paypal_client_secret = EXCLUDED.paypal_client_secret,
      paypal_webhook_id = EXCLUDED.paypal_webhook_id,
      paypal_merchant_id = EXCLUDED.paypal_merchant_id,
      paypal_is_live_mode = EXCLUDED.paypal_is_live_mode,
      paymob_public_key = EXCLUDED.paymob_public_key,
      paymob_secret_key = EXCLUDED.paymob_secret_key,
      paymob_hmac_secret = EXCLUDED.paymob_hmac_secret,
      paymob_integration_ids = EXCLUDED.paymob_integration_ids,
      paymob_base_url = EXCLUDED.paymob_base_url,
      paymob_is_live_mode = EXCLUDED.paymob_is_live_mode,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [
      settings.stripe_publishable_key ?? null,
      encryptedSecretKey,
      encryptedWebhookSecret,
      settings.is_live_mode ?? false,
      settings.paypal_client_id ?? null,
      encryptedPaypalSecret,
      encryptedPaypalWebhook,
      settings.paypal_merchant_id ?? null,
      settings.paypal_is_live_mode ?? false,
      settings.paymob_public_key ?? null,
      encryptedPaymobSecret,
      encryptedPaymobHmac,
      settings.paymob_integration_ids ? JSON.stringify(settings.paymob_integration_ids) : null,
      settings.paymob_base_url ?? null,
      settings.paymob_is_live_mode ?? false,
      userId
    ]
  );
}

/**
 * Test Stripe connection with provided keys
 * @param secretKey - Stripe secret key to test
 * @returns true if connection successful
 */
export async function testTenantStripeConnection(secretKey: string): Promise<boolean> {
  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    });
    // Try to retrieve account info to verify key is valid
    await stripe.accounts.retrieve();
    return true;
  } catch (error) {
    console.error('[TENANT_STRIPE] Connection test failed:', error);
    return false;
  }
}

/**
 * Create a Stripe Checkout session for tenant payments
 * (e.g., course purchases, products)
 */
export async function createTenantCheckoutSession(
  pool: Pool,
  options: {
    items: Array<{
      name: string;
      description?: string;
      amount: number; // Amount in cents
      quantity?: number;
    }>;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    returnUrl?: string;
    customerEmail?: string;
    metadata?: Record<string, unknown>;
    uiMode?: 'embedded' | 'redirect';
  }
): Promise<{ sessionId: string; checkoutUrl: string | null; clientSecret: string | null }> {
  const stripe = await getTenantStripeClient(pool);
  const currency = options.currency || 'usd';
  const customerEmail = (options.customerEmail || '').trim() || undefined;
  const metadata = buildStripeMetadata(options.metadata || {});
  const uiMode = options.uiMode || 'redirect';
  const isEmbedded = uiMode === 'embedded';
  const returnUrl = options.returnUrl || options.successUrl;
  
  const lineItems = options.items.map(item => ({
    price_data: {
      currency: currency.toLowerCase(),
      product_data: {
        name: item.name,
        description: item.description,
      },
      unit_amount: item.amount,
    },
    quantity: item.quantity || 1,
  }));
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    ...(isEmbedded
      ? {
          ui_mode: 'embedded',
          return_url: returnUrl,
          redirect_on_completion: 'if_required',
        }
      : {
          success_url: options.successUrl,
          cancel_url: options.cancelUrl,
        }),
    customer_email: customerEmail,
    metadata,
    payment_intent_data: {
      metadata,
    },
  });
  
  return {
    sessionId: session.id,
    checkoutUrl: session.url ?? null,
    clientSecret: session.client_secret ?? null,
  };
}

/**
 * Verify Stripe webhook signature for tenant
 */
export async function verifyTenantWebhookSignature(
  pool: Pool,
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const keys = await getTenantStripeKeys(pool);
  
  if (!keys.webhookSecret) {
    console.warn('[WEBHOOK] Tenant webhook secret not configured - skipping signature verification (NOT RECOMMENDED for production)');
    // Parse the event without verification when webhook secret is not configured
    // This is NOT recommended for production but allows testing without webhook secret
    const event = JSON.parse(payload.toString());
    return event as Stripe.Event;
  }
  
  const stripe = new Stripe(keys.secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
  
  return stripe.webhooks.constructEvent(payload, signature, keys.webhookSecret);
}

/**
 * Log a tenant payment transaction
 */
export async function logTenantTransaction(
  pool: Pool,
  transaction: {
    stripePaymentId: string;
    stripeCheckoutSessionId?: string;
    customerUserId?: number;
    orderId?: number;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paymentType: string;
    paymentProvider?: 'stripe' | 'paypal' | 'paymob';
    paypalOrderId?: string | null;
    paypalCaptureId?: string | null;
    paypalSubscriptionId?: string | null;
    paypalPayerId?: string | null;
    paymobIntentionId?: string | null;
    paymobTransactionId?: string | null;
    metadata?: Record<string, any>;
  }
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO tenant_payment_transactions 
     (stripe_payment_id, stripe_checkout_session_id, customer_user_id, order_id, amount, currency, status, payment_type, payment_provider, paypal_order_id, paypal_capture_id, paypal_subscription_id, paypal_payer_id, paymob_intention_id, paymob_transaction_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id`,
    [
      transaction.stripePaymentId,
      transaction.stripeCheckoutSessionId,
      transaction.customerUserId,
      transaction.orderId,
      transaction.amount,
      (transaction.currency || 'USD').toUpperCase(),
      transaction.status,
      transaction.paymentType,
      transaction.paymentProvider || 'stripe',
      transaction.paypalOrderId ?? null,
      transaction.paypalCaptureId ?? null,
      transaction.paypalSubscriptionId ?? null,
      transaction.paypalPayerId ?? null,
      transaction.paymobIntentionId ?? null,
      transaction.paymobTransactionId ?? null,
      JSON.stringify(transaction.metadata || {}),
    ]
  );
  
  return result.rows[0].id;
}

/**
 * Update tenant transaction status
 */
export async function updateTenantTransactionStatus(
  pool: Pool,
  stripeReference: string,
  status: 'pending' | 'completed' | 'failed' | 'refunded',
  actualPaymentId?: string | null,
  options?: {
    paypalCaptureId?: string | null;
    paypalPayerId?: string | null;
    paymobTransactionId?: string | null;
    paymobIntentionId?: string | null;
  }
): Promise<void> {
  const paypalCaptureId = options?.paypalCaptureId ?? null;
  const paypalPayerId = options?.paypalPayerId ?? null;
  const paymobTransactionId = options?.paymobTransactionId ?? null;
  const paymobIntentionId = options?.paymobIntentionId ?? null;

  await pool.query(
    `UPDATE tenant_payment_transactions 
    SET status = $1,
        stripe_payment_id = COALESCE($3, stripe_payment_id),
        paypal_capture_id = COALESCE($4, paypal_capture_id),
        paypal_payer_id = COALESCE($5, paypal_payer_id),
        paymob_intention_id = COALESCE($6, paymob_intention_id),
        paymob_transaction_id = COALESCE($7, paymob_transaction_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE stripe_payment_id = $2 OR stripe_checkout_session_id = $2`,
    [status, stripeReference, actualPaymentId || null, paypalCaptureId, paypalPayerId, paymobIntentionId, paymobTransactionId]
  );
}

/**
 * Get tenant payment transactions
 */
export async function getTenantTransactions(
  pool: Pool,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    customerUserId?: number;
  }
): Promise<{
  transactions: any[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100);
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  const params: any[] = [];
  let paramIndex = 1;
  
  if (options.status) {
    whereClause += ` WHERE status = $${paramIndex++}`;
    params.push(options.status);
  }
  
  if (options.customerUserId) {
    whereClause += whereClause ? ' AND' : ' WHERE';
    whereClause += ` customer_user_id = $${paramIndex++}`;
    params.push(options.customerUserId);
  }
  
  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM tenant_payment_transactions${whereClause}`,
    params
  );
  
  // Get transactions with customer info
  const result = await pool.query(
    `SELECT tpt.*, u.email as customer_email, u.first_name, u.last_name
     FROM tenant_payment_transactions tpt
     LEFT JOIN users u ON tpt.customer_user_id = u.id
     ${whereClause}
     ORDER BY tpt.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );
  
  return {
    transactions: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    page,
    limit,
  };
}

/**
 * Get tenant publishable key for frontend
 */
export async function getTenantPublishableKey(pool: Pool): Promise<string | null> {
  const result = await pool.query(
    'SELECT stripe_publishable_key FROM tenant_payment_settings LIMIT 1'
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0].stripe_publishable_key;
}

/**
 * Retrieve a checkout session to verify payment
 */
export async function retrieveTenantCheckoutSession(
  pool: Pool,
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = await getTenantStripeClient(pool);
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Check if tenant has payment configured
 */
export async function isTenantPaymentConfigured(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM tenant_payment_settings WHERE stripe_secret_key IS NOT NULL LIMIT 1'
    );
    return result.rows.length > 0;
  } catch (error) {
    // Table might not exist yet
    return false;
  }
}
