#!/usr/bin/env npx tsx
/**
 * Manual credit settlement script for lara@sief.naioshfit.com
 * 
 * This script manually completes pending credit transactions that failed
 * due to webhook signature verification when webhook secret was not configured.
 */

import { Pool } from 'pg';

const TENANT_DB = 'tenant_sief';
const USER_ID = 2; // lara
const ACCOUNT_ID = '7711aa8d-8d67-4170-bd96-b19b0a254cec';
const TRANSACTIONS = [
  {
    sessionId: 'cs_test_a1vg32BIi78Qe6POHKbWKBLN81qeFRqNz9rigiaNBF4tNLywE2vF32VwfN',
    credits: 50,
    balanceAfter: 50
  },
  {
    sessionId: 'cs_test_a1RrbG8xqJXnTWqeMjJCJuU0b0srDOkID1tI8uQnFEyHEE1D1YNaVpfgeQ',
    credits: 50,
    balanceAfter: 100
  }
];

async function main() {
  const connectionString = process.env.CENTRAL_DATABASE_URL || 
    'postgresql://postgres:wWLSoGvNpROTODgkatyFXfRVsNtavVAe@shuttle.proxy.rlwy.net:41026/railway';
  
  // Connect to tenant database
  const tenantConnString = connectionString.replace('/railway', `/${TENANT_DB}`) + '?sslmode=require';
  const pool = new Pool({ connectionString: tenantConnString });
  
  try {
    console.log('🔄 Connecting to tenant database:', TENANT_DB);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('\n📝 Processing transactions...\n');
      
      for (const tx of TRANSACTIONS) {
        const result = await client.query(
          `UPDATE credit_transactions_v2 
           SET status = 'completed', balance_after = $1 
           WHERE checkout_session_id = $2 AND status = 'pending'
           RETURNING id, credits_delta, status`,
          [tx.balanceAfter, tx.sessionId]
        );
        
        if (result.rowCount > 0) {
          console.log(`✅ Updated transaction ${tx.sessionId.slice(0, 20)}...`);
          console.log(`   Credits: ${tx.credits}, New Balance: ${tx.balanceAfter}`);
        } else {
          console.log(`⚠️  No pending transaction found for ${tx.sessionId.slice(0, 20)}...`);
        }
      }
      
      // Update account balance
      const accountResult = await client.query(
        `UPDATE credit_accounts 
         SET balance = $1 
         WHERE id = $2 AND user_id = $3
         RETURNING id, balance`,
        [100, ACCOUNT_ID, USER_ID]
      );
      
      if (accountResult.rowCount > 0) {
        console.log(`\n💰 Updated account balance to: ${accountResult.rows[0].balance} credits`);
      }
      
      await client.query('COMMIT');
      console.log('\n✅ All changes committed successfully!\n');
      
      // Verify final state
      const txCheck = await client.query(
        `SELECT id, status, credits_delta, balance_after, created_at 
         FROM credit_transactions_v2 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [USER_ID]
      );
      
      console.log('📊 Final transaction status:');
      txCheck.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.status.toUpperCase()}: ${row.credits_delta > 0 ? '+' : ''}${row.credits_delta} credits → Balance: ${row.balance_after}`);
      });
      
      const accountCheck = await client.query(
        'SELECT balance FROM credit_accounts WHERE user_id = $1',
        [USER_ID]
      );
      
      console.log(`\n💰 Final account balance: ${accountCheck.rows[0]?.balance || 0} credits\n`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error during transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
