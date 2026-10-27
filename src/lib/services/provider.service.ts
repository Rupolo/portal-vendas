/**
 * Marketplace Providers Service
 * ============================
 *
 * This service bridges the app with the real Prisma schema currently in the repo.
 * It stores marketplace credentials in the MarketplaceAuth/MarketplaceConfig tables
 * and exposes a safe abstraction for authentication and sync setup.
 */

import { prisma } from '../prisma';
import { encryptData, decryptData } from './encryption';
import type { MarketplaceType } from '../types/marketplace.types';

export interface Provider {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: unknown;
  isActive: boolean;
  isAvailable: boolean;
  categories: string[];
  responseTimeMinutes?: number;
  successRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderProduct {
  id: string;
  providerId: string;
  productId: string;
  providerSku: string;
  name: string;
  price: number;
  availableQuantity: number;
  syncStatus: 'pending' | 'synced' | 'failed';
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderCredential {
  id: string;
  providerId: string;
  apiKey: string;
  secret?: string;
  endpointUrl: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceProviderConfig {
  vendorId: string;
  marketplace: MarketplaceType;
  isActive: boolean;
  autoSync: boolean;
  syncFrequency: number;
  conflictStrategy: 'latest' | 'local-priority' | 'remote-priority' | 'inventory-min';
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceProviderCredential {
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

export class ProviderService {
  async saveMarketplaceCredentials(
    vendorId: string,
    marketplace: MarketplaceType,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    tokenType = 'Bearer',
    scope: string[] = [],
  ): Promise<MarketplaceProviderCredential> {
    if (!vendorId || !marketplace || !accessToken) {
      throw new Error('vendorId, marketplace and accessToken are required');
    }

    const encryptedAccess = encryptData(accessToken);
    const encryptedRefresh = refreshToken ? encryptData(refreshToken) : null;

    const record = await prisma.marketplaceAuth.upsert({
      where: {
        vendorId_marketplace: { vendorId, marketplace },
      },
      update: {
        encryptedAccessToken: encryptedAccess.encrypted,
        encryptedRefreshToken: encryptedRefresh?.encrypted ?? null,
        accessTokenIv: encryptedAccess.iv,
        accessTokenSalt: encryptedAccess.salt,
        accessTokenAuthTag: encryptedAccess.authTag,
        refreshTokenIv: encryptedRefresh?.iv ?? null,
        refreshTokenSalt: encryptedRefresh?.salt ?? null,
        refreshTokenAuthTag: encryptedRefresh?.authTag ?? null,
        expiresAt: expiresAt ?? null,
        tokenType,
        scope: scope as any,
        isValid: true,
      },
      create: {
        vendorId,
        marketplace,
        encryptedAccessToken: encryptedAccess.encrypted,
        encryptedRefreshToken: encryptedRefresh?.encrypted ?? null,
        accessTokenIv: encryptedAccess.iv,
        accessTokenSalt: encryptedAccess.salt,
        accessTokenAuthTag: encryptedAccess.authTag,
        refreshTokenIv: encryptedRefresh?.iv ?? null,
        refreshTokenSalt: encryptedRefresh?.salt ?? null,
        refreshTokenAuthTag: encryptedRefresh?.authTag ?? null,
        expiresAt: expiresAt ?? null,
        tokenType,
        scope: scope as any,
        isValid: true,
      },
    });

    await prisma.marketplaceConfig.upsert({
      where: {
        vendorId_marketplace: { vendorId, marketplace },
      },
      update: {
        isActive: true,
        autoSync: true,
      },
      create: {
        vendorId,
        marketplace,
        isActive: true,
        autoSync: true,
        syncFrequency: 300000,
        conflictStrategy: 'latest',
        maxRetries: 5,
      },
    });

    return {
      vendorId: record.vendorId,
      marketplace: record.marketplace as MarketplaceType,
      accessToken: decryptData(
        record.encryptedAccessToken,
        record.accessTokenIv,
        record.accessTokenSalt,
        record.accessTokenAuthTag,
      ),
      refreshToken:
        record.encryptedRefreshToken &&
        record.refreshTokenIv &&
        record.refreshTokenSalt &&
        record.refreshTokenAuthTag
          ? decryptData(
              record.encryptedRefreshToken,
              record.refreshTokenIv,
              record.refreshTokenSalt,
              record.refreshTokenAuthTag,
            )
          : undefined,
      expiresAt: record.expiresAt ?? undefined,
      tokenType: record.tokenType,
      scope: Array.isArray(record.scope) ? (record.scope as string[]) : [],
      isValid: record.isValid,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async getMarketplaceCredentials(
    vendorId: string,
    marketplace: MarketplaceType,
  ): Promise<MarketplaceProviderCredential | null> {
    const record = await prisma.marketplaceAuth.findUnique({
      where: {
        vendorId_marketplace: { vendorId, marketplace },
      },
    });

    if (!record) {
      return null;
    }

    return {
      vendorId: record.vendorId,
      marketplace: record.marketplace as MarketplaceType,
      accessToken: decryptData(
        record.encryptedAccessToken,
        record.accessTokenIv,
        record.accessTokenSalt,
        record.accessTokenAuthTag,
      ),
      refreshToken:
        record.encryptedRefreshToken &&
        record.refreshTokenIv &&
        record.refreshTokenSalt &&
        record.refreshTokenAuthTag
          ? decryptData(
              record.encryptedRefreshToken,
              record.refreshTokenIv,
              record.refreshTokenSalt,
              record.refreshTokenAuthTag,
            )
          : undefined,
      expiresAt: record.expiresAt ?? undefined,
      tokenType: record.tokenType,
      scope: Array.isArray(record.scope) ? (record.scope as string[]) : [],
      isValid: record.isValid,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async getMarketplaceConfig(
    vendorId: string,
    marketplace: MarketplaceType,
  ): Promise<MarketplaceProviderConfig | null> {
    const record = await prisma.marketplaceConfig.findUnique({
      where: {
        vendorId_marketplace: { vendorId, marketplace },
      },
    });

    if (!record) {
      return null;
    }

    return {
      vendorId: record.vendorId,
      marketplace: record.marketplace as MarketplaceType,
      isActive: record.isActive,
      autoSync: record.autoSync,
      syncFrequency: record.syncFrequency,
      conflictStrategy: record.conflictStrategy as MarketplaceProviderConfig['conflictStrategy'],
      maxRetries: record.maxRetries,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async getProviderCredentials(providerId: string): Promise<ProviderCredential | null> {
    const record = await prisma.providerCredential.findUnique({
      where: { providerId },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      providerId: record.providerId,
      apiKey: decryptData(
        record.encryptedApiKey,
        record.apiKeyIv,
        record.apiKeySalt,
        record.apiKeyAuthTag,
      ),
      secret:
        record.encryptedSecret && record.secretIv && record.secretSalt && record.secretAuthTag
          ? decryptData(
              record.encryptedSecret,
              record.secretIv,
              record.secretSalt,
              record.secretAuthTag,
            )
          : undefined,
      endpointUrl: record.endpointUrl,
      webhookUrl: record.webhookUrl ?? undefined,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async validateProviderAvailability(providerId: string): Promise<boolean> {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { isActive: true, isAvailable: true },
    });

    return Boolean(provider?.isActive && provider?.isAvailable);
  }

  async toggleAvailability(providerId: string, isAvailable: boolean): Promise<boolean> {
    const provider = await prisma.provider.update({
      where: { id: providerId },
      data: { isAvailable },
    });

    return Boolean(provider.isAvailable);
  }

  async updateMarketplaceConfig(
    vendorId: string,
    marketplace: MarketplaceType,
    updates: Partial<Omit<MarketplaceProviderConfig, 'vendorId' | 'marketplace' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MarketplaceProviderConfig> {
    const record = await prisma.marketplaceConfig.upsert({
      where: {
        vendorId_marketplace: { vendorId, marketplace },
      },
      update: {
        isActive: updates.isActive,
        autoSync: updates.autoSync,
        syncFrequency: updates.syncFrequency,
        conflictStrategy: updates.conflictStrategy,
        maxRetries: updates.maxRetries,
      },
      create: {
        vendorId,
        marketplace,
        isActive: updates.isActive ?? true,
        autoSync: updates.autoSync ?? true,
        syncFrequency: updates.syncFrequency ?? 300000,
        conflictStrategy: updates.conflictStrategy ?? 'latest',
        maxRetries: updates.maxRetries ?? 5,
      },
    });

    return {
      vendorId: record.vendorId,
      marketplace: record.marketplace as MarketplaceType,
      isActive: record.isActive,
      autoSync: record.autoSync,
      syncFrequency: record.syncFrequency,
      conflictStrategy: record.conflictStrategy as MarketplaceProviderConfig['conflictStrategy'],
      maxRetries: record.maxRetries,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async deleteMarketplaceCredentials(vendorId: string, marketplace: MarketplaceType): Promise<void> {
    await prisma.marketplaceAuth.deleteMany({
      where: {
        vendorId,
        marketplace,
      },
    });
  }
}

export const providerService = new ProviderService();
export default providerService;
