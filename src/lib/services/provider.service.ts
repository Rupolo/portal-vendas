/**
 * Provider Service
 * =================
 * 
 * Manages providers (dropshipping suppliers) for Portal Vendas.
 * Provides CRUD operations, mapping between products and providers,
 * and validation of provider availability.
 * 
 * Features:
 * - CRUD operations for providers
 * - Product-provider mapping
 * - Provider credential management (encrypted)
 * - Availability validation
 * 
 * @see schema.prisma for database models
 * @see auth.service.ts for credential encryption
 */

import { PrismaClient } from '@/generated/prisma';
import { config } from '../config';
import { encryptData, decryptData } from '../encryption';
import type { MarketplaceType } from '../types/marketplace.types';

const prisma = new PrismaClient();

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type ProviderStatus = 'pending' | 'active' | 'inactive' | 'suspended';
export type ProductProviderStatus = 'pending' | 'synced' | 'failed';

export interface Provider {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  email: string;
  phone?: string;
  document?: string;
  address?: any;
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
  syncStatus: ProductProviderStatus;
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

export interface ProviderStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  successRate: number;
  avgResponseTime: number;
}

// ============================================================================
// PROVIDER SERVICE
// ============================================================================

export class ProviderService {
  /**
   * Get all providers for a vendor
   */
  async getProviders(vendorId: string, opts?: { isActive?: boolean }): Promise<Provider[]> {
    try {
      const where: any = { vendorId };
      if (opts?.isActive !== undefined) {
        where.isActive = opts.isActive;
      }

      const providers = await prisma.provider.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return providers as any;
    } catch (error) {
      console.error('[ProviderService] Error getting providers:', error);
      throw error;
    }
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: string): Promise<Provider | null> {
    try {
      const provider = await prisma.provider.findUnique({
        where: { id },
      });

      return provider as any;
    } catch (error) {
      console.error('[ProviderService] Error getting provider:', error);
      throw error;
    }
  }

  /**
   * Create a new provider
   */
  async createProvider(vendorId: string, data: Partial<Provider>): Promise<Provider> {
    try {
      const provider = await prisma.provider.create({
        data: {
          vendorId,
          name: data.name,
          description: data.description,
          email: data.email,
          phone: data.phone,
          document: data.document,
          address: data.address,
          isActive: data.isActive ?? true,
          isAvailable: data.isAvailable ?? false,
          categories: data.categories ?? [],
          responseTimeMinutes: data.responseTimeMinutes,
          successRate: data.successRate,
        },
      });

      console.log([ProviderService] Provider created: );
      return provider as any;
    } catch (error) {
      console.error('[ProviderService] Error creating provider:', error);
      throw error;
    }
  }

  /**
   * Update provider
   */
  async updateProvider(id: string, data: Partial<Provider>): Promise<Provider> {
    try {
      const provider = await prisma.provider.update({
        where: { id },
        data,
      });

      console.log([ProviderService] Provider updated: );
      return provider as any;
    } catch (error) {
      console.error('[ProviderService] Error updating provider:', error);
      throw error;
    }
  }

  /**
   * Delete provider (soft delete)
   */
  async deleteProvider(id: string): Promise<void> {
    try {
      await prisma.provider.update({
        where: { id },
        data: { isActive: false },
      });

      console.log([ProviderService] Provider deleted: );
    } catch (error) {
      console.error('[ProviderService] Error deleting provider:', error);
      throw error;
    }
  }

  /**
   * Toggle provider availability
   */
  async toggleAvailability(id: string, isAvailable: boolean): Promise<void> {
    try {
      await prisma.provider.update({
        where: { id },
        data: { isAvailable },
      });

      console.log([ProviderService] Provider  availability set to: );
    } catch (error) {
      console.error('[ProviderService] Error toggling availability:', error);
      throw error;
    }
  }

  /**
   * Validate provider availability
   */
  async validateProviderAvailability(providerId: string): Promise<boolean> {
    try {
      const provider = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { isActive: true, isAvailable: true },
      });

