/**
 * Property-Based Tests for Encryption (AES-256-GCM)
 * ==================================================
 * 
 * Validates:
 * - Round-trip encryption/decryption preserves original data
 * - AuthTag integrity validation detects tampering
 * - Encryption handles various input lengths correctly
 * 
 * Requirements covered:
 * - Tokens criptografados antes de armazenar
 * - Descriptografia segura
 * - Validação de integridade com authTag
 * - Teste de round-trip (encrypt/decrypt)
 */

import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, type EncryptedData } from '@/lib/services/encryption';
import * as fc from 'fast-check';

/**
 * Property: Round-trip encryption/decryption preserves original data
 * This is the most important property for encryption - data must be perfectly recoverable
 */
describe('Encryption - Round-trip Property', () => {
  it('should encrypt and decrypt any string preserving exact content', () => {
    fc.assert(
      fc.property(fc.string(), (originalData) => {
        // Encrypt
        const encrypted: EncryptedData = encryptData(originalData);
        
        // Decrypt
        const decrypted = decryptData(
          encrypted.encrypted,
          encrypted.iv,
          encrypted.salt,
          encrypted.authTag
        );
        
        // Verify exact match
        expect(decrypted).toBe(originalData);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty strings', () => {
    const originalData = '';
    const encrypted: EncryptedData = encryptData(originalData);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(originalData);
  });

  it('should handle very long strings', () => {
    const originalData = 'a'.repeat(10000); // 10KB string
    const encrypted: EncryptedData = encryptData(originalData);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(originalData);
  });

  it('should handle unicode and special characters', () => {
    const originalData = 'Hello 世界 🌍! @#$%^&*()_+-=[]{}|;:,.<>?';
    const encrypted: EncryptedData = encryptData(originalData);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(originalData);
  });

  it('should handle JSON strings', () => {
    const originalData = JSON.stringify({
      vendorId: 'vendor-123',
      accessToken: 'token-abc',
      marketplace: 'shopee',
      expiresAt: new Date().toISOString(),
    });
    
    const encrypted: EncryptedData = encryptData(originalData);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(originalData);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(originalData));
  });

  it('should handle authentication tokens (typical length)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 512 }),
        (tokenLength) => {
          // Generate a typical API token
          const originalData = Array.from({ length: tokenLength }, () => 
            'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
          ).flat().slice(0, tokenLength).join('');
          
          const encrypted: EncryptedData = encryptData(originalData);
          const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
          
          expect(decrypted).toBe(originalData);
          // Note: encrypted.length may be larger than original due to encryption overhead
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property: AuthTag integrity validation
 * Tampered data should be rejected during decryption
 */
describe('Encryption - Integrity Validation', () => {
  it('should reject data with modified encrypted content', () => {
    const originalData = 'sensitive-token-data';
    const encrypted: EncryptedData = encryptData(originalData);
    
    // Tamper with the encrypted content
    const tamperedEncrypted = encrypted.encrypted.substring(0, encrypted.encrypted.length - 4) + 'XXXX';
    
    expect(() => {
      decryptData(tamperedEncrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    }).toThrow(/Decryption failed/);
  });

  it('should reject data with modified IV', () => {
    const originalData = 'sensitive-token-data';
    const encrypted: EncryptedData = encryptData(originalData);
    
    // Tamper with IV (flip a bit)
    const tamperedIv = encrypted.iv.substring(0, encrypted.iv.length - 4) + 'ffff';
    
    expect(() => {
      decryptData(encrypted.encrypted, tamperedIv, encrypted.salt, encrypted.authTag);
    }).toThrow(/Decryption failed/);
  });

  it('should reject data with modified authTag', () => {
    const originalData = 'sensitive-token-data';
    const encrypted: EncryptedData = encryptData(originalData);
    
    // Tamper with authTag - modify all characters
    const tamperedAuthTag = '00000000000000000000000000000000';
    
    expect(() => {
      decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, tamperedAuthTag);
    }).toThrow(/Decryption failed/);
  });

  it('should reject data with modified salt', () => {
    const originalData = 'sensitive-token-data';
    const encrypted: EncryptedData = encryptData(originalData);
    
    // Tamper with salt
    const tamperedSalt = encrypted.salt.substring(0, encrypted.salt.length - 4) + 'XXXX';
    
    expect(() => {
      decryptData(encrypted.encrypted, encrypted.iv, tamperedSalt, encrypted.authTag);
    }).toThrow(/Decryption failed/);
  });
});

/**
 * Property: Different encryption operations produce different ciphertexts
 * Even for the same input, each encryption should be unique (with different IV/salt)
 */
describe('Encryption - Randomness', () => {
  it('should produce different ciphertexts for same input on each encryption', () => {
    const originalData = 'same-input-different-ciphertext';
    
    const encrypted1: EncryptedData = encryptData(originalData);
    const encrypted2: EncryptedData = encryptData(originalData);
    
    // Ciphertexts should be different due to random IV and salt
    expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.salt).not.toBe(encrypted2.salt);
    
    // But both should decrypt to the same value
    const decrypted1 = decryptData(encrypted1.encrypted, encrypted1.iv, encrypted1.salt, encrypted1.authTag);
    const decrypted2 = decryptData(encrypted2.encrypted, encrypted2.iv, encrypted2.salt, encrypted2.authTag);
    
    expect(decrypted1).toBe(originalData);
    expect(decrypted2).toBe(originalData);
    expect(decrypted1).toBe(decrypted2);
  });
});

/**
 * Property: Output format consistency
 * EncryptedData should have all required fields
 */
describe('Encryption - Output Format', () => {
  it('should produce EncryptedData with all required fields', () => {
    fc.assert(
      fc.property(fc.string(), (originalData) => {
        // Skip empty strings - they produce empty encrypted output
        if (originalData.length === 0) return true;
        
        const encrypted: EncryptedData = encryptData(originalData);
        
        // Verify all required fields exist and are non-empty
        expect(encrypted.encrypted).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.salt).toBeDefined();
        expect(encrypted.authTag).toBeDefined();
        
        // Verify fields are hex strings
        expect(encrypted.encrypted).toMatch(/^[0-9a-f]+$/);
        expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
        expect(encrypted.salt).toMatch(/^[0-9a-f]+$/);
        expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);
        
        // Verify field lengths match config
        expect(encrypted.iv.length).toBe(32); // 16 bytes * 2 (hex)
        expect(encrypted.salt.length).toBe(32); // 16 bytes * 2 (hex)
        expect(encrypted.authTag.length).toBe(32); // 16 bytes * 2 (hex)
      }),
      { numRuns: 50 }
    );
  });
});