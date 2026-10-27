/**
 * Authentication Service
 * Manages secure storage and validation of marketplace tokens
 * Uses AES-256-GCM encryption for tokens at rest
 */

import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../prisma';
import type { MarketplaceType } from '../types/marketplace.types';
import { encryptData, decryptData, type EncryptedData } from '../services/encryption';
import { providerService } from './provider.service';

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
      if (!vendorId || !marketplace || !accessToken || accessToken.trim().length === 0) {
        throw new Error('Invalid access token');
      }

      await providerService.saveMarketplaceCredentials(
        vendorId,
        marketplace,
        accessToken,
        refreshToken,
        expiresAt,
        'Bearer',
        []
      );

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
      const credentials = await providerService.getMarketplaceCredentials(vendorId, marketplace);

      if (!credentials) {
        console.log(`[AuthService] No credentials found for ${vendorId}/${marketplace}`);
        return null;
      }

      return {
        vendorId: credentials.vendorId,
        marketplace: credentials.marketplace,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt,
        tokenType: credentials.tokenType,
        scope: credentials.scope,
        isValid: credentials.isValid,
        createdAt: credentials.createdAt,
        updatedAt: credentials.updatedAt,
      };
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
      if (!token || token.trim().length === 0) {
        return false;
      }

      const normalizedToken = token.trim();

      if (marketplace === 'mercadolivre') {
        const response = await fetch(`${config.marketplaces.mercadolivre.baseUrl}/users/me`, {
          headers: {
            Authorization: `Bearer ${normalizedToken}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return true;
        }

        if (response.status === 401 || response.status === 403) {
          return false;
        }

        return normalizedToken.length >= 20;
      }

      if (marketplace === 'shopee') {
        return normalizedToken.length >= 20;
      }

      return normalizedToken.length >= 10;
    } catch (error) {
      console.error(`[AuthService] Token validation error:`, error);
      return token.trim().length >= 10;
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
      if (!refreshToken || refreshToken.trim().length === 0) {
        return null;
      }

      const storedCredentials = await providerService.getMarketplaceCredentials(vendorId, marketplace);
      const activeRefreshToken = storedCredentials?.refreshToken ?? refreshToken;

      if (marketplace === 'mercadolivre') {
        const clientId = config.marketplaces.mercadolivre.clientId;
        const clientSecret = config.marketplaces.mercadolivre.clientSecret;

        if (!clientId || !clientSecret) {
          console.warn(`[AuthService] Mercado Livre OAuth not configured. Skipping refresh for ${vendorId}`);
          return storedCredentials?.accessToken
            ? { accessToken: storedCredentials.accessToken, expiresAt: storedCredentials.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000) }
            : null;
        }

        const response = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: activeRefreshToken,
          }),
        });

        if (!response.ok) {
          console.warn(`[AuthService] Refresh token rejected for ${vendorId}/${marketplace}`);
          return null;
        }

        const payload = await response.json() as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };

        if (!payload.access_token) {
          return null;
        }

        const expiresAt = new Date(Date.now() + Math.max(0, Number(payload.expires_in ?? 3600)) * 1000);

        await providerService.saveMarketplaceCredentials(
          vendorId,
          marketplace,
          payload.access_token,
          payload.refresh_token ?? activeRefreshToken,
          expiresAt,
          'Bearer',
          []
        );

        return {
          accessToken: payload.access_token,
          expiresAt,
        };
      }

      if (marketplace === 'shopee') {
        console.warn(`[AuthService] Shopee refresh flow is not configured for this environment.`);
      }

      return storedCredentials?.accessToken
        ? { accessToken: storedCredentials.accessToken, expiresAt: storedCredentials.expiresAt ?? new Date() }
        : null;
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
      if (!accessToken || accessToken.trim().length < 10) {
        return { isValid: false, error: 'Invalid token format' };
      }

      const isValid = await this.validateToken(accessToken, marketplace);

      if (!isValid) {
        return {
          isValid: false,
          error: `${marketplace} access token is invalid or rejected by the marketplace`,
        };
      }

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
      await providerService.deleteMarketplaceCredentials(vendorId, marketplace);
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
