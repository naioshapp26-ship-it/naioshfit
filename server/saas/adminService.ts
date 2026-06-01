import { getCentralPool } from './centralDb';
import type { TenantRecord } from './types';
import { getPlatformStripeClient } from '../payment/platformStripe';

export interface TenantSummary extends Pick<TenantRecord, 'id' | 'subdomain' | 'company_name' | 'subscription_plan' | 'status' | 'created_at'> {
  admin_count: number;
}

export interface TenantDetails extends TenantSummary {
  database_name: string | null;
  updated_at: Date;
}

export interface TenantPaymentTransaction {
  id: string;
  tenant_id: string | null;
  amount: string;
  currency: string;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  stripe_payment_id?: string | null;
  stripe_checkout_session_id?: string | null;
  payment_type?: string | null;
  created_at: Date;
}

export interface TenantListFilters {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

interface PlatformPaymentTransactionRow {
  id: number;
  tenant_id: string | null;
  amount: any;
  currency: string;
  status: string;
  payment_type: string | null;
  stripe_payment_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: Date;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function fetchTenantList(filters: TenantListFilters) {
  console.log('[SAAS ADMIN SERVICE] fetchTenantList called with filters:', filters);
  const pool = getCentralPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const idx = values.length;
    where.push(`(LOWER(tenants.subdomain) LIKE $${idx} OR LOWER(tenants.company_name) LIKE $${idx})`);
  }

  if (filters.status) {
    values.push(filters.status);
    const idx = values.length;
    where.push(`tenants.status = $${idx}`);
  }

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const offset = Math.max(filters.offset ?? 0, 0);

  values.push(limit);
  values.push(offset);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataQuery = `
    SELECT tenants.id,
           tenants.subdomain,
           tenants.company_name,
           tenants.subscription_plan,
           tenants.status,
           tenants.created_at,
           COUNT(tenant_admins.id) AS admin_count
    FROM tenants
    LEFT JOIN tenant_admins ON tenant_admins.tenant_id = tenants.id
    ${whereClause}
    GROUP BY tenants.id
    ORDER BY tenants.created_at DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `;

  const countQuery = `SELECT COUNT(*)::int AS total FROM tenants ${whereClause}`;

  console.log('[SAAS ADMIN SERVICE] Executing query:', dataQuery);
  console.log('[SAAS ADMIN SERVICE] Query values:', values);

  const [dataResult, countResult] = await Promise.all([
    pool.query<TenantSummary>(dataQuery, values),
    pool.query<{ total: number }>(countQuery, values.slice(0, values.length - 2)),
  ]);

  console.log('[SAAS ADMIN SERVICE] Query results - rows:', dataResult.rows.length, 'total:', countResult.rows[0]?.total);

