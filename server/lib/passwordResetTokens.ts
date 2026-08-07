import type { Pool } from 'pg';
import { pool as centralPool, db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON password_reset_tokens(token_hash);
`;

export async function ensurePasswordResetTokensTable(pool?: Pool | null): Promise<void> {
  const targetPool = pool || centralPool;
  await targetPool.query(ENSURE_TABLE_SQL);
}

export async function storePasswordResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
  pool?: Pool | null,
): Promise<void> {
  await ensurePasswordResetTokensTable(pool);

  if (pool) {
    await pool.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
    return;
  }

  await db
    .delete(schema.passwordResetTokens)
    .where(eq(schema.passwordResetTokens.userId, userId));
  await db.insert(schema.passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });
}
