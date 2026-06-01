import type { Pool, PoolClient } from 'pg';
import { pool as centralPool } from '../db';

export function normalizeTenantId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  return trimmed.length ? trimmed : null;
}

export type CreditScope = {
  pool: Pool;
  tenantId: string | null;
};

export type CreditBundleRecord = {
  id: string;
  tenant_id: string | null;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreditActionRecord = {
  id: string;
  tenant_id: string | null;
  action_key: string;
  description: string | null;
  cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditAccountRecord = {
  id: string;
  user_id: number;
  tenant_id: string | null;
  balance: number;
  low_balance_threshold: number;
  created_at: string;
  updated_at: string;
};

export type CreditTransactionRecord = {
  id: string;
  credit_account_id: string;
  tenant_id: string | null;
  user_id: number;
  type: string;
  credits_delta: number;
  balance_after: number | null;
  provider: string | null;
  provider_reference: string | null;
  checkout_session_id: string | null;
  bundle_id: string | null;
  action_key: string | null;
  metadata: any;
  status: string;
  created_at: string;
};

export type CreditBonusSettingsRecord = {
  id: string;
  tenant_id: string | null;
  scope_key: string;
  signup_bonus_credits: number;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type CreditBonusSettings = {
  signupBonusCredits: number;
};

const SIGNUP_CREDIT_REASON = 'signup_bonus';
const DEFAULT_SIGNUP_BONUS_CREDITS = 100;

async function withClient<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function buildScopeFromRequest(req: any): CreditScope {
  const tenant = req.tenant as { id?: string } | undefined;
  const tenantPool = req.tenantPool as Pool | undefined;
  const tenantId = normalizeTenantId(tenant?.id);
  return {
    pool: tenantPool || centralPool,
    tenantId,
  };
}

export async function ensureCreditAccount(scope: CreditScope, userId: number): Promise<CreditAccountRecord> {
  const existing = await getCreditAccount(scope, userId);
  if (existing) return existing;
  const tenantId = normalizeTenantId(scope.tenantId);
  const result = await scope.pool.query<CreditAccountRecord>(
    `INSERT INTO credit_accounts (user_id, tenant_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, tenant_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [userId, tenantId]
  );
  return result.rows[0];
}

export async function getCreditAccount(scope: CreditScope, userId: number): Promise<CreditAccountRecord | null> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const params: any[] = [userId];
  let where = 'user_id = $1 AND tenant_id IS NULL';
  if (tenantId !== null) {
    params.push(tenantId);
    where = 'user_id = $1 AND tenant_id = $2';
  }

  const result = await scope.pool.query<CreditAccountRecord>(
    `SELECT * FROM credit_accounts
     WHERE ${where}
     ORDER BY updated_at DESC, created_at DESC, balance DESC
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

export async function listCreditBundles(scope: CreditScope, opts?: { includeInactive?: boolean }): Promise<CreditBundleRecord[]> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const includeInactive = opts?.includeInactive ?? false;
  const params: any[] = [];
  let where = 'tenant_id IS NULL';
  if (tenantId !== null) {
    params.push(tenantId);
    where = 'tenant_id = $1';
  }

  if (!includeInactive) {
    where += tenantId !== null ? ' AND is_active = TRUE' : ' AND is_active = TRUE';
  }

  const result = await scope.pool.query<CreditBundleRecord>(
    `SELECT * FROM credit_bundles
     WHERE ${where}
     ORDER BY sort_order, created_at DESC`,
    params
  );
  return result.rows;
}

export async function upsertCreditBundle(scope: CreditScope, input: {
  id?: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<CreditBundleRecord> {
  const tenantId = normalizeTenantId(scope.tenantId);
  if (input.id) {
    const params: any[] = [
      input.name,
      input.credits,
      input.priceCents,
      input.currency,
      input.isActive ?? null,
      input.sortOrder ?? null,
      input.id,
    ];
    let where = 'id = $7 AND tenant_id IS NULL';
    if (tenantId !== null) {
      params.push(tenantId);
      where = 'id = $7 AND tenant_id = $8';
    }

    const result = await scope.pool.query<CreditBundleRecord>(
      `UPDATE credit_bundles
       SET name = $1, credits = $2, price_cents = $3, currency = $4, is_active = COALESCE($5, is_active), sort_order = COALESCE($6, sort_order), updated_at = NOW()
       WHERE ${where}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      throw new Error('Bundle not found in this scope');
    }
    return result.rows[0];
  }

  const result = await scope.pool.query<CreditBundleRecord>(
    `INSERT INTO credit_bundles (tenant_id, name, credits, price_cents, currency, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), COALESCE($7, 0))
     RETURNING *`,
    [tenantId, input.name, input.credits, input.priceCents, input.currency, input.isActive ?? true, input.sortOrder ?? 0]
  );
  return result.rows[0];
}

export async function deleteCreditBundle(scope: CreditScope, bundleId: string): Promise<void> {
  const params: any[] = [bundleId];
  let where = 'id = $1 AND tenant_id IS NULL';
  const tenantId = normalizeTenantId(scope.tenantId);
  if (tenantId !== null) {
    params.push(tenantId);
    where = 'id = $1 AND tenant_id = $2';
  }

  try {
    const result = await scope.pool.query(`DELETE FROM credit_bundles WHERE ${where}`, params);
    if (result.rowCount === 0) {
      throw new Error('Bundle not found in this scope');
    }
  } catch (error: any) {
    if (error?.code === '23503') {
      throw new Error('Cannot delete bundle that has related transactions');
    }
    throw error;
  }
}

export async function listCreditActions(scope: CreditScope, opts?: { includeInactive?: boolean }): Promise<CreditActionRecord[]> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const includeInactive = opts?.includeInactive ?? false;
  const params: any[] = [];
  let where = 'tenant_id IS NULL';
  if (tenantId !== null) {
    params.push(tenantId);
    where = 'tenant_id = $1';
  }
  if (!includeInactive) {
    where += tenantId !== null ? ' AND is_active = TRUE' : ' AND is_active = TRUE';
  }

  const result = await scope.pool.query<CreditActionRecord>(
    `SELECT DISTINCT ON (action_key) *
     FROM credit_actions
     WHERE ${where}
     ORDER BY action_key, created_at DESC`,
    params
  );
  return result.rows;
}

export async function getCreditBonusSettings(scope: CreditScope): Promise<CreditBonusSettings> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const scopeKey = tenantId ?? 'platform';

  const result = await scope.pool.query<CreditBonusSettingsRecord>(
    `SELECT * FROM credit_bonus_settings
     WHERE scope_key = $1
     LIMIT 1`,
    [scopeKey]
  );

  if (!result.rows[0]) {
    return { signupBonusCredits: DEFAULT_SIGNUP_BONUS_CREDITS };
  }

  return {
    signupBonusCredits: Number(result.rows[0].signup_bonus_credits) || DEFAULT_SIGNUP_BONUS_CREDITS,
  };
}

export async function upsertCreditBonusSettings(scope: CreditScope, input: {
  signupBonusCredits: number;
  updatedBy?: number | null;
}): Promise<CreditBonusSettingsRecord> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const scopeKey = tenantId ?? 'platform';

  const result = await scope.pool.query<CreditBonusSettingsRecord>(
    `INSERT INTO credit_bonus_settings (tenant_id, signup_bonus_credits, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (scope_key)
     DO UPDATE SET signup_bonus_credits = EXCLUDED.signup_bonus_credits, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
    [tenantId, Math.trunc(input.signupBonusCredits), input.updatedBy ?? null]
  );

  if (!result.rows[0]) {
    throw new Error('Failed to save credit bonus settings');
  }

  return result.rows[0];
}

export async function deleteCreditAction(scope: CreditScope, actionId: string): Promise<void> {
  const params: any[] = [actionId];
  let where = 'id = $1 AND tenant_id IS NULL';
  const tenantId = normalizeTenantId(scope.tenantId);
  if (tenantId !== null) {
    params.push(tenantId);
    where = 'id = $1 AND tenant_id = $2';
  }

  const result = await scope.pool.query(`DELETE FROM credit_actions WHERE ${where}`, params);
  if (result.rowCount === 0) {
    throw new Error('Action not found in this scope');
  }
}

export async function upsertCreditAction(scope: CreditScope, input: {
  id?: string;
  actionKey: string;
  description?: string | null;
  cost: number;
  isActive?: boolean;
}): Promise<CreditActionRecord> {
  const tenantId = normalizeTenantId(scope.tenantId);
  if (input.id) {
    const params: any[] = [
      input.actionKey,
      input.description ?? null,
      input.cost,
      input.isActive ?? null,
      input.id,
    ];
    let where = 'id = $5 AND tenant_id IS NULL';
    if (tenantId !== null) {
      params.push(tenantId);
      where = 'id = $5 AND tenant_id = $6';
    }

    const result = await scope.pool.query<CreditActionRecord>(
      `UPDATE credit_actions
       SET action_key = $1, description = $2, cost = $3, is_active = COALESCE($4, is_active), updated_at = NOW()
       WHERE ${where}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) {
      throw new Error('Action not found in this scope');
    }
    return result.rows[0];
  }

  const result = await scope.pool.query<CreditActionRecord>(
    `INSERT INTO credit_actions (tenant_id, action_key, description, cost, is_active)
     VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
     ON CONFLICT (tenant_id, action_key)
     DO UPDATE SET description = EXCLUDED.description, cost = EXCLUDED.cost, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *`,
    [tenantId, input.actionKey, input.description ?? null, input.cost, input.isActive ?? true]
  );
  return result.rows[0];
}

export async function recordPendingPurchase(scope: CreditScope, input: {
  accountId: string;
  userId: number;
  bundle: CreditBundleRecord;
  checkoutSessionId: string;
  provider: string;
  paymentIntentId?: string | null;
}): Promise<CreditTransactionRecord> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const metadata = {
    bundle_id: input.bundle.id,
    credits: input.bundle.credits,
    price_cents: input.bundle.price_cents,
    currency: input.bundle.currency,
  };
  const result = await scope.pool.query<CreditTransactionRecord>(
    `INSERT INTO credit_transactions_v2 (
      credit_account_id, tenant_id, user_id, type, credits_delta, balance_after,
      provider, provider_reference, checkout_session_id, bundle_id, action_key, metadata, status
    ) VALUES ($1, $2, $3, 'purchase', $4, NULL, $5, $6, $7, $8, NULL, $9, 'pending')
    ON CONFLICT (provider_reference)
    DO UPDATE SET metadata = EXCLUDED.metadata
    RETURNING *`,
    [
      input.accountId,
      tenantId,
      input.userId,
      input.bundle.credits,
      input.provider,
      input.checkoutSessionId,
      input.checkoutSessionId,
      input.bundle.id,
      metadata,
    ]
  );
  return result.rows[0];
}

export async function settlePurchase(scope: CreditScope, input: {
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  credits: number;
  userId: number;
  accountId?: string | null;
  bundleId?: string | null;
}): Promise<{ balance: number; transaction: CreditTransactionRecord } | null> {
  const tenantId = normalizeTenantId(scope.tenantId);
  return withClient(scope.pool, async (client) => {
    const txRes = await client.query<CreditTransactionRecord>(
      `SELECT * FROM credit_transactions_v2
       WHERE checkout_session_id = $1
       FOR UPDATE`,
      [input.checkoutSessionId]
    );

    const existingTx = txRes.rows[0];
    const accountId = input.accountId || existingTx?.credit_account_id || null;
    if (!accountId) {
      return null;
    }

    const accountRes = await client.query<CreditAccountRecord>(
      `SELECT * FROM credit_accounts WHERE id = $1 FOR UPDATE`,
      [accountId]
    );
    const account = accountRes.rows[0];
    if (!account) {
      return null;
    }

    // Idempotency: if this checkout/payment was already settled, avoid double-crediting
    // (e.g., when both checkout.session.completed and payment_intent.succeeded fire).
    if (existingTx?.status === 'completed') {
      return { balance: account.balance, transaction: existingTx };
    }

    const providerReference = existingTx?.provider_reference || input.paymentIntentId || input.checkoutSessionId;
    const checkoutSessionId = input.checkoutSessionId || existingTx?.checkout_session_id || null;

    // Prevent double-crediting if any completed transaction already exists for this payment/checkout
    const refCandidates = [providerReference, checkoutSessionId, input.paymentIntentId].filter(Boolean) as string[];
    if (refCandidates.length) {
      const completedRes = await client.query<CreditTransactionRecord>(
        `SELECT * FROM credit_transactions_v2
         WHERE provider_reference = ANY($1::text[]) AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1`,
        [refCandidates]
      );
      const completedTx = completedRes.rows[0];
      if (completedTx) {
        return { balance: account.balance, transaction: completedTx };
      }
    }

    const newBalance = account.balance + input.credits;
    await client.query(
      `UPDATE credit_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, account.id]
    );

    const metadata = {
      ...(existingTx?.metadata || {}),
      bundle_id: input.bundleId ?? existingTx?.bundle_id ?? null,
      credits: input.credits,
      payment_intent_id: input.paymentIntentId || existingTx?.metadata?.payment_intent_id || null,
    };

    const updatedTx = await client.query<CreditTransactionRecord>(
      `INSERT INTO credit_transactions_v2 (
        credit_account_id, tenant_id, user_id, type, credits_delta, balance_after,
        provider, provider_reference, checkout_session_id, bundle_id, action_key, metadata, status
      ) VALUES ($1, $2, $3, 'purchase', $4, $5, 'stripe', $6, $7, $8, NULL, $9, 'completed')
      ON CONFLICT (provider_reference)
      DO UPDATE SET status = 'completed', balance_after = $5, metadata = EXCLUDED.metadata, checkout_session_id = COALESCE(EXCLUDED.checkout_session_id, credit_transactions_v2.checkout_session_id)
      RETURNING *`,
      [
        account.id,
        tenantId,
        input.userId,
        input.credits,
        newBalance,
        providerReference,
        checkoutSessionId,
        input.bundleId ?? existingTx?.bundle_id ?? null,
        metadata,
      ]
    );

    // If we updated a pending transaction that used the checkout session as provider_reference,
    // ensure any older pending rows tied to the same session are marked completed as well.
    if (existingTx && existingTx.status !== 'completed' && existingTx.provider_reference !== providerReference) {
      await client.query(
        `UPDATE credit_transactions_v2
         SET status = 'completed', balance_after = $1, metadata = $2, updated_at = NOW()
         WHERE id = $3`,
        [newBalance, metadata, existingTx.id]
      );
    }

    return { balance: newBalance, transaction: updatedTx.rows[0] };
  });
}

export async function consumeCredits(scope: CreditScope, input: {
  userId: number;
  actionKey: string;
  units?: number;
}): Promise<{ balance: number; isLow: boolean; exhausted: boolean; transaction: CreditTransactionRecord } | { insufficient: true; balance: number } > {
  const units = input.units && input.units > 0 ? input.units : 1;
  const tenantId = normalizeTenantId(scope.tenantId);
  const fallbackActions: Record<string, { description: string; cost: number; legacyKey?: string }> = {
    nutrition_log_meal: { description: 'Log a meal', cost: 1, legacyKey: 'log_meal' },
    nutrition_log_water: { description: 'Log water intake', cost: 1, legacyKey: 'log_progress' },
    progress_log_entry: { description: 'Log progress update', cost: 1, legacyKey: 'log_progress' },
    workout_complete_session: { description: 'Complete a workout session', cost: 3, legacyKey: 'watch_workout' },
    ai_generate_plan: { description: 'Generate AI plan', cost: 20 },
    ai_agent_chat: { description: 'AI chat message', cost: 5 },
    files_upload: { description: 'Upload a file', cost: 1 },
  };

  return withClient(scope.pool, async (client) => {
    let actionRes = await client.query<CreditActionRecord>(
      `SELECT * FROM credit_actions
       WHERE action_key = $1 AND ${tenantId === null ? 'tenant_id IS NULL' : 'tenant_id = $2'} AND is_active = TRUE
       LIMIT 1`,
      tenantId === null ? [input.actionKey] : [input.actionKey, tenantId]
    );
    let action = actionRes.rows[0];

    if (!action && tenantId !== null) {
      const fallback = fallbackActions[input.actionKey];
      const legacyKey = fallback?.legacyKey;
      let template: CreditActionRecord | null = null;

      if (legacyKey) {
        const legacyRes = await client.query<CreditActionRecord>(
          `SELECT * FROM credit_actions
           WHERE action_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
           ORDER BY tenant_id NULLS LAST
           LIMIT 1`,
          [legacyKey, tenantId]
        );
        template = legacyRes.rows[0] || null;
      }

      if (!template) {
        const directRes = await client.query<CreditActionRecord>(
          `SELECT * FROM credit_actions
           WHERE action_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
           ORDER BY tenant_id NULLS LAST
           LIMIT 1`,
          [input.actionKey, tenantId]
        );
        template = directRes.rows[0] || null;
      }

      if (template || fallback) {
        const description = template?.description ?? fallback?.description ?? null;
        const cost = template?.cost ?? fallback?.cost ?? 1;
        const isActive = template?.is_active ?? true;

        await client.query(
          `INSERT INTO credit_actions (tenant_id, action_key, description, cost, is_active)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, action_key)
           DO UPDATE SET description = EXCLUDED.description, cost = EXCLUDED.cost, is_active = EXCLUDED.is_active, updated_at = NOW()`,
          [tenantId, input.actionKey, description, cost, isActive]
        );

        actionRes = await client.query<CreditActionRecord>(
          `SELECT * FROM credit_actions
           WHERE action_key = $1 AND tenant_id = $2 AND is_active = TRUE
           LIMIT 1`,
          [input.actionKey, tenantId]
        );
        action = actionRes.rows[0];
      }
    }

    if (!action) {
      throw new Error('Action not configured');
    }

    const accountRes = await client.query<CreditAccountRecord>(
      `SELECT * FROM credit_accounts
       WHERE user_id = $1 AND ${tenantId === null ? 'tenant_id IS NULL' : 'tenant_id = $2'}
       FOR UPDATE`,
      tenantId === null ? [input.userId] : [input.userId, tenantId]
    );

    const account = accountRes.rows[0];
    if (!account) {
      throw new Error('Credit account not found');
    }

    const cost = action.cost * units;
    if (account.balance < cost) {
      return { insufficient: true, balance: account.balance } as const;
    }

    const newBalance = account.balance - cost;

    await client.query(
      `UPDATE credit_accounts
       SET balance = $1, updated_at = NOW()
       WHERE id = $2`,
      [newBalance, account.id]
    );

    const txRes = await client.query<CreditTransactionRecord>(
      `INSERT INTO credit_transactions_v2 (
        credit_account_id, tenant_id, user_id, type, credits_delta, balance_after,
        provider, provider_reference, checkout_session_id, bundle_id, action_key, metadata, status
      ) VALUES ($1, $2, $3, 'debit', $4, $5, 'internal', NULL, NULL, NULL, $6, NULL, 'completed')
      RETURNING *`,
      [account.id, tenantId, input.userId, -cost, newBalance, action.action_key]
    );

    const isLow = newBalance <= account.low_balance_threshold;
    const exhausted = newBalance <= 0;

    return { balance: newBalance, isLow, exhausted, transaction: txRes.rows[0] };
  });
}

export async function adjustCredits(scope: CreditScope, input: {
  userId: number;
  creditsDelta: number;
  reason?: string | null;
  adminId?: number | null;
}): Promise<{ balance: number; transaction: CreditTransactionRecord }> {
  const tenantId = normalizeTenantId(scope.tenantId);
  return withClient(scope.pool, async (client) => {
    const params: any[] = [input.userId];
    let where = 'user_id = $1 AND tenant_id IS NULL';
    if (tenantId !== null) {
      params.push(tenantId);
      where = 'user_id = $1 AND tenant_id = $2';
    }

    const accountRes = await client.query<CreditAccountRecord>(
      `SELECT * FROM credit_accounts
       WHERE ${where}
       ORDER BY updated_at DESC, created_at DESC, balance DESC
       FOR UPDATE
       LIMIT 1`,
      params
    );

    let account = accountRes.rows[0];
    if (!account) {
      const insertRes = await client.query<CreditAccountRecord>(
        `INSERT INTO credit_accounts (user_id, tenant_id)
         VALUES ($1, $2)
         RETURNING *`,
        [input.userId, tenantId]
      );
      account = insertRes.rows[0];
    }

    const newBalance = account.balance + input.creditsDelta;
    if (newBalance < 0) {
      throw new Error('Insufficient balance for adjustment');
    }

    await client.query(
      `UPDATE credit_accounts
       SET balance = $1, updated_at = NOW()
       WHERE id = $2`,
      [newBalance, account.id]
    );

    const metadata = {
      reason: input.reason || null,
      admin_id: input.adminId || null,
    };

    const txRes = await client.query<CreditTransactionRecord>(
      `INSERT INTO credit_transactions_v2 (
        credit_account_id, tenant_id, user_id, type, credits_delta, balance_after,
        provider, provider_reference, checkout_session_id, bundle_id, action_key, metadata, status
      ) VALUES ($1, $2, $3, 'adjustment', $4, $5, 'admin', NULL, NULL, NULL, NULL, $6, 'completed')
      RETURNING *`,
      [account.id, tenantId, input.userId, input.creditsDelta, newBalance, metadata]
    );

    return { balance: newBalance, transaction: txRes.rows[0] };
  });
}

export async function grantSignupCredits(scope: CreditScope, input: {
  userId: number;
  credits?: number;
}): Promise<{ balance: number; granted: boolean; transaction: CreditTransactionRecord | null }> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const configuredSignupCredits = input.credits ?? (await getCreditBonusSettings(scope)).signupBonusCredits;
  const credits = Math.trunc(configuredSignupCredits);

  if (credits <= 0) {
    throw new Error('Signup credits must be a positive integer');
  }

  return withClient(scope.pool, async (client) => {
    const params: any[] = [input.userId];
    let where = 'user_id = $1 AND tenant_id IS NULL';
    if (tenantId !== null) {
      params.push(tenantId);
      where = 'user_id = $1 AND tenant_id = $2';
    }

    const accountRes = await client.query<CreditAccountRecord>(
      `SELECT * FROM credit_accounts
       WHERE ${where}
       ORDER BY updated_at DESC, created_at DESC, balance DESC
       FOR UPDATE
       LIMIT 1`,
      params
    );

    let account = accountRes.rows[0];
    if (!account) {
      const insertRes = await client.query<CreditAccountRecord>(
        `INSERT INTO credit_accounts (user_id, tenant_id)
         VALUES ($1, $2)
         RETURNING *`,
        [input.userId, tenantId]
      );
      account = insertRes.rows[0];
    }

    const existingSignupTx = await client.query<{ id: string }>(
      `SELECT id FROM credit_transactions_v2
       WHERE user_id = $1
         AND ${tenantId === null ? 'tenant_id IS NULL' : 'tenant_id = $2'}
         AND type = 'adjustment'
         AND status = 'completed'
         AND metadata->>'reason' = $${params.length + 1}
       ORDER BY created_at DESC
       LIMIT 1`,
      [...params, SIGNUP_CREDIT_REASON]
    );

    if (existingSignupTx.rows[0]) {
      return { balance: account.balance, granted: false, transaction: null };
    }

    const newBalance = account.balance + credits;

    await client.query(
      `UPDATE credit_accounts
       SET balance = $1, updated_at = NOW()
       WHERE id = $2`,
      [newBalance, account.id]
    );

    const metadata = {
      reason: SIGNUP_CREDIT_REASON,
      source: 'signup',
      credits,
    };

    const txRes = await client.query<CreditTransactionRecord>(
      `INSERT INTO credit_transactions_v2 (
        credit_account_id, tenant_id, user_id, type, credits_delta, balance_after,
        provider, provider_reference, checkout_session_id, bundle_id, action_key, metadata, status
      ) VALUES ($1, $2, $3, 'adjustment', $4, $5, 'system', NULL, NULL, NULL, NULL, $6, 'completed')
      RETURNING *`,
      [account.id, tenantId, input.userId, credits, newBalance, metadata]
    );

    return { balance: newBalance, granted: true, transaction: txRes.rows[0] };
  });
}

export async function getOrCreateAccountWithBalance(scope: CreditScope, userId: number): Promise<CreditAccountRecord> {
  const existing = await getCreditAccount(scope, userId);
  if (existing) return existing;
  return ensureCreditAccount(scope, userId);
}