  return {
    tenants: dataResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    limit,
    offset,
  };
}

export async function fetchTenantDetails(tenantId: string): Promise<TenantDetails | null> {
  const pool = getCentralPool();
  const result = await pool.query<TenantDetails>(
    `SELECT tenants.id,
            tenants.subdomain,
            tenants.company_name,
            tenants.subscription_plan,
            tenants.status,
            tenants.created_at,
            tenants.updated_at,
            tenants.database_name,
            COUNT(tenant_admins.id) AS admin_count
     FROM tenants
     LEFT JOIN tenant_admins ON tenant_admins.tenant_id = tenants.id
     WHERE tenants.id = $1
     GROUP BY tenants.id
     LIMIT 1`,
    [tenantId]
  );

  return result.rows[0] ?? null;
}

export async function fetchTenantPayments(tenantId: string, limit = 25, offset = 0) {
  const pool = getCentralPool();
  const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
  const safeOffset = Math.max(offset, 0);

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id,
              tenant_id,
              amount,
              currency,
              status,
              payment_type,
              stripe_payment_id,
              stripe_checkout_session_id,
              created_at
       FROM platform_payment_transactions
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, safeLimit, safeOffset]
    ),
    pool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM platform_payment_transactions WHERE tenant_id = $1',
      [tenantId]
    ),
  ]);

  const payments: TenantPaymentTransaction[] = dataResult.rows.map(mapPlatformPaymentRow);

  return {
    payments,
    total: countResult.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function refundTenantPayment(tenantId: string, paymentId: string): Promise<TenantPaymentTransaction> {
  const paymentPk = Number(paymentId);
  if (!Number.isFinite(paymentPk)) {
    throw new Error('Invalid payment identifier.');
  }

  const pool = getCentralPool();
  const paymentResult = await pool.query<PlatformPaymentTransactionRow>(
    `SELECT id,
            tenant_id,
            amount,
            currency,
            status,
            payment_type,
            stripe_payment_id,
            stripe_checkout_session_id,
            created_at
     FROM platform_payment_transactions
     WHERE id = $1 AND tenant_id = $2
     LIMIT 1`,
    [paymentPk, tenantId]
  );

  const payment = paymentResult.rows[0];
  if (!payment) {
    throw new Error('Payment not found.');
  }

  if (payment.status === 'refunded') {
    return mapPlatformPaymentRow(payment);
  }

  let paymentIntentId = payment.stripe_payment_id;
  let checkoutSessionId = payment.stripe_checkout_session_id;

  if (!paymentIntentId && checkoutSessionId) {
    const resolved = await resolvePaymentIntentId(checkoutSessionId);
    paymentIntentId = resolved.paymentIntentId;
    checkoutSessionId = resolved.checkoutSessionId ?? checkoutSessionId;
  }

  if (paymentIntentId && paymentIntentId.startsWith('cs_')) {
    checkoutSessionId = paymentIntentId;
    const resolved = await resolvePaymentIntentId(paymentIntentId);
    paymentIntentId = resolved.paymentIntentId;
    checkoutSessionId = resolved.checkoutSessionId ?? checkoutSessionId;
  }

  if (!paymentIntentId) {
    if (checkoutSessionId) {
      try {
        const stripe = await getPlatformStripeClient();
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

        // Trial subscriptions may not have a payment intent yet; cancel subscription to stop future billing and mark refunded locally.
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        if (subscriptionId) {
          try {
            await stripe.subscriptions.cancel(subscriptionId);
          } catch (cancelError: any) {
            console.error('[SAAS ADMIN] Failed to cancel Stripe subscription during refund:', cancelError);
          }

          const updateResult = await pool.query<PlatformPaymentTransactionRow>(
            `UPDATE platform_payment_transactions
             SET status = 'refunded',
                 stripe_payment_id = COALESCE($2, stripe_payment_id),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, tenant_id, amount, currency, status, payment_type, stripe_payment_id, stripe_checkout_session_id, created_at`,
            [paymentPk, subscriptionId]
          );

          return mapPlatformPaymentRow(updateResult.rows[0]);
        }
      } catch (stripeError: any) {
        console.error('[SAAS ADMIN] Failed to resolve Stripe session for refund:', stripeError);
      }
    }

    const updateResult = await pool.query<PlatformPaymentTransactionRow>(
      `UPDATE platform_payment_transactions
       SET status = 'refunded',
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, tenant_id, amount, currency, status, payment_type, stripe_payment_id, stripe_checkout_session_id, created_at`,
      [paymentPk]
    );

    return mapPlatformPaymentRow(updateResult.rows[0]);
  }

  try {
    const stripe = await getPlatformStripeClient();
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    if (typeof refund.payment_intent === 'string') {
      paymentIntentId = refund.payment_intent;
    }
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to create refund in Stripe.');
  }

  const updateResult = await pool.query<PlatformPaymentTransactionRow>(
    `UPDATE platform_payment_transactions
     SET status = 'refunded',
         stripe_payment_id = COALESCE($2, stripe_payment_id),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, tenant_id, amount, currency, status, payment_type, stripe_payment_id, stripe_checkout_session_id, created_at`,
    [paymentPk, paymentIntentId]
  );

  return mapPlatformPaymentRow(updateResult.rows[0]);
}

function mapPlatformPaymentRow(row: PlatformPaymentTransactionRow): TenantPaymentTransaction {
  return {
    id: String(row.id),
    tenant_id: row.tenant_id ?? null,
    amount: row.amount?.toString?.() ?? String(row.amount ?? ''),
    currency: row.currency,
    status: row.status,
    payment_method: row.payment_type ?? null,
    payment_type: row.payment_type ?? null,
    transaction_id: row.stripe_payment_id || row.stripe_checkout_session_id || null,
    stripe_payment_id: row.stripe_payment_id ?? null,
    stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
    created_at: row.created_at,
  };
}

async function resolvePaymentIntentId(stripeReference: string): Promise<{ paymentIntentId: string | null; checkoutSessionId: string | null }> {
  const stripe = await getPlatformStripeClient();

  if (stripeReference.startsWith('pi_')) {
    return { paymentIntentId: stripeReference, checkoutSessionId: null };
  }

  const session = await stripe.checkout.sessions.retrieve(stripeReference, {
    expand: ['payment_intent'],
  });

  let paymentIntentId: string | null = null;
  if (typeof session.payment_intent === 'string') {
    paymentIntentId = session.payment_intent;
  } else if (session.payment_intent?.id) {
    paymentIntentId = session.payment_intent.id;
  }

  return { paymentIntentId, checkoutSessionId: session.id };
}

export async function updateTenantDetails(
  tenantId: string,
  updates: { companyName?: string; subscriptionPlan?: string | null; status?: string }
): Promise<TenantRecord | null> {
  const pool = getCentralPool();
  const fields: string[] = [];
  const values: Array<string | null> = [];

  if (typeof updates.companyName === 'string') {
    values.push(updates.companyName.trim());
    fields.push(`company_name = $${values.length}`);
  }

  if (updates.subscriptionPlan !== undefined) {
    values.push(updates.subscriptionPlan);
    fields.push(`subscription_plan = $${values.length}`);
  }

  if (typeof updates.status === 'string') {
    values.push(updates.status);
    fields.push(`status = $${values.length}`);
  }

  if (fields.length === 0) {
    return null;
  }

  values.push(tenantId);
  const query = `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
  const result = await pool.query<TenantRecord>(query, values);
  return result.rows[0] ?? null;
}
