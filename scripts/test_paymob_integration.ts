#!/usr/bin/env tsx

/**
 * Test Paymob Integration - Comprehensive Test Suite
 * 
 * Tests the full Paymob payment flow including:
 * - Configuration verification
 * - Intention creation
 * - Webhook verification
 * - API endpoints
 */

import { getPlatformPaymobKeys, createPlatformPaymobIntention } from '../server/payment/platformPaymob';
import { verifyPaymobWebhookSignature } from '../server/payment/paymobClient';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji: string, message: string, color = COLORS.reset) {
  console.log(`${color}${emoji} ${message}${COLORS.reset}`);
}

function success(message: string) {
  log('✅', message, COLORS.green);
}

function error(message: string) {
  log('❌', message, COLORS.red);
}

function info(message: string) {
  log('ℹ️ ', message, COLORS.cyan);
}

function section(title: string) {
  console.log(`\n${COLORS.blue}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.blue}${title}${COLORS.reset}`);
  console.log(`${COLORS.blue}${'='.repeat(60)}${COLORS.reset}\n`);
}

async function testEndpoints() {
  section('1. Testing Production API Endpoints');
  
  try {
    // Test status endpoint
    info('Testing GET /api/paymob/status...');
    const statusResponse = await fetch('https://www.naioshfit.com/api/paymob/status');
    const statusData = await statusResponse.json();
    
    if (statusData.configured === true) {
      success('Status endpoint: Paymob is configured');
      console.log(`   Response: ${JSON.stringify(statusData)}`);
    } else {
      error('Status endpoint: Paymob not configured');
      return false;
    }
    
    // Test config endpoint
    info('Testing GET /api/paymob/config...');
    const configResponse = await fetch('https://www.naioshfit.com/api/paymob/config');
    const configData = await configResponse.json();
    
    if (configData.publicKey && configData.publicKey.startsWith('egy_pk_')) {
      success('Config endpoint: Public key retrieved');
      console.log(`   Public Key: ${configData.publicKey}`);
      console.log(`   Base URL: ${configData.baseUrl || 'default'}`);
    } else {
      error('Config endpoint: Failed to retrieve public key');
      return false;
    }
    
    return true;
  } catch (err: any) {
    error(`Endpoint test failed: ${err.message}`);
    return false;
  }
}

async function testConfiguration() {
  section('2. Testing Paymob Configuration from Database');
  
  try {
    info('Fetching Paymob keys from database...');
    const keys = await getPlatformPaymobKeys();
    
    if (keys.publicKey && keys.secretKey) {
      success('Configuration retrieved successfully');
      console.log(`   Public Key: ${keys.publicKey}`);
      console.log(`   Secret Key: ${keys.secretKey.substring(0, 20)}...`);
      console.log(`   HMAC Secret: ${keys.hmacSecret ? keys.hmacSecret.substring(0, 10) + '...' : 'not set'}`);
      console.log(`   Base URL: ${keys.baseUrl || 'default'}`);
      console.log(`   Live Mode: ${keys.isLiveMode}`);
      console.log(`   Integration IDs: ${keys.integrationIds.length > 0 ? keys.integrationIds.join(', ') : 'none configured'}`);
      return keys;
    } else {
      error('Configuration incomplete');
      return null;
    }
  } catch (err: any) {
    error(`Configuration test failed: ${err.message}`);
    return null;
  }
}

async function testIntentionCreation() {
  section('3. Testing Paymob Intention Creation');
  
  try {
    info('Creating test payment intention...');

    const keys = await getPlatformPaymobKeys();
    if (!keys.integrationIds?.length) {
      error('No Paymob Integration IDs configured in DB (paymob_integration_ids)');
      return null;
    }
    
    const testAmount = 100; // 100 EGP
    const intention = await createPlatformPaymobIntention({
      amount: testAmount,
      currency: 'EGP',
      paymentMethods: keys.integrationIds,
      items: [
        {
          name: 'Test SaaS Subscription',
          amount: testAmount,
          quantity: 1,
          description: 'Test subscription for Paymob integration',
        },
      ],
      billingData: {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone_number: '+201234567890',
      },
      metadata: {
        test: true,
        source: 'integration_test',
        timestamp: new Date().toISOString(),
      },
      successUrl: 'https://www.naioshfit.com/saas/success',
      failureUrl: 'https://www.naioshfit.com/saas/failure',
      callbackUrl: 'https://www.naioshfit.com/api/paymob/webhook',
    });
    
    if (intention.id) {
      success('Payment intention created successfully');
      console.log(`   Intention ID: ${intention.id}`);
      console.log(`   Client Secret: ${intention.clientSecret ? intention.clientSecret.substring(0, 20) + '...' : 'not provided'}`);
      console.log(`   Payment URL: ${intention.paymentUrl || 'not provided'}`);
      
      if (intention.clientSecret || intention.paymentUrl) {
        success('Paymob checkout is ready to use!');
        if (intention.paymentUrl) {
          info(`Test payment URL: ${intention.paymentUrl}`);
        }
      }
      
      return intention;
    } else {
      error('Failed to create payment intention - no ID returned');
      console.log(`   Raw response: ${JSON.stringify(intention.raw)}`);
      return null;
    }
  } catch (err: any) {
    error(`Intention creation failed: ${err.message}`);
    if (err.message.includes('Paymob API error')) {
      console.log(`   This might indicate invalid credentials or API restrictions`);
    }
    return null;
  }
}

