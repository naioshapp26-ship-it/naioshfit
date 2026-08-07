import type pg from 'pg';

export interface TenantRecord {
  id: string;
  subdomain: string;
  company_name: string;
  subscription_plan: string | null;
  status: string;
  database_url_encrypted: Buffer;
  database_name: string | null;
  settings: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
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
