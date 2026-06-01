/**
 * Token Cleanup Utility
 * Removes expired and used password reset tokens from the database
 */

import { db } from '../db';
import { sql, lt } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { Pool } from 'pg';

/**
 * Clean up expired or used tokens older than the specified hours
 * @param hoursOld - Remove tokens that expired or were used this many hours ago (default: 24)
 * @returns Number of tokens deleted
 */
export async function cleanupExpiredTokens(hoursOld: number = 24): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    
    console.log('[TOKEN-CLEANUP] Starting cleanup of tokens older than:', cutoffDate);
    
    // Delete tokens that are either:
    // 1. Expired and older than cutoff date
    // 2. Used and older than cutoff date
    const result = await db
      .delete(schema.passwordResetTokens)
      .where(
        sql`(expires_at < ${cutoffDate} OR (used_at IS NOT NULL AND used_at < ${cutoffDate}))`
      );
    
    const deletedCount = result.rowCount || 0;
    console.log('[TOKEN-CLEANUP] Deleted', deletedCount, 'expired/used tokens from central database');
    
    return deletedCount;
  } catch (error) {
    console.error('[TOKEN-CLEANUP] Error cleaning up tokens:', error);
    return 0;
  }
}

/**
 * Clean up expired tokens from a tenant database
 * @param tenantPool - PostgreSQL connection pool for the tenant database
 * @param hoursOld - Remove tokens that expired or were used this many hours ago (default: 24)
 * @returns Number of tokens deleted
 */
export async function cleanupTenantExpiredTokens(
  tenantPool: Pool,
  hoursOld: number = 24
): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    
    console.log('[TOKEN-CLEANUP] Starting tenant cleanup of tokens older than:', cutoffDate);
    
    const result = await tenantPool.query(
      `DELETE FROM password_reset_tokens 
       WHERE expires_at < $1 OR (used_at IS NOT NULL AND used_at < $1)`,
      [cutoffDate]
    );
    
    const deletedCount = result.rowCount || 0;
    console.log('[TOKEN-CLEANUP] Deleted', deletedCount, 'expired/used tokens from tenant database');
    
    return deletedCount;
  } catch (error) {
    console.error('[TOKEN-CLEANUP] Error cleaning up tenant tokens:', error);
    return 0;
  }
}

/**
 * Run cleanup on startup - removes tokens older than 24 hours
 * This should be called when the server starts
 */
export async function runStartupCleanup(): Promise<void> {
  console.log('[TOKEN-CLEANUP] Running startup token cleanup...');
  await cleanupExpiredTokens(24);
  console.log('[TOKEN-CLEANUP] Startup cleanup complete');
}

/**
 * Schedule periodic cleanup (runs cleanup every N hours)
 * @param intervalHours - How often to run cleanup (default: 6 hours)
 * @param deleteOlderThan - Delete tokens older than this many hours (default: 24)
 */
export function schedulePeriodicCleanup(
  intervalHours: number = 6,
  deleteOlderThan: number = 24
): NodeJS.Timeout {
  console.log(`[TOKEN-CLEANUP] Scheduling periodic cleanup every ${intervalHours} hours`);
  
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  return setInterval(async () => {
    console.log('[TOKEN-CLEANUP] Running scheduled cleanup...');
    await cleanupExpiredTokens(deleteOlderThan);
  }, intervalMs);
}