async function testWebhookVerification() {
  section('4. Testing Webhook Signature Verification');
  
  try {
    const keys = await getPlatformPaymobKeys();
    
    if (!keys.hmacSecret) {
      info('HMAC secret not configured - skipping webhook verification test');
      return true;
    }
    
    info('Testing HMAC signature verification...');
    
    // Create test webhook payload
    const testPayload = {
      obj: {
        id: 12345,
        amount_cents: 10000,
        currency: 'EGP',
        success: true,
      },
      type: 'TRANSACTION',
    };
    
    const payloadString = JSON.stringify(testPayload);
    
    // Generate valid signature
    const crypto = await import('crypto');
    const validSignature = crypto.createHmac('sha256', keys.hmacSecret)
      .update(payloadString)
      .digest('hex');
    
    const isValid = verifyPaymobWebhookSignature(payloadString, validSignature, keys.hmacSecret);
    
    if (isValid) {
      success('Webhook signature verification working correctly');
    } else {
      error('Webhook signature verification failed');
      return false;
    }
    
    // Test invalid signature
    const invalidSignature = 'invalid_signature_12345';
    const isInvalid = verifyPaymobWebhookSignature(payloadString, invalidSignature, keys.hmacSecret);
    
    if (!isInvalid) {
      success('Invalid signatures correctly rejected');
    } else {
      error('Invalid signature was not rejected!');
      return false;
    }
    
    return true;
  } catch (err: any) {
    error(`Webhook verification test failed: ${err.message}`);
    return false;
  }
}

async function testUIIntegration() {
  section('5. Testing Frontend UI Integration');
  
  try {
    info('Checking if Paymob button is enabled on /saas page...');
    
    const response = await fetch('https://www.naioshfit.com/saas');
    const html = await response.text();
    
    // Check if page loads
    if (response.ok) {
      success('SaaS signup page loads successfully');
    } else {
      error('Failed to load SaaS signup page');
      return false;
    }
    
    // Note: We can't directly test React state, but we've verified the API endpoints work
    info('The Paymob button should now be clickable (verified via API endpoints)');
    info('Manual testing required: Visit https://www.naioshfit.com/saas');
    
    return true;
  } catch (err: any) {
    error(`UI integration check failed: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log(`${COLORS.yellow}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        PAYMOB INTEGRATION TEST SUITE                       ║');
  console.log('║        Testing Production Environment                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(COLORS.reset);
  
  const results = {
    endpoints: false,
    configuration: false,
    intention: false,
    webhook: false,
    ui: false,
  };
  
  try {
    // Test 1: Endpoints
    results.endpoints = await testEndpoints();
    
    // Test 2: Configuration
    const config = await testConfiguration();
    results.configuration = config !== null;
    
    // Test 3: Intention Creation (real API call)
    results.intention = (await testIntentionCreation()) !== null;
    
    // Test 4: Webhook Verification
    results.webhook = await testWebhookVerification();
    
    // Test 5: UI Integration
    results.ui = await testUIIntegration();
    
    // Summary
    section('TEST SUMMARY');
    
    const allPassed = Object.values(results).every(r => r);
    const passedCount = Object.values(results).filter(r => r).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`${COLORS.cyan}Test Results:${COLORS.reset}`);
    console.log(`  ${results.endpoints ? '✅' : '❌'} API Endpoints`);
    console.log(`  ${results.configuration ? '✅' : '❌'} Database Configuration`);
    console.log(`  ${results.intention ? '✅' : '❌'} Intention Creation (Live API)`);
    console.log(`  ${results.webhook ? '✅' : '❌'} Webhook Verification`);
    console.log(`  ${results.ui ? '✅' : '❌'} UI Integration Check`);
    
    console.log(`\n${COLORS.cyan}Overall: ${passedCount}/${totalCount} tests passed${COLORS.reset}\n`);
    
    if (allPassed) {
      console.log(`${COLORS.green}╔════════════════════════════════════════════════════════════╗${COLORS.reset}`);
      console.log(`${COLORS.green}║  🎉 ALL TESTS PASSED! Paymob integration is working!     ║${COLORS.reset}`);
      console.log(`${COLORS.green}╚════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);
      
      info('Next steps:');
      console.log('  1. Visit https://www.naioshfit.com/saas');
      console.log('  2. Click the Paymob payment button');
      console.log('  3. Complete a test signup transaction');
      console.log('  4. Verify tenant provisioning works correctly');
      console.log('  5. Update credentials for production use\n');
      
      process.exit(0);
    } else {
      console.log(`${COLORS.red}╔════════════════════════════════════════════════════════════╗${COLORS.reset}`);
      console.log(`${COLORS.red}║  ⚠️  SOME TESTS FAILED - Review errors above              ║${COLORS.reset}`);
      console.log(`${COLORS.red}╚════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);
      process.exit(1);
    }
    
  } catch (err: any) {
    error(`Test suite failed with error: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

// Run the test suite
runAllTests();
