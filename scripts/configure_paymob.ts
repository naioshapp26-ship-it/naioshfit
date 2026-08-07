#!/usr/bin/env tsx

/**
 * Configure Paymob payment settings in production database
 * 
 * Usage: tsx scripts/configure_paymob.ts
 */

import { getCentralPool } from '../server/saas/centralDb';
import { encryptKey } from '../server/payment/encryption';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function parseIntegrationIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

async function configurePaymob() {
  console.log('🔧 Configuring Paymob payment settings...');

  const publicKey = requireEnv('PAYMOB_PUBLIC_KEY');
  const secretKey = requireEnv('PAYMOB_SECRET_KEY');
  const hmacSecret = optionalEnv('PAYMOB_HMAC_SECRET');
  const baseUrl = optionalEnv('PAYMOB_BASE_URL') || 'https://accept.paymob.com';
  const isLiveMode = (optionalEnv('PAYMOB_IS_LIVE_MODE') || '').toLowerCase() === 'true';
  const integrationIds = parseIntegrationIds(optionalEnv('PAYMOB_INTEGRATION_IDS'));
  
  const pool = getCentralPool();
  
  try {
    // Check if platform_payment_settings table exists and has a row
    const checkResult = await pool.query(
      'SELECT COUNT(*) as count FROM platform_payment_settings'
    );
    
    const hasRows = parseInt(checkResult.rows[0].count) > 0;
    
    // Encrypt sensitive keys
    console.log('🔐 Encrypting secret keys...');
    const encryptedSecretKey = encryptKey(secretKey);
    const encryptedHmacSecret = hmacSecret ? encryptKey(hmacSecret) : null;
    
    if (hasRows) {
      // Update existing row
      console.log('📝 Updating existing payment settings...');
      await pool.query(
        `UPDATE platform_payment_settings
         SET paymob_public_key = $1,
             paymob_secret_key = $2,
             paymob_hmac_secret = $3,
             paymob_integration_ids = $4,
             paymob_base_url = $5,
             paymob_is_live_mode = $6`,
        [
          publicKey,
          encryptedSecretKey,
          encryptedHmacSecret,
          JSON.stringify(integrationIds),
          baseUrl,
          isLiveMode,
        ]
      );
    } else {
      // Insert new row
      console.log('📝 Creating new payment settings row...');
      await pool.query(
        `INSERT INTO platform_payment_settings (
           paymob_public_key,
           paymob_secret_key,
           paymob_hmac_secret,
           paymob_integration_ids,
           paymob_base_url,
           paymob_is_live_mode
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          publicKey,
          encryptedSecretKey,
          encryptedHmacSecret,
          JSON.stringify(integrationIds),
          baseUrl,
          isLiveMode,
        ]
      );
    }
    
    // Verify the configuration
    console.log('✅ Verifying configuration...');
    const verifyResult = await pool.query(
      `SELECT paymob_public_key, paymob_base_url, paymob_is_live_mode
       FROM platform_payment_settings
       LIMIT 1`
    );
    
    if (verifyResult.rows.length > 0) {
      const row = verifyResult.rows[0];
      console.log('✅ Paymob configuration saved successfully!');
      console.log(`   Public Key: ${row.paymob_public_key}`);
      console.log(`   Base URL: ${row.paymob_base_url}`);
      console.log(`   Live Mode: ${row.paymob_is_live_mode}`);
      console.log('\n🎉 Paymob is now configured and ready to use!');
      console.log('   Test the configuration at: https://www.naioshfit.com/api/paymob/status');
    } else {
      console.error('❌ Configuration verification failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error configuring Paymob:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the configuration
configurePaymob().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
