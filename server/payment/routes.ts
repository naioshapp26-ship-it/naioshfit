/**
 * Payment Routes
 * 
 * Handles API endpoints for both platform-level and tenant-level Stripe payments.
 * Routes are context-aware - they automatically use the correct Stripe keys based
 * on whether the request is from the main domain or a tenant subdomain.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  getPlatformPaymentSettings,
  savePlatformPaymentSettings,
  testStripeConnection as testPlatformStripeConnection,
  createPlatformCheckoutSession,
  getPlatformTransactions,
  verifyPlatformWebhookSignature,
  updatePlatformTransactionStatus,
  logPlatformTransaction,
  getPlatformPublishableKey,
  getPlatformStripeClient,
  getPlatformStripeKeys,
} from './platformStripe';
import {
  getPlatformPayPalClientId,
  isPlatformPayPalConfigured,
  createPlatformPayPalOrder,
  capturePlatformPayPalOrder,
  createPlatformPayPalSubscription,
  verifyPlatformPayPalWebhookSignature,
  testPlatformPayPalConnection,
} from './platformPayPal';
import {
  getPlatformPaymobPublicConfig,
  isPlatformPaymobConfigured,
  verifyPlatformPaymobWebhook,
} from './platformPaymob';
import {
  getTenantPaymentSettings,
  saveTenantPaymentSettings,
  testTenantStripeConnection,
  createTenantCheckoutSession,
  getTenantTransactions,
  verifyTenantWebhookSignature,
  updateTenantTransactionStatus,
  logTenantTransaction,
  getTenantPublishableKey,
  isTenantPaymentConfigured,
  retrieveTenantCheckoutSession,
  getTenantStripeClient,
  getTenantStripeKeys,
} from './tenantStripe';
import {
  getTenantPayPalClientId,
  isTenantPayPalConfigured,
  createTenantPayPalOrder,
  captureTenantPayPalOrder,
  verifyTenantPayPalWebhookSignature,
  testTenantPayPalConnection,
} from './tenantPayPal';
import {
  getTenantPaymobPublicConfig,
  isTenantPaymobConfigured,
  verifyTenantPaymobWebhook,
} from './tenantPaymob';
import { buildRequestMetadata, mergeStripeMetadata } from './metadata';
import { tenantResolver } from '../saas/tenantResolver';
import { getCentralPool } from '../saas/centralDb';
import { getTenantPool } from '../saas/dbManager';
import type { TenantRecord } from '../saas/types';
import { ensureCreditAccount, normalizeTenantId, settlePurchase } from '../services/creditBilling';
import { storage } from '../storage';

// Type for request with tenant pool
interface TenantRequest extends Request {
  tenantPool?: Pool;
  tenantSubdomain?: string;
}

/**
 * Check if request is from main domain (platform level)
 */
function isPlatformRequest(req: Request): boolean {
  const host = req.get('host') || '';
  const mainDomain = process.env.MAIN_DOMAIN || 'naioshfit.com';
  // Main domain is www.naioshfit.com or just naioshfit.com
  return host === mainDomain || host === `www.${mainDomain}` || host.includes('localhost');
}

function resolvePaymentTenant(req: Request, res: Response, next: NextFunction) {
  if (isPlatformRequest(req)) {
    return next();
  }

  return tenantResolver(req, res, next);
}

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to ensure user is admin
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

