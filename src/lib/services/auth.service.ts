/**
 * Authentication Service
 * Manages secure storage and validation of marketplace tokens
 * Uses AES-256-GCM encryption for tokens at rest
 */

import crypto from 'crypto';
import { config } from '../config';
import type { MarketplaceType } from '../types/marketplace.types';
import { encryptData, decryptData, type EncryptedData } from '../services/encryption';

export interface MarketplaceCredentials {
  vendorId: string;
  marketplace: MarketplaceType;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string[];
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptedToken {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
  algorithm: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  expiresIn?: number; // seconds
  requiresRefresh: boolean;
  error?: string;
}

export class AuthService {
  private encryptionKey: Buffer;

  constructor(encryptionSecret?: string) {
    // Use environment secret or generate from process
    const secret = encryptionSecret || process.env.ENCRYPTION_SECRET || 'default-secret';
    // Derive a 256-bit key from the secret
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  /**
   * Encrypt a token using AES-256-GCM
   */
  private encryptToken(token: string): EncryptedToken {
    try {
      const iv = crypto.randomBytes(config.security.tokenIVLength);
      const salt = crypto.randomBytes(config.security.tokenSaltLength);

      const cipher = crypto.createCipheriv(
        config.security.tokenEncryptionAlgorithm as any,
        this.encryptionKey,
        iv
      );

      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = (cipher as any).getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
        algorithm: config.security.tokenEncryptionAlgorithm,
      };
    } catch (error) {
      throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decrypt a token using AES-256-GCM
   */
  private decryptToken(encryptedData: EncryptedToken): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      const decipher = crypto.createDecipheriv(
        encryptedData.algorithm as any,
        this.encryptionKey,
        iv
      );

      (decipher as any).setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store marketplace credentials securely
   */
  async storeMarketplaceCredentials(
    vendorId: string,
    marketplace: MarketplaceType,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      // Validate token before storing
      if (!accessToken || accessToken.length === 0) {
        throw new Error('Invalid access token');
      }

      // Encrypt tokens using the service-level encryption
      const encryptedAccessToken = encryptData(accessToken);
      const encryptedRefreshToken = refreshToken ? encryptData(refreshToken) : null;

      // TODO: Store in database via Prisma
      // This is a placeholder - actual storage would use database
      console.log(`[AuthService] Stored credentials for ${vendorId}/${marketplace}`);

      return;
    } catch (error) {
      throw new Error(
        `Failed to store credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retrieve and decrypt marketplace credentials
   */
  async retrieveAndDecrypt(
    vendorId: string,
    marketplace: MarketplaceType
  ): Promise<MarketplaceCredentials | null> {
    try {
      // TODO: Retrieve from database via Prisma
      // This is a placeholder - actual retrieval would use database
      console.log(`[AuthService] Retrieved credentials for ${vendorId}/${marketplace}`);

      return null;
    } catch (error) {
      throw new Error(
        `Failed to retrieve credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate if a token is still valid
   */
  async validateToken(token: string, marketplace: MarketplaceType): Promise<boolean> {
    try {
      if (!token || token.length === 0) {
        return false;
      }

      // TODO: Call marketplace API to validate token
      // For now, just check if it exists and is not empty
      return true;
    } catch (error) {
      console.error(`[AuthService] Token validation error:`, error);
      return false;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(expiresAt?: Date): boolean {
    if (!expiresAt) {
      return false;
    }

    return new Date() > expiresAt;
  }

  /**
   * Get time until token expiration
   */
  getTokenExpirationTime(expiresAt?: Date): number | null {
    if (!expiresAt) {
      return null;
    }

    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    return Math.max(0, diff);
  }

  /**
   * Check if token needs refresh (expires in less than 5 minutes)
   */
  shouldRefreshToken(expiresAt?: Date): boolean {
    const timeUntilExpiration = this.getTokenExpirationTime(expiresAt);

    if (timeUntilExpiration === null) {
      return false;
    }

    const fiveMinutesInMs = 5 * 60 * 1000;
    return timeUntilExpiration < fiveMinutesInMs;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    vendorId: string,
    marketplace: MarketplaceType,
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt: Date } | null> {
    try {
      // TODO: Call marketplace API to refresh token
      // This is a placeholder
      console.log(`[AuthService] Refreshing token for ${vendorId}/${marketplace}`);

      return null;
    } catch (error) {
      console.error(`[AuthService] Token refresh error:`, error);
      throw error;
    }
  }

  /**
   * Validate marketplace credentials before storing
   */
  async validateMarketplaceCredentials(
    marketplace: MarketplaceType,
    accessToken: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!accessToken || accessToken.length < 10) {
        return { isValid: false, error: 'Invalid token format' };
      }

      // TODO: Call marketplace API to validate
      // This is a placeholder
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Revoke marketplace credentials
   */
  async revokeMarketplaceCredentials(
    vendorId: string,
    marketplace: MarketplaceType
  ): Promise<void> {
    try {
      // TODO: Call marketplace API to revoke token
      // TODO: Delete from database

      console.log(`[AuthService] Revoked credentials for ${vendorId}/${marketplace}`);
    } catch (error) {
      throw new Error(
        `Failed to revoke credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get validation result for a token
   */
  validateTokenResult(credentials: MarketplaceCredentials): TokenValidationResult {
    const isExpired = this.isTokenExpired(credentials.expiresAt);
    const expiresIn = credentials.expiresAt
      ? Math.max(0, Math.floor((credentials.expiresAt.getTime() - new Date().getTime()) / 1000))
      : undefined;
    const requiresRefresh = this.shouldRefreshToken(credentials.expiresAt);

    return {
      isValid: credentials.isValid && !isExpired,
      isExpired,
      expiresIn,
      requiresRefresh,
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
