#!/usr/bin/env tsx
/**
 * CLI script to manually run credit deduction
 * Usage: npm run deduct-credits
 */

import { deductDailyCredits } from './deduct_credits.js';

deductDailyCredits()
  .then((result) => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
