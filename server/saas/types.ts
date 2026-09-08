import type pg from 'pg';

export interface TenantRecord {
  id: string;
  subdomain: string;
  company_name: string;
  /** @deprecated use company_name; some rows may also expose name */
  name?: string;
  subscription_plan: string | null;
  status: string;
  database_url_encrypted: Buffer;
  database_name: string | null;
  settings: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  suspended_at?: Date | null;
  suspended_by?: string | null;
  suspension_reason?: string | null;
  admin_notes?: string | null;
  disabled_at?: Date | null;
  disabled_by?: string | null;
  previous_status?: string | null;
  product_type?: string | null;
}

export interface TenantContext {
  tenant: TenantRecord;
  pool: pg.Pool;
}

export interface ProvisioningStepResult {
  step: ProvisioningStep;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type ProvisioningStep =
  | 'CREATE_TENANT_RECORD'
  | 'CREATE_TENANT_DATABASE'
  | 'STORE_DATABASE_SECRET'
  | 'RUN_MIGRATIONS'
  | 'SEED_DEFAULTS'
  | 'CREATE_SUBSCRIPTION'
  | 'CREATE_ADMIN'
  | 'SEND_WELCOME_EMAIL';
