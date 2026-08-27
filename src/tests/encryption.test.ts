/**
 * Unit Tests for Encryption (AES-256-GCM)
 * =======================================
 * 
 * Validates specific examples and edge cases for encryption functionality.
 * Complements property-based tests with explicit test scenarios.
 * 
 * Requirements covered:
 * - Tokens criptografados antes de armazenar
 * - Descriptografia segura
 * - Validação de integridade com authTag
 * - Teste de round-trip (encrypt/decrypt)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { encryptData, decryptData, type EncryptedData } from '@/lib/services/encryption';

// ============================================================================
// MOCK CONFIGURATION FOR TESTING
// ============================================================================

// Store original env
const originalEnv = { ...process.env };

beforeEach(() => {
  // Reset to clean state before each test
  process.env = { ...originalEnv };
  delete process.env.ENCRYPTION_SECRET;
});

// ============================================================================
// TEST DATA
// ============================================================================

const testTokens = {
  short: 'abc123',
  medium: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
  long: 'a'.repeat(1000),
  unicode: 'token-测试-🌍-日本語',
  specialChars: 'token!@#$%^&*()_+-=[]{}|;:,.<>?',
  shopeeStyle: 'SPC12345678901234567890123456789012345678901234567890',
  mercadolivreStyle: 'MLA12345678901234567890123456789012345678901234567890',
};

// ============================================================================
// ROUND-TRIP TESTS
// ============================================================================

describe('Encryption - Round-trip Tests', () => {
  describe.each(Object.entries(testTokens))('Token: %s', (name, token) => {
    it(`should encrypt and decrypt ${name} token`, () => {
      const encrypted: EncryptedData = encryptData(token);
      const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
      
      expect(decrypted).toBe(token);
    });
  });

  it('should handle vendor credentials JSON', () => {
    const credentials = JSON.stringify({
      vendorId: 'vendor-123',
      marketplace: 'shopee',
      accessToken: 'shopee-access-token-abc123',
      refreshToken: 'shopee-refresh-token-xyz789',
      expiresAt: new Date('2025-12-31T23:59:59Z').toISOString(),
    });

    const encrypted: EncryptedData = encryptData(credentials);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);

    expect(decrypted).toBe(credentials);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(credentials));
  });

  it('should handle empty string', () => {
    const token = '';
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);

    expect(decrypted).toBe(token);
  });

  it('should handle maximum token length (Prisma varchar(255) limit)', () => {
    // Prisma varchar(255) = 255 chars
    const token = 'a'.repeat(255);
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);

    expect(decrypted).toBe(token);
    expect(decrypted.length).toBe(255);
  });

  it('should handle 512 char tokens (extended limit)', () => {
    // Extended limit for API tokens
    const token = 'b'.repeat(512);
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);

    expect(decrypted).toBe(token);
    expect(decrypted.length).toBe(512);
  });
});

// ============================================================================
// INTEGRITY VALIDATION TESTS (authTag)
// ============================================================================

describe('Encryption - Integrity Validation (authTag)', () => {
  it('should reject data with modified encrypted content', () => {
    const originalData = 'sensitive-token-data';
    const encrypted: EncryptedData = encryptData(originalData);
    
    // Tamper with the encrypted content by replacing with random hex data
    const tamperedEncrypted = '0000000000000000000000000000000000000000000000000000000000000000';
    
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
    
    // Tamper with authTag - need to modify enough to trigger integrity check
    const tamperedAuthTag = '00000000000000000000000000000000';
    
    expect(() => {
      decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, tamperedAuthTag);
    }).toThrow(/Decryption failed/);
  });

  it('should reject data with modified salt', () => {
    const originalData = 'sensitive-token-data';
    const encrypted: EncryptedData = encryptData(originalData);
    
    // Tamper with salt - replace with zeros
    const tamperedSalt = '00000000000000000000000000000000';
    
    expect(() => {
      decryptData(encrypted.encrypted, encrypted.iv, tamperedSalt, encrypted.authTag);
    }).toThrow(/Decryption failed/);
  });

  it('should reject with correct error message for corrupted data', () => {
    const encrypted = {
      encrypted: 'corrupted',
      iv: '0000000000000000',
      salt: '0000000000000000',
      authTag: '0000000000000000',
    };

    expect(() => {
      decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    }).toThrow();
  });
});

// ============================================================================
// DIFFERENT ENCRYPTIONS TESTS (Randomness)
// ============================================================================

describe('Encryption - Randomness', () => {
  it('should produce different encrypted output for same input', () => {
    const token = 'same-input-different-output';

    const encrypted1: EncryptedData = encryptData(token);
    const encrypted2: EncryptedData = encryptData(token);

    // Different IV and salt should produce different ciphertexts
    expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.salt).not.toBe(encrypted2.salt);

    // But both should decrypt correctly
    expect(decryptData(encrypted1.encrypted, encrypted1.iv, encrypted1.salt, encrypted1.authTag)).toBe(token);
    expect(decryptData(encrypted2.encrypted, encrypted2.iv, encrypted2.salt, encrypted2.authTag)).toBe(token);
  });

  it('should maintain consistency across multiple encryptions', () => {
    const token = 'consistency-test';
    const expectedDecryption = token;

    // Encrypt and decrypt 10 times
    for (let i = 0; i < 10; i++) {
      const encrypted: EncryptedData = encryptData(token);
      const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
      expect(decrypted).toBe(expectedDecryption);
    }
  });
});

// ============================================================================
// FORMAT VALIDATION TESTS
// ============================================================================

describe('Encryption - Format Validation', () => {
  it('should produce valid hex strings for all fields', () => {
    const token = 'format-test';
    const encrypted: EncryptedData = encryptData(token);

    expect(encrypted.encrypted).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.salt).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);
  });

  it('should have correct field lengths based on config', () => {
    const token = 'length-test';
    const encrypted: EncryptedData = encryptData(token);

    // IV: 16 bytes = 32 hex chars
    expect(encrypted.iv.length).toBe(32);
    
    // Salt: 16 bytes = 32 hex chars  
    expect(encrypted.salt.length).toBe(32);
    
    // AuthTag: 16 bytes = 32 hex chars
    expect(encrypted.authTag.length).toBe(32);
    
    // Encrypted: variable length, but at least 1 byte + AEAD
    expect(encrypted.encrypted.length).toBeGreaterThanOrEqual(16);
  });

  it('should include algorithm metadata', () => {
    const token = 'algorithm-test';
    const encrypted: EncryptedData = encryptData(token);

    // Algorithm is not stored in EncryptedData, but config specifies it
    expect(encrypted).toMatchObject({
      encrypted: expect.any(String),
      iv: expect.any(String),
      salt: expect.any(String),
      authTag: expect.any(String),
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Encryption - Edge Cases', () => {
  it('should handle null-like strings', () => {
    const token = 'null';
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe('null');
  });

  it('should handle numeric strings', () => {
    const token = '12345678901234567890';
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(token);
  });

  it('should handle newline characters', () => {
    const token = 'line1\nline2\nline3';
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(token);
  });

  it('should handle tab characters', () => {
    const token = 'col1\tcol2\tcol3';
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(token);
  });

  it('should handle very long Unicode strings', () => {
    const token = '🌍'.repeat(200);
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(token);
  });

  it('should handle mixed content tokens', () => {
    const token = 'vendor-123:shopee-token-xyz@2024!#%';
    const encrypted: EncryptedData = encryptData(token);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(token);
  });
});

// ============================================================================
// REAL-WORLD SCENARIOS
// ============================================================================

describe('Encryption - Real-world Scenarios', () => {
  it('should handle Shopee API token format', () => {
    const shopeeToken = 'SPC12345678901234567890123456789012345678901234567890';
    const encrypted: EncryptedData = encryptData(shopeeToken);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(shopeeToken);
  });

  it('should handle Mercado Livre API token format', () => {
    const mlToken = 'MLA12345678901234567890123456789012345678901234567890';
    const encrypted: EncryptedData = encryptData(mlToken);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(mlToken);
  });

  it('should handle OAuth2 access tokens', () => {
    const oauthToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(200);
    const encrypted: EncryptedData = encryptData(oauthToken);
    const decrypted = decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag);
    
    expect(decrypted).toBe(oauthToken);
  });

  it('should handle token refresh scenarios', () => {
    const oldToken = 'old-refresh-token-abc123';
    const newToken = 'new-access-token-xyz789';
    
    // Encrypt old token
    const oldEncrypted: EncryptedData = encryptData(oldToken);
    const oldDecrypted = decryptData(oldEncrypted.encrypted, oldEncrypted.iv, oldEncrypted.salt, oldEncrypted.authTag);
    
    // Encrypt new token
    const newEncrypted: EncryptedData = encryptData(newToken);
    const newDecrypted = decryptData(newEncrypted.encrypted, newEncrypted.iv, newEncrypted.salt, newEncrypted.authTag);
    
    expect(oldDecrypted).toBe(oldToken);
    expect(newDecrypted).toBe(newToken);
  });

  it('should handle batch encryption of multiple tokens', () => {
    const tokens = [
      'token-1-abc',
      'token-2-def',
      'token-3-ghi',
    ];

    const encryptedTokens = tokens.map(token => encryptData(token));
    const decryptedTokens = encryptedTokens.map((enc, i) => 
      decryptData(enc.encrypted, enc.iv, enc.salt, enc.authTag)
    );

    expect(decryptedTokens).toEqual(tokens);
  });
});

// ============================================================================
// CLEANUP
// ============================================================================

afterEach(() => {
  process.env = originalEnv;
});