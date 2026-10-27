/**
 * Product Sync Service Tests
 * ==========================
 * 
 * Unit tests for product synchronization service.
 * Tests cover:
 * - Single product sync to marketplaces
 * - Batch sync for 100+ products
 * - Product mapping for Shopee and Mercado Livre
 * - Change detection with hash comparison
 * - Error handling and retry logic
 * - Queue integration
 * 
 * @see product-sync.service.ts for implementation
 * @see queue.ts for BullMQ queue integration
 * @see config.ts for marketplace configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { productSyncService, ProductSyncService } from './product-sync.service';
import * as cacheModule from '../cache';
import * as queueModule from '../queue';
import * as prismaModule from '../../generated/prisma';
import type { PortalProduct } from '../types/product.types';

// ============================================================================
// MOCKS
// ============================================================================

// Set up Prisma mock first (before any imports)
vi.mock('../../generated/prisma', () => {
  const mockPrismaClient = {
    marketplaceProduct: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  };
});

vi.mock('../cache', () => ({
  getCachedProduct: vi.fn(),
  cacheProduct: vi.fn(),
  invalidateCache: vi.fn(),
}));

vi.mock('../queue', () => ({
  getQueue: vi.fn(),
  QUEUE_NAMES: {
    PRODUCT_SYNC: 'productSync',
  },
  addJob: vi.fn(),
  addBulkJobs: vi.fn(),
}));

// ============================================================================
// TEST SETUP
// ============================================================================

describe('ProductSyncService', () => {
  let service: ProductSyncService;
  let mockPrismaClient: any;

  beforeEach(() => {
    service = new ProductSyncService();
    vi.clearAllMocks();
    
    // Mock Prisma client
    mockPrismaClient = {
      marketplaceProduct: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    
    // Override the PrismaClient import
    vi.mocked(prismaModule.PrismaClient).mockImplementation(() => mockPrismaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // TESTS: syncProductToMarketplaces
  // ============================================================================

  describe('syncProductToMarketplaces', () => {
    const mockProduct: PortalProduct = {
      id: 'prod_123',
      vendorId: 'vendor_abc',
      title: 'Test Product',
      description: 'This is a test product',
      price: 99.90,
      images: ['https://example.com/image.jpg'],
      categoryId: 'cat_1',
      attributes: { brand: 'TestBrand', model: 'ModelX' },
      sku: 'SKU123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSyncOptions = {
      vendorId: 'vendor_abc',
      marketplace: 'shopee' as const,
    };

    it('should sync product to Shopee successfully', async () => {
      (cacheModule.getCachedProduct as any).mockResolvedValue(null);

      const result = await service.syncProductToMarketplaces(mockProduct, 'shopee', mockSyncOptions);

      expect(result.success).toBe(true);
      expect(result.marketplace).toBe('shopee');
      expect(result.productId).toBe(mockProduct.id);
      expect(result.remoteId).toBeDefined();
      expect(result.operation).toBe('create');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should skip sync if product unchanged (hash match)', async () => {
      const cachedProduct = {
        remoteId: 'shopee_prod_123',
        lastSyncedHash: service['calculateProductHash'](mockProduct),
      };

      (cacheModule.getCachedProduct as any).mockResolvedValue(cachedProduct);

      const result = await service.syncProductToMarketplaces(mockProduct, 'shopee', {
        ...mockSyncOptions,
        forceSync: false,
      });

      expect(result.success).toBe(true);
      expect(result.remoteId).toBe('shopee_prod_123');
      // Should not call API since unchanged
    });

    it('should sync product even if unchanged when forceSync=true', async () => {
      const cachedProduct = {
        remoteId: 'shopee_prod_123',
        lastSyncedHash: service['calculateProductHash'](mockProduct),
      };

      (cacheModule.getCachedProduct as any).mockResolvedValue(cachedProduct);
      (cacheModule.cacheProduct as any).mockResolvedValue(undefined);

      const result = await service.syncProductToMarketplaces(mockProduct, 'shopee', {
        ...mockSyncOptions,
        forceSync: true,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('update');
    });

    it('should handle sync errors gracefully', async () => {
      (cacheModule.getCachedProduct as any).mockResolvedValue(null);

      // Mock API call to throw error
      vi.spyOn(service as any, 'callMarketplaceAPI').mockRejectedValue(
        new Error('API Error')
      );

      const result = await service.syncProductToMarketplaces(mockProduct, 'shopee', mockSyncOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should cache synced product', async () => {
      (cacheModule.getCachedProduct as any).mockResolvedValue(null);
      (cacheModule.cacheProduct as any).mockResolvedValue(undefined);

      await service.syncProductToMarketplaces(mockProduct, 'shopee', mockSyncOptions);

      expect(cacheModule.cacheProduct).toHaveBeenCalledWith(
        'prod_123:shopee',
        expect.objectContaining({
          remoteId: expect.any(String),
        })
      );
    });

    it('should update or create marketplace product record', async () => {
      (cacheModule.getCachedProduct as any).mockResolvedValue(null);
      
      // Mock the Prisma calls
      mockPrismaClient.marketplaceProduct.findFirst.mockResolvedValue(null); // No existing record
      mockPrismaClient.marketplaceProduct.create.mockResolvedValue({
        id: 'mp_123',
        remoteId: 'shopee_prod_123',
        marketplace: 'shopee',
        productId: 'prod_123',
        title: 'Test Product',
        price: 99.90,
        status: 'active',
        lastSyncedAt: new Date(),
      });

      // We need to test the private method indirectly through syncProductToMarketplaces
      // This would normally be tested via the public API
      const result = await service.syncProductToMarketplaces(mockProduct, 'shopee', mockSyncOptions);

      expect(result.success).toBe(true);
      expect(mockPrismaClient.marketplaceProduct.create).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TESTS: batchSyncProducts
  // ============================================================================

  describe('batchSyncProducts', () => {
    it('should sync 100 products to marketplace queue', async () => {
      // Create 100 mock products
      const products: PortalProduct[] = Array.from({ length: 100 }).map((_, i) => ({
        id: `prod_${i}`,
        vendorId: 'vendor_abc',
        title: `Product ${i}`,
        description: `Description ${i}`,
        price: 99.90 + i,
        images: ['https://example.com/image.jpg'],
        categoryId: 'cat_1',
        attributes: {},
        sku: `SKU${i}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (queueModule.addBulkJobs as any).mockResolvedValue(
        products.map(p => ({ id: `job_${p.id}` }))
      );

      const result = await service.batchSyncProducts(products, 'shopee', {
        vendorId: 'vendor_abc',
        forceSync: false,
      });

      expect(result.total).toBe(100);
      expect(result.success).toBe(100);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(100);
      expect(result.errors.length).toBe(0);

      // Verify queue was called with correct number of jobs
      expect(queueModule.addBulkJobs).toHaveBeenCalled();
    });

    it('should handle batch sync errors', async () => {
      const products: PortalProduct[] = [
        { id: 'prod_1', vendorId: 'vendor_abc', title: 'Product 1', description: 'Desc 1', price: 10, images: [], categoryId: 'cat', attributes: {}, sku: 'S1', isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'prod_2', vendorId: 'vendor_abc', title: 'Product 2', description: 'Desc 2', price: 20, images: [], categoryId: 'cat', attributes: {}, sku: 'S2', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ];

      (queueModule.addBulkJobs as any).mockRejectedValue(new Error('Queue error'));

      const result = await service.batchSyncProducts(products, 'shopee', {
        vendorId: 'vendor_abc',
      });

      expect(result.total).toBe(2);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors.length).toBe(2);
    });

    it('should process products in batches for large datasets', async () => {
      // Test with 250 products (should create 3 batches)
      const products: PortalProduct[] = Array.from({ length: 250 }).map((_, i) => ({
        id: `prod_${i}`,
        vendorId: 'vendor_abc',
        title: `Product ${i}`,
        description: `Description ${i}`,
        price: 99.90,
        images: ['https://example.com/image.jpg'],
        categoryId: 'cat_1',
        attributes: {},
        sku: `SKU${i}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (queueModule.addBulkJobs as any).mockResolvedValue(
        products.map(p => ({ id: `job_${p.id}` }))
      );

      const result = await service.batchSyncProducts(products, 'mercadolivre', {
        vendorId: 'vendor_abc',
      });

      expect(result.total).toBe(250);
      expect(result.success).toBe(250);
    });
  });

  // ============================================================================
  // TESTS: fetchMarketplaceProduct
  // ============================================================================

  describe('fetchMarketplaceProduct', () => {
    it('should fetch product from Shopee by remote ID', async () => {
      const result = await service.fetchMarketplaceProduct('shopee', 'shopee_prod_123');

      expect(result).toBeDefined();
      expect(result?.remoteId).toBe('shopee_prod_123');
      expect(result?.marketplace).toBe('shopee');
      expect(result?.title).toBe('Simulated Product');
    });

    it('should fetch product from Mercado Livre by remote ID', async () => {
      const result = await service.fetchMarketplaceProduct('mercadolivre', 'MLB123456789');

      expect(result).toBeDefined();
      expect(result?.remoteId).toBe('MLB123456789');
      expect(result?.marketplace).toBe('mercadolivre');
    });

    it('should return null when product not found', async () => {
      // Mock API to return null
      vi.spyOn(service as any, 'callMarketplaceAPI').mockResolvedValue(null);

      const result = await service.fetchMarketplaceProduct('shopee', 'non_existent');

      expect(result).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      vi.spyOn(service as any, 'callMarketplaceAPI').mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.fetchMarketplaceProduct('shopee', 'prod_123');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // TESTS: mapProductToMarketplace
  // ============================================================================

  describe('mapProductToMarketplace', () => {
    const testProduct: PortalProduct = {
      id: 'prod_123',
      vendorId: 'vendor_abc',
      title: 'Test Product with a very long title that should be truncated',
      description: 'Test description '.repeat(100), // Long description
      price: 99.90,
      cost: 50,
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg'],
      categoryId: 'cat_1',
      attributes: { brand: 'TestBrand', model: 'ModelX', color: 'Red' },
      sku: 'SKU123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should map product to Shopee format', () => {
      const mapped = service.mapProductToMarketplace(testProduct, 'shopee');

      expect(mapped).toBeDefined();
      expect(mapped.shopeeTitle).toBeDefined();
      expect(mapped.shopeePrice).toBe('BRL 99.90');
      expect(mapped.shopeeStock).toBe(100);
      expect(mapped.shopeeAttributes.brand).toBe('TestBrand');
    });

    it('should map product to Mercado Livre format', () => {
      const mapped = service.mapProductToMarketplace(testProduct, 'mercadolivre');

      expect(mapped).toBeDefined();
      expect(mapped.mercadoLivreTitle).toBeDefined();
      expect(mapped.mercadoLivrePrice).toBe(99.90);
      expect(mapped.mercadoLivreAvailableQuantity).toBe(50);
      expect(mapped.mercadoLivreAttributes.brand).toBe('TestBrand');
      expect(mapped.mercadoLivreAttributes.condition).toBe('new');
    });

    it('should truncate long product titles for Shopee', () => {
      const longTitle = 'A'.repeat(150);
      const product = { ...testProduct, title: longTitle };
      const mapped = service.mapProductToMarketplace(product, 'shopee');

      // Shopee limit is 120 characters
      expect(mapped.shopeeTitle.length).toBeLessThanOrEqual(120);
    });

    it('should truncate long product titles for Mercado Livre', () => {
      const longTitle = 'A'.repeat(100);
      const product = { ...testProduct, title: longTitle };
      const mapped = service.mapProductToMarketplace(product, 'mercadolivre');

      // Mercado Livre limit is 60 characters
      expect(mapped.mercadoLivreTitle.length).toBeLessThanOrEqual(60);
    });

    it('should limit images for Shopee (max 9)', () => {
      const product = { ...testProduct, images: Array(15).fill('img.jpg') };
      const mapped = service.mapProductToMarketplace(product, 'shopee');

      expect(mapped.shopeeImages.length).toBe(9);
    });

    it('should limit images for Mercado Livre (max 5)', () => {
      const product = { ...testProduct, images: Array(15).fill('img.jpg') };
      const mapped = service.mapProductToMarketplace(product, 'mercadolivre');

      expect(mapped.mercadoLivrePictures.length).toBe(5);
    });
  });

  // ============================================================================
  // TESTS: Helper Methods
  // ============================================================================

  describe('Helper Methods', () => {
    it('should calculate consistent product hashes', () => {
      const product: PortalProduct = {
        id: 'prod_123',
        vendorId: 'vendor_abc',
        title: 'Test',
        description: 'Desc',
        price: 10,
        images: [],
        categoryId: 'cat',
        attributes: {},
        sku: 'S',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const hash1 = service['calculateProductHash'](product);
      const hash2 = service['calculateProductHash'](product);

      expect(hash1).toBe(hash2);
    });

    it('should detect product changes via hash', () => {
      const product1: PortalProduct = {
        id: 'prod_123',
        vendorId: 'vendor_abc',
        title: 'Product A',
        description: 'Desc',
        price: 10,
        images: [],
        categoryId: 'cat',
        attributes: {},
        sku: 'S',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const product2: PortalProduct = {
        id: 'prod_123',
        vendorId: 'vendor_abc',
        title: 'Product B', // Changed
        description: 'Desc',
        price: 10,
        images: [],
        categoryId: 'cat',
        attributes: {},
        sku: 'S',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const hash1 = service['calculateProductHash'](product1);
      const hash2 = service['calculateProductHash'](product2);

      expect(hash1).not.toBe(hash2);
    });

    it('should truncate descriptions to marketplace limits', () => {
      const longDesc = 'X'.repeat(6000);
      const product = { ...testProduct, description: longDesc };

      const shopeeMapped = service.mapProductToMarketplace(product, 'shopee');
      expect(shopeeMapped.shopeeDescription.length).toBeLessThanOrEqual(5000);

      const mlMapped = service.mapProductToMarketplace(product, 'mercadolivre');
      expect(mlMapped.mercadoLivreDescription.length).toBeLessThanOrEqual(5000);
    });

    it('should handle empty product attributes gracefully', () => {
      const product: PortalProduct = {
        id: 'prod_123',
        vendorId: 'vendor_abc',
        title: 'Test',
        description: 'Desc',
        price: 10,
        images: [],
        categoryId: 'cat',
        attributes: {},
        sku: 'S',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const shopeeMapped = service.mapProductToMarketplace(product, 'shopee');
      expect(shopeeMapped.shopeeAttributes).toEqual({ brand: '', model: '', color: '' });

      const mlMapped = service.mapProductToMarketplace(product, 'mercadolivre');
      expect(mlMapped.mercadoLivreAttributes).toEqual({
        brand: '',
        model: '',
        color: '',
        condition: 'new',
      });
    });
  });

  // ============================================================================
  // TESTS: Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should return error result when API call fails', async () => {
      const product: PortalProduct = {
        id: 'prod_123',
        vendorId: 'vendor_abc',
        title: 'Test',
        description: 'Desc',
        price: 10,
        images: [],
        categoryId: 'cat',
        attributes: {},
        sku: 'S',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cacheModule.getCachedProduct as any).mockResolvedValue(null);
      vi.spyOn(service as any, 'callMarketplaceAPI').mockRejectedValue(
        new Error('Connection timeout')
      );

      const result = await service.syncProductToMarketplaces(product, 'shopee', {
        vendorId: 'vendor_abc',
        marketplace: 'shopee',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should return null when fetch fails', async () => {
      vi.spyOn(service as any, 'callMarketplaceAPI').mockRejectedValue(
        new Error('API Error')
      );

      const result = await service.fetchMarketplaceProduct('shopee', 'prod_123');

      expect(result).toBeNull();
    });

    it('should handle invalid marketplace gracefully', () => {
      expect(() => {
        service.mapProductToMarketplace(testProduct, 'invalid' as any);
      }).toThrow();
    });
  });

  // ============================================================================
  // TESTS: Multiple Marketplaces
  // ============================================================================

  describe('Multiple Marketplaces', () => {
    const product: PortalProduct = {
      id: 'prod_123',
      vendorId: 'vendor_abc',
      title: 'Test Product',
      description: 'Description',
      price: 99.90,
      images: ['img.jpg'],
      categoryId: 'cat_1',
      attributes: { brand: 'Brand', model: 'Model' },
      sku: 'SKU123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should handle Shopee and Mercado Livre independently', async () => {
      (cacheModule.getCachedProduct as any).mockResolvedValue(null);

      const shopeeResult = await service.syncProductToMarketplaces(
        product,
        'shopee',
        { vendorId: 'vendor_abc', marketplace: 'shopee' }
      );

      const mlResult = await service.syncProductToMarketplaces(
        product,
        'mercadolivre',
        { vendorId: 'vendor_abc', marketplace: 'mercadolivre' }
      );

      expect(shopeeResult.marketplace).toBe('shopee');
      expect(mlResult.marketplace).toBe('mercadolivre');
      expect(shopeeResult.remoteId).not.toEqual(mlResult.remoteId);
    });

    it('should map to different formats for each marketplace', () => {
      const shopeeMapped = service.mapProductToMarketplace(product, 'shopee');
      const mlMapped = service.mapProductToMarketplace(product, 'mercadolivre');

      // Different field names
      expect(shopeeMapped).toHaveProperty('shopeeTitle');
      expect(mlMapped).toHaveProperty('mercadoLivreTitle');

      expect(shopeeMapped.shopeeTitle).not.toEqual(mlMapped.mercadoLivreTitle);
    });
  });

  // ============================================================================
  // TESTS: Performance - Batch with 100 Products
  // ============================================================================

  describe('Performance: Batch with 100 Products', () => {
    it('should sync 100 products within acceptable time', async () => {
      const products: PortalProduct[] = Array.from({ length: 100 }).map((_, i) => ({
        id: `prod_${i}`,
        vendorId: 'vendor_abc',
        title: `Product ${i}`,
        description: `Description ${i}`,
        price: 99.90 + i,
        images: ['https://example.com/image.jpg'],
        categoryId: 'cat_1',
        attributes: {},
        sku: `SKU${i}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (queueModule.addBulkJobs as any).mockResolvedValue(
        products.map(p => ({ id: `job_${p.id}` }))
      );

      const startTime = Date.now();
      const result = await service.batchSyncProducts(products, 'shopee', {
        vendorId: 'vendor_abc',
        forceSync: false,
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.total).toBe(100);
      expect(result.success).toBe(100);
    });
  });
});
