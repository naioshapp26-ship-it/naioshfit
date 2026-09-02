import type { Express, Request, Response } from 'express';
import { tenantResolver, requireTenantPool } from './tenantResolver';
import { provisionTenant, getProvisioningStatus } from './provisioningService';
import { isValidSubdomain, normalizeSubdomain } from './validation';
import { ensureCentralSchema, getCentralPool } from './centralDb';
import {
  createPlatformCheckoutSession,
  logPlatformTransaction,
  getPlatformPublishableKey,
  getPlatformPaymentSettings,
  getPlatformSaasPlanConfig,
  getPlatformStripeClient,
} from '../payment/platformStripe';
import { createPlatformPaymobIntention, getPlatformPaymobKeys, isPlatformPaymobConfigured } from '../payment/platformPaymob';
import {
  createPlatformPayPalSubscription,
  getPlatformPayPalSubscription,
  isPlatformPayPalConfigured,
} from '../payment/platformPayPal';
import { buildRequestMetadata, mergeStripeMetadata } from '../payment/metadata';
import { getPaymentNotCompletedMessage, getRequestLanguage } from '../utils/i18n';
import { buildTenantPublicUrl, normalizeSaasMainDomain } from '@shared/saasUrls';
import type { TenantRecord } from './types';
import { isDirectSignupAllowed, isSaasPaymentSkipped } from './paymentConfig';
import { applyTenantEnvDefaults, resolveTenantDatabaseTemplate, resolveTenantEncryptionKey } from './tenantEnv';
import { getTenantIsolationMode } from './tenantConnection';

export { isSaasPaymentSkipped } from './paymentConfig';

// Store pending signups temporarily (in production, use Redis or database)
const pendingSignups = new Map<string, any>();

const FALLBACK_SAAS_PLANS = [
  { key: 'starter', name: 'Starter Plan', price_id: '', paypal_plan_id: '', amount: 9900, currency: 'usd', interval: 'month' },
  { key: 'growth', name: 'Growth Plan', price_id: '', paypal_plan_id: '', amount: 29900, currency: 'usd', interval: 'month' },
  { key: 'enterprise', name: 'Enterprise Plan', price_id: '', paypal_plan_id: '', amount: 99900, currency: 'usd', interval: 'month' },
];

function getSaasMainDomain(): string {
  return normalizeSaasMainDomain(process.env.MAIN_DOMAIN);
}

function serializeTenant(tenant: TenantRecord) {
  const mainDomain = getSaasMainDomain();
  return {
    id: tenant.id,
    subdomain: tenant.subdomain,
    companyName: tenant.company_name,
    status: tenant.status,
    subscriptionPlan: tenant.subscription_plan,
    mainDomain,
    tenantUrl: buildTenantPublicUrl(tenant.subdomain, mainDomain, { path: '/auth' }),
  };
}

function pruneExpiredPendingSignups() {
  for (const [key, value] of pendingSignups.entries()) {
    if (Date.now() - value.createdAt > 3600000) {
      pendingSignups.delete(key);
    }
  }
}

function createDirectPendingSignup(input: {
  subdomain: string;
  companyName: string;
  subscriptionPlan: string;
  adminEmail: string;
  adminName: string;
  adminPhone?: string;
  adminPassword: string;
}) {
  pruneExpiredPendingSignups();
  const sessionReference = `saas-${input.subdomain}-${Date.now()}`;
  pendingSignups.set(sessionReference, {
    subdomain: input.subdomain,
    companyName: input.companyName,
    subscriptionPlan: input.subscriptionPlan,
    amount: 0,
    adminEmail: input.adminEmail,
    adminName: input.adminName,
    adminPhone: input.adminPhone || '',
    adminPassword: input.adminPassword,
    createdAt: Date.now(),
    paymentProvider: 'direct',
  });

  return {
    directSignup: true,
    session: {
      sessionId: sessionReference,
      checkoutUrl: null,
      clientSecret: null,
      sessionReference,
      amount: 0,
      currency: 'USD',
      paymentProvider: 'direct' as const,
    },
  };
}