      return provider?.isActive === true && provider.isAvailable === true;
    } catch (error) {
      console.error('[ProviderService] Error validating provider:', error);
      return false;
    }
  }

  /**
   * Get provider by product ID
   */
  async getProviderByProduct(productId: string): Promise<Provider | null> {
    try {
      const providerProduct = await prisma.providerProduct.findFirst({
        where: { productId },
        include: { provider: true },
      });

      return providerProduct?.provider ?? null;
    } catch (error) {
      console.error('[ProviderService] Error getting provider by product:', error);
      throw error;
    }
  }

  /**
   * Assign product to provider
   */
  async assignProductToProvider(
    productId: string,
    providerId: string,
    providerSku: string,
    name: string,
    price: number,
    availableQuantity: number = 0
  ): Promise<ProviderProduct> {
    try {
      const providerProduct = await prisma.providerProduct.upsert({
        where: {
          providerId_productId: { providerId, productId },
        },
        update: {
          providerSku,
          name,
          price,
          availableQuantity,
          syncStatus: 'pending',
        },
        create: {
          providerId,
          productId,
          providerSku,
          name,
          price,
          availableQuantity,
          syncStatus: 'pending',
        },
        include: { provider: true, product: true },
      });

      console.log([ProviderService] Product assigned to provider:  -> );
      return providerProduct as any;
    } catch (error) {
      console.error('[ProviderService] Error assigning product to provider:', error);
      throw error;
    }
  }

  /**
   * Update provider product
   */
  async updateProviderProduct(
    providerId: string,
    productId: string,
    data: Partial<ProviderProduct>
  ): Promise<ProviderProduct> {
    try {
      const providerProduct = await prisma.providerProduct.update({
        where: { providerId_productId: { providerId, productId } },
        data,
      });

      return providerProduct as any;
    } catch (error) {
      console.error('[ProviderService] Error updating provider product:', error);
      throw error;
    }
  }

  /**
   * Sync provider products status
   */
  async syncProviderProductsStatus(
    providerId: string,
    products: Array<{ productId: string; providerSku: string; syncStatus: ProductProviderStatus }>
  ): Promise<void> {
    try {
      for (const product of products) {
        await prisma.providerProduct.update({
          where: { providerId_productId: { providerId, productId: product.productId } },
          data: {
            providerSku: product.providerSku,
            syncStatus: product.syncStatus,
            lastSyncedAt: new Date(),
          },
        });
      }
      console.log([ProviderService] Synced  provider products);
    } catch (error) {
      console.error('[ProviderService] Error syncing provider products:', error);
      throw error;
    }
  }

  /**
   * Get provider stats
   */
  async getProviderStats(providerId: string): Promise<ProviderStats> {
    try {
      const [products, orders] = await Promise.all([
        prisma.providerProduct.count({
          where: { providerId },
        }),
        prisma.orderProviderAssignment.count({
          where: { providerId, status: { not: 'pending' } },
        }),
      ]);

      const successfulOrders = await prisma.orderProviderAssignment.count({
        where: { providerId, status: 'delivered' },
      });

      const successRate = orders > 0 ? (successfulOrders / orders) * 100 : 100;

      return {
        totalProducts: products,
        activeProducts: products, // TODO: Implement active count
        totalOrders: orders,
        successRate,
        avgResponseTime: 30, // TODO: Calculate from actual data
      };
    } catch (error) {
      console.error('[ProviderService] Error getting provider stats:', error);
      throw error;
    }
  }

  /**
   * Store provider credentials (encrypted)
   */
  async storeProviderCredentials(
    providerId: string,
    apiKey: string,
    secret?: string,
    endpointUrl: string = '',
    webhookUrl?: string
  ): Promise<void> {
    try {
      // Encrypt credentials
      const encryptedApiKey = encryptData(apiKey);
      const encryptedSecret = secret ? encryptData(secret) : undefined;

      // Store credentials
      await prisma.providerCredential.upsert({
        where: { providerId },
        update: {
          encryptedApiKey,
          apiKeyIv: encryptedApiKey.iv,
          apiKeySalt: encryptedApiKey.salt,
          apiKeyAuthTag: encryptedApiKey.authTag,
          encryptedSecret: encryptedSecret?.encrypted,
          secretIv: encryptedSecret?.iv,
          secretSalt: encryptedSecret?.salt,
          secretAuthTag: encryptedSecret?.authTag,
          endpointUrl,
          webhookUrl,
          isActive: true,
        },
        create: {
          providerId,
          encryptedApiKey,
          apiKeyIv: encryptedApiKey.iv,
          apiKeySalt: encryptedApiKey.salt,
          apiKeyAuthTag: encryptedApiKey.authTag,
          encryptedSecret: encryptedSecret?.encrypted,
          secretIv: encryptedSecret?.iv,
          secretSalt: encryptedSecret?.salt,
          secretAuthTag: encryptedSecret?.authTag,
          endpointUrl,
          webhookUrl,
          isActive: true,
        },
      });

      console.log([ProviderService] Credentials stored for provider: );
    } catch (error) {
      console.error('[ProviderService] Error storing provider credentials:', error);
      throw error;
    }
  }

  /**
   * Get provider credentials (decrypted)
   */
  async getProviderCredentials(providerId: string): Promise<ProviderCredential | null> {
    try {
      const credential = await prisma.providerCredential.findUnique({
        where: { providerId },
      });

      if (!credential) return null;

      return {
        id: credential.id,
        providerId: credential.providerId,
        apiKey: decryptData(credential.encryptedApiKey, credential.apiKeyIv, credential.apiKeySalt, credential.apiKeyAuthTag),
        secret: credential.encryptedSecret ? decryptData(credential.encryptedSecret, credential.secretIv || '', credential.secretSalt || '', credential.secretAuthTag || '') : undefined,
        endpointUrl: credential.endpointUrl,
        webhookUrl: credential.webhookUrl,
        isActive: credential.isActive,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      };
    } catch (error) {
      console.error('[ProviderService] Error getting provider credentials:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const providerService = new ProviderService();
export default providerService;
