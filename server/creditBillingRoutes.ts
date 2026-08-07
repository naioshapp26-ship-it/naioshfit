import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { buildScopeFromRequest, consumeCredits, ensureCreditAccount, getOrCreateAccountWithBalance, listCreditActions, listCreditBundles, recordPendingPurchase, settlePurchase, upsertCreditAction, upsertCreditBundle, deleteCreditBundle, deleteCreditAction, adjustCredits, getCreditBonusSettings, upsertCreditBonusSettings } from './services/creditBilling';
import { createPlatformCheckoutSession, logPlatformTransaction } from './payment/platformStripe';
import { createTenantCheckoutSession, logTenantTransaction } from './payment/tenantStripe';
import { createPlatformPayPalOrder } from './payment/platformPayPal';
import { createTenantPayPalOrder } from './payment/tenantPayPal';
import { createPlatformPaymobIntention, getPlatformPaymobKeys } from './payment/platformPaymob';
import { createTenantPaymobIntention, getTenantPaymobKeys } from './payment/tenantPaymob';
import { formatPayPalAmount } from './payment/paypalClient';
import { buildRequestMetadata, mergeStripeMetadata } from './payment/metadata';
import type { Pool } from 'pg';
import { getBundleDeleteHasTransactionsMessage, getInsufficientCreditsMessage, getPaymentGatewayNotConfiguredMessage, getPaymobIntegrationMissingMessage, getPurchaseSessionFailedMessage, getRequestLanguage } from './utils/i18n';

function requireAuth(isAuthenticated: any) {
  return (req: Request, res: Response, next: NextFunction) => isAuthenticated(req, res, next);
}

function requireAdmin(_isAuthenticated: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    return next();
  };
}

function resolveBaseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

const purchaseSchema = z.object({
  bundleId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  paymentProvider: z.enum(['stripe', 'paypal', 'paymob']).optional(),
});

const consumeSchema = z.object({
  actionKey: z.string().min(1),
  units: z.number().int().positive().optional(),
});

const bundleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  credits: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const actionSchema = z.object({
  id: z.string().uuid().optional(),
  actionKey: z.string().min(1),
  description: z.string().nullable().optional(),
  cost: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
});

const adjustSchema = z.object({
  userId: z.number().int().positive(),
  creditsDelta: z.number().int().refine((value) => value !== 0, {
    message: 'creditsDelta must be a non-zero integer',
  }),
  reason: z.string().max(500).optional(),
});

const bonusSettingsSchema = z.object({
  signupBonusCredits: z.number().int().positive().max(100000),
});