export function registerSaasRoutes(app: Express) {
  app.use('/saas', async (_req: Request, res: Response, next) => {
    try {
      await ensureCentralSchema();
      return next();
    } catch (error) {
      console.error('[SAAS] Central database initialization failed:', error);
      return res.status(500).json({ message: 'Central database not initialized.' });
    }
  });

  app.get('/saas/platform-config', (_req: Request, res: Response) => {
    const mainDomain = getSaasMainDomain();
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return res.json({
      mainDomain,
      signupBaseUrl: `${protocol}://www.${mainDomain}`,
      skipPayment: isSaasPaymentSkipped(),
      directSignupAvailable: isDirectSignupAllowed(),
      isolationMode: getTenantIsolationMode(),
      provisionEngine: 'per-file-v4',
    });
  });

  // Public config alias used by the signup wizard
  app.get('/saas/public-config', (_req: Request, res: Response) => {
    const mainDomain = getSaasMainDomain();
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return res.json({
      mainDomain,
      signupBaseUrl: `${protocol}://www.${mainDomain}`,
      skipPayment: isSaasPaymentSkipped(),
      directSignupAvailable: isDirectSignupAllowed(),
      isolationMode: getTenantIsolationMode(),
      provisionEngine: 'per-file-v4',
    });
  });

  // Create Stripe checkout session for SaaS subscription
  app.post('/saas/create-payment-session', async (req: Request, res: Response) => {
    const { subdomain, companyName, subscriptionPlan, adminEmail, adminName, adminPhone, adminPassword, paymentProvider } = req.body || {};
    
    if (!subdomain || !companyName || !subscriptionPlan || !adminEmail || !adminName || !adminPassword) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const normalizedSubdomain = normalizeSubdomain(subdomain);
    if (!normalizedSubdomain || !isValidSubdomain(normalizedSubdomain)) {
      return res.status(400).json({ message: 'Invalid tenant subdomain.' });
    }

    try {
      // Check if subdomain already exists
      const pool = getCentralPool();
      const existing = await pool.query(
        'SELECT id FROM tenants WHERE subdomain = $1',
        [normalizedSubdomain]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'Subdomain already taken.' });
      }

      // Create a unique session reference
      const sessionReference = `saas-${normalizedSubdomain}-${Date.now()}`;

      pruneExpiredPendingSignups();

      // Get the main domain for redirect URLs
      const mainDomain = getSaasMainDomain();
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const baseUrl = `${protocol}://www.${mainDomain}`;

      const provider = paymentProvider === 'paypal'
        ? 'paypal'
        : (paymentProvider === 'paymob' ? 'paymob' : 'stripe');

      if (provider === 'paymob' && !adminPhone) {
        return res.status(400).json({ message: 'Missing required fields.' });
      }

      // Check if platform payment is configured
      let paymentSettings;
      try {
        paymentSettings = await getPlatformPaymentSettings();
      } catch (settingsError) {
        console.error('[SAAS] Failed to load payment settings:', settingsError);
        paymentSettings = null;
      }

      const encryptionKeyConfigured = (() => {
        try {
          resolveTenantEncryptionKey();
          return true;
        } catch {
          return false;
        }
      })();
      const paymentReady = Boolean(
        paymentSettings &&
        encryptionKeyConfigured &&
        paymentSettings.saas_plan_config?.length
      );

      if (!paymentReady) {
        if (isDirectSignupAllowed()) {
          try {
            resolveTenantEncryptionKey();
            resolveTenantDatabaseTemplate();
          } catch (envError: any) {
            const message = envError?.message || '';
            if (message.includes('TENANT_DB_ENCRYPTION_KEY')) {
              return res.status(503).json({
                message: 'Tenant database encryption key is missing or invalid. Please contact administrator.',
                code: 'TENANT_DB_ENCRYPTION_KEY_INVALID',
              });
            }
            if (message.includes('TENANT_DATABASE_URL_TEMPLATE')) {
              return res.status(503).json({
                message: 'Tenant database template is not configured. Please contact administrator.',
                code: 'TENANT_DATABASE_TEMPLATE_MISSING',
              });
            }
            throw envError;
          }
          return res.json(createDirectPendingSignup({
            subdomain: normalizedSubdomain,
            companyName,
            subscriptionPlan,
            adminEmail,
            adminName,
            adminPhone,
            adminPassword,
          }));
        }
        return res.status(503).json({
          message: 'Payment gateway not configured. Please contact administrator.',
          code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
          directSignupAvailable: false,
        });
      }

      if (provider === 'paypal') {
        const paypalConfigured = await isPlatformPayPalConfigured();
        if (!paypalConfigured) {
          return res.status(503).json({
            message: 'PayPal not configured. Please contact administrator.',
            code: 'PLATFORM_PAYMENT_NOT_CONFIGURED'
          });
        }
      }

      if (provider === 'paymob') {
        const paymobConfigured = await isPlatformPaymobConfigured();
        if (!paymobConfigured) {
          return res.status(503).json({
            message: 'Paymob not configured. Please contact administrator.',
            code: 'PLATFORM_PAYMENT_NOT_CONFIGURED'
          });
        }
      }

      const planConfigResponse = await getPlatformSaasPlanConfig().catch((planError) => {
        console.error('[SAAS] Failed to load SaaS plan config:', planError);
        return null;
      });
      if (!planConfigResponse) {
        return res.status(503).json({
          message: 'Payment gateway not configured. Please contact administrator.',
          code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
          directSignupAvailable: isDirectSignupAllowed(),
        });
      }
      const planConfig = planConfigResponse.plans.find((plan) => plan.key === subscriptionPlan);
      if (!planConfig) {
        return res.status(400).json({ message: 'Invalid subscription plan.' });
      }

      // Currency:
      // - Stripe/PayPal: use plan-configured currency (default USD)
      // - Paymob: force EGP because Integration IDs are currency-scoped in Paymob
      const currency = provider === 'paymob'
        ? 'EGP'
        : String(planConfig.currency || 'USD').toUpperCase();

      if (provider === 'stripe' && !planConfig.price_id) {
        return res.status(400).json({ message: 'Selected plan is not configured for recurring billing.' });
      }

      if (provider === 'paypal' && !planConfig.paypal_plan_id) {
        return res.status(400).json({ message: 'Selected plan is not configured for PayPal billing.' });
      }

      if (provider === 'paymob' && !planConfig.amount) {
        return res.status(400).json({ message: 'Selected plan does not have a billing amount configured.' });
      }

      const planAmount = planConfig.amount ? planConfig.amount / 100 : 0;
      const requestMetadata = buildRequestMetadata(req);
      const signupMetadata = {
        payment_context: 'platform',
        payment_type: 'saas_subscription',
        payment_provider: provider,
        customer_email: adminEmail,
        customer_name: adminName,
        company_name: companyName,
        tenant_subdomain: normalizedSubdomain,
        subscription_plan: subscriptionPlan,
        subscription_plan_name: planConfig.name,
        subscription_price_id: planConfig.price_id,
        subscription_amount: planAmount,
        subscription_currency: currency,
        trial_days: planConfigResponse.trial_days ?? 14,
      };
      const stripeMetadata = mergeStripeMetadata(requestMetadata, signupMetadata, {
        session_reference: sessionReference,
      });

      let session: { sessionId: string; checkoutUrl: string | null; clientSecret: string | null };
      let paypalSubscriptionId: string | null = null;
      let paymobIntentionId: string | null = null;

      if (provider === 'paypal') {
        const subscription = await createPlatformPayPalSubscription({
          planId: planConfig.paypal_plan_id as string,
          customId: sessionReference,
          returnUrl: `${baseUrl}/saas?step=3&session=${sessionReference}&status=success`,
          cancelUrl: `${baseUrl}/saas?step=2&session=${sessionReference}&status=cancelled`,
          subscriber: {
            emailAddress: adminEmail,
            name: {
              givenName: adminName.split(' ')[0] || adminName,
              surname: adminName.split(' ').slice(1).join(' ') || undefined,
            },
          },
        });

        paypalSubscriptionId = subscription.id;
        session = {
          sessionId: subscription.id,
          checkoutUrl: subscription.links?.find((link: any) => link.rel === 'approve')?.href || null,
          clientSecret: null,
        };
      } else if (provider === 'paymob') {
        const paymobKeys = await getPlatformPaymobKeys();
        const intention = await createPlatformPaymobIntention({
          amount: planConfig.amount as number,
          currency,
          paymentMethods: paymobKeys.integrationIds,
          items: [
            {
              name: planConfig.name,
              amount: planConfig.amount as number,
              quantity: 1,
            },
          ],
          billingData: {
            first_name: adminName.split(' ')[0] || adminName,
            last_name: adminName.split(' ').slice(1).join(' ') || '',
            email: adminEmail,
            phone_number: String(adminPhone || '').trim(),
          },
          metadata: stripeMetadata,
          successUrl: `${baseUrl}/saas?step=3&session=${sessionReference}&status=success`,
          failureUrl: `${baseUrl}/saas?step=2&session=${sessionReference}&status=cancelled`,
          callbackUrl: `${baseUrl}/api/admin/paymob/webhook`,
        });

        paymobIntentionId = intention.id;
        session = {
          sessionId: intention.id || sessionReference,
          checkoutUrl: intention.paymentUrl,
          clientSecret: intention.clientSecret,
        };
      } else {
        // Create Stripe checkout session
        session = await createPlatformCheckoutSession({
          currency,
          paymentType: 'saas_subscription',
          priceId: planConfig.price_id,
          trialPeriodDays: planConfigResponse.trial_days ?? 14,
          successUrl: `${baseUrl}/saas?step=3&session=${sessionReference}&status=success`,
          cancelUrl: `${baseUrl}/saas?step=2&session=${sessionReference}&status=cancelled`,
          returnUrl: `${baseUrl}/saas?step=3&session=${sessionReference}&status=success`,
          customerEmail: adminEmail,
          metadata: stripeMetadata,
          uiMode: 'embedded',
        });
      }

      // Store signup data temporarily
      pendingSignups.set(sessionReference, {
        subdomain: normalizedSubdomain,
        companyName,
        subscriptionPlan,
        amount: planAmount,
        adminEmail,
        adminName,
        adminPassword,
        createdAt: Date.now(),
        stripeSessionId: session.sessionId,
        paypalSubscriptionId,
        paymentProvider: provider,
        paymobIntentionId,
      });

      res.json({
        session: {
          sessionId: session.sessionId,
          checkoutUrl: session.checkoutUrl,
          clientSecret: session.clientSecret,
          sessionReference,
          amount: planAmount,
          currency,
          paymentProvider: provider,
          paypalSubscriptionId,
          paymobIntentionId,
        },
      });
    } catch (error: any) {
      console.error('[SAAS] Payment session creation failed:', error);

      const message = error?.message || '';
      if (message.includes('TENANT_DB_ENCRYPTION_KEY')) {
        return res.status(503).json({
          message: 'Tenant database encryption key is missing or invalid. Please contact administrator.',
          code: 'TENANT_DB_ENCRYPTION_KEY_INVALID',
        });
      }

      if (message.startsWith('Paymob API error:')) {
        const raw = message.slice('Paymob API error:'.length).trim();
        let detail: string | null = null;
        try {
          const parsed = JSON.parse(raw);
          detail = typeof parsed?.detail === 'string' ? parsed.detail : null;
          if (!detail && parsed?.billing_data && typeof parsed.billing_data === 'object') {
            detail = JSON.stringify(parsed.billing_data);
          }
        } catch {
          // ignore JSON parse failures
        }

        return res.status(502).json({
          message: detail ? `Paymob error: ${detail}` : 'Paymob error while creating payment session.',
          code: 'PAYMOB_SESSION_FAILED',
          raw,
        });
      }

      if (error.message === 'PLATFORM_PAYMENT_NOT_CONFIGURED') {
        return res.status(503).json({ 
          message: 'Payment gateway not configured. Please contact administrator.',
          code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
          directSignupAvailable: isDirectSignupAllowed(),
        });
      }

      if (isDirectSignupAllowed()) {
        return res.status(503).json({
          message: 'Payment gateway not configured. Please contact administrator.',
          code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
          directSignupAvailable: true,
        });
      }

      res.status(500).json({ message: 'Failed to create payment session.' });
    }
  });

  // Direct signup session when payment gateway is not configured yet
  app.post('/saas/create-signup-session', async (req: Request, res: Response) => {
    const { subdomain, companyName, subscriptionPlan, adminEmail, adminName, adminPhone, adminPassword } = req.body || {};

    if (!isDirectSignupAllowed()) {
      return res.status(503).json({
        message: 'Payment gateway not configured. Please contact administrator.',
        code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
      });
    }

    if (!subdomain || !companyName || !subscriptionPlan || !adminEmail || !adminName || !adminPassword) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const normalizedSubdomain = normalizeSubdomain(subdomain);
    if (!normalizedSubdomain || !isValidSubdomain(normalizedSubdomain)) {
      return res.status(400).json({ message: 'Invalid tenant subdomain.' });
    }

    try {
      resolveTenantEncryptionKey();
    } catch {
      return res.status(503).json({
        message: 'Tenant database encryption key is missing or invalid. Please contact administrator.',
        code: 'TENANT_DB_ENCRYPTION_KEY_INVALID',
      });
    }

    try {
      resolveTenantDatabaseTemplate();
    } catch {
      return res.status(503).json({
        message: 'Tenant database template is not configured. Please contact administrator.',
        code: 'TENANT_DATABASE_TEMPLATE_MISSING',
      });
    }

    try {
      const pool = getCentralPool();
      const existing = await pool.query(
        'SELECT id FROM tenants WHERE subdomain = $1',
        [normalizedSubdomain]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'Subdomain already taken.' });
      }

      pruneExpiredPendingSignups();

      return res.json(createDirectPendingSignup({
        subdomain: normalizedSubdomain,
        companyName,
        subscriptionPlan,
        adminEmail,
        adminName,
        adminPhone,
        adminPassword,
      }));
    } catch (error: any) {
      console.error('[SAAS] Direct signup session creation failed:', error);
      return res.status(500).json({ message: 'Failed to create signup session.' });
    }
  });

  // Provision tenant after successful Stripe payment
  app.post('/saas/provision', async (req: Request, res: Response) => {
    const { sessionReference, subdomain, companyName, adminEmail, adminName, adminPhone, adminPassword, subscriptionPlan, paymentProvider, paypalSubscriptionId } = req.body || {};
    
    // Support both sessionReference and merchantReferenceId for backward compatibility
    const reference = sessionReference || req.body.merchantReferenceId;
    
    if (!reference || !subdomain || !companyName || !adminEmail || !adminName || !adminPassword) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const resolvedAdminPhone = String(adminPhone || pendingSignups.get(reference)?.adminPhone || '').trim();

    const normalizedSubdomain = normalizeSubdomain(subdomain);
    if (!normalizedSubdomain || !isValidSubdomain(normalizedSubdomain)) {
      return res.status(400).json({ message: 'Invalid tenant subdomain.' });
    }

    try {
      let pending = pendingSignups.get(reference);
      if (!pending && isDirectSignupAllowed() && paymentProvider === 'direct') {
        pending = {
          subdomain: normalizedSubdomain,
          companyName,
          subscriptionPlan,
          adminEmail,
          adminName,
          adminPhone: resolvedAdminPhone,
          adminPassword,
          paymentProvider: 'direct',
          amount: 0,
          createdAt: Date.now(),
        };
      }
      if (!pending) {
        return res.status(400).json({ message: 'Invalid or expired payment session.' });
      }

      const provider = pending.paymentProvider === 'direct'
        ? 'direct'
        : (paymentProvider || pending.paymentProvider || 'stripe');
      let stripeCheckoutSessionId: string | null = pending.stripeSessionId || null;
      let stripePaymentIntentId: string | null = null;
      let resolvedPayPalSubscriptionId: string | null = paypalSubscriptionId || pending.paypalSubscriptionId || null;

      if (provider === 'direct') {
        if (!isDirectSignupAllowed()) {
          return res.status(403).json({ message: 'Direct signup is not enabled.' });
        }
      } else if (provider === 'paypal') {
        if (!resolvedPayPalSubscriptionId) {
          return res.status(400).json({ message: 'Missing PayPal subscription reference.' });
        }

        try {
          const subscription = await getPlatformPayPalSubscription(resolvedPayPalSubscriptionId);
          const status = subscription?.status;
          if (status !== 'ACTIVE') {
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getPaymentNotCompletedMessage(language) });
          }
        } catch (paypalError: any) {
          console.error('[SAAS] Failed to verify PayPal subscription:', paypalError);
          return res.status(502).json({ message: 'Unable to verify PayPal subscription.' });
        }
      } else if (provider === 'paymob') {
        const paymobReference = pending.paymobIntentionId || stripeCheckoutSessionId || reference;
        if (!paymobReference) {
          return res.status(400).json({ message: 'Missing Paymob payment reference.' });
        }

        try {
          const pool = getCentralPool();
          const result = await pool.query(
            `SELECT status FROM platform_payment_transactions
             WHERE paymob_intention_id = $1 OR paymob_transaction_id = $1 OR stripe_payment_id = $1 OR stripe_checkout_session_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [paymobReference]
          );

          const status = result.rows[0]?.status || 'pending';
          if (status !== 'completed') {
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getPaymentNotCompletedMessage(language) });
          }
        } catch (paymobError: any) {
          console.error('[SAAS] Failed to verify Paymob payment:', paymobError);
          return res.status(502).json({ message: 'Unable to verify Paymob payment.' });
        }
      } else {
        if (!stripeCheckoutSessionId) {
          return res.status(400).json({ message: 'Missing payment session reference.' });
        }

        try {
          const stripe = await getPlatformStripeClient();
          const session = await stripe.checkout.sessions.retrieve(stripeCheckoutSessionId, {
            expand: ['payment_intent'],
          });

          if (session.payment_status !== 'paid' && session.payment_status !== 'complete') {
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getPaymentNotCompletedMessage(language) });
          }

          stripeCheckoutSessionId = session.id;
          if (typeof session.payment_intent === 'string') {
            stripePaymentIntentId = session.payment_intent;
          } else if (session.payment_intent?.id) {
            stripePaymentIntentId = session.payment_intent.id;
          }
        } catch (stripeError: any) {
          console.error('[SAAS] Failed to verify Stripe session:', stripeError);
          return res.status(502).json({ message: 'Unable to verify payment session with Stripe.' });
        }
      }

      // Provision the tenant
      const tenant = await provisionTenant({
        subdomain: normalizedSubdomain,
        companyName,
        adminEmail,
        adminName,
        adminPhone: resolvedAdminPhone,
        adminPassword,
        subscriptionPlan: subscriptionPlan || pending.subscriptionPlan,
      });

      // Log the transaction (skip for direct signup without payment)
      if (provider !== 'direct') {
        try {
          await logPlatformTransaction({
          stripePaymentId: provider === 'paypal'
            ? resolvedPayPalSubscriptionId || reference
            : (provider === 'paymob'
                ? (pending.paymobIntentionId || stripeCheckoutSessionId || reference)
                : (stripePaymentIntentId || stripeCheckoutSessionId || reference)),
          stripeCheckoutSessionId: provider === 'paypal'
            ? resolvedPayPalSubscriptionId || reference
            : (provider === 'paymob'
                ? (pending.paymobIntentionId || stripeCheckoutSessionId || reference)
                : (stripeCheckoutSessionId || stripePaymentIntentId || reference)),
          tenantId: tenant.id,
          amount: pending.amount,
          currency: 'USD',
          status: 'completed',
          paymentType: 'saas_subscription',
          paymentProvider: provider,
          paypalSubscriptionId: provider === 'paypal' ? resolvedPayPalSubscriptionId : undefined,
          paymobIntentionId: provider === 'paymob' ? (pending.paymobIntentionId || stripeCheckoutSessionId || reference) : undefined,
          metadata: {
            subdomain: normalizedSubdomain,
            subscriptionPlan: subscriptionPlan || pending.subscriptionPlan,
            sessionReference: reference,
          },
        });
        } catch (logError) {
          console.error('[SAAS] Failed to log transaction:', logError);
        }
      }

      const logs = await getProvisioningStatus(tenant.id);
      
      // Clean up pending signup
      pendingSignups.delete(reference);

      return res.status(201).json({
        tenant: serializeTenant(tenant),
        logs,
      });
    } catch (error: any) {
      console.error('[SAAS] Provisioning failed:', error);
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Tenant subdomain already exists.' });
      }

      let logs: any[] = [];
      try {
        const existing = await getCentralPool().query(
          'SELECT id FROM tenants WHERE subdomain = $1 LIMIT 1',
          [normalizedSubdomain]
        );
        if (existing.rows[0]?.id) {
          logs = await getProvisioningStatus(existing.rows[0].id);
        }
      } catch (logLookupError) {
        console.error('[SAAS] Failed to load provisioning logs after error:', logLookupError);
      }

      const exposeDetails = process.env.SAAS_DEBUG_INIT === '1' || process.env.NODE_ENV === 'development';
      return res.status(500).json({
        message: error?.message || 'Tenant provisioning failed.',
        error: exposeDetails ? error?.message : undefined,
        details: exposeDetails ? error?.stack : undefined,
        logs,
      });
    }
  });

  // Get SaaS subscription plan configuration (public)
  app.get('/saas/plan-config', async (_req: Request, res: Response) => {
    try {
      const planConfig = await getPlatformSaasPlanConfig();
      return res.json({
        ...planConfig,
        paymentConfigured: true,
        directSignupAvailable: isDirectSignupAllowed(),
        skipPayment: isSaasPaymentSkipped(),
      });
    } catch (error: any) {
      console.error('[SAAS] Failed to load plan config:', error);
      if (isDirectSignupAllowed()) {
        return res.json({
          trial_days: 14,
          plans: FALLBACK_SAAS_PLANS,
          paymentConfigured: false,
          directSignupAvailable: true,
          skipPayment: isSaasPaymentSkipped(),
        });
      }
      return res.status(503).json({
        message: 'Plan configuration not available.',
        code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
        directSignupAvailable: false,
        skipPayment: false,
      });
    }
  });

  // Get Stripe publishable key for frontend payment integration
  app.get('/api/stripe/saas-publishable-key', async (req: Request, res: Response) => {
    try {
      const publishableKey = await getPlatformPublishableKey();
      
      if (!publishableKey) {
        return res.status(503).json({ 
          message: 'Payment gateway not configured.',
          code: 'PLATFORM_PAYMENT_NOT_CONFIGURED'
        });
      }

      res.json({ publishableKey });
    } catch (error: any) {
      console.error('[SAAS] Failed to get publishable key:', error);
      res.status(500).json({ message: 'Failed to get payment configuration.' });
    }
  });

  // Get provisioning status for a tenant
  app.get('/saas/provisioning-status/:tenantId', async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    
    try {
      const logs = await getProvisioningStatus(tenantId);
      res.json({ logs });
    } catch (error: any) {
      console.error('[SAAS] Failed to get provisioning status:', error);
      res.status(500).json({ message: 'Failed to get provisioning status.' });
    }
  });

  // Original signup endpoint (now deprecated, keeping for backward compatibility)
  app.post('/saas/signup', async (req: Request, res: Response) => {
    const { subdomain, companyName, adminEmail, adminName, adminPhone, adminPassword, subscriptionPlan } = req.body || {};
    if (!subdomain || !companyName || !adminEmail || !adminName || !adminPassword) {
      return res.status(400).json({ message: 'Missing signup fields.' });
    }

    const normalizedSubdomain = normalizeSubdomain(subdomain);
    if (!normalizedSubdomain || !isValidSubdomain(normalizedSubdomain)) {
      return res.status(400).json({ message: 'Invalid tenant subdomain.' });
    }

    try {
      const tenant = await provisionTenant({
        subdomain: normalizedSubdomain,
        companyName,
        adminEmail,
        adminName,
        adminPhone: String(adminPhone || '').trim(),
        adminPassword,
        subscriptionPlan,
      });
      const logs = await getProvisioningStatus(tenant.id);
      return res.status(201).json({
        tenant: serializeTenant(tenant),
        logs,
      });
    } catch (error: any) {
      console.error('[SAAS] Signup failed:', error);
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Tenant subdomain already exists.' });
      }
      const isProd = process.env.NODE_ENV === 'production';
      return res.status(500).json({
        message: 'Tenant signup failed.',
        ...(isProd ? {} : { details: error?.message || String(error) })
      });
    }
  });

  app.get('/saas/tenant-context', tenantResolver, (req: Request, res: Response) => {
    const tenant = (req as any).tenant as { id: string; subdomain: string; company_name: string; status: string; subscription_plan: string | null } | undefined;
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not resolved.' });
    }

    res.json({
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        companyName: tenant.company_name,
        status: tenant.status,
        subscriptionPlan: tenant.subscription_plan,
      },
    });
  });

  app.get('/saas/health', tenantResolver, requireTenantPool, async (req: Request, res: Response) => {
    try {
      const pool = (req as any).tenantPool;
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (error) {
      console.error('[SAAS] Tenant health check failed:', error);
      res.status(500).json({ message: 'Tenant health check failed.' });
    }
  });
}
