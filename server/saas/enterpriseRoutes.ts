import type { Express, Request, Response } from 'express';
import { getCentralPool } from './centralDb';
import { normalizeSubdomain, isValidSubdomain } from './validation';
import {
  checkSubdomainAvailable,
  createRateLimiter,
  sanitizeInput,
  auditMiddleware,
} from './middleware/tenantGuard';
import { listAuditLogs } from './auditLog';
import { PLATFORM_TYPES, SAAS_PLAN_KEYS } from '@shared/enterpriseSaas';
import { isSaasPaymentSkipped } from './paymentConfig';

const saasRateLimit = createRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: 'saas' });

export { saasRateLimit };

export function registerSaasEnterpriseRoutes(app: Express) {
  app.get('/saas/platform-types', (_req: Request, res: Response) => {
    res.json({ types: PLATFORM_TYPES });
  });

  app.get('/saas/public-config', (_req: Request, res: Response) => {
    res.json({
      mainDomain: process.env.MAIN_DOMAIN || 'naioshfit.com',
      skipPayment: isSaasPaymentSkipped(),
    });
  });

  app.get('/saas/enterprise-plans', async (_req: Request, res: Response) => {
    try {
      const pool = getCentralPool();
      const { rows } = await pool.query(
        `SELECT key, name, name_ar, price_cents, currency, interval, features, max_users
         FROM tenant_plans WHERE is_active = TRUE ORDER BY sort_order`,
      );
      if (rows.length > 0) {
        return res.json({ plans: rows });
      }
      return res.json({
        plans: SAAS_PLAN_KEYS.map((key, i) => ({
          key,
          name: key.charAt(0).toUpperCase() + key.slice(1),
          price_cents: [9900, 29900, 49900, 99900][i] ?? 9900,
          currency: 'usd',
          interval: 'month',
          features: [],
        })),
      });
    } catch (error) {
      console.error('[SAAS] enterprise-plans error:', error);
      return res.status(500).json({ message: 'Failed to load plans.' });
    }
  });

  app.get('/saas/check-subdomain', async (req: Request, res: Response) => {
    const raw = sanitizeInput(req.query.subdomain);
    const normalized = normalizeSubdomain(raw);
    if (!normalized || !isValidSubdomain(normalized)) {
      return res.json({ available: false, subdomain: normalized, reason: 'invalid' });
    }

    try {
      const result = await checkSubdomainAvailable(normalized);
      const mainDomain = process.env.MAIN_DOMAIN || 'naiosh.com';
      return res.json({
        available: result.available,
        subdomain: normalized,
        reason: result.reason ?? null,
        preview: `${normalized}.${mainDomain}`,
        pathPreview: `${mainDomain}/${normalized}`,
      });
    } catch (error) {
      console.error('[SAAS] check-subdomain error:', error);
      return res.status(503).json({ available: false, reason: 'error', message: 'Unable to verify subdomain.' });
    }
  });

  app.post('/saas/onboarding-session', auditMiddleware('saas.onboarding.start'), async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const platformType = sanitizeInput(body.platformType);
    const companyName = sanitizeInput(body.companyName);
    const ownerName = sanitizeInput(body.ownerName);
    const email = sanitizeInput(body.email);
    const phone = sanitizeInput(body.phone);
    const country = sanitizeInput(body.country);
    const city = sanitizeInput(body.city);
    const plan = sanitizeInput(body.plan) || 'starter';
    const subdomain = normalizeSubdomain(sanitizeInput(body.subdomain));
    const domainMode = sanitizeInput(body.domainMode) || 'subdomain';
    const paymentMethod = sanitizeInput(body.paymentMethod);

    if (!companyName || !ownerName || !email || !subdomain) {
      return res.status(400).json({ message: 'Missing required onboarding fields.' });
    }

    if (!isValidSubdomain(subdomain)) {
      return res.status(400).json({ message: 'Invalid subdomain.' });
    }

    const availability = await checkSubdomainAvailable(subdomain);
    if (!availability.available) {
      return res.status(409).json({ message: 'Subdomain already taken.' });
    }

    return res.json({
      ok: true,
      session: {
        platformType,
        companyName,
        ownerName,
        email,
        phone,
        country,
        city,
        plan,
        subdomain,
        domainMode,
        paymentMethod,
      },
    });
  });

  app.get('/api/admin/saas/audit-logs', async (req: Request, res: Response) => {
    const role = (req as any).user?.role;
    if (role !== 'super_admin' && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    try {
      const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
      const logs = await listAuditLogs({ tenantId, limit: 100 });
      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load audit logs.' });
    }
  });

  app.get('/api/admin/saas/revenue-summary', async (req: Request, res: Response) => {
    const role = (req as any).user?.role;
    if (role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    try {
      const pool = getCentralPool();
      const tenants = await pool.query(`SELECT COUNT(*)::int AS total FROM tenants WHERE status = 'active'`);
      const revenue = await pool.query(
        `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total_cents FROM tenant_billing WHERE status = 'paid'`,
      );
      const pending = await pool.query(
        `SELECT COUNT(*)::int AS c FROM tenants WHERE status = 'pending_payment'`,
      );
      return res.json({
        activeTenants: tenants.rows[0]?.total ?? 0,
        totalRevenueCents: Number(revenue.rows[0]?.total_cents ?? 0),
        pendingTenants: pending.rows[0]?.c ?? 0,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load revenue summary.' });
    }
  });
}

export async function recordTenantEnterpriseMetadata(
  tenantId: string,
  data: {
    platformType?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    country?: string;
    city?: string;
    plan?: string;
    domainMode?: string;
    paymentMethod?: string;
    amountCents?: number;
  },
): Promise<void> {
  const pool = getCentralPool();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await pool.query(
    `UPDATE tenants SET
      platform_type = COALESCE($2, platform_type),
      owner_name = COALESCE($3, owner_name),
      owner_email = COALESCE($4, owner_email),
      owner_phone = COALESCE($5, owner_phone),
      country = COALESCE($6, country),
      city = COALESCE($7, city),
      subscription_plan = COALESCE($8, subscription_plan),
      domain_mode = COALESCE($9, domain_mode),
      expires_at = COALESCE(expires_at, $10),
      updated_at = NOW()
     WHERE id = $1`,
    [
      tenantId,
      data.platformType ?? null,
      data.ownerName ?? null,
      data.ownerEmail ?? null,
      data.ownerPhone ?? null,
      data.country ?? null,
      data.city ?? null,
      data.plan ?? null,
      data.domainMode ?? 'subdomain',
      expiresAt,
    ],
  );

  const mainDomain = process.env.MAIN_DOMAIN || 'naiosh.com';
  const tenantRow = await pool.query<{ subdomain: string }>('SELECT subdomain FROM tenants WHERE id = $1', [tenantId]);
  const subdomain = tenantRow.rows[0]?.subdomain;
  if (subdomain) {
    await pool.query(
      `INSERT INTO tenant_domains (tenant_id, domain_type, host, path_prefix, is_primary, verified)
       VALUES ($1, $2, $3, $4, TRUE, TRUE)
       ON CONFLICT DO NOTHING`,
      [
        tenantId,
        data.domainMode === 'path' ? 'path' : 'subdomain',
        data.domainMode === 'path' ? mainDomain : `${subdomain}.${mainDomain}`,
        data.domainMode === 'path' ? `/${subdomain}` : null,
      ],
    );
  }

  if (data.plan) {
    await pool.query(
      `INSERT INTO tenant_billing (tenant_id, plan_key, amount_cents, currency, payment_method, status, paid_at, expires_at)
       VALUES ($1, $2, $3, 'usd', $4, 'paid', NOW(), $5)`,
      [tenantId, data.plan, data.amountCents ?? 0, data.paymentMethod ?? 'card', expiresAt],
    );

    const modules = ['dashboard', 'users', 'billing', 'reports', 'training', 'support'];
    for (const moduleKey of modules) {
      await pool.query(
        `INSERT INTO tenant_modules (tenant_id, module_key, enabled) VALUES ($1, $2, TRUE)
         ON CONFLICT (tenant_id, module_key) DO NOTHING`,
        [tenantId, moduleKey],
      );
    }
  }
}
