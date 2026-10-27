/**
 * Product Sync Service
 * ====================
 * 
 * Handles synchronization of products between Portal Vendas and marketplaces
 * (Shopee, Mercado Livre). Provides core sync functionality, mapping between
 * product formats, and queue integration for async processing.
 * 
 * Features:
 * - Single product sync to marketplaces
 * - Batch sync for 100+ products
 * - Product mapping for each marketplace format
 * - Marketplace product fetch by remote ID
 * - Queue-based async processing with BullMQ
 * - Structured logging with [ProductSyncService] prefix
 * - Retry logic with exponential backoff
 * - Change detection using hash comparison
 * - Database updates with remoteIds
 * 
 * @see config.ts for queue and marketplace configuration
 * @see queue.ts for BullMQ queue integration
 * @see cache.ts for Redis caching
 * @see provider.service.ts for provider integration
 * @see auth.service.ts for marketplace authentication
 * 
 * Requirements: 1, 7, 12
 * Effort: 3 hours
 */

import { PrismaClient } from '../../generated/prisma';
import { config } from '../config';
import { cacheProduct, getCachedProduct, invalidateCache } from '../cache';
import { getQueue, QUEUE_NAMES, addJob, addBulkJobs } from '../queue';
import type { Marketplace, MarketplaceProduct } from '../types/marketplace.types';
import type { PortalProduct } from '../types/product.types';
import type { Queue } from 'bullmq';

const prisma = new PrismaClient();

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SyncOptions {
  vendorId: string;
  marketplace: Marketplace;
  forceSync?: boolean; // Skip hash comparison
  notifyOnComplete?: boolean;
}

export interface SyncResult {
  success: boolean;
  marketplace: Marketplace;
  remoteId?: string;
  productId: string;
  operation: 'create' | 'update';
  duration: number;
  error?: string;
  warnings?: string[];
}

export interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  results: SyncResult[];
  errors: Array<{ productId: string; error: string }>;
}

export interface MarketplaceProductResponse {
  remoteId: string;
  marketplace: Marketplace;
  productId: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  marketplaceCategoryId: string;
  attributes: Record<string, string>;
  status: 'active' | 'inactive' | 'delisted';
  lastSyncedAt: Date;
  lastSyncedHash?: string;
}

// ============================================================================
// PRODUCT SYNC SERVICE
// ============================================================================

export class ProductSyncService {
  // ============================================================================
  // CORE SYNC METHODS
  // ============================================================================