export function registerCreditBillingRoutes(app: Express, deps: { isAuthenticated: any }) {
  const auth = requireAuth(deps.isAuthenticated);
  const adminOnly = requireAdmin(deps.isAuthenticated);

  // Public bundle prices for marketing/homepage
  app.get('/api/credits/public-bundles', async (req: Request, res: Response) => {
    try {
      const scope = buildScopeFromRequest(req);
      const bundles = await listCreditBundles(scope, { includeInactive: false });
      return res.json({ bundles });
    } catch (error) {
      console.error('[CREDITS] Failed to load public bundles', error);
      return res.status(500).json({ message: 'Failed to load bundle pricing' });
    }
  });

  // Public summary for authenticated trainee
  app.get('/api/credits/summary', auth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const scope = buildScopeFromRequest(req);
      const account = await getOrCreateAccountWithBalance(scope, user.id);
      const bundles = await listCreditBundles(scope, { includeInactive: false });
      const actions = await listCreditActions(scope, { includeInactive: false });
      const isLow = account.balance <= account.low_balance_threshold;
      const exhausted = account.balance <= 0;

      return res.json({
        balance: account.balance,
        lowBalanceThreshold: account.low_balance_threshold,
        isLow,
        exhausted,
        bundles,
        actions,
      });
    } catch (error) {
      console.error('[CREDITS] Failed to load summary', error);
      return res.status(500).json({ message: 'Failed to load credits summary' });
    }
  });

  // Create checkout session for credit bundle
  app.post('/api/credits/purchase-session', auth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const body = purchaseSchema.parse(req.body ?? {});
      const scope = buildScopeFromRequest(req);
      const bundles = await listCreditBundles(scope, { includeInactive: false });
      const bundle = bundles.find((b) => b.id === body.bundleId);
      if (!bundle) {
        return res.status(404).json({ message: 'Bundle not found' });
      }

      const account = await ensureCreditAccount(scope, user.id);
      const baseUrl = resolveBaseUrl(req);
      const successUrl = body.successUrl || `${baseUrl}/payments/success`;
      const cancelUrl = body.cancelUrl || `${baseUrl}/payments/cancel`;
      const customerEmail = (user.email || '').trim() || undefined;
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
      const bundleMetadata = {
        payment_context: (req as any).tenantPool ? 'tenant' : 'platform',
        payment_type: 'credits_purchase',
        payment_provider: body.paymentProvider || 'stripe',
        item_type: 'credit_bundle',
        item_id: bundle.id,
        item_name: bundle.name,
        item_description: `${bundle.credits} credits bundle`,
        item_quantity: 1,
        item_price_cents: bundle.price_cents,
        item_currency: bundle.currency,
        credit_bundle_id: bundle.id,
        credit_account_id: account.id,
        credit_user_id: user.id,
        credit_tenant_id: tenant?.id || null,
        credit_credits: String(bundle.credits),
      };
      const stripeMetadata = mergeStripeMetadata(requestMetadata, userMetadata, bundleMetadata);

      // Free bundles: grant credits immediately without a payment gateway.
      if (bundle.price_cents <= 0) {
        const sessionId = `free-credits-${bundle.id}-${user.id}-${Date.now()}`;
        await recordPendingPurchase(scope, {
          accountId: account.id,
          userId: user.id,
          bundle,
          checkoutSessionId: sessionId,
          provider: 'free',
        });
        const settled = await settlePurchase(scope, {
          checkoutSessionId: sessionId,
          credits: bundle.credits,
          userId: user.id,
          accountId: account.id,
          bundleId: bundle.id,
        });
        return res.json({
          sessionId,
          checkoutUrl: null,
          clientSecret: null,
          paymentProvider: 'free',
          completed: true,
          balance: settled?.balance ?? null,
        });
      }

      const paymentProvider = body.paymentProvider || 'stripe';
      let sessionId: string | undefined;
      let checkoutUrl: string | null;
      let clientSecret: string | null;

      if ((req as any).tenantPool && paymentProvider === 'stripe') {
        const tenantPool = (req as any).tenantPool as Pool;
        const session = await createTenantCheckoutSession(tenantPool, {
          items: [
            {
              name: bundle.name,
              description: `${bundle.credits} credits bundle`,
              amount: bundle.price_cents,
              quantity: 1,
            },
          ],
          currency: bundle.currency,
          successUrl,
          cancelUrl,
          returnUrl: successUrl,
          customerEmail,
          metadata: stripeMetadata,
          uiMode: 'embedded',
        });
        sessionId = session.sessionId;
        checkoutUrl = session.checkoutUrl;
        clientSecret = session.clientSecret;

        await logTenantTransaction(tenantPool, {
          stripePaymentId: sessionId,
          stripeCheckoutSessionId: sessionId,
          customerUserId: user.id,
          amount: bundle.price_cents / 100,
          currency: bundle.currency,
          status: 'pending',
          paymentType: 'credits_purchase',
          metadata: stripeMetadata,
        });
      } else if (!(req as any).tenantPool && paymentProvider === 'stripe') {
        const session = await createPlatformCheckoutSession({
          amount: bundle.price_cents,
          currency: bundle.currency,
          paymentType: 'credits_purchase',
          productName: bundle.name,
          successUrl,
          cancelUrl,
          returnUrl: successUrl,
          customerEmail,
          metadata: stripeMetadata,
          uiMode: 'embedded',
        });
        sessionId = session.sessionId;
        checkoutUrl = session.checkoutUrl;
        clientSecret = session.clientSecret;

        await logPlatformTransaction({
          stripeCheckoutSessionId: sessionId,
          amount: bundle.price_cents / 100,
          currency: bundle.currency,
          status: 'pending',
          paymentType: 'credits_purchase',
          metadata: stripeMetadata,
        });
      } else if ((req as any).tenantPool && paymentProvider === 'paypal') {
        const tenantPool = (req as any).tenantPool as Pool;
        const order = await createTenantPayPalOrder(tenantPool, {
          amount: formatPayPalAmount(bundle.price_cents / 100),
          currency: bundle.currency,
          description: `${bundle.credits} credits bundle`,
          customId: `credits:${bundle.id}:${user.id}`,
          items: [
            {
              name: bundle.name,
              description: `${bundle.credits} credits bundle`,
              unitAmount: formatPayPalAmount(bundle.price_cents / 100),
              quantity: 1,
            },
          ],
          shippingPreference: 'NO_SHIPPING',
        });

        sessionId = order.id;
        checkoutUrl = order.links?.find((link: any) => link.rel === 'approve')?.href || null;
        clientSecret = null;

        await logTenantTransaction(tenantPool, {
          stripePaymentId: sessionId,
          stripeCheckoutSessionId: sessionId,
          customerUserId: user.id,
          amount: bundle.price_cents / 100,
          currency: bundle.currency,
          status: 'pending',
          paymentType: 'credits_purchase',
          paymentProvider: 'paypal',
          paypalOrderId: sessionId,
          metadata: stripeMetadata,
        });
      } else if (!(req as any).tenantPool && paymentProvider === 'paypal') {
        const order = await createPlatformPayPalOrder({
          amount: formatPayPalAmount(bundle.price_cents / 100),
          currency: bundle.currency,
          description: `${bundle.credits} credits bundle`,
          customId: `credits:${bundle.id}:${user.id}`,
          items: [
            {
              name: bundle.name,
              description: `${bundle.credits} credits bundle`,
              unitAmount: formatPayPalAmount(bundle.price_cents / 100),
              quantity: 1,
            },
          ],
          shippingPreference: 'NO_SHIPPING',
        });

        sessionId = order.id;
        checkoutUrl = order.links?.find((link: any) => link.rel === 'approve')?.href || null;
        clientSecret = null;

        await logPlatformTransaction({
          stripeCheckoutSessionId: sessionId,
          amount: bundle.price_cents / 100,
          currency: bundle.currency,
          status: 'pending',
          paymentType: 'credits_purchase',
          paymentProvider: 'paypal',
          paypalOrderId: sessionId,
          metadata: stripeMetadata,
        });
      } else if ((req as any).tenantPool && paymentProvider === 'paymob') {
        const tenantPool = (req as any).tenantPool as Pool;
        const paymobKeys = await getTenantPaymobKeys(tenantPool);
        if (!paymobKeys.integrationIds.length) {
          throw new Error('PAYMOB_INTEGRATION_IDS_MISSING');
        }
        const intention = await createTenantPaymobIntention(tenantPool, {
          amount: bundle.price_cents,
          currency: bundle.currency,
          paymentMethods: paymobKeys.integrationIds,
          items: [
            {
              name: bundle.name,
              description: `${bundle.credits} credits bundle`,
              amount: bundle.price_cents,
              quantity: 1,
            },
          ],
          billingData: {
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            email: user.email || undefined,
            phone_number: user.phone || user.phoneNumber || user.mobile || undefined,
          },
          metadata: stripeMetadata,
          successUrl,
          failureUrl: cancelUrl,
          callbackUrl: `${baseUrl}/api/paymob/webhook`,
        });

        sessionId = intention.id || `paymob-${Date.now()}`;
        checkoutUrl = intention.paymentUrl;
        clientSecret = intention.clientSecret;

        await logTenantTransaction(tenantPool, {
          stripePaymentId: sessionId,
          stripeCheckoutSessionId: sessionId,
          customerUserId: user.id,
          amount: bundle.price_cents / 100,
          currency: bundle.currency,
          status: 'pending',
          paymentType: 'credits_purchase',
          paymentProvider: 'paymob',
          paymobIntentionId: intention.id || sessionId,
          metadata: stripeMetadata,
        });
      } else if (!(req as any).tenantPool && paymentProvider === 'paymob') {
        const paymobKeys = await getPlatformPaymobKeys();
        if (!paymobKeys.integrationIds.length) {
          throw new Error('PAYMOB_INTEGRATION_IDS_MISSING');
        }
        const intention = await createPlatformPaymobIntention({
          amount: bundle.price_cents,
          currency: bundle.currency,
          paymentMethods: paymobKeys.integrationIds,
          items: [
            {
              name: bundle.name,
              description: `${bundle.credits} credits bundle`,
              amount: bundle.price_cents,
              quantity: 1,
            },
          ],
          billingData: {
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            email: user.email || undefined,
            phone_number: user.phone || user.phoneNumber || user.mobile || undefined,
          },
          metadata: stripeMetadata,
          successUrl,
          failureUrl: cancelUrl,
          callbackUrl: `${baseUrl}/api/admin/paymob/webhook`,
        });

        sessionId = intention.id || `paymob-${Date.now()}`;
        checkoutUrl = intention.paymentUrl;
        clientSecret = intention.clientSecret;

        await logPlatformTransaction({
          stripeCheckoutSessionId: sessionId,
          amount: bundle.price_cents / 100,
          currency: bundle.currency,
          status: 'pending',
          paymentType: 'credits_purchase',
          paymentProvider: 'paymob',
          paymobIntentionId: intention.id || sessionId,
          metadata: stripeMetadata,
        });
      }

      if (!sessionId) {
        return res.status(503).json({
          message: 'بوابة الدفع غير مهيأة أو غير متاحة حالياً.',
          code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        });
      }

      await recordPendingPurchase(scope, {
        accountId: account.id,
        userId: user.id,
        bundle,
        checkoutSessionId: sessionId,
        provider: paymentProvider,
      });

      return res.json({
        sessionId,
        checkoutUrl,
        clientSecret,
        paymentProvider,
      });
    } catch (error: any) {
      console.error('[CREDITS] Failed to create purchase session', error);
      const language = getRequestLanguage(req);
      if (error?.issues) {
        return res.status(400).json({ message: 'Invalid request', details: error.issues });
      }
      const code = String(error?.message || '');
      if (
        code === 'PLATFORM_PAYMENT_NOT_CONFIGURED'
        || code === 'TENANT_PAYMENT_NOT_CONFIGURED'
        || code === 'PLATFORM_PAYMOB_NOT_CONFIGURED'
        || code === 'TENANT_PAYMOB_NOT_CONFIGURED'
      ) {
        return res.status(503).json({
          message: getPaymentGatewayNotConfiguredMessage(language),
          code,
        });
      }
      if (code === 'PAYMOB_INTEGRATION_IDS_MISSING') {
        return res.status(503).json({
          message: getPaymobIntegrationMissingMessage(language),
          code,
        });
      }
      if (code.includes('TENANT_DB_ENCRYPTION_KEY')) {
        return res.status(503).json({
          message: getPaymentGatewayNotConfiguredMessage(language),
          code: 'PAYMENT_KEY_DECRYPT_FAILED',
        });
      }
      if (error?.type?.startsWith?.('Stripe')) {
        return res.status(502).json({
          message: error.message || getPurchaseSessionFailedMessage(language),
          code: 'STRIPE_ERROR',
        });
      }
      if (code.startsWith('Paymob API error')) {
        return res.status(502).json({
          message: getPurchaseSessionFailedMessage(language),
          code: 'PAYMOB_ERROR',
          details: code,
        });
      }
      return res.status(500).json({
        message: getPurchaseSessionFailedMessage(language),
        code: 'PURCHASE_SESSION_FAILED',
      });
    }
  });

  // Consume credits for an action
  app.post('/api/credits/consume', auth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const body = consumeSchema.parse(req.body ?? {});
      const scope = buildScopeFromRequest(req);
      const account = await getOrCreateAccountWithBalance(scope, user.id);
      const result = await consumeCredits(scope, {
        userId: user.id,
        actionKey: body.actionKey,
        units: body.units,
      });

      if ((result as any).insufficient) {
        const language = getRequestLanguage(req);
        return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: (result as any).balance });
      }

      return res.json({
        balance: (result as any).balance,
        isLow: (result as any).isLow,
        exhausted: (result as any).exhausted,
        transaction: (result as any).transaction,
      });
    } catch (error: any) {
      console.error('[CREDITS] Failed to consume credits', error);
      if (error?.issues) {
        return res.status(400).json({ message: 'Invalid request', details: error.issues });
      }
      return res.status(500).json({ message: error?.message || 'Failed to consume credits' });
    }
  });

  // Admin: bundles CRUD (scope-aware)
  app.get('/api/admin/credits/bundles', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const scope = buildScopeFromRequest(req);
      const bundles = await listCreditBundles(scope, { includeInactive: true });
      return res.json(bundles);
    } catch (error) {
      console.error('[CREDITS] Failed to list bundles', error);
      return res.status(500).json({ message: 'Failed to list credit bundles' });
    }
  });

  app.post('/api/admin/credits/bundles', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const body = bundleSchema.parse(req.body ?? {});
      const scope = buildScopeFromRequest(req);
      const bundle = await upsertCreditBundle(scope, body);
      return res.json(bundle);
    } catch (error: any) {
      console.error('[CREDITS] Failed to save bundle', error);
      if (error?.issues) {
        return res.status(400).json({ message: 'Invalid bundle payload', details: error.issues });
      }
      return res.status(500).json({ message: error?.message || 'Failed to save bundle' });
    }
  });

  app.delete('/api/admin/credits/bundles/:id', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const scope = buildScopeFromRequest(req);
      await deleteCreditBundle(scope, req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[CREDITS] Failed to delete bundle', error);
      if (error?.message?.includes('related transactions')) {
        const language = getRequestLanguage(req);
        return res.status(400).json({ message: getBundleDeleteHasTransactionsMessage(language) });
      }
      return res.status(500).json({ message: error?.message || 'Failed to delete bundle' });
    }
  });

  // Admin: actions CRUD (scope-aware)
  app.get('/api/admin/credits/actions', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const scope = buildScopeFromRequest(req);
      const actions = await listCreditActions(scope, { includeInactive: true });
      return res.json(actions);
    } catch (error) {
      console.error('[CREDITS] Failed to list actions', error);
      return res.status(500).json({ message: 'Failed to list credit actions' });
    }
  });

  app.post('/api/admin/credits/actions', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const body = actionSchema.parse(req.body ?? {});
      const scope = buildScopeFromRequest(req);
      const action = await upsertCreditAction(scope, body);
      return res.json(action);
    } catch (error: any) {
      console.error('[CREDITS] Failed to save action', error);
      if (error?.issues) {
        return res.status(400).json({ message: 'Invalid action payload', details: error.issues });
      }
      return res.status(500).json({ message: error?.message || 'Failed to save action' });
    }
  });

  app.delete('/api/admin/credits/actions/:id', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const scope = buildScopeFromRequest(req);
      await deleteCreditAction(scope, req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[CREDITS] Failed to delete action', error);
      return res.status(500).json({ message: error?.message || 'Failed to delete action' });
    }
  });

  app.post('/api/admin/credits/adjust', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const body = adjustSchema.parse(req.body ?? {});
      const scope = buildScopeFromRequest(req);
      const adminId = (req.user as any)?.id ?? null;
      const result = await adjustCredits(scope, {
        userId: body.userId,
        creditsDelta: body.creditsDelta,
        reason: body.reason ?? null,
        adminId,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('[CREDITS] Failed to adjust credits', error);
      if (error?.issues) {
        return res.status(400).json({ message: 'Invalid adjust payload', details: error.issues });
      }
      if (error?.message?.includes('Insufficient balance')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error?.message || 'Failed to adjust credits' });
    }
  });

  app.get('/api/admin/credits/bonus-settings', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const scope = buildScopeFromRequest(req);
      const settings = await getCreditBonusSettings(scope);
      return res.json(settings);
    } catch (error: any) {
      console.error('[CREDITS] Failed to load bonus settings', error);
      return res.status(500).json({ message: error?.message || 'Failed to load bonus settings' });
    }
  });

  app.post('/api/admin/credits/bonus-settings', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const body = bonusSettingsSchema.parse(req.body ?? {});
      const scope = buildScopeFromRequest(req);
      const adminId = (req.user as any)?.id ?? null;
      const settings = await upsertCreditBonusSettings(scope, {
        signupBonusCredits: body.signupBonusCredits,
        updatedBy: adminId,
      });
      return res.json({ signupBonusCredits: settings.signup_bonus_credits });
    } catch (error: any) {
      console.error('[CREDITS] Failed to save bonus settings', error);
      if (error?.issues) {
        return res.status(400).json({ message: 'Invalid bonus settings payload', details: error.issues });
      }
      return res.status(500).json({ message: error?.message || 'Failed to save bonus settings' });
    }
  });

  app.get('/api/admin/credits/balance/:userId', auth, adminOnly, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ message: 'Invalid user id' });
      }
      const scope = buildScopeFromRequest(req);
      const account = await getOrCreateAccountWithBalance(scope, userId);
      return res.json({ balance: account.balance, lowBalanceThreshold: account.low_balance_threshold });
    } catch (error: any) {
      console.error('[CREDITS] Failed to load balance', error);
      return res.status(500).json({ message: error?.message || 'Failed to load credit balance' });
    }
  });

  // Utility: webhook settlement (exposed for payment webhooks)
  app.post('/api/credits/settle', async (req: Request, res: Response) => {
    try {
      const { checkoutSessionId, paymentIntentId, credits, userId, bundleId } = req.body || {};
      if (!checkoutSessionId || !credits || !userId) {
        return res.status(400).json({ message: 'Missing required settlement fields' });
      }
      const scope = buildScopeFromRequest(req);
      const account = await ensureCreditAccount(scope, userId);
      const settled = await settlePurchase(scope, {
        checkoutSessionId,
        paymentIntentId,
        credits,
        userId,
        accountId: account.id,
        bundleId,
      });
      if (!settled) {
        return res.status(404).json({ message: 'No matching transaction' });
      }
      return res.json(settled);
    } catch (error: any) {
      console.error('[CREDITS] Settlement failed', error);
      return res.status(500).json({ message: error?.message || 'Failed to settle credits' });
    }
  });
}
