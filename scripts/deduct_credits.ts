#!/usr/bin/env tsx
/**
 * Daily Credit Deduction Script
 * 
 * TESTING MODE: Deducts 3.3 credits every 5 minutes for testing
 * PRODUCTION: Should deduct every 24 hours
 * 
 * This script deducts 3.3 credits from users with a credit balance >= 0.1
 * This implements a subscription-based credit system where 100 credits depletes in ~30 days.
 * 
 * Run manually: npm run deduct-credits
 * Run with cron: Set up a cron job to run this daily at midnight
 * 
 * Calculation: 100 credits / 3.3 per day ≈ 30.3 days
 */

import { db } from '../server/db';
import { creditBalances } from '../shared/schema';
import { gte, sql } from 'drizzle-orm';

const DAILY_DEDUCTION = 3.3;
const MIN_BALANCE = 0.1;

async function deductDailyCredits() {
  console.log('🔄 Starting daily credit deduction process...');
  console.log(`ℹ️  Deduction amount: ${DAILY_DEDUCTION} credits per day`);
  console.log(`ℹ️  Minimum balance threshold: ${MIN_BALANCE} credits`);
  
  try {
    const now = new Date();
    // TESTING MODE: 5 minutes instead of 24 hours
    // Production: const timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const timeThreshold = new Date(now.getTime() - 5 * 60 * 1000);

    // Find all users who:
    // 1. Have balance >= 0.1
    // 2. Haven't been deducted in the last 5 minutes (TESTING) / 24 hours (PRODUCTION)
    const usersToDeduct = await db
      .select()
      .from(creditBalances)
      .where(gte(creditBalances.totalCredits, MIN_BALANCE));

    console.log(`📊 Found ${usersToDeduct.length} users with balance >= ${MIN_BALANCE}`);

    let deducted = 0;
    let skipped = 0;
    let depleted = 0;

    for (const user of usersToDeduct) {
      // Check if 5 minutes (TESTING) / 24 hours (PRODUCTION) have passed since last deduction
      if (user.lastDeductionDate) {
        const lastDeduction = new Date(user.lastDeductionDate);
        if (lastDeduction > timeThreshold) {
          console.log(`⏭️  Skipping user ${user.userId}: Last deduction was less than 5 minutes ago`);
          skipped++;
          continue;
        }
      }

      // Calculate new balance
      const newBalance = Math.max(0, user.totalCredits - DAILY_DEDUCTION);
      
      // Update the user's credit balance
      await db
        .update(creditBalances)
        .set({
          totalCredits: newBalance,
          lastDeductionDate: now,
          updatedAt: now,
        })
        .where(sql`user_id = ${user.userId}`);

      if (newBalance === 0) {
        console.log(`💳 User ${user.userId}: Deducted ${DAILY_DEDUCTION} credits (${user.totalCredits} → ${newBalance}) - DEPLETED`);
        depleted++;
      } else {
        console.log(`💳 User ${user.userId}: Deducted ${DAILY_DEDUCTION} credits (${user.totalCredits} → ${newBalance})`);
      }
      
      deducted++;
    }

    console.log('\n✅ Daily credit deduction completed');
    console.log(`📈 Summary:`);
    console.log(`   - Total users processed: ${usersToDeduct.length}`);
    console.log(`   - Credits deducted from: ${deducted} users`);
    console.log(`   - Skipped (already deducted today): ${skipped} users`);
    console.log(`   - Accounts depleted: ${depleted} users`);
    
    return {
      total: usersToDeduct.length,
      deducted,
      skipped,
      depleted,
    };
  } catch (error) {
    console.error('❌ Error during credit deduction:', error);
    throw error;
  }
}

export { deductDailyCredits };
