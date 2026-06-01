CREATE TABLE IF NOT EXISTS credit_balances (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_credits DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_reference_id TEXT NOT NULL UNIQUE,
    session_id TEXT UNIQUE,
    order_id TEXT,
    payment_gateway TEXT NOT NULL DEFAULT 'stripe',
    status TEXT NOT NULL DEFAULT 'pending',
    gateway_status TEXT,
    response_code TEXT,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EGP',
    credits INTEGER NOT NULL,
    checkout_url TEXT,
    return_url TEXT,
    callback_url TEXT,
    request_payload JSONB,
    session_payload JSONB,
    callback_payload JSONB,
    signature_valid BOOLEAN DEFAULT FALSE,
    signature_header TEXT,
    error_message TEXT,
    credited BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_status_idx ON credit_transactions(status);
