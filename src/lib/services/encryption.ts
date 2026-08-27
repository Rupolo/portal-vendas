/**
 * Encryption Helper
 * =================
 * 
 * Provides encryption/decryption utilities for sensitive data.
 * Uses AES-256-GCM for secure data encryption.
 */

import crypto from 'crypto';
import { config } from '../config';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encryptData(data: string): EncryptedData {
  try {
    const iv = crypto.randomBytes(config.security.tokenIVLength);
    const salt = crypto.randomBytes(config.security.tokenSaltLength);

    // Derive key from encryption secret
    const key = crypto.scryptSync(config.security.encryptionSecret, salt, 32);

    const cipher = crypto.createCipheriv(config.security.tokenEncryptionAlgorithm as any, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as any).getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptData(
  encryptedData: string,
  iv: string,
  salt: string,
  authTag: string
): string {
  try {
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');
    const saltBuffer = Buffer.from(salt, 'hex');

    // Derive key from encryption secret
    const key = crypto.scryptSync(config.security.encryptionSecret, saltBuffer, 32);

    const decipher = crypto.createDecipheriv(
      config.security.tokenEncryptionAlgorithm as any,
      key,
      ivBuffer
    );

    (decipher as any).setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}