-- Enterprise SaaS: plans, billing, domains, modules, usage, RBAC

CREATE TABLE IF NOT EXISTS tenant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  interval TEXT NOT NULL DEFAULT 'month',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_users INTEGER,
  max_storage_mb INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_method TEXT,
  payment_provider TEXT,
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_billing_tenant_idx ON tenant_billing(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_billing_status_idx ON tenant_billing(status);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_type TEXT NOT NULL DEFAULT 'subdomain' CHECK (domain_type IN ('subdomain', 'path', 'custom')),
  host TEXT NOT NULL,
  path_prefix TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  ssl_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(host, path_prefix)
);

CREATE INDEX IF NOT EXISTS tenant_domains_tenant_idx ON tenant_domains(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, metric_key, period_start)
);

CREATE INDEX IF NOT EXISTS tenant_usage_tenant_idx ON tenant_usage(tenant_id);

CREATE TABLE IF NOT EXISTS saas_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  scope TEXT NOT NULL DEFAULT 'tenant' CHECK (scope IN ('platform', 'tenant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  module TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_role_permissions (
  role_id UUID NOT NULL REFERENCES saas_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES saas_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS tenant_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER,
  central_admin_id UUID REFERENCES tenant_admins(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES saas_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_user_roles_tenant_idx ON tenant_user_roles(tenant_id);

CREATE TABLE IF NOT EXISTS saas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saas_audit_logs_tenant_idx ON saas_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS saas_audit_logs_created_idx ON saas_audit_logs(created_at DESC);

-- Extend tenants with platform type and expiry
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS platform_type TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_mode TEXT DEFAULT 'subdomain';

-- Seed default plans
INSERT INTO tenant_plans (key, name, name_ar, price_cents, currency, features, max_users, sort_order)
VALUES
  ('starter', 'Starter', 'المبتدئ', 9900, 'usd', '["Up to 50 users","Basic dashboard","Email support"]'::jsonb, 50, 1),
  ('business', 'Business', 'الأعمال', 29900, 'usd', '["Up to 200 users","Advanced reports","Priority support","Custom branding"]'::jsonb, 200, 2),
  ('professional', 'Professional', 'المحترف', 49900, 'usd', '["Up to 500 users","API access","Dedicated manager","Multi-branch"]'::jsonb, 500, 3),
  ('enterprise', 'Enterprise', 'المؤسسات', 99900, 'usd', '["Unlimited users","SLA 99.9%","Custom integrations","On-premise option"]'::jsonb, NULL, 4)
ON CONFLICT (key) DO NOTHING;

-- Seed RBAC roles
INSERT INTO saas_roles (key, name, name_ar, scope) VALUES
  ('super_admin', 'Super Admin', 'مدير المنصة', 'platform'),
  ('tenant_owner', 'Tenant Owner', 'مالك المنصة', 'tenant'),
  ('admin', 'Admin', 'مدير', 'tenant'),
  ('manager', 'Manager', 'مشرف', 'tenant'),
  ('employee', 'Employee', 'موظف', 'tenant'),
  ('customer', 'Customer', 'عميل', 'tenant')
ON CONFLICT (key) DO NOTHING;

-- Seed permissions
INSERT INTO saas_permissions (key, name, name_ar, module) VALUES
  ('tenants.read', 'View tenants', 'عرض المستأجرين', 'platform'),
  ('tenants.manage', 'Manage tenants', 'إدارة المستأجرين', 'platform'),
  ('billing.read', 'View billing', 'عرض الفواتير', 'billing'),
  ('billing.manage', 'Manage billing', 'إدارة الفواتير', 'billing'),
  ('users.read', 'View users', 'عرض المستخدمين', 'users'),
  ('users.manage', 'Manage users', 'إدارة المستخدمين', 'users'),
  ('reports.read', 'View reports', 'عرض التقارير', 'reports'),
  ('settings.manage', 'Manage settings', 'إدارة الإعدادات', 'settings')
ON CONFLICT (key) DO NOTHING;

-- Super admin gets all permissions
INSERT INTO saas_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM saas_roles r CROSS JOIN saas_permissions p WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;

-- Tenant owner permissions
INSERT INTO saas_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM saas_roles r JOIN saas_permissions p ON p.key IN (
  'billing.read', 'billing.manage', 'users.read', 'users.manage', 'reports.read', 'settings.manage'
) WHERE r.key = 'tenant_owner'
ON CONFLICT DO NOTHING;