  /**
   * Sync a single product to marketplaces
   * 
   * Creates or updates the product on the specified marketplace.
   * Uses hashing for change detection - only syncs if changed or forceSync=true.
   * 
   * @param product - Portal product to sync
   * @param marketplace - Target marketplace ('shopee' or 'mercadolivre')
   * @param options - Sync options (vendorId, forceSync, etc.)
   * @returns Sync result with success status and remote ID
   * 
   * @example
   * ```typescript
   * const result = await productSyncService.syncProductToMarketplaces(
   *   { id: 'prod_123', title: 'Product', price: 99.90, ... },
   *   'shopee',
   *   { vendorId: 'vendor_abc' }
   * );
   * 
   * if (result.success) {
   *   console.log(`Product synced with remote ID: ${result.remoteId}`);
   * }
   * ```
   */
  async syncProductToMarketplaces(
    product: PortalProduct,
    marketplace: Marketplace,
    options: SyncOptions
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const { vendorId, forceSync = false } = options;

    try {
      console.log(
        `[ProductSyncService] Syncing product ${product.id} to ${marketplace}...`
      );

      // Get cached marketplace product if exists
      const cached = await getCachedProduct(`${product.id}:${marketplace}`);
      
      // Check if product needs sync (change detection)
      const currentHash = this.calculateProductHash(product);
      
      if (cached && !forceSync) {
        const cachedHash = cached.lastSyncedHash;
        if (cachedHash === currentHash) {
          console.log(
            `[ProductSyncService] Product ${product.id} unchanged, skipping sync`
          );
          return {
            success: true,
            marketplace,
            remoteId: cached.remoteId,
            productId: product.id,
            operation: 'update',
            duration: Date.now() - startTime,
          };
        }
      }

      // Map product to marketplace format
      const mappedProduct = this.mapProductToMarketplace(product, marketplace);
      
      // Call marketplace API to sync product
      const syncResult = await this.callMarketplaceAPI(
        marketplace,
        'syncProduct',
        {
          vendorId,
          product: mappedProduct,
        }
      );

      // Update or create marketplace product record
      const marketplaceProduct = await this.updateMarketplaceProductRecord({
        remoteId: syncResult.remoteId,
        marketplace,
        vendorId,
        productId: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        images: product.images,
        categoryId: product.categoryId,
        marketplaceCategoryId: syncResult.categoryId || mappedProduct.categoryId,
        attributes: product.attributes,
        status: 'active',
        lastSyncedHash: currentHash,
      });

      // Cache the synced product
      await cacheProduct(`${product.id}:${marketplace}`, {
        ...marketplaceProduct,
        lastSyncedHash: currentHash,
      });

      const duration = Date.now() - startTime;
      console.log(
        `[ProductSyncService] ✓ Synced product ${product.id} to ${marketplace} ` +
        `(remoteId: ${marketplaceProduct.remoteId}, operation: ${syncResult.operation}, ${duration}ms)`
      );

      return {
        success: true,
        marketplace,
        remoteId: marketplaceProduct.remoteId,
        productId: product.id,
        operation: syncResult.operation,
        duration,
        warnings: syncResult.warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[ProductSyncService] ✗ Failed to sync product ${product.id} to ${marketplace}:`,
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        marketplace,
        productId: product.id,
        operation: 'create',
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Batch sync multiple products to marketplaces
   * 
   * Efficiently syncs 100+ products using queue-based async processing.
   * Groups products by marketplace and creates separate queue jobs.
   * 
   * @param products - Array of products to sync
   * @param marketplace - Target marketplace
   * @param options - Sync options
   * @returns Batch sync result with success/failure counts
   * 
   * @example
   * ```typescript
   * const products = [...]; // 100+ products
   * const result = await productSyncService.batchSyncProducts(
   *   products,
   *   'shopee',
   *   { vendorId: 'vendor_abc' }
   * );
   * 
   * console.log(`Synced ${result.success}/${result.total} products`);
   * if (result.failed > 0) {
   *   console.error('Failed:', result.errors);
   * }
   * ```
   */
  async batchSyncProducts(
    products: PortalProduct[],
    marketplace: Marketplace,
    options: SyncOptions
  ): Promise<BatchSyncResult> {
    const { vendorId, forceSync = false } = options;
    const total = products.length;
    const results: SyncResult[] = [];
    const errors: Array<{ productId: string; error: string }> = [];

    console.log(
      `[ProductSyncService] Starting batch sync for ${total} products to ${marketplace}...`
    );

    // Add all products to queue as bulk jobs
    try {
      const queue = getQueue(QUEUE_NAMES.PRODUCT_SYNC);
      
      const bulkJobs = products.map(product => ({
        name: 'batch-sync-product',
        data: {
          product,
          marketplace,
          vendorId,
          forceSync,
          syncType: 'batch' as const,
        },
        opts: {
          attempts: config.queues.productSync.defaultJobOptions.attempts,
          backoff: config.queues.productSync.defaultJobOptions.backoff,
        },
      }));

      const jobs = await queue.addBulk(bulkJobs);
      console.log(
        `[ProductSyncService] Added ${jobs.length} jobs to queue for batch sync`
      );

      // Process results (in a real implementation, you'd wait for jobs to complete)
      // For now, return placeholder results
      for (const product of products) {
        results.push({
          success: true,
          marketplace,
          productId: product.id,
          operation: 'create',
          duration: 0,
          remoteId: 'pending', // Will be updated when job completes
        });
      }

      return {
        total,
        success: total,
        failed: 0,
        results,
        errors,
      };
    } catch (error) {
      console.error(
        `[ProductSyncService] Failed to add batch sync jobs to queue:`,
        error instanceof Error ? error.message : String(error)
      );

      // Record failures
      for (const product of products) {
        errors.push({
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          success: false,
          marketplace,
          productId: product.id,
          operation: 'create',
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return {
        total,
        success: 0,
        failed: total,
        results,
        errors,
      };
    }
  }

  /**
   * Fetch a product from marketplace by remote ID
   * 
   * Retrieves product details from the specified marketplace using
   * the remote ID assigned during sync.
   * 
   * @param marketplace - Source marketplace
   * @param id - Remote ID from marketplace
   * @returns Marketplace product details or null if not found
   * 
   * @example
   * ```typescript
   * const product = await productSyncService.fetchMarketplaceProduct(
   *   'shopee',
   *   'shopee_prod_12345'
   * );
   * 
   * if (product) {
   *   console.log('Product:', product.title, product.price);
   * }
   * ```
   */
  async fetchMarketplaceProduct(
    marketplace: Marketplace,
    id: string
  ): Promise<MarketplaceProductResponse | null> {
    try {
      console.log(
        `[ProductSyncService] Fetching product ${id} from ${marketplace}...`
      );

      const result = await this.callMarketplaceAPI(
        marketplace,
        'fetchProduct',
        { remoteId: id }
      );

      if (!result) {
        console.log(
          `[ProductSyncService] Product ${id} not found on ${marketplace}`
        );
        return null;
      }

      // Parse and format response
      const marketplaceProduct: MarketplaceProductResponse = {
        remoteId: result.remoteId || id,
        marketplace,
        productId: result.productId || '',
        title: result.title || '',
        description: result.description || '',
        price: result.price || 0,
        originalPrice: result.originalPrice,
        images: result.images || [],
        categoryId: result.categoryId || '',
        marketplaceCategoryId: result.marketplaceCategoryId || '',
        attributes: result.attributes || {},
        status: result.status || 'active',
        lastSyncedAt: new Date(),
        lastSyncedHash: result.hash,
      };

      console.log(
        `[ProductSyncService] ✓ Fetched product ${id} from ${marketplace}`
      );

      return marketplaceProduct;
    } catch (error) {
      console.error(
        `[ProductSyncService] Failed to fetch product ${id} from ${marketplace}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Map product to marketplace-specific format
   * 
   * Transforms Portal Vendas product format to the specific format
   * required by each marketplace (Shopee or Mercado Livre).
   * 
   * @param product - Portal product to map
   * @param marketplace - Target marketplace
   * @returns Marketplace-specific product format
   * 
   * @example
   * ```typescript
   * const mapped = productSyncService.mapProductToMarketplace(
   *   { id: '1', title: 'Product', price: 99.90, ... },
   *   'shopee'
   * );
   * 
   * // Returns Shopee-specific format
   * console.log(mapped.shopeeTitle, mapped.shopeePrice);
   * ```
   */
  mapProductToMarketplace(
    product: PortalProduct,
    marketplace: Marketplace
  ): any {
    const baseProduct = {
      remoteId: '',
      vendorId: product.vendorId,
      productId: product.id,
      title: this.truncateProductTitle(product.title, marketplace),
      description: this.truncateProductDescription(product.description, marketplace),
      price: product.price,
      originalPrice: product.cost || undefined,
      images: product.images.slice(0, this.getMaxImageCount(marketplace)),
      categoryId: product.categoryId,
      marketplaceCategoryId: '', // Will be set by marketplace API or schema service
      attributes: this.mapAttributes(product.attributes, marketplace),
      status: product.isActive ? 'active' : 'inactive',
      lastSyncedAt: new Date(),
    };

    if (marketplace === 'shopee') {
      return this.mapToShopeeFormat(baseProduct, product);
    } else if (marketplace === 'mercadolivre') {
      return this.mapToMercadoLivreFormat(baseProduct, product);
    }

    return baseProduct;
  }

  // ============================================================================
  // MARKETPLACE-SPECIFIC MAPPING
  // ============================================================================

  /**
   * Map product to Shopee format
   */
  private mapToShopeeFormat(base: any, product: PortalProduct): any {
    return {
      ...base,
      shopeeTitle: base.title,
      shopeePrice: this.formatPrice(product.price, 'BRL'),
      shopeeOriginalPrice: product.cost ? this.formatPrice(product.cost, 'BRL') : undefined,
      shopeeStock: this.getShopeeQuantity(product),
      shopeeWeight: product.weight || 0.1,
      shopeeLength: product.dimensions?.length || 10,
      shopeeWidth: product.dimensions?.width || 10,
      shopeeHeight: product.dimensions?.height || 10,
      shopeeCategory: base.marketplaceCategoryId,
      shopeeAttributes: {
        brand: product.attributes['brand'] || '',
        model: product.attributes['model'] || '',
        color: product.attributes['color'] || '',
      },
      shopeeVariations: [],
      shopeePackageContent: product.attributes['packageContent'] || '',
      shopeeCampaignPrice: undefined, // Can be set for promotions
    };
  }

  /**
   * Map product to Mercado Livre format
   */
  private mapToMercadoLivreFormat(base: any, product: PortalProduct): any {
    return {
      ...base,
      mercadoLivreTitle: base.title,
      mercadoLivrePrice: product.price,
      mercadoLivreAvailableQuantity: this.getMercadoLivreQuantity(product),
      mercadoLivreCategory: base.marketplaceCategoryId,
      mercadoLivreAttributes: {
        brand: product.attributes['brand'] || '',
        model: product.attributes['model'] || '',
        color: product.attributes['color'] || '',
        condition: product.cost ? 'used' : 'new',
      },
      mercadoLivrePictures: product.images.map((url, index) => ({
        source: url,
        order: index + 1,
        skip: index > 0, // ML allows multiple images but we skip some
      })),
      mercadoLivreBuyers: 0,
      mercadoLivreSellerContact: '',
      mercadoLivreListingType: 'classified', // or 'fixed_price'
      mercadoLivreWarranty: product.attributes['warranty'] || '',
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate hash for product (for change detection)
   */
  private calculateProductHash(product: PortalProduct): string {
    const { id, vendorId, title, price, images, categoryId, attributes } = product;
    const hashContent = JSON.stringify({
      id,
      vendorId,
      title,
      price,
      images,
      categoryId,
      attributes,
    });
    return this.hashString(hashContent);
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update or create marketplace product record in database
   */
  private async updateMarketplaceProductRecord(data: Partial<MarketplaceProduct>): Promise<MarketplaceProduct> {
    const existing = await prisma.marketplaceProduct.findFirst({
      where: {
        productId: data.productId!,
        marketplace: data.marketplace!,
      },
    });

    if (existing) {
      const updated = await prisma.marketplaceProduct.update({
        where: { id: existing.id },
        data: {
          remoteId: data.remoteId!,
          title: data.title!,
          description: data.description!,
          price: data.price!,
          originalPrice: data.originalPrice,
          images: data.images!,
          categoryId: data.categoryId!,
          marketplaceCategoryId: data.marketplaceCategoryId!,
          attributes: data.attributes!,
          status: data.status!,
          lastSyncedAt: data.lastSyncedAt!,
          lastSyncedHash: data.lastSyncedHash,
        },
      });
      return updated as any;
    } else {
      const created = await prisma.marketplaceProduct.create({
        data: {
          remoteId: data.remoteId!,
          marketplace: data.marketplace!,
          vendorId: data.vendorId!,
          productId: data.productId!,
          title: data.title!,
          description: data.description!,
          price: data.price!,
          originalPrice: data.originalPrice,
          images: data.images!,
          categoryId: data.categoryId!,
          marketplaceCategoryId: data.marketplaceCategoryId!,
          attributes: data.attributes!,
          status: data.status!,
          lastSyncedAt: data.lastSyncedAt!,
          lastSyncedHash: data.lastSyncedHash,
        },
      });
      return created as any;
    }
  }

  /**
   * Call marketplace API
   * 
   * This is a placeholder that simulates API calls.
   * In production, this would call actual Shopee/Mercado Livre APIs.
   */
  private async callMarketplaceAPI(
    marketplace: Marketplace,
    operation: string,
    params: any
  ): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // TODO: Call actual marketplace API
    // This is a placeholder implementation

    if (marketplace === 'shopee') {
      return this.simulateShopeeAPI(operation, params);
    } else if (marketplace === 'mercadolivre') {
      return this.simulateMercadoLivreAPI(operation, params);
    }

    throw new Error(`Unsupported marketplace: ${marketplace}`);
  }

  /**
   * Simulate Shopee API response
   */
  private simulateShopeeAPI(operation: string, params: any): any {
    console.log(`[ProductSyncService] Simulating Shopee API: ${operation}`);

    switch (operation) {
      case 'syncProduct':
        return {
          remoteId: `shopee_prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          operation: params.product.remoteId ? 'update' : 'create',
          categoryId: params.product.shopeeCategory || '12345',
          warnings: [],
        };
      case 'fetchProduct':
        return {
          remoteId: params.remoteId,
          productId: params.remoteId.replace('shopee_prod_', ''),
          title: 'Simulated Product',
          description: 'This is a simulated product from Shopee API',
          price: 99.90,
          images: ['https://example.com/image.jpg'],
          categoryId: '12345',
          marketplaceCategoryId: 'cat_123',
          attributes: {},
          status: 'active',
        };
      default:
        throw new Error(`Unknown Shopee operation: ${operation}`);
    }
  }

  /**
   * Simulate Mercado Livre API response
   */
  private simulateMercadoLivreAPI(operation: string, params: any): any {
    console.log(`[ProductSyncService] Simulating Mercado Livre API: ${operation}`);

    switch (operation) {
      case 'syncProduct':
        return {
          remoteId: `MLB${Math.floor(Math.random() * 1000000000)}`,
          operation: params.product.remoteId ? 'update' : 'create',
          categoryId: params.product.mercadoLivreCategory || 'MLB1234',
          warnings: [],
        };
      case 'fetchProduct':
        return {
          remoteId: params.remoteId,
          productId: params.remoteId,
          title: 'Simulated Product ML',
          description: 'This is a simulated product from Mercado Livre API',
          price: 149.90,
          images: ['https://example.com/ml-image.jpg'],
          categoryId: 'MLB1234',
          marketplaceCategoryId: 'MLB5678',
          attributes: {},
          status: 'active',
        };
      default:
        throw new Error(`Unknown Mercado Livre operation: ${operation}`);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Truncate product title to marketplace limit
   */
  private truncateProductTitle(title: string, marketplace: Marketplace): string {
    const limits = {
      shopee: 120,
      mercadolivre: 60,
    };
    const limit = limits[marketplace as keyof typeof limits] || 100;
    return title.length > limit ? title.substring(0, limit - 3) + '...' : title;
  }

  /**
   * Truncate product description to marketplace limit
   */
  private truncateProductDescription(description: string, marketplace: Marketplace): string {
    const limits = {
      shopee: 5000,
      mercadolivre: 5000,
    };
    const limit = limits[marketplace as keyof typeof limits] || 5000;
    return description.length > limit ? description.substring(0, limit - 3) + '...' : description;
  }

  /**
   * Get max image count for marketplace
   */
  private getMaxImageCount(marketplace: Marketplace): number {
    const limits = {
      shopee: 9,
      mercadolivre: 5,
    };
    return limits[marketplace as keyof typeof limits] || 5;
  }

  /**
   * Map custom attributes to marketplace format
   */
  private mapAttributes(attributes: Record<string, string>, marketplace: Marketplace): Record<string, string> {
    const mapped: Record<string, string> = {};

    // Map common attributes
    if (attributes['brand']) mapped['brand'] = attributes['brand'];
    if (attributes['model']) mapped['model'] = attributes['model'];
    if (attributes['color']) mapped['color'] = attributes['color'];

    // Marketplace-specific mappings
    if (marketplace === 'shopee') {
      if (attributes['packageContent']) mapped['packageContent'] = attributes['packageContent'];
    } else if (marketplace === 'mercadolivre') {
      if (attributes['warranty']) mapped['warranty'] = attributes['warranty'];
      if (attributes['condition']) mapped['condition'] = attributes['condition'];
    }

    return mapped;
  }

  /**
   * Get Shopee stock quantity
   */
  private getShopeeQuantity(product: PortalProduct): number {
    // TODO: Implement actual inventory lookup
    // This should check inventory service for actual stock
    return 100;
  }

  /**
   * Get Mercado Livre available quantity
   */
  private getMercadoLivreQuantity(product: PortalProduct): number {
    // TODO: Implement actual inventory lookup
    return 50;
  }

  /**
   * Format price with currency
   */
  private formatPrice(price: number, currency: string): string {
    return `${currency} ${price.toFixed(2)}`;
  }

  /**
   * Log sync operation result
   */
  private logSyncResult(
    productId: string,
    marketplace: Marketplace,
    success: boolean,
    remoteId?: string,
    operation?: 'create' | 'update',
    duration?: number
  ): void {
    if (success) {
      console.log(
        `[ProductSyncService] ✓ ${operation}d product ${productId} on ${marketplace} ` +
        `(remoteId: ${remoteId}, duration: ${duration}ms)`
      );
    } else {
      console.error(
        `[ProductSyncService] ✗ Failed to sync product ${productId} to ${marketplace}`
      );
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance of ProductSyncService
 * 
 * Use this instance throughout the application for product synchronization
 */
export const productSyncService = new ProductSyncService();

export default productSyncService;
/**
 * Product Sync Service
 * ====================
 * 
 * Handles synchronization of products between Portal Vendas and marketplaces
 * (Shopee, Mercado Livre). Provides core sync functionality, mapping between
 * product formats, and queue integration for async processing.
 * 
 * Features:
 * - Single product sync to marketplaces
 * - Batch sync for 100+ products
 * - Product mapping for each marketplace format
 * - Marketplace product fetch by remote ID
 * - Queue-based async processing with BullMQ
 * - Structured logging with [ProductSyncService] prefix
 * - Retry logic with exponential backoff
 * - Change detection using hash comparison
 * - Database updates with remoteIds
 * - Rate limiting per marketplace
 * - Product deletion/deactivation support
 * 
 * @see config.ts for queue and marketplace configuration
 * @see queue.ts for BullMQ queue integration
 * @see cache.ts for Redis caching
 * @see provider.service.ts for provider integration
 * @see auth.service.ts for marketplace authentication
 * @see rate-limiter.service.ts for rate limiting
 * 
 * Requirements: 1, 7, 12
 * Effort: 3 hours
 */

import { PrismaClient } from '../../generated/prisma';
import { config } from '../config';
import { cacheProduct, getCachedProduct, invalidateCache } from '../cache';
import { getQueue, QUEUE_NAMES, addJob, addBulkJobs } from '../queue';
import { rateLimiterService } from '../services/rate-limiter.service';
import type { Marketplace, MarketplaceProduct } from '../types/marketplace.types';
import type { PortalProduct } from '../types/product.types';
import type { Queue } from 'bullmq';

const prisma = new PrismaClient();

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SyncOptions {
  vendorId: string;
  marketplace: Marketplace;
  forceSync?: boolean; // Skip hash comparison
  notifyOnComplete?: boolean;
}

export interface SyncResult {
  success: boolean;
  marketplace: Marketplace;
  remoteId?: string;
  productId: string;
  operation: 'create' | 'update' | 'delete';
  duration: number;
  error?: string;
  warnings?: string[];
}

export interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  results: SyncResult[];
  errors: Array<{ productId: string; error: string }>;
}

export interface MarketplaceProductResponse {
  remoteId: string;
  marketplace: Marketplace;
  productId: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  marketplaceCategoryId: string;
  attributes: Record<string, string>;
  status: 'active' | 'inactive' | 'delisted';
  lastSyncedAt: Date;
  lastSyncedHash?: string;
}

export interface ProductChange {
  field: keyof PortalProduct;
  oldValue: any;
  newValue: any;
  changedAt: Date;
}

export interface DeletionOptions {
  deactivateOnly?: boolean; // Deactivate instead of delete (safer)
  clearMapping?: boolean; // Clear marketplace mapping
}

// ============================================================================
// PRODUCT SYNC SERVICE
// ============================================================================

export class ProductSyncService {
  // ============================================================================
  // DELETION/DEACTIVATION METHODS
  // ============================================================================

  /**
   * Delete or deactivate a product on marketplace
   * 
   * When a product is deleted from Portal Vendas, this method
   * syncs the deletion to the marketplace. By default, uses
   * deactivation (safer) but can also remove completely.
   * 
   * @param productId - Portal product ID
   * @param marketplace - Target marketplace
   * @param options - Deletion options
   * @returns Sync result with deletion status
   * 
   * @example
   * ```typescript
   * // Deactivate product (safer)
   * const result = await productSyncService.deleteProductSync(
   *   'prod_123',
   *   'shopee',
   *   { deactivateOnly: true, clearMapping: true }
   * );
   * 
   * // Completely delete product (if API allows)
   * const result = await productSyncService.deleteProductSync(
   *   'prod_123',
   *   'shopee',
   *   { deactivateOnly: false, clearMapping: true }
   * );
   * ```
   */
  async deleteProductSync(
    productId: string,
    marketplace: Marketplace,
    options: DeletionOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const { deactivateOnly = true, clearMapping = true } = options;

    try {
      console.log(
        `[ProductSyncService] Deleting product ${productId} from ${marketplace}...`
      );

      // Check if product has marketplace mapping
      const marketplaceProduct = await prisma.marketplaceProduct.findFirst({
        where: {
          productId,
          marketplace,
        },
      });

      if (!marketplaceProduct) {
        console.log(
          `[ProductSyncService] No marketplace mapping found for product ${productId} on ${marketplace}`
        );
        return {
          success: true,
          marketplace,
          productId,
          operation: 'delete',
          duration: Date.now() - startTime,
          warnings: ['No marketplace mapping found'],
        };
      }

      // Rate limit check
      const rateLimitStatus = rateLimiterService.isMarketplaceAllowed(marketplace);
      if (!rateLimitStatus.allowed) {
        console.warn(
          `[ProductSyncService] Rate limit exceeded for marketplace ${marketplace}`
        );
        return {
          success: false,
          marketplace,
          productId,
          operation: 'delete',
          duration: Date.now() - startTime,
          error: `Rate limit exceeded. Retry after ${rateLimitStatus.retryAfter}s`,
        };
      }

      // Call marketplace API to delete/deactivate
      const syncResult = await this.callMarketplaceAPI(
        marketplace,
        'deleteProduct',
        {
          remoteId: marketplaceProduct.remoteId,
          deactivateOnly,
        }
      );

      // Update or clear marketplace mapping
      if (clearMapping) {
        await this.clearMarketplaceMapping(productId, marketplace);
      }

      const duration = Date.now() - startTime;
      console.log(
        `[ProductSyncService] ✓ Deleted product ${productId} from ${marketplace} ` +
        `(remoteId: ${marketplaceProduct.remoteId}, operation: ${syncResult.operation}, ${duration}ms)`
      );

      return {
        success: true,
        marketplace,
        remoteId: marketplaceProduct.remoteId,
        productId,
        operation: 'delete',
        duration,
        warnings: syncResult.warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[ProductSyncService] ✗ Failed to delete product ${productId} from ${marketplace}:`,
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        marketplace,
        productId,
        operation: 'delete',
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear marketplace mapping for a product
   * 
   * Removes or deactivates the marketplace product mapping
   * 
   * @param productId - Portal product ID
   * @param marketplace - Target marketplace
   */
  private async clearMarketplaceMapping(
    productId: string,
    marketplace: Marketplace
  ): Promise<void> {
    try {
      const existing = await prisma.marketplaceProduct.findFirst({
        where: {
          productId,
          marketplace,
        },
      });

      if (existing) {
        if (marketplace === 'shopee') {
          // For Shopee, mark as inactive instead of deleting
          await prisma.marketplaceProduct.update({
            where: { id: existing.id },
            data: {
              status: 'inactive',
              remoteId: null,
              lastSyncedAt: new Date(),
            },
          });
        } else {
          // For Mercado Livre, can delete mapping
          await prisma.marketplaceProduct.delete({
            where: { id: existing.id },
          });
        }
        console.log(
          `[ProductSyncService] Cleared marketplace mapping for product ${productId} on ${marketplace}`
        );
      }
    } catch (error) {
      console.error(
        `[ProductSyncService] Error clearing marketplace mapping for ${productId} on ${marketplace}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ============================================================================
  // CHANGE DETECTION METHODS
  // ============================================================================

  /**
   * Detect changes between two product versions
   * 
   * Compares two product objects and identifies which fields have changed
   * 
   * @param oldProduct - Previous product version
   * @param newProduct - Current product version
   * @returns Array of changed fields with old/new values
   * 
   * @example
   * ```typescript
   * const changes = productSyncService.detectProductChanges(
   *   { title: 'Old', price: 99 },
   *   { title: 'New', price: 99 }
   * );
   * // Returns: [{ field: 'title', oldValue: 'Old', newValue: 'New' }]
   * ```
   */
  detectProductChanges(
    oldProduct: PortalProduct,
    newProduct: PortalProduct
  ): ProductChange[] {
    const changes: ProductChange[] = [];
    const changeFields: (keyof PortalProduct)[] = [
      'title',
      'description',
      'price',
      'cost',
      'images',
      'categoryId',
      'attributes',
      'isActive',
    ];

    for (const field of changeFields) {
      const oldValue = oldProduct[field];
      const newValue = newProduct[field];

      // Compare values (handle arrays and objects)
      const isChanged = !this.isEqual(oldValue, newValue);

      if (isChanged) {
        changes.push({
          field,
          oldValue,
          newValue,
          changedAt: new Date(),
        });
      }
    }

    return changes;
  }

  /**
   * Deep equality check for any values
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.isEqual(item, b[index]));
    }

    if (typeof a === 'object') {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(key => this.isEqual(a[key], b[key]));
    }

    return false;
  }

  /**
   * Sync only changed fields to marketplace
   * 
   * When a product is updated, sync only the fields that changed
   * to minimize API calls and avoid rate limits
   * 
   * @param productId - Portal product ID
   * @param marketplace - Target marketplace
   * @param changes - Array of changed fields from detectProductChanges
   * @returns Sync result
   */
  async syncChangedFields(
    productId: string,
    marketplace: Marketplace,
    changes: ProductChange[]
  ): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      console.log(
        `[ProductSyncService] Syncing ${changes.length} changed fields for product ${productId} to ${marketplace}...`
      );

      // Check rate limit
      const rateLimitStatus = rateLimiterService.isMarketplaceAllowed(marketplace);
      if (!rateLimitStatus.allowed) {
        return {
          success: false,
          marketplace,
          productId,
          operation: 'update',
          duration: Date.now() - startTime,
          error: `Rate limit exceeded. Retry after ${rateLimitStatus.retryAfter}s`,
        };
      }

      // Fetch current product from database
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return {
          success: false,
          marketplace,
          productId,
          operation: 'update',
          duration: Date.now() - startTime,
          error: 'Product not found',
        };
      }

      // Fetch current marketplace product to get current values
      const marketplaceProduct = await prisma.marketplaceProduct.findFirst({
        where: { productId, marketplace },
      });

      // Map only changed fields to marketplace format
      const mappedChanges = this.mapChangedFieldsToMarketplace(
        product,
        marketplace,
        changes
      );

      // Call marketplace API with only changed fields
      const syncResult = await this.callMarketplaceAPI(
        marketplace,
        'updateProduct',
        {
          remoteId: marketplaceProduct?.remoteId,
          changedFields: mappedChanges,
          vendorId: product.vendorId,
        }
      );

      // Update database record
      await this.updateMarketplaceProductRecord({
        remoteId: syncResult.remoteId,
        marketplace,
        vendorId: product.vendorId,
        productId: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        images: product.images,
        categoryId: product.categoryId,
        marketplaceCategoryId: syncResult.categoryId || marketplaceProduct?.marketplaceCategoryId || '',
        attributes: product.attributes,
        status: product.isActive ? 'active' : 'inactive',
        lastSyncedAt: new Date(),
        lastSyncedHash: this.calculateProductHash(product),
      });

      const duration = Date.now() - startTime;
      console.log(
        `[ProductSyncService] ✓ Synced ${changes.length} changed fields for product ${productId} ` +
        `(duration: ${duration}ms)`
      );

      return {
        success: true,
        marketplace,
        remoteId: syncResult.remoteId,
        productId,
        operation: 'update',
        duration,
        warnings: syncResult.warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[ProductSyncService] ✗ Failed to sync changed fields for product ${productId}:`,
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        marketplace,
        productId,
        operation: 'update',
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Map changed fields to marketplace format
   */
  private mapChangedFieldsToMarketplace(
    product: PortalProduct,
    marketplace: Marketplace,
    changes: ProductChange[]
  ): Record<string, any> {
    const mappedChanges: Record<string, any> = {};

    for (const change of changes) {
      const field = change.field;
      const newValue = change.newValue;

      if (field === 'title') {
        mappedChanges.title = this.truncateProductTitle(newValue, marketplace);
      } else if (field === 'price') {
        mappedChanges.price = newValue;
      } else if (field === 'description') {
        mappedChanges.description = this.truncateProductDescription(newValue, marketplace);
      } else if (field === 'images') {
        mappedChanges.images = newValue.slice(0, this.getMaxImageCount(marketplace));
      } else if (field === 'categoryId') {
        mappedChanges.categoryId = newValue;
      } else if (field === 'isActive') {
        mappedChanges.status = newValue ? 'active' : 'inactive';
      }
      // Handle other fields as needed
    }

    return mappedChanges;
  }

  // ============================================================================
  // CORE SYNC METHODS
  // ============================================================================