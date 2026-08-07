-- Trainee credit billing foundations (central app database)
CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    low_balance_threshold INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS credit_accounts_tenant_idx ON credit_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS credit_accounts_user_idx ON credit_accounts(user_id);

CREATE TABLE IF NOT EXISTS credit_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL CHECK (credits > 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_bundles_list_idx ON credit_bundles(tenant_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS credit_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    action_key TEXT NOT NULL,
    description TEXT,
    cost INTEGER NOT NULL CHECK (cost >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, action_key)
);

CREATE INDEX IF NOT EXISTS credit_actions_active_idx ON credit_actions(tenant_id, is_active);

-- Transactions ledger for credit purchases and debits
CREATE TABLE IF NOT EXISTS credit_transactions_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    tenant_id UUID NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'debit', 'refund', 'adjustment')),
    credits_delta INTEGER NOT NULL,
    balance_after INTEGER,
    provider TEXT,
    provider_reference TEXT,
    checkout_session_id TEXT,
    bundle_id UUID NULL REFERENCES credit_bundles(id),
    action_key TEXT,
    metadata JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_reference)
);

CREATE INDEX IF NOT EXISTS credit_tx_account_idx ON credit_transactions_v2(credit_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_tx_session_idx ON credit_transactions_v2(checkout_session_id);
CREATE INDEX IF NOT EXISTS credit_tx_action_idx ON credit_transactions_v2(action_key);

-- Seed default credit actions (central scope)
INSERT INTO credit_actions (tenant_id, action_key, description, cost, is_active)
VALUES
    (NULL, 'log_meal', 'Log a meal', 1, TRUE),
    (NULL, 'watch_workout', 'Watch a workout', 3, TRUE),
    (NULL, 'log_progress', 'Log progress update', 1, TRUE),
    (NULL, 'watch_video', 'Watch a video', 2, TRUE)
ON CONFLICT (tenant_id, action_key) DO NOTHING;

-- Seed starter bundles (central scope)
INSERT INTO credit_bundles (tenant_id, name, credits, price_cents, currency, is_active, sort_order)
VALUES
    (NULL, 'Starter 50', 50, 9900, 'usd', TRUE, 1),
    (NULL, 'Value 100', 100, 17900, 'usd', TRUE, 2),
    (NULL, 'Pro 200', 200, 32900, 'usd', TRUE, 3)
ON CONFLICT DO NOTHING;
