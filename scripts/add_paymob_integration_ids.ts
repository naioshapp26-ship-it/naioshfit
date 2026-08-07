#!/usr/bin/env tsx

/**
 * Update Paymob Integration IDs
 * 
 * After creating payment integrations in Paymob dashboard, use this script
 * to add the Integration IDs to your production database.
 * 
 * Usage: tsx scripts/add_paymob_integration_ids.ts
 */

import { getCentralPool } from '../server/saas/centralDb';

// Integration IDs from Paymob Dashboard
// Go to: Paymob Dashboard → Developers → Payment Integrations
const INTEGRATION_IDS = [
  '5516811', // Online card (Visa/Mastercard)
  '5545521', // Mobile Wallet (Vodafone Cash, etc.)
];

async function updateIntegrationIds() {
  console.log('🔧 Updating Paymob Integration IDs...');
  
  if (INTEGRATION_IDS.length === 0) {
    console.log('⚠️  No Integration IDs configured in this script.');
    console.log('\nTo get your Integration IDs:');
    console.log('  1. Log into Paymob Dashboard: https://accept.paymob.com/portal2/en/login');
    console.log('  2. Go to: Developers → Payment Integrations');
    console.log('  3. Copy the Integration ID for each payment method');
    console.log('  4. Edit this script and add them to INTEGRATION_IDS array');
    console.log('  5. Run this script again\n');
    process.exit(0);
  }
  
  const pool = getCentralPool();
  
  try {
    console.log(`📝 Adding ${INTEGRATION_IDS.length} Integration ID(s)...`);
    console.log(`   IDs: ${INTEGRATION_IDS.join(', ')}`);
    
    await pool.query(
      `UPDATE platform_payment_settings
       SET paymob_integration_ids = $1`,
      [JSON.stringify(INTEGRATION_IDS)]
    );
    
    // Verify
    const result = await pool.query(
      `SELECT paymob_integration_ids FROM platform_payment_settings LIMIT 1`
    );
    
    if (result.rows.length > 0) {
      const ids = result.rows[0].paymob_integration_ids;
      console.log('✅ Integration IDs updated successfully!');
      console.log(`   Configured IDs: ${JSON.stringify(ids)}`);
      console.log('\n🎉 Paymob is now ready for live transactions!');
    } else {
      console.error('❌ Update verification failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error updating Integration IDs:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateIntegrationIds();
