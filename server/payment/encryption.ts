/**
 * Encryption Service for Payment Keys
 * 
 * Uses AES-256-CBC encryption to securely store Stripe secret keys
 * in the database. The encryption key is stored in environment variable
 * TENANT_DB_ENCRYPTION_KEY.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const key = process.env.TENANT_DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TENANT_DB_ENCRYPTION_KEY environment variable not set');
  }
  // Create a 32-byte key from the provided string
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string (e.g., Stripe secret key) for database storage
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encryptKey(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Store IV with encrypted data for decryption
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a string (e.g., Stripe secret key) from database
 * @param encrypted - Encrypted string in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decryptKey(encrypted: string): string {
  if (!encrypted) {
    throw new Error('No encrypted data provided');
  }
  
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if a string is encrypted (has the expected format)
 * @param text - String to check
 * @returns true if the string appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  // Check if it has IV:data format where IV is 32 hex chars (16 bytes)
  return parts.length === 2 && parts[0].length === 32 && /^[0-9a-f]+$/i.test(parts[0]);
}
