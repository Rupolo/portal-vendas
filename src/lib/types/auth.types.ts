/**
 * Tipos relacionados a Autenticação e Autorização
 */

import type { Marketplace } from './marketplace.types';

export interface MarketplaceAuthToken {
  id: string;
  vendorId: string;
  marketplace: Marketplace;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string[];
  encryptedAt: Date;
  isExpired: boolean;
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

export interface MarketplaceCredentialValidation {
  marketplace: Marketplace;
  isValid: boolean;
  canConnect: boolean;
  error?: string;
  warnings?: string[];
  expiresAt?: Date;
}

export interface RefreshTokenJob {
  vendorId: string;
  marketplace: Marketplace;
  tokenId: string;
  refreshToken: string;
  currentAccessToken: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newAccessToken?: string;
  newRefreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface AuthorizationContext {
  vendorId: string;
  marketplaces: Marketplace[];
  permissions: string[];
  createdAt: Date;
  expiresAt: Date;
}