export function registerPaymentRoutes(app: Express) {
  const resolveTenantPoolById = async (tenantId: string | null | undefined) => {
    if (!tenantId) return null;
    try {
      const pool = getCentralPool();
      const result = await pool.query(
        'SELECT * FROM tenants WHERE id = $1 LIMIT 1',
        [tenantId]
      );
      const tenant = result.rows[0] as TenantRecord | undefined;
      if (!tenant) return null;
      return await getTenantPool(tenant);
    } catch (error) {
      console.error('[PAYMENT] Failed to resolve tenant pool for webhook:', error);
      return null;
    }
  };

  const loadPendingCreditTransaction = async (pool: Pool, checkoutSessionId: string) => {
    try {
      const result = await pool.query(
        `SELECT credit_account_id, tenant_id, user_id, bundle_id, credits_delta, metadata
         FROM credit_transactions_v2
         WHERE checkout_session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [checkoutSessionId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[WEBHOOK] Failed to load pending credit transaction:', error);
      return null;
    }
  };

  const loadPlatformTransactionByPayPalId = async (paypalOrderId: string) => {
    try {
      const pool = getCentralPool();
      const result = await pool.query(
        `SELECT * FROM platform_payment_transactions
         WHERE paypal_order_id = $1 OR stripe_payment_id = $1 OR stripe_checkout_session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [paypalOrderId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[PAYPAL] Failed to load platform transaction:', error);
      return null;
    }
  };

  const loadTenantTransactionByPayPalId = async (pool: Pool, paypalOrderId: string) => {
    try {
      const result = await pool.query(
        `SELECT * FROM tenant_payment_transactions
         WHERE paypal_order_id = $1 OR stripe_payment_id = $1 OR stripe_checkout_session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [paypalOrderId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[PAYPAL] Failed to load tenant transaction:', error);
      return null;
    }
  };

  const loadPlatformTransactionByPaymobId = async (paymobReference: string) => {
    try {
      const pool = getCentralPool();
      const result = await pool.query(
        `SELECT * FROM platform_payment_transactions
         WHERE paymob_intention_id = $1 OR paymob_transaction_id = $1 OR stripe_payment_id = $1 OR stripe_checkout_session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [paymobReference]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[PAYMOB] Failed to load platform transaction:', error);
      return null;
    }
  };

  const loadTenantTransactionByPaymobId = async (pool: Pool, paymobReference: string) => {
    try {
      const result = await pool.query(
        `SELECT * FROM tenant_payment_transactions
         WHERE paymob_intention_id = $1 OR paymob_transaction_id = $1 OR stripe_payment_id = $1 OR stripe_checkout_session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [paymobReference]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[PAYMOB] Failed to load tenant transaction:', error);
      return null;
    }
  };

  const ensurePlatformTransactionLogged = async (transaction: {
    stripePaymentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    tenantId?: string | null;
    amount?: number | null;
    currency?: string | null;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paymentType?: string;
    paymentProvider?: 'stripe' | 'paypal' | 'paymob';
    paypalOrderId?: string | null;
    paypalCaptureId?: string | null;
    paypalSubscriptionId?: string | null;
    paypalPayerId?: string | null;
    paymobIntentionId?: string | null;
    paymobTransactionId?: string | null;
    metadata?: Record<string, any>;
  }) => {
    try {
      const ref = transaction.stripePaymentId || transaction.stripeCheckoutSessionId || transaction.paymobIntentionId;
      if (!ref) return null;

      const pool = getCentralPool();
      const existing = await pool.query(
        `SELECT id FROM platform_payment_transactions
         WHERE stripe_payment_id = $1 OR stripe_checkout_session_id = $1 OR paymob_intention_id = $1 OR paymob_transaction_id = $1
         LIMIT 1`,
        [ref]
      );

      if (existing.rows[0]) {
        return existing.rows[0].id;
      }

      return await logPlatformTransaction({
        stripePaymentId: transaction.stripePaymentId || transaction.stripeCheckoutSessionId || transaction.paymobIntentionId,
        stripeCheckoutSessionId: transaction.stripeCheckoutSessionId || transaction.stripePaymentId || transaction.paymobIntentionId,
        tenantId: transaction.tenantId ?? null,
        amount: transaction.amount ?? 0,
        currency: (transaction.currency || 'USD').toUpperCase(),
        status: transaction.status,
        paymentType: transaction.paymentType || 'purchase',
        paymentProvider: transaction.paymentProvider || 'stripe',
        paypalOrderId: transaction.paypalOrderId ?? null,
        paypalCaptureId: transaction.paypalCaptureId ?? null,
        paypalSubscriptionId: transaction.paypalSubscriptionId ?? null,
        paypalPayerId: transaction.paypalPayerId ?? null,
        paymobIntentionId: transaction.paymobIntentionId ?? null,
        paymobTransactionId: transaction.paymobTransactionId ?? null,
        metadata: transaction.metadata || {},
      });
    } catch (err) {
      console.error('[PAYMENT] Failed to ensure platform transaction log:', err);
      return null;
    }
  };

  const ensureTenantTransactionLogged = async (
    pool: Pool,
    transaction: {
      stripePaymentId?: string | null;
      stripeCheckoutSessionId?: string | null;
      customerUserId?: number | null;
      orderId?: number | null;
      amount?: number | null;
      currency?: string | null;
      status: 'pending' | 'completed' | 'failed' | 'refunded';
      paymentType?: string;
      paymentProvider?: 'stripe' | 'paypal' | 'paymob';
      paypalOrderId?: string | null;
      paypalCaptureId?: string | null;
      paypalSubscriptionId?: string | null;
      paypalPayerId?: string | null;
      paymobIntentionId?: string | null;
      paymobTransactionId?: string | null;
      metadata?: Record<string, any>;
    }
  ) => {
    try {
      const ref = transaction.stripePaymentId || transaction.stripeCheckoutSessionId || transaction.paymobIntentionId;
      if (!ref) return null;

      const existing = await pool.query(
        `SELECT id FROM tenant_payment_transactions
         WHERE stripe_payment_id = $1 OR stripe_checkout_session_id = $1 OR paymob_intention_id = $1 OR paymob_transaction_id = $1
         LIMIT 1`,
        [ref]
      );

      if (existing.rows[0]) {
        return existing.rows[0].id;
      }

      return await logTenantTransaction(pool, {
        stripePaymentId: transaction.stripePaymentId || transaction.stripeCheckoutSessionId || transaction.paymobIntentionId || '',
        stripeCheckoutSessionId: transaction.stripeCheckoutSessionId || transaction.stripePaymentId || transaction.paymobIntentionId || undefined,
        customerUserId: transaction.customerUserId || undefined,
        orderId: transaction.orderId || undefined,
        amount: transaction.amount ?? 0,
        currency: (transaction.currency || 'USD').toUpperCase(),
        status: transaction.status,
        paymentType: transaction.paymentType || 'purchase',
        paymentProvider: transaction.paymentProvider || 'stripe',
        paypalOrderId: transaction.paypalOrderId ?? null,
        paypalCaptureId: transaction.paypalCaptureId ?? null,
        paypalSubscriptionId: transaction.paypalSubscriptionId ?? null,
        paypalPayerId: transaction.paypalPayerId ?? null,
        paymobIntentionId: transaction.paymobIntentionId ?? null,
        paymobTransactionId: transaction.paymobTransactionId ?? null,
        metadata: transaction.metadata || {},
      });
    } catch (err: any) {
      // Some tenants might not have the transactions table yet; avoid breaking webhook processing
      if (!err?.message?.includes('relation') || !String(err.message).includes('tenant_payment_transactions')) {
        console.error('[PAYMENT] Failed to ensure tenant transaction log:', err);
      }
      return null;
    }
  };

  const settleCreditPurchase = async (options: {
    pool: Pool;
    tenantId?: string | null;
    checkoutSessionId?: string | null;
    paymentIntentId?: string | null;
    metadata?: Record<string, any>;
    pendingTx?: any;
  }) => {
    try {
      const pendingTx = options.pendingTx || (options.checkoutSessionId ? await loadPendingCreditTransaction(options.pool, options.checkoutSessionId) : null);
      const metadata = {
        ...(pendingTx?.metadata || {}),
        ...(options.metadata || {}),
      } as Record<string, any>;

      const tenantId = normalizeTenantId(options.tenantId ?? pendingTx?.tenant_id ?? null);

      let credits = Number(metadata.credit_credits || metadata.credits || 0);
      if (!(credits > 0) && pendingTx?.credits_delta && pendingTx.credits_delta > 0) {
        credits = pendingTx.credits_delta;
      }

      const userId = Number(metadata.credit_user_id || pendingTx?.user_id || 0);
      let accountId = metadata.credit_account_id || pendingTx?.credit_account_id || null;
      const bundleId = metadata.credit_bundle_id || pendingTx?.bundle_id || metadata.bundle_id || null;
      const checkoutId = options.checkoutSessionId || pendingTx?.checkout_session_id || options.paymentIntentId || null;

      if (!accountId && userId) {
        try {
          const account = await ensureCreditAccount({ pool: options.pool, tenantId } as any, userId);
          accountId = account.id;
        } catch (err) {
          console.error('[WEBHOOK] Failed to resolve credit account for user', userId, err);
        }
      }

      if (!(credits > 0 && userId && accountId && checkoutId)) {
        const ref = options.checkoutSessionId || options.paymentIntentId;
        console.warn('[WEBHOOK] Incomplete credit metadata - skip settlement', {
          ref,
          credits,
          userId,
          accountId,
          bundleId,
          hasPending: Boolean(pendingTx),
        });
        return false;
      }

      const scope = { pool: options.pool, tenantId } as any;
      await ensureCreditAccount(scope, userId);
      await settlePurchase(scope, {
        checkoutSessionId: checkoutId,
        paymentIntentId: options.paymentIntentId,
        credits,
        userId,
        accountId,
        bundleId,
      });

      return true;
    } catch (err) {
      console.error('[WEBHOOK] Credit settlement failed:', err);
      return false;
    }
  };

  const fetchTenantRecordById = async (tenantId: string): Promise<TenantRecord | null> => {
    try {
      const pool = getCentralPool();
      const result = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('[PAYMENT] Failed to resolve tenant record for order update:', err);
      return null;
    }
  };

  const buildPayPalCustomId = (metadata: Record<string, any> | null | undefined): string | undefined => {
    if (!metadata) return undefined;
    const parts: string[] = [];
    const paymentType = metadata.payment_type || metadata.paymentType;
    if (paymentType) parts.push(`type:${paymentType}`);
    const orderId = metadata.order_id || metadata.orderId;
    if (orderId) parts.push(`order:${orderId}`);
    const bundleId = metadata.credit_bundle_id || metadata.bundle_id;
    if (bundleId) parts.push(`bundle:${bundleId}`);
    const tenantId = metadata.tenant_id || metadata.tenantId;
    if (tenantId) parts.push(`tenant:${tenantId}`);
    const userId = metadata.credit_user_id || metadata.user_id || metadata.customer_user_id;
    if (userId) parts.push(`user:${userId}`);

    const raw = parts.join('|');
    if (!raw) return undefined;
    return raw.length > 127 ? raw.slice(0, 127) : raw;
  };

  const updateStoreOrderPayment = async (options: {
    tenantId?: string | null;
    orderId: number;
    paymentStatus: 'paid' | 'failed' | 'refunded';
    status?: string;
  }) => {
    try {
      if (options.tenantId) {
        const tenantRecord = await fetchTenantRecordById(options.tenantId);
        if (!tenantRecord) {
          console.warn('[PAYMENT] Tenant not found for store order update:', options.tenantId);
          return;
        }
        const tenantPool = await getTenantPool(tenantRecord);
        const values: any[] = [options.paymentStatus];
        let setClause = 'payment_status = $1, updated_at = NOW()';
        if (options.status) {
          values.push(options.status);
          setClause = `${setClause}, status = $2`;
        }
        values.push(options.orderId);
        await tenantPool.query(
          `UPDATE orders SET ${setClause} WHERE id = $${values.length}`,
          values
        );
        return;
      }

      await storage.updateOrder(options.orderId, {
        paymentStatus: options.paymentStatus,
        ...(options.status ? { status: options.status } : {}),
      });
    } catch (err) {
      console.error('[PAYMENT] Failed to update store order payment status:', err);
    }
  };

  const maybeUpdateStoreOrderFromMetadata = async (
    metadata: Record<string, any> | null | undefined,
    paymentStatus: 'paid' | 'failed' | 'refunded'
  ) => {
    if (!metadata) return false;
    const paymentType = metadata.payment_type || metadata.paymentType;
    if (paymentType !== 'store_order') return false;
    const orderId = Number(metadata.order_id || metadata.orderId || 0);
    if (!orderId) return false;
    const tenantId = metadata.tenant_id || metadata.tenantId || null;
    const status = paymentStatus === 'paid' ? 'processing' : undefined;
    await updateStoreOrderPayment({ tenantId, orderId, paymentStatus, status });
    return true;
  };

  const handlePlatformWebhook = async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({ message: 'Missing Stripe signature' });
      }

      const rawBody = (req as any).rawBody || req.body;

      let event;
      try {
        event = await verifyPlatformWebhookSignature(rawBody, signature);
      } catch (err) {
        console.error('[WEBHOOK] Signature verification failed:', err);
        return res.status(400).json({ message: 'Invalid signature' });
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          console.log('[WEBHOOK] Checkout session completed:', session.id);

          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;
          await updatePlatformTransactionStatus(session.id, 'completed', paymentIntentId);

          const pendingTx = await loadPendingCreditTransaction(getCentralPool(), session.id);

          await ensurePlatformTransactionLogged({
            stripePaymentId: paymentIntentId,
            stripeCheckoutSessionId: session.id,
            tenantId: session.metadata?.credit_tenant_id ?? pendingTx?.tenant_id ?? null,
            amount: session.amount_total ? session.amount_total / 100 : null,
            currency: session.currency,
            status: 'completed',
            paymentType: session.metadata?.payment_type || 'checkout',
            metadata: session.metadata || {},
          });

          const resolvedTenantId = normalizeTenantId(session.metadata?.credit_tenant_id ?? pendingTx?.tenant_id ?? null);
          if (resolvedTenantId) {
            const tenantPool = await resolveTenantPoolById(resolvedTenantId);
            if (tenantPool) {
              const tenantPending = await loadPendingCreditTransaction(tenantPool, session.id);
              await settleCreditPurchase({
                pool: tenantPool,
                tenantId: resolvedTenantId,
                checkoutSessionId: session.id,
                paymentIntentId,
                metadata: session.metadata || {},
                pendingTx: tenantPending,
              });
            } else {
              console.warn('[WEBHOOK] Tenant pool not found for credit settlement', { tenantId: resolvedTenantId });
            }
          } else {
            await settleCreditPurchase({
              pool: getCentralPool(),
              tenantId: null,
              checkoutSessionId: session.id,
              paymentIntentId,
              metadata: session.metadata || {},
              pendingTx,
            });
          }

          await maybeUpdateStoreOrderFromMetadata(session.metadata, 'paid');

          if (session.metadata?.payment_type === 'saas_subscription') {
            console.log('[WEBHOOK] SaaS subscription payment completed for:', session.metadata);
          }
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as any;
          console.log('[WEBHOOK] Platform payment intent succeeded:', paymentIntent.id);

          let checkoutSessionId = paymentIntent.metadata?.checkout_session_id || null;
          let mergedMetadata = { ...(paymentIntent.metadata || {}) } as Record<string, any>;

          if (!checkoutSessionId) {
            try {
              const stripe = await getPlatformStripeClient();
              const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent.id, limit: 1 });
              if (sessions.data?.length) {
                checkoutSessionId = sessions.data[0].id;
                mergedMetadata = { ...(sessions.data[0].metadata || {}), ...mergedMetadata };
              }
            } catch (err) {
              console.error('[WEBHOOK] Failed to resolve checkout session for payment intent:', paymentIntent.id, err);
            }
          }

          const platformReference = checkoutSessionId || paymentIntent.id;
          await updatePlatformTransactionStatus(platformReference, 'completed', paymentIntent.id);

          await ensurePlatformTransactionLogged({
            stripePaymentId: paymentIntent.id,
            stripeCheckoutSessionId: checkoutSessionId || paymentIntent.id,
            tenantId: mergedMetadata?.credit_tenant_id ?? null,
            amount: paymentIntent.amount_received ? paymentIntent.amount_received / 100 : null,
            currency: paymentIntent.currency,
            status: 'completed',
            paymentType: mergedMetadata?.payment_type || 'payment_intent',
            metadata: mergedMetadata,
          });

          const resolvedTenantId = normalizeTenantId(mergedMetadata?.credit_tenant_id ?? null);
          if (resolvedTenantId) {
            const tenantPool = await resolveTenantPoolById(resolvedTenantId);
            if (tenantPool) {
              const tenantPending = checkoutSessionId
                ? await loadPendingCreditTransaction(tenantPool, checkoutSessionId)
                : null;
              await settleCreditPurchase({
                pool: tenantPool,
                tenantId: resolvedTenantId,
                checkoutSessionId: checkoutSessionId || undefined,
                paymentIntentId: paymentIntent.id,
                metadata: mergedMetadata,
                pendingTx: tenantPending,
              });
            } else {
              console.warn('[WEBHOOK] Tenant pool not found for credit settlement', { tenantId: resolvedTenantId });
            }
          } else {
            await settleCreditPurchase({
              pool: getCentralPool(),
              tenantId: null,
              checkoutSessionId: checkoutSessionId || undefined,
              paymentIntentId: paymentIntent.id,
              metadata: mergedMetadata,
              pendingTx: checkoutSessionId ? await loadPendingCreditTransaction(getCentralPool(), checkoutSessionId) : null,
            });
          }

          await maybeUpdateStoreOrderFromMetadata(mergedMetadata, 'paid');

          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as any;
          console.log('[WEBHOOK] Payment failed:', paymentIntent.id);
          await updatePlatformTransactionStatus(paymentIntent.id, 'failed');
          await maybeUpdateStoreOrderFromMetadata(paymentIntent.metadata, 'failed');
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as any;
          console.log('[WEBHOOK] Charge refunded:', charge.payment_intent);
          await updatePlatformTransactionStatus(charge.payment_intent, 'refunded');
          await maybeUpdateStoreOrderFromMetadata(charge.metadata, 'refunded');
          break;
        }

        default:
          console.log('[WEBHOOK] Unhandled event type:', event.type);
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error('[WEBHOOK] Platform webhook error:', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }
  };

  const handlePlatformPayPalWebhook = async (req: Request, res: Response) => {
    try {
      const event = req.body as Record<string, any>;
      const isValid = await verifyPlatformPayPalWebhookSignature(req.headers, event);

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid signature' });
      }

      const eventType = event?.event_type;

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          const resource = event?.resource || {};
          const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.invoice_id || resource?.custom_id;
          const captureId = resource?.id || null;
          const payerId = resource?.payer?.payer_id || null;
          const amount = Number(resource?.amount?.value || 0);
          const currency = resource?.amount?.currency_code || 'USD';

          if (!orderId) {
            console.warn('[PAYPAL] Missing order id in capture event');
            break;
          }

          const existing = await loadPlatformTransactionByPayPalId(orderId);
          if (!existing) {
            await ensurePlatformTransactionLogged({
              stripePaymentId: orderId,
              stripeCheckoutSessionId: orderId,
              amount,
              currency,
              status: 'completed',
              paymentType: 'paypal_capture',
              paymentProvider: 'paypal',
              paypalOrderId: orderId,
              paypalCaptureId: captureId,
              paypalPayerId: payerId,
              metadata: resource || {},
            });
          }

          await updatePlatformTransactionStatus(orderId, 'completed', captureId || undefined, {
            paypalCaptureId: captureId,
            paypalPayerId: payerId,
          });

          const metadata = (existing?.metadata || {}) as Record<string, any>;
          const pendingTx = await loadPendingCreditTransaction(getCentralPool(), orderId);

          await settleCreditPurchase({
            pool: getCentralPool(),
            tenantId: metadata?.credit_tenant_id ?? pendingTx?.tenant_id ?? null,
            checkoutSessionId: orderId,
            paymentIntentId: captureId || undefined,
            metadata,
            pendingTx,
          });

          await maybeUpdateStoreOrderFromMetadata(metadata, 'paid');
          break;
        }

        case 'PAYMENT.CAPTURE.REFUNDED': {
          const resource = event?.resource || {};
          const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.invoice_id || resource?.custom_id;
          if (orderId) {
            await updatePlatformTransactionStatus(orderId, 'refunded');
            const existing = await loadPlatformTransactionByPayPalId(orderId);
            await maybeUpdateStoreOrderFromMetadata(existing?.metadata, 'refunded');
          }
          break;
        }

        default:
          console.log('[PAYPAL] Unhandled platform event type:', eventType);
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error('[PAYPAL] Platform webhook error:', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }
  };

  const handlePlatformPaymobWebhook = async (req: Request, res: Response) => {
    try {
      const rawBody = (req as any).rawBody || req.body;
      const event = req.body as Record<string, any>;
      const isValid = await verifyPlatformPaymobWebhook(rawBody, req.headers, event);

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid signature' });
      }

      const payload = event?.obj || event?.data || event || {};
      const paymobTransactionId = payload?.id || payload?.transaction_id || payload?.transaction?.id || null;
      const paymobIntentionId = payload?.intention?.id || payload?.intention_id || payload?.order?.id || payload?.order_id || null;

      const amountCents = Number(payload?.amount_cents || payload?.order?.amount_cents || 0);
      const amount = amountCents > 0 ? amountCents / 100 : Number(payload?.amount || payload?.order?.amount || 0);
      const currency = payload?.currency || payload?.order?.currency || 'USD';
      const isRefunded = Boolean(payload?.is_refunded || payload?.refunded);
      const isSuccessful = payload?.success === true || payload?.is_success === true || payload?.success === 'true';
      const status = isRefunded ? 'refunded' : (isSuccessful ? 'completed' : 'failed');

      const reference = paymobIntentionId || paymobTransactionId;
      if (!reference) {
        console.warn('[PAYMOB] Missing Paymob reference in webhook payload');
        return res.json({ received: true });
      }

      const existing = await loadPlatformTransactionByPaymobId(reference);
      if (!existing) {
        await ensurePlatformTransactionLogged({
          stripePaymentId: reference,
          stripeCheckoutSessionId: reference,
          amount,
          currency,
          status,
          paymentType: payload?.payment_type || 'paymob_payment',
          paymentProvider: 'paymob',
          paymobIntentionId: paymobIntentionId || reference,
          paymobTransactionId: paymobTransactionId,
          metadata: payload || {},
        });
      }

      await updatePlatformTransactionStatus(reference, status, paymobTransactionId || undefined, {
        paymobIntentionId: paymobIntentionId || reference,
        paymobTransactionId: paymobTransactionId,
      });

      const metadata = (existing?.metadata || {}) as Record<string, any>;
      const pendingTx = await loadPendingCreditTransaction(getCentralPool(), reference);

      if (status === 'completed') {
        await settleCreditPurchase({
          pool: getCentralPool(),
          tenantId: metadata?.credit_tenant_id ?? pendingTx?.tenant_id ?? null,
          checkoutSessionId: reference,
          paymentIntentId: paymobTransactionId || undefined,
          metadata,
          pendingTx,
        });

        await maybeUpdateStoreOrderFromMetadata(metadata, 'paid');
      } else if (status === 'refunded') {
        await maybeUpdateStoreOrderFromMetadata(metadata, 'refunded');
      } else {
        await maybeUpdateStoreOrderFromMetadata(metadata, 'failed');
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error('[PAYMOB] Platform webhook error:', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }
  };
  // =========================================
  // PLATFORM-LEVEL PAYMENT ROUTES (Super Admin)
  // =========================================

  /**
   * Get platform payment settings (admin only)
   * GET /api/admin/payment-settings
   */
  app.get('/api/admin/payment-settings', resolvePaymentTenant, async (req: TenantRequest, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // If this is a tenant request, use tenant settings
      if (req.tenantPool) {
        const settings = await getTenantPaymentSettings(req.tenantPool);
        return res.json(settings || { configured: false });
      }

      // Platform level
      const settings = await getPlatformPaymentSettings();
      return res.json(settings || { configured: false });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to get payment settings:', error);
      return res.status(500).json({ message: 'Failed to get payment settings' });
    }
  });

  /**
   * Save platform payment settings (admin only)
   * POST /api/admin/payment-settings
   */
  app.post('/api/admin/payment-settings', resolvePaymentTenant, async (req: TenantRequest, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const {
        stripe_publishable_key,
        stripe_secret_key,
        stripe_webhook_secret,
        is_live_mode,
        saas_plan_config,
        saas_trial_days,
        paypal_client_id,
        paypal_client_secret,
        paypal_webhook_id,
        paypal_merchant_id,
        paypal_is_live_mode,
        paymob_public_key,
        paymob_secret_key,
        paymob_hmac_secret,
        paymob_integration_ids,
        paymob_base_url,
        paymob_is_live_mode,
      } = req.body;
      let normalizedPlans: Array<{ key: string; name: string; price_id: string; paypal_plan_id?: string }> | undefined;
      let normalizedPaymobIntegrationIds: string[] | undefined;
      let existingPayPalClientId: string | null = null;
      let existingPayPalHasSecret = false;
      let existingPaymobPublicKey: string | null = null;
      let existingPaymobHasSecret = false;

      const normalizedPaypalClientId = typeof paypal_client_id === 'string' ? paypal_client_id.trim() : paypal_client_id;
      const normalizedPaypalClientSecret = typeof paypal_client_secret === 'string' ? paypal_client_secret.trim() : paypal_client_secret;
      const resolvedPaypalClientId = normalizedPaypalClientId ? normalizedPaypalClientId : undefined;
      const resolvedPaypalClientSecret = normalizedPaypalClientSecret ? normalizedPaypalClientSecret : undefined;

      const normalizedPaymobPublicKey = typeof paymob_public_key === 'string' ? paymob_public_key.trim() : paymob_public_key;
      const normalizedPaymobSecretKey = typeof paymob_secret_key === 'string' ? paymob_secret_key.trim() : paymob_secret_key;
      const resolvedPaymobPublicKey = normalizedPaymobPublicKey ? normalizedPaymobPublicKey : undefined;
      const resolvedPaymobSecretKey = normalizedPaymobSecretKey ? normalizedPaymobSecretKey : undefined;

      const hasStripePayload = [
        stripe_publishable_key,
        stripe_secret_key,
        stripe_webhook_secret,
      ].some((value) => value !== undefined && value !== null)
        || is_live_mode !== undefined
        || saas_plan_config !== undefined
        || saas_trial_days !== undefined;

      const hasPayPalPayload = [
        paypal_client_id,
        paypal_client_secret,
        paypal_webhook_id,
        paypal_merchant_id,
      ].some((value) => value !== undefined && value !== null)
        || paypal_is_live_mode !== undefined;

      const hasPaymobPayload = [
        paymob_public_key,
        paymob_secret_key,
        paymob_hmac_secret,
        paymob_integration_ids,
        paymob_base_url,
      ].some((value) => value !== undefined && value !== null)
        || paymob_is_live_mode !== undefined;

      if (!hasStripePayload && !hasPayPalPayload && !hasPaymobPayload) {
        return res.status(400).json({ message: 'No payment settings provided' });
      }

      if (hasPayPalPayload || hasPaymobPayload) {
        const existingSettings = req.tenantPool
          ? await getTenantPaymentSettings(req.tenantPool)
          : await getPlatformPaymentSettings();
        existingPayPalClientId = existingSettings?.paypal_client_id ?? null;
        existingPayPalHasSecret = Boolean(existingSettings?.has_paypal_client_secret);
        existingPaymobPublicKey = existingSettings?.paymob_public_key ?? null;
        existingPaymobHasSecret = Boolean(existingSettings?.has_paymob_secret_key);
      }

      // Normalize Stripe keys
      const normalizedStripePublishable = typeof stripe_publishable_key === 'string' ? stripe_publishable_key.trim() : stripe_publishable_key;
      const normalizedStripeSecret = typeof stripe_secret_key === 'string' ? stripe_secret_key.trim() : stripe_secret_key;
      let resolvedStripePublishable = normalizedStripePublishable ? normalizedStripePublishable : undefined;
      let resolvedStripeSecret = normalizedStripeSecret ? normalizedStripeSecret : undefined;
      let resolvedStripeWebhook = stripe_webhook_secret as string | undefined;
      let resolvedStripeLiveMode = typeof is_live_mode === 'boolean' ? is_live_mode : undefined;

      // Only validate and require Stripe keys if at least one is provided
      // Allow clearing all Stripe keys to disable Stripe payments
      const hasAnyStripeKey = resolvedStripePublishable || resolvedStripeSecret;
      
      if (hasAnyStripeKey) {
        // If providing Stripe keys, both publishable and secret are required
        if (!resolvedStripePublishable || !resolvedStripeSecret) {
          return res.status(400).json({ message: 'Stripe publishable key and secret key are required when configuring Stripe' });
        }

        // Validate key prefixes
        if (!resolvedStripePublishable.startsWith('pk_')) {
          return res.status(400).json({ message: 'Invalid publishable key format. Must start with pk_' });
        }
        if (!resolvedStripeSecret.startsWith('sk_')) {
          return res.status(400).json({ message: 'Invalid secret key format. Must start with sk_' });
        }
        
        // Get live mode from existing settings if not provided
        if (resolvedStripeLiveMode === undefined) {
          try {
            if (req.tenantPool) {
              const existingKeys = await getTenantStripeKeys(req.tenantPool);
              resolvedStripeLiveMode = existingKeys.isLiveMode;
            } else {
              const existingKeys = await getPlatformStripeKeys();
              resolvedStripeLiveMode = existingKeys.isLiveMode;
            }
          } catch (error) {
            resolvedStripeLiveMode = false; // Default to test mode
          }
        }
      } else if (hasStripePayload) {
        // If Stripe payload exists but no keys provided, we're clearing Stripe
        // Set to undefined to clear in database
        resolvedStripePublishable = undefined;
        resolvedStripeSecret = undefined;
        resolvedStripeWebhook = undefined;
        resolvedStripeLiveMode = resolvedStripeLiveMode ?? false;
      } else {
        // No Stripe payload at all, skip Stripe validation
        return res.status(400).json({ message: 'No payment settings provided' });
      }

      // Only validate PayPal keys if at least one is provided (not undefined)
      // If all PayPal keys are undefined/null, it means we're clearing/disabling PayPal
      if (hasPayPalPayload && (resolvedPaypalClientId || resolvedPaypalClientSecret)) {
        if (!resolvedPaypalClientId || !resolvedPaypalClientSecret) {
          const canReuseExistingSecret = Boolean(
            resolvedPaypalClientId
              && !resolvedPaypalClientSecret
              && existingPayPalHasSecret
              && existingPayPalClientId
              && existingPayPalClientId === resolvedPaypalClientId
          );
          if (!canReuseExistingSecret) {
            return res.status(400).json({ message: 'PayPal client id and secret are required' });
          }
        }
      }

      // Only validate Paymob keys if at least one is provided (not undefined)
      // If all Paymob keys are undefined/null, it means we're clearing/disabling Paymob
      if (resolvedPaymobPublicKey || resolvedPaymobSecretKey) {
        if (!resolvedPaymobPublicKey || !resolvedPaymobSecretKey) {
          const canReuseExistingSecret = Boolean(
            resolvedPaymobPublicKey
              && !resolvedPaymobSecretKey
              && existingPaymobHasSecret
              && existingPaymobPublicKey
              && existingPaymobPublicKey === resolvedPaymobPublicKey
          );
          if (!canReuseExistingSecret) {
            return res.status(400).json({ message: 'Paymob public key and secret key are required' });
          }
        }
      }

      if (paymob_integration_ids !== undefined && paymob_integration_ids !== null) {
        if (Array.isArray(paymob_integration_ids)) {
          normalizedPaymobIntegrationIds = paymob_integration_ids.map((value) => String(value).trim()).filter(Boolean);
        } else if (typeof paymob_integration_ids === 'string') {
          normalizedPaymobIntegrationIds = paymob_integration_ids
            .split(/[\n,]+/)
            .map((value) => value.trim())
            .filter(Boolean);
        } else {
          return res.status(400).json({ message: 'Paymob integration ids must be an array or comma-separated string' });
        }
      }

      // If this is a tenant request, use tenant settings
      if (req.tenantPool) {
        // Test Stripe connection if keys are provided
        if (resolvedStripeSecret) {
          const isValid = await testTenantStripeConnection(resolvedStripeSecret);
          if (!isValid) {
            return res.status(400).json({ message: 'Invalid Stripe keys. Connection test failed.' });
          }
        }

        if (resolvedPaypalClientId && resolvedPaypalClientSecret) {
          const isPayPalValid = await testTenantPayPalConnection(
            resolvedPaypalClientId,
            resolvedPaypalClientSecret,
            paypal_is_live_mode ?? false
          );
          if (!isPayPalValid) {
            return res.status(400).json({ message: 'Invalid PayPal keys. Connection test failed.' });
          }
        }

        await saveTenantPaymentSettings(req.tenantPool, {
          stripe_publishable_key: resolvedStripePublishable,
          stripe_secret_key: resolvedStripeSecret,
          stripe_webhook_secret: resolvedStripeWebhook,
          is_live_mode: resolvedStripeLiveMode ?? false,
          paypal_client_id: resolvedPaypalClientId ?? undefined,
          paypal_client_secret: resolvedPaypalClientSecret ?? undefined,
          paypal_webhook_id: paypal_webhook_id ?? undefined,
          paypal_merchant_id: paypal_merchant_id ?? undefined,
          paypal_is_live_mode: paypal_is_live_mode,
          paymob_public_key: resolvedPaymobPublicKey ?? undefined,
          paymob_secret_key: resolvedPaymobSecretKey ?? undefined,
          paymob_hmac_secret: paymob_hmac_secret ?? undefined,
          paymob_integration_ids: normalizedPaymobIntegrationIds ?? undefined,
          paymob_base_url: paymob_base_url ?? undefined,
          paymob_is_live_mode: paymob_is_live_mode,
        }, user.id);

        const settings = await getTenantPaymentSettings(req.tenantPool);
        return res.json({
          success: true,
          message: 'Payment settings updated successfully',
          settings,
        });
      }

      if (saas_plan_config !== undefined) {
        if (!Array.isArray(saas_plan_config)) {
          return res.status(400).json({ message: 'SaaS plan configuration must be an array.' });
        }

        normalizedPlans = saas_plan_config.map((plan: any) => ({
          key: String(plan?.key || '').trim(),
          name: String(plan?.name || '').trim(),
          price_id: String(plan?.price_id || '').trim(),
          paypal_plan_id: plan?.paypal_plan_id ? String(plan.paypal_plan_id).trim() : undefined,
        }));

        if (normalizedPlans.some((plan: any) => !plan.key || !plan.name)) {
          return res.status(400).json({ message: 'Each plan must include a key and name.' });
        }

        const keys = normalizedPlans.map((plan: any) => plan.key.toLowerCase());
        if (new Set(keys).size !== keys.length) {
          return res.status(400).json({ message: 'Plan keys must be unique.' });
        }

        const plansWithPrice = normalizedPlans.filter((plan: any) => plan.price_id);
        if (plansWithPrice.some((plan: any) => !plan.price_id.startsWith('price_'))) {
          return res.status(400).json({ message: 'Stripe price IDs must start with price_ when provided.' });
        }
      }

      // Platform level - test Stripe connection if keys are provided
      if (resolvedStripeSecret) {
        const isValid = await testPlatformStripeConnection(resolvedStripeSecret);
        if (!isValid) {
          return res.status(400).json({ message: 'Invalid Stripe keys. Connection test failed.' });
        }
      }

      if (resolvedPaypalClientId && resolvedPaypalClientSecret) {
        const isPayPalValid = await testPlatformPayPalConnection(
          resolvedPaypalClientId,
          resolvedPaypalClientSecret,
          paypal_is_live_mode ?? false
        );
        if (!isPayPalValid) {
          return res.status(400).json({ message: 'Invalid PayPal keys. Connection test failed.' });
        }
      }

      await savePlatformPaymentSettings({
        stripe_publishable_key: resolvedStripePublishable,
        stripe_secret_key: resolvedStripeSecret,
        stripe_webhook_secret: resolvedStripeWebhook,
        is_live_mode: resolvedStripeLiveMode ?? false,
        paypal_client_id: resolvedPaypalClientId ?? undefined,
        paypal_client_secret: resolvedPaypalClientSecret ?? undefined,
        paypal_webhook_id: paypal_webhook_id ?? undefined,
        paypal_merchant_id: paypal_merchant_id ?? undefined,
        paypal_is_live_mode: paypal_is_live_mode,
        paymob_public_key: resolvedPaymobPublicKey ?? undefined,
        paymob_secret_key: resolvedPaymobSecretKey ?? undefined,
        paymob_hmac_secret: paymob_hmac_secret ?? undefined,
        paymob_integration_ids: normalizedPaymobIntegrationIds ?? undefined,
        paymob_base_url: paymob_base_url ?? undefined,
        paymob_is_live_mode: paymob_is_live_mode,
        saas_plan_config: normalizedPlans ?? (Array.isArray(saas_plan_config) ? saas_plan_config : undefined),
        saas_trial_days: typeof saas_trial_days === 'number' ? saas_trial_days : undefined,
      }, user.id);

      const settings = await getPlatformPaymentSettings();
      return res.json({
        success: true,
        message: 'Platform payment settings updated successfully',
        settings,
      });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to save payment settings:', error);
      return res.status(500).json({ message: 'Failed to save payment settings' });
    }
  });

  /**
   * Test Stripe connection
   * POST /api/admin/payment-settings/test
   */
  app.post('/api/admin/payment-settings/test', resolvePaymentTenant, async (req: TenantRequest, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { stripe_secret_key } = req.body;

      if (!stripe_secret_key) {
        return res.status(400).json({ message: 'Stripe secret key is required' });
      }

      const isValid = await testPlatformStripeConnection(stripe_secret_key);
      return res.json({ success: isValid, message: isValid ? 'Connection successful' : 'Connection failed' });
    } catch (error: any) {
      console.error('[PAYMENT] Connection test failed:', error);
      return res.status(500).json({ success: false, message: 'Connection test failed' });
    }
  });

  /**
   * Test PayPal connection
   * POST /api/admin/payment-settings/paypal-test
   */
  app.post('/api/admin/payment-settings/paypal-test', resolvePaymentTenant, async (req: TenantRequest, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { paypal_client_id, paypal_client_secret, paypal_is_live_mode } = req.body;

      if (!paypal_client_id || !paypal_client_secret) {
        return res.status(400).json({ message: 'PayPal client id and secret are required' });
      }

      const isValid = req.tenantPool
        ? await testTenantPayPalConnection(paypal_client_id, paypal_client_secret, Boolean(paypal_is_live_mode))
        : await testPlatformPayPalConnection(paypal_client_id, paypal_client_secret, Boolean(paypal_is_live_mode));

      return res.json({ success: isValid, message: isValid ? 'Connection successful' : 'Connection failed' });
    } catch (error: any) {
      console.error('[PAYMENT] PayPal connection test failed:', error);
      return res.status(500).json({ success: false, message: 'Connection test failed' });
    }
  });

  /**
   * Get payment transactions (admin only)
   * GET /api/admin/payment-transactions
   */
  app.get('/api/admin/payment-transactions', resolvePaymentTenant, async (req: TenantRequest, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      // If this is a tenant request, use tenant transactions
      if (req.tenantPool) {
        const result = await getTenantTransactions(req.tenantPool, { page, limit, status });
        return res.json(result);
      }

      // Platform level
      const tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id as string) : undefined;
      const result = await getPlatformTransactions({ page, limit, status, tenantId });
      return res.json(result);
    } catch (error: any) {
      console.error('[PAYMENT] Failed to get transactions:', error);
      return res.status(500).json({ message: 'Failed to get transactions' });
    }
  });

  // =========================================
  // PUBLIC STRIPE ROUTES (Publishable Key)
  // =========================================

  /**
   * Get Stripe publishable key for frontend
   * GET /api/stripe/publishable-key
   */
  app.get('/api/stripe/publishable-key', async (req: TenantRequest, res: Response) => {
    try {
      let publishableKey: string | null = null;

      // If this is a tenant request, get tenant's key
      if (req.tenantPool) {
        publishableKey = await getTenantPublishableKey(req.tenantPool);
      } else {
        // Platform level
        publishableKey = await getPlatformPublishableKey();
      }

      if (!publishableKey) {
        return res.status(404).json({ 
          message: 'Payment gateway not configured',
          code: req.tenantPool ? 'TENANT_PAYMENT_NOT_CONFIGURED' : 'PLATFORM_PAYMENT_NOT_CONFIGURED'
        });
      }

      return res.json({ publishableKey });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to get publishable key:', error);
      return res.status(500).json({ message: 'Failed to get payment configuration' });
    }
  });

  /**
   * Check if payment is configured
   * GET /api/stripe/status
   */
  app.get('/api/stripe/status', async (req: TenantRequest, res: Response) => {
    try {
      let configured = false;

      if (req.tenantPool) {
        configured = await isTenantPaymentConfigured(req.tenantPool);
      } else {
        const settings = await getPlatformPaymentSettings();
        configured = settings !== null;
      }

      return res.json({ configured });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to check payment status:', error);
      return res.json({ configured: false });
    }
  });

  /**
   * Get PayPal client id for frontend
   * GET /api/paypal/client-id
   */
  app.get('/api/paypal/client-id', async (req: TenantRequest, res: Response) => {
    try {
      let clientId: string | null = null;

      if (req.tenantPool) {
        clientId = await getTenantPayPalClientId(req.tenantPool);
      } else {
        clientId = await getPlatformPayPalClientId();
      }

      if (!clientId) {
        return res.status(404).json({
          message: 'Payment gateway not configured',
          code: req.tenantPool ? 'TENANT_PAYMENT_NOT_CONFIGURED' : 'PLATFORM_PAYMENT_NOT_CONFIGURED',
        });
      }

      return res.json({ clientId });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to get PayPal client id:', error);
      return res.status(500).json({ message: 'Failed to get payment configuration' });
    }
  });

  /**
   * Check if PayPal is configured
   * GET /api/paypal/status
   */
  app.get('/api/paypal/status', async (req: TenantRequest, res: Response) => {
    try {
      const configured = req.tenantPool
        ? await isTenantPayPalConfigured(req.tenantPool)
        : await isPlatformPayPalConfigured();

      return res.json({ configured });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to check PayPal status:', error);
      return res.json({ configured: false });
    }
  });

  /**
   * Get Paymob public config for frontend
   * GET /api/paymob/config
   */
  app.get('/api/paymob/config', async (req: TenantRequest, res: Response) => {
    try {
      const config = req.tenantPool
        ? await getTenantPaymobPublicConfig(req.tenantPool)
        : await getPlatformPaymobPublicConfig();

      if (!config.publicKey) {
        return res.status(404).json({
          message: 'Payment gateway not configured',
          code: req.tenantPool ? 'TENANT_PAYMENT_NOT_CONFIGURED' : 'PLATFORM_PAYMENT_NOT_CONFIGURED',
        });
      }

      return res.json({
        publicKey: config.publicKey,
        baseUrl: config.baseUrl,
      });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to get Paymob configuration:', error);
      return res.status(500).json({ message: 'Failed to get payment configuration' });
    }
  });

  /**
   * Check if Paymob is configured
   * GET /api/paymob/status
   */
  app.get('/api/paymob/status', async (req: TenantRequest, res: Response) => {
    try {
      const configured = req.tenantPool
        ? await isTenantPaymobConfigured(req.tenantPool)
        : await isPlatformPaymobConfigured();

      return res.json({ configured });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to check Paymob status:', error);
      return res.json({ configured: false });
    }
  });

  // =========================================
  // PAYPAL CHECKOUT ROUTES
  // =========================================

  /**
   * Capture PayPal order after approval
   * POST /api/paypal/orders/:orderId/capture
   */
  app.post('/api/paypal/orders/:orderId/capture', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ message: 'PayPal order id is required' });
      }

      const capture = req.tenantPool
        ? await captureTenantPayPalOrder(req.tenantPool, orderId)
        : await capturePlatformPayPalOrder(orderId);

      const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
      const payerId = capture?.payer?.payer_id || null;

      const transaction = req.tenantPool
        ? await loadTenantTransactionByPayPalId(req.tenantPool, orderId)
        : await loadPlatformTransactionByPayPalId(orderId);

      const metadata = (transaction?.metadata || {}) as Record<string, any>;

      if (req.tenantPool) {
        await updateTenantTransactionStatus(req.tenantPool, orderId, 'completed', captureId || undefined, {
          paypalCaptureId: captureId,
          paypalPayerId: payerId,
        });
      } else {
        await updatePlatformTransactionStatus(orderId, 'completed', captureId || undefined, {
          paypalCaptureId: captureId,
          paypalPayerId: payerId,
        });
      }

      const pendingTx = req.tenantPool
        ? await loadPendingCreditTransaction(req.tenantPool, orderId)
        : await loadPendingCreditTransaction(getCentralPool(), orderId);

      await settleCreditPurchase({
        pool: req.tenantPool || getCentralPool(),
        tenantId: metadata?.credit_tenant_id ?? (req as any).tenant?.id ?? pendingTx?.tenant_id ?? null,
        checkoutSessionId: orderId,
        paymentIntentId: captureId || undefined,
        metadata,
        pendingTx,
      });

      await maybeUpdateStoreOrderFromMetadata(metadata, 'paid');

      return res.json({
        success: true,
        orderId,
        captureId,
        payerId,
      });
    } catch (error: any) {
      console.error('[PAYPAL] Failed to capture order:', error);
      return res.status(500).json({ message: 'Failed to capture PayPal order' });
    }
  });

  /**
   * Create checkout session for tenant purchases (courses, products)
   * POST /api/stripe/create-checkout-session
   */
  app.post('/api/stripe/create-checkout-session', async (req: TenantRequest, res: Response) => {
    try {
      if (!req.tenantPool) {
        return res.status(400).json({ message: 'This endpoint is only available for tenants' });
      }

      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { items, success_url, cancel_url, return_url, currency } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Items are required' });
      }

      if (!return_url && (!success_url || !cancel_url)) {
        return res.status(400).json({ message: 'Return URL or success/cancel URLs are required' });
      }

      // Calculate total for logging
      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.amount * (item.quantity || 1)), 0);
      const tenant = (req as any).tenant as { id?: string; subdomain?: string } | undefined;
      const requestMetadata = buildRequestMetadata(req);
      const userMetadata = {
        customer_user_id: user.id,
        customer_email: user.email,
        customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        customer_username: user.username,
        customer_role: user.role,
        tenant_id: tenant?.id,
        tenant_subdomain: tenant?.subdomain,
      };
      const itemsSummary = items.map((item: any) => ({
        name: item.name,
        description: item.description,
        amount: item.amount,
        quantity: item.quantity || 1,
      }));
      const purchaseMetadata = {
        payment_context: 'tenant',
        payment_type: req.body.payment_type || 'purchase',
        item_type: 'custom',
        item_count: items.length,
        item_total_amount_cents: totalAmount,
        item_currency: currency || 'usd',
        items_json: itemsSummary,
      };
      const stripeMetadata = mergeStripeMetadata(
        requestMetadata,
        userMetadata,
        purchaseMetadata,
        req.body.metadata
      );

      const resolvedSuccessUrl = success_url || return_url;
      const resolvedCancelUrl = cancel_url || return_url || success_url;

      const session = await createTenantCheckoutSession(req.tenantPool, {
        items: items.map((item: any) => ({
          name: item.name,
          description: item.description,
          amount: item.amount,
          quantity: item.quantity,
        })),
        currency: currency || 'usd',
        successUrl: resolvedSuccessUrl,
        cancelUrl: resolvedCancelUrl,
        returnUrl: return_url || resolvedSuccessUrl,
        customerEmail: user.email,
        metadata: stripeMetadata,
        uiMode: 'embedded',
      });

      // Log the pending transaction
      await logTenantTransaction(req.tenantPool, {
        stripePaymentId: session.sessionId,
        stripeCheckoutSessionId: session.sessionId,
        customerUserId: user.id,
        amount: totalAmount / 100, // Convert cents to dollars
        currency: currency || 'USD',
        status: 'pending',
        paymentType: req.body.payment_type || 'purchase',
        metadata: stripeMetadata,
      });

      return res.json({
        session_id: session.sessionId,
        checkout_url: session.checkoutUrl,
        client_secret: session.clientSecret,
      });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to create checkout session:', error);
      
      if (error.message === 'TENANT_PAYMENT_NOT_CONFIGURED') {
        return res.status(400).json({ 
          message: 'Payment gateway not configured. Please contact administrator.',
          code: 'TENANT_PAYMENT_NOT_CONFIGURED'
        });
      }
      
      return res.status(500).json({ message: 'Failed to create checkout session' });
    }
  });

  /**
   * Verify checkout session (after successful payment)
   * GET /api/stripe/verify-session/:sessionId
   */
  app.get('/api/stripe/verify-session/:sessionId', async (req: TenantRequest, res: Response) => {
    try {
      if (!req.tenantPool) {
        return res.status(400).json({ message: 'This endpoint is only available for tenants' });
      }

      const { sessionId } = req.params;

      const session = await retrieveTenantCheckoutSession(req.tenantPool, sessionId);

      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

      const isPaid = session.payment_status === 'paid' || session.status === 'complete';
      if (isPaid) {
        try {
          await updateTenantTransactionStatus(req.tenantPool, session.id, 'completed', paymentIntentId);

          const pendingTx = await loadPendingCreditTransaction(req.tenantPool, session.id);

          await ensureTenantTransactionLogged(req.tenantPool, {
            stripePaymentId: paymentIntentId || session.id,
            stripeCheckoutSessionId: session.id,
            customerUserId: Number(session.metadata?.credit_user_id || session.metadata?.user_id || pendingTx?.user_id || 0) || undefined,
            amount: session.amount_total ? session.amount_total / 100 : null,
            currency: session.currency,
            status: 'completed',
            paymentType: session.metadata?.payment_type || 'checkout',
            metadata: session.metadata || {},
          });

          await settleCreditPurchase({
            pool: req.tenantPool,
            tenantId: (req as any).tenant?.id || pendingTx?.tenant_id || null,
            checkoutSessionId: session.id,
            paymentIntentId: paymentIntentId || undefined,
            metadata: session.metadata || {},
            pendingTx,
          });

          await maybeUpdateStoreOrderFromMetadata(session.metadata, 'paid');
        } catch (settleError) {
          console.error('[PAYMENT] Failed to settle tenant checkout session:', settleError);
        }
      }

      return res.json({
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details?.email,
        metadata: session.metadata,
      });
    } catch (error: any) {
      console.error('[PAYMENT] Failed to verify session:', error);
      return res.status(500).json({ message: 'Failed to verify payment session' });
    }
  });

  // =========================================
  // WEBHOOK ROUTES
  // =========================================

  /**
   * Platform PayPal webhook handler
   * POST /api/admin/paypal/webhook
   */
  app.post('/api/admin/paypal/webhook', async (req: Request, res: Response) => {
    return handlePlatformPayPalWebhook(req, res);
  });

  /**
   * Tenant PayPal webhook handler
   * POST /api/paypal/webhook
   */
  app.post('/api/paypal/webhook', async (req: TenantRequest, res: Response) => {
    try {
      if (!req.tenantPool) {
        if (isPlatformRequest(req)) {
          return handlePlatformPayPalWebhook(req, res);
        }
        return res.status(400).json({ message: 'Tenant context required' });
      }

      const event = req.body as Record<string, any>;
      const isValid = await verifyTenantPayPalWebhookSignature(req.tenantPool, req.headers, event);

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid signature' });
      }

      const eventType = event?.event_type;

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          const resource = event?.resource || {};
          const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.invoice_id || resource?.custom_id;
          const captureId = resource?.id || null;
          const payerId = resource?.payer?.payer_id || null;
          const amount = Number(resource?.amount?.value || 0);
          const currency = resource?.amount?.currency_code || 'USD';

          if (!orderId) {
            console.warn('[PAYPAL] Missing order id in tenant capture event');
            break;
          }

          const existing = await loadTenantTransactionByPayPalId(req.tenantPool, orderId);
          if (!existing) {
            await ensureTenantTransactionLogged(req.tenantPool, {
              stripePaymentId: orderId,
              stripeCheckoutSessionId: orderId,
              amount,
              currency,
              status: 'completed',
              paymentType: 'paypal_capture',
              paymentProvider: 'paypal',
              paypalOrderId: orderId,
              paypalCaptureId: captureId,
              paypalPayerId: payerId,
              metadata: resource || {},
            });
          }

          await updateTenantTransactionStatus(req.tenantPool, orderId, 'completed', captureId || undefined, {
            paypalCaptureId: captureId,
            paypalPayerId: payerId,
          });

          const metadata = (existing?.metadata || {}) as Record<string, any>;
          const pendingTx = await loadPendingCreditTransaction(req.tenantPool, orderId);

          await settleCreditPurchase({
            pool: req.tenantPool,
            tenantId: (req as any).tenant?.id || pendingTx?.tenant_id || null,
            checkoutSessionId: orderId,
            paymentIntentId: captureId || undefined,
            metadata,
            pendingTx,
          });

          await maybeUpdateStoreOrderFromMetadata(metadata, 'paid');
          break;
        }

        case 'PAYMENT.CAPTURE.REFUNDED': {
          const resource = event?.resource || {};
          const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.invoice_id || resource?.custom_id;
          if (orderId) {
            await updateTenantTransactionStatus(req.tenantPool, orderId, 'refunded');
            const existing = await loadTenantTransactionByPayPalId(req.tenantPool, orderId);
            await maybeUpdateStoreOrderFromMetadata(existing?.metadata, 'refunded');
          }
          break;
        }

        default:
          console.log('[PAYPAL] Unhandled tenant event type:', eventType);
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error('[PAYPAL] Tenant webhook error:', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  /**
   * Platform Paymob webhook handler
   * POST /api/admin/paymob/webhook
   */
  app.post('/api/admin/paymob/webhook', async (req: Request, res: Response) => {
    return handlePlatformPaymobWebhook(req, res);
  });

  /**
   * Tenant Paymob webhook handler
   * POST /api/paymob/webhook
   */
  app.post('/api/paymob/webhook', async (req: TenantRequest, res: Response) => {
    try {
      if (!req.tenantPool) {
        if (isPlatformRequest(req)) {
          return handlePlatformPaymobWebhook(req, res);
        }
        return res.status(400).json({ message: 'Tenant context required' });
      }

      const rawBody = (req as any).rawBody || req.body;
      const event = req.body as Record<string, any>;
      const isValid = await verifyTenantPaymobWebhook(req.tenantPool, rawBody, req.headers, event);

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid signature' });
      }

      const payload = event?.obj || event?.data || event || {};
      const paymobTransactionId = payload?.id || payload?.transaction_id || payload?.transaction?.id || null;
      const paymobIntentionId = payload?.intention?.id || payload?.intention_id || payload?.order?.id || payload?.order_id || null;

      const amountCents = Number(payload?.amount_cents || payload?.order?.amount_cents || 0);
      const amount = amountCents > 0 ? amountCents / 100 : Number(payload?.amount || payload?.order?.amount || 0);
      const currency = payload?.currency || payload?.order?.currency || 'USD';
      const isRefunded = Boolean(payload?.is_refunded || payload?.refunded);
      const isSuccessful = payload?.success === true || payload?.is_success === true || payload?.success === 'true';
      const status = isRefunded ? 'refunded' : (isSuccessful ? 'completed' : 'failed');

      const reference = paymobIntentionId || paymobTransactionId;
      if (!reference) {
        console.warn('[PAYMOB] Missing Paymob reference in tenant webhook payload');
        return res.json({ received: true });
      }

      const existing = await loadTenantTransactionByPaymobId(req.tenantPool, reference);
      if (!existing) {
        await ensureTenantTransactionLogged(req.tenantPool, {
          stripePaymentId: reference,
          stripeCheckoutSessionId: reference,
          amount,
          currency,
          status,
          paymentType: payload?.payment_type || 'paymob_payment',
          paymentProvider: 'paymob',
          paymobIntentionId: paymobIntentionId || reference,
          paymobTransactionId: paymobTransactionId,
          metadata: payload || {},
        });
      }

      await updateTenantTransactionStatus(req.tenantPool, reference, status, paymobTransactionId || undefined, {
        paymobIntentionId: paymobIntentionId || reference,
        paymobTransactionId: paymobTransactionId,
      });

      const metadata = (existing?.metadata || {}) as Record<string, any>;
      const pendingTx = await loadPendingCreditTransaction(req.tenantPool, reference);

      if (status === 'completed') {
        await settleCreditPurchase({
          pool: req.tenantPool,
          tenantId: (req as any).tenant?.id || pendingTx?.tenant_id || null,
          checkoutSessionId: reference,
          paymentIntentId: paymobTransactionId || undefined,
          metadata,
          pendingTx,
        });

        await maybeUpdateStoreOrderFromMetadata(metadata, 'paid');
      } else if (status === 'refunded') {
        await maybeUpdateStoreOrderFromMetadata(metadata, 'refunded');
      } else {
        await maybeUpdateStoreOrderFromMetadata(metadata, 'failed');
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error('[PAYMOB] Tenant webhook error:', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  /**
   * Platform Stripe webhook handler
   * POST /api/admin/stripe/webhook
   */
  app.post('/api/admin/stripe/webhook', 
    // Use raw body for webhook signature verification
    async (req: Request, res: Response) => {
      return handlePlatformWebhook(req, res);
    }
  );

  /**
   * Tenant Stripe webhook handler
   * POST /api/stripe/webhook
   */
  app.post('/api/stripe/webhook',
    async (req: TenantRequest, res: Response) => {
      try {
        if (!req.tenantPool) {
          if (isPlatformRequest(req)) {
            return handlePlatformWebhook(req, res);
          }
          return res.status(400).json({ message: 'Tenant context required' });
        }

        const signature = req.headers['stripe-signature'] as string;
        
        if (!signature) {
          return res.status(400).json({ message: 'Missing Stripe signature' });
        }

        const rawBody = (req as any).rawBody || req.body;

        let event;
        try {
          event = await verifyTenantWebhookSignature(req.tenantPool, rawBody, signature);
        } catch (err) {
          console.error('[WEBHOOK] Tenant signature verification failed:', err);
          return res.status(400).json({ message: 'Invalid signature' });
        }

        // Handle the event
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as any;
            console.log('[WEBHOOK] Tenant checkout completed:', session.id);
            
            const paymentIntentId = typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id;
            await updateTenantTransactionStatus(req.tenantPool, session.id, 'completed', paymentIntentId);
            
            const pendingTx = await loadPendingCreditTransaction(req.tenantPool, session.id);

            await ensureTenantTransactionLogged(req.tenantPool, {
              stripePaymentId: paymentIntentId,
              stripeCheckoutSessionId: session.id,
              customerUserId: Number(session.metadata?.credit_user_id || session.metadata?.user_id || pendingTx?.user_id || 0) || undefined,
              amount: session.amount_total ? session.amount_total / 100 : null,
              currency: session.currency,
              status: 'completed',
              paymentType: session.metadata?.payment_type || 'checkout',
              metadata: session.metadata || {},
            });

            await settleCreditPurchase({
              pool: req.tenantPool,
              tenantId: (req as any).tenant?.id || pendingTx?.tenant_id || null,
              checkoutSessionId: session.id,
              paymentIntentId,
              metadata: session.metadata || {},
              pendingTx,
            });

            await maybeUpdateStoreOrderFromMetadata(session.metadata, 'paid');
            
            // TODO: Create enrollment/order records based on metadata
            break;
          }

          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as any;
            console.log('[WEBHOOK] Tenant payment intent succeeded:', paymentIntent.id);

            let checkoutSessionId = paymentIntent.metadata?.checkout_session_id || null;
            let mergedMetadata = { ...(paymentIntent.metadata || {}) } as Record<string, any>;

            if (!checkoutSessionId) {
              try {
                const stripe = await getTenantStripeClient(req.tenantPool);
                const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent.id, limit: 1 });
                if (sessions.data?.length) {
                  checkoutSessionId = sessions.data[0].id;
                  mergedMetadata = { ...(sessions.data[0].metadata || {}), ...mergedMetadata };
                }
              } catch (err) {
                console.error('[WEBHOOK] Failed to resolve tenant checkout session for payment intent:', paymentIntent.id, err);
              }
            }

            const tenantReference = checkoutSessionId || paymentIntent.id;
            await updateTenantTransactionStatus(req.tenantPool, tenantReference, 'completed', paymentIntent.id);

            await ensureTenantTransactionLogged(req.tenantPool, {
              stripePaymentId: paymentIntent.id,
              stripeCheckoutSessionId: checkoutSessionId || paymentIntent.id,
              customerUserId: Number(mergedMetadata?.credit_user_id || mergedMetadata?.user_id || 0) || undefined,
              amount: paymentIntent.amount_received ? paymentIntent.amount_received / 100 : null,
              currency: paymentIntent.currency,
              status: 'completed',
              paymentType: mergedMetadata?.payment_type || 'payment_intent',
              metadata: mergedMetadata,
            });

            await settleCreditPurchase({
              pool: req.tenantPool,
              tenantId: (req as any).tenant?.id || null,
              checkoutSessionId: checkoutSessionId || undefined,
              paymentIntentId: paymentIntent.id,
              metadata: mergedMetadata,
              pendingTx: checkoutSessionId ? await loadPendingCreditTransaction(req.tenantPool, checkoutSessionId) : null,
            });

            await maybeUpdateStoreOrderFromMetadata(mergedMetadata, 'paid');

            break;
          }
          
          case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object as any;
            console.log('[WEBHOOK] Tenant payment failed:', paymentIntent.id);
            await updateTenantTransactionStatus(req.tenantPool, paymentIntent.id, 'failed');
            await maybeUpdateStoreOrderFromMetadata(paymentIntent.metadata, 'failed');
            break;
          }
          
          case 'charge.refunded': {
            const charge = event.data.object as any;
            console.log('[WEBHOOK] Tenant charge refunded:', charge.payment_intent);
            await updateTenantTransactionStatus(req.tenantPool, charge.payment_intent, 'refunded');
            await maybeUpdateStoreOrderFromMetadata(charge.metadata, 'refunded');
            break;
          }
          
          default:
            console.log('[WEBHOOK] Unhandled tenant event type:', event.type);
        }

        return res.json({ received: true });
      } catch (error: any) {
        console.error('[WEBHOOK] Tenant webhook error:', error);
        return res.status(500).json({ message: 'Webhook processing failed' });
      }
    }
  );

  console.log('[PAYMENT] Payment routes registered');
}
