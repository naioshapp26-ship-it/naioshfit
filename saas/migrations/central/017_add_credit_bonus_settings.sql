CREATE TABLE IF NOT EXISTS credit_bonus_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    scope_key TEXT GENERATED ALWAYS AS (COALESCE(tenant_id::text, 'platform')) STORED,
    signup_bonus_credits INTEGER NOT NULL DEFAULT 100 CHECK (signup_bonus_credits > 0),
    updated_by INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope_key)
);
