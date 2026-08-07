-- Epic H: Payments, Subscriptions & Financial Reporting
-- Migration 0027: Add payment methods, subscriptions, invoices, and financial tracking

-- Payment Methods (H1)
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'card', 'bank_transfer', 'e_wallet', 'crypto'
  provider VARCHAR(100) NOT NULL, -- 'stripe', 'paypal', 'coinbase', 'stc_pay', etc.
  token VARCHAR(255) NOT NULL, -- Provider's payment method token
  display_name VARCHAR(255), -- e.g., "Visa ending in 4242"
  metadata JSONB, -- Provider-specific data (last4, exp_month, exp_year, wallet_email, etc.)
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE;

-- Payments (H1)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD', -- ISO 4217
  exchange_rate DECIMAL(10, 6), -- If converted from another currency
  original_amount DECIMAL(10, 2), -- Original amount before conversion
  original_currency VARCHAR(3),
  status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
  provider VARCHAR(100) NOT NULL,
  provider_transaction_id VARCHAR(255),
  provider_fee DECIMAL(10, 2),
  related_entity_type VARCHAR(50), -- 'subscription', 'credits', 'workshop', 'course', etc.
  related_entity_id INTEGER,
  description TEXT,
  metadata JSONB, -- Additional provider data
  failed_reason TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_txn ON payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_related_entity ON payments(related_entity_type, related_entity_id);

-- Subscription Plans (H2)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  tier VARCHAR(50) NOT NULL, -- 'free', 'basic', 'premium', 'enterprise'
  interval VARCHAR(50) NOT NULL, -- 'monthly', 'yearly', 'quarterly', 'lifetime'
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  pricing_by_country JSONB, -- Country-specific pricing: {"US": 29.99, "SA": 99.99, ...}
  trial_days INTEGER DEFAULT 0,
  features JSONB NOT NULL, -- Feature matrix: {"max_trainees": 10, "ai_assistant": true, ...}
  description TEXT,
  description_ar TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

-- Subscriptions (H2)
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL, -- 'trial', 'active', 'past_due', 'cancelled', 'expired'
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  cancel_at TIMESTAMP, -- Scheduled cancellation
  cancelled_at TIMESTAMP, -- Actual cancellation
  ended_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  next_billing_date TIMESTAMP,
  payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
  discount_coupon_id INTEGER REFERENCES discount_coupons(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date) WHERE auto_renew = TRUE;

-- Invoices (H2)
DO $$
DECLARE
  subscription_id_type text;
  payment_id_type text;
BEGIN
  SELECT data_type INTO subscription_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'id';

  SELECT data_type INTO payment_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'id';

  IF subscription_id_type IS NULL THEN
    subscription_id_type := 'integer';
  END IF;

  IF payment_id_type IS NULL THEN
    payment_id_type := 'integer';
  END IF;

  IF subscription_id_type = 'uuid' AND payment_id_type = 'uuid' THEN
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) DEFAULT 0,
        discount DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        line_items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        pdf_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    $sql$;
  ELSIF subscription_id_type = 'uuid' THEN
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) DEFAULT 0,
        discount DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        line_items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        pdf_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    $sql$;
  ELSIF payment_id_type = 'uuid' THEN
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
        payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) DEFAULT 0,
        discount DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        line_items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        pdf_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
        payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        invoice_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) DEFAULT 0,
        discount DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        line_items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        pdf_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    $sql$;
  END IF;
END $$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Discount Coupons (H2)
CREATE TABLE IF NOT EXISTS discount_coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed_amount', 'free_trial_extension'
  value DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3), -- For fixed_amount type
  applicable_plans JSONB, -- Array of plan IDs or null for all
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discount_coupons_code ON discount_coupons(code);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_active ON discount_coupons(is_active, valid_from, valid_until);

-- Financial Transactions (H3)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'revenue', 'expense'
  category VARCHAR(100) NOT NULL, -- 'subscription', 'credits', 'refund', 'marketing', 'operations', 'commission', etc.
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  related_entity_type VARCHAR(50), -- 'payment', 'subscription', 'refund', 'expense'
  related_entity_id INTEGER,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  vendor VARCHAR(255), -- For expenses
  receipt_file_id INTEGER REFERENCES uploaded_files(id) ON DELETE SET NULL,
  transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category ON financial_transactions(category);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user ON financial_transactions(user_id);

-- Refund Requests (H3)
DO $$
DECLARE
  payment_id_type text;
BEGIN
  SELECT data_type INTO payment_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'id';

  IF payment_id_type IS NULL THEN
    payment_id_type := 'integer';
  END IF;

  IF payment_id_type = 'uuid' THEN
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS refund_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        reason_details TEXT,
        status VARCHAR(50) NOT NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rejection_reason TEXT,
        refund_transaction_id VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS refund_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        reason_details TEXT,
        status VARCHAR(50) NOT NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rejection_reason TEXT,
        refund_transaction_id VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    $sql$;
  END IF;
END $$;

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment ON refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

-- Comments
COMMENT ON TABLE payment_methods IS 'Epic H1: User payment methods (cards, wallets, crypto)';
COMMENT ON TABLE payments IS 'Epic H1: Payment transaction records';
COMMENT ON TABLE subscription_plans IS 'Epic H2: Subscription plan definitions';
COMMENT ON TABLE subscriptions IS 'Epic H2: User subscription records';
COMMENT ON TABLE invoices IS 'Epic H2: Electronic invoices';
COMMENT ON TABLE discount_coupons IS 'Epic H2: Discount codes and promotional offers';
COMMENT ON TABLE financial_transactions IS 'Epic H3: Unified financial ledger (revenue + expenses)';
COMMENT ON TABLE refund_requests IS 'Epic H3: Refund management workflow';
