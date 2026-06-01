#!/usr/bin/env tsx

/**
 * Run tenant migrations for all existing tenants
 * This script applies any pending migrations to all tenant databases
 * 
 * Usage: tsx scripts/run-tenant-migrations-all.ts
 */

import { getCentralPool } from '../server/saas/centralDb';
import { runTenantMigrations } from '../server/saas/provisioningService';
import { decryptTenantDatabaseUrl } from '../server/saas/dbManager';

async function runMigrationsForAllTenants() {
  const centralPool = getCentralPool();
  
  try {
    console.log('[MIGRATIONS] Fetching all tenants...');
    
    const result = await centralPool.query<{
      id: string;
      subdomain: string;
      database_url_encrypted: Buffer;
      status: string;
    }>(
      `SELECT id, subdomain, database_url_encrypted, status 
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
        console.log(`[MIGRATIONS] Running migrations for tenant: ${tenant.subdomain} (${tenant.id})`);
        
        const databaseUrl = await decryptTenantDatabaseUrl(tenant.database_url_encrypted);
        await runTenantMigrations(databaseUrl);
        
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
