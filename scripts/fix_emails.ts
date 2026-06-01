/**
 * Script to fix email/username issue
 * Moves email addresses from username field to email field
 */

import { Pool } from 'pg';

const CENTRAL_DB_URL = 'postgresql://postgres:RJYtiOLwqtxtNfjnQwCKEoIuktKGypaU@trolley.proxy.rlwy.net:51243/railway';

async function fixCentralDatabase() {
  const pool = new Pool({ connectionString: CENTRAL_DB_URL });
  
  try {
    console.log('🔍 Checking central database...\n');
    
    // Check current state
    const before = await pool.query(
      `SELECT id, username, email, first_name, last_name, role 
       FROM users 
       WHERE username LIKE '%@%'
       ORDER BY id`
    );
    
    console.log(`Found ${before.rows.length} users with email in username field:\n`);
    before.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.username} (${row.first_name} ${row.last_name}) - Email field: ${row.email || 'NULL'}`);
    });
    
    // Fix the data - KEEP username field intact for authentication compatibility!
    console.log('\n🔧 Fixing data...\n');
    const result = await pool.query(
      `UPDATE users
       SET email = LOWER(username)
       WHERE username ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' 
       AND email IS NULL`
    );
    
    console.log(`✅ Updated ${result.rowCount} records\n`);
    
    // Verify the fix
    const after = await pool.query(
      `SELECT id, username, email, first_name, last_name, role 
       FROM users 
       WHERE email IS NOT NULL 
       ORDER BY id 
       LIMIT 20`
    );
    
    console.log(`\n📊 Sample of fixed records (showing ${after.rows.length}):\n`);
    after.rows.forEach(row => {
      console.log(`  ID ${row.id}: Username=${row.username || 'NULL'}, Email=${row.email} (${row.first_name} ${row.last_name})`);
    });
    
    const total = await pool.query(`SELECT COUNT(*) as count FROM users WHERE email IS NOT NULL`);
    console.log(`\n✨ Total users with email: ${total.rows[0].count}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function fixTenantDatabases() {
  const centralPool = new Pool({ connectionString: CENTRAL_DB_URL });
  
  try {
    console.log('\n🔍 Checking for tenant databases...\n');
    
    // Check if tenants table exists
    const tableCheck = await centralPool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'tenants'
       )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.log('ℹ️  No tenants table found - skipping tenant database fixes\n');
      return;
    }
    
    // Get all tenant database URLs
    const tenantsResult = await centralPool.query(
      `SELECT id, tenant_name, database_url FROM tenants WHERE database_url IS NOT NULL`
    );
    
    if (tenantsResult.rows.length === 0) {
      console.log('ℹ️  No tenant databases found\n');
      return;
    }
    
    console.log(`Found ${tenantsResult.rows.length} tenant database(s)\n`);
    
    for (const tenant of tenantsResult.rows) {
      console.log(`\n🏢 Processing tenant: ${tenant.tenant_name} (ID: ${tenant.id})\n`);
      
      const tenantPool = new Pool({ connectionString: tenant.database_url });
      
      try {
        // Check current state
        const before = await tenantPool.query(
          `SELECT id, username, email, first_name, last_name, role 
           FROM users 
           WHERE username LIKE '%@%'`
        );
        
        if (before.rows.length === 0) {
          console.log(`  ✓ No issues found in ${tenant.tenant_name}\n`);
          continue;
        }
        
        console.log(`  Found ${before.rows.length} users with email in username field\n`);
        
        // Fix the data
        const result = await tenantPool.query(
          `UPDATE users
           SET email = username,
               username = NULL
           WHERE username LIKE '%@%' AND email IS NULL`
        );
        
        console.log(`  ✅ Updated ${result.rowCount} records in ${tenant.tenant_name}\n`);
        
      } catch (error) {
        console.error(`  ❌ Error processing tenant ${tenant.tenant_name}:`, error);
      } finally {
        await tenantPool.end();
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking tenants:', error);
  } finally {
    await centralPool.end();
  }
}

async function main() {
  console.log('='  .repeat(60));
  console.log('🔧 Email/Username Fix Script');
  console.log('='  .repeat(60));
  console.log();
  
  try {
    await fixCentralDatabase();
    await fixTenantDatabases();
    
    console.log('='  .repeat(60));
    console.log('✨ All done!');
    console.log('='  .repeat(60));
    console.log();
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

main();
