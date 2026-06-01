#!/usr/bin/env tsx

/**
 * Run tenant migrations directly on tenant databases
 * This script applies any pending migrations to tenant databases
 * without needing to decrypt the database URLs from the central database
 * 
 * Usage: DATABASE_URL=<central_db_url> tsx scripts/run-tenant-migrations-direct.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCentralPool } from '../server/saas/centralDb';

const { Pool } = pg;

interface TenantInfo {
  id: string;
  subdomain: string;
  database_name: string;
}

function getTenantMigrationsPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, '..', 'saas', 'migrations', 'tenant');
}

function createTenantDatabaseUrl(baseUrl: string, databaseName: string): string {
  const url = new URL(baseUrl);
  // Replace the database name in the path
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function runMigrationsForTenant(tenantDbUrl: string, tenantSubdomain: string): Promise<void> {
  const pool = new Pool({
    connectionString: tenantDbUrl,
    ssl: tenantDbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const migrationsDir = getTenantMigrationsPath();
    
    // Ensure migrations tracking table exists
    await pool.query(
      `CREATE TABLE IF NOT EXISTS tenant_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )`
    );

    // Get list of applied migrations
    const appliedResult = await pool.query<{ filename: string }>(
      'SELECT filename FROM tenant_migrations'
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));
    
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      
      console.log(`  [${tenantSubdomain}] Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      if (sql.trim()) {
        await pool.query(sql);
        await pool.query('INSERT INTO tenant_migrations (filename) VALUES ($1)', [file]);
        appliedCount++;
      }
    }
    
    if (appliedCount === 0) {
      console.log(`  [${tenantSubdomain}] All migrations up to date`);
    } else {
      console.log(`  [${tenantSubdomain}] Applied ${appliedCount} new migration(s)`);
    }
  } finally {
    await pool.end();
  }
}

async function runMigrationsForAllTenants() {
  const centralPool = getCentralPool();
  const baseDbUrl = process.env.DATABASE_URL || process.env.CENTRAL_DATABASE_URL;
  
  if (!baseDbUrl) {
    console.error('[MIGRATIONS] DATABASE_URL must be set');
    process.exit(1);
  }
  
  try {
    console.log('[MIGRATIONS] Fetching all tenants from central database...');
    
    const result = await centralPool.query<TenantInfo>(
      `SELECT id, subdomain, database_name 
       FROM tenants 
       WHERE status != 'deleted' 
       ORDER BY subdomain`
    );
    
    console.log(`[MIGRATIONS] Found ${result.rows.length} tenants\n`);
    
    let successCount = 0;
    let failCount = 0;
    const failures: Array<{ subdomain: string; error: string }> = [];
    
    for (const tenant of result.rows) {
      try {
        console.log(`[MIGRATIONS] Processing tenant: ${tenant.subdomain} (${tenant.database_name})`);
        
        const tenantDbUrl = createTenantDatabaseUrl(baseDbUrl, tenant.database_name);
        await runMigrationsForTenant(tenantDbUrl, tenant.subdomain);
        
        console.log(`[MIGRATIONS] ✓ Success: ${tenant.subdomain}\n`);
        successCount++;
      } catch (error: any) {
        console.error(`[MIGRATIONS] ✗ Failed: ${tenant.subdomain}`);
        console.error(`[MIGRATIONS] Error:`, error.message);
        console.error('');
        
        failCount++;
        failures.push({
          subdomain: tenant.subdomain,
          error: error.message
        });
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total tenants: ${result.rows.length}`);
    console.log(`✓ Successful: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);
    
    if (failures.length > 0) {
      console.log('\nFailed tenants:');
      failures.forEach(({ subdomain, error }) => {
        console.log(`  - ${subdomain}: ${error}`);
      });
    }
    
    process.exit(failCount > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('[MIGRATIONS] Fatal error:', error);
    process.exit(1);
  }
}

runMigrationsForAllTenants();
