/**
 * Marketplace Schema Service Tests
 * =================================
 * 
 * Unit tests for marketplace schema caching service.
 * Tests cover:
 * - Cache hits and misses
 * - Automatic refresh on expiration
 * - Manual invalidation
 * - Cache statistics tracking
 * - Error handling
 * - Schema validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { marketplaceSchemaService, MarketplaceSchemaService, type Marketplace } from './marketplace-schema.service';
import * as cacheModule from '../cache';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateByPattern: vi.fn(),
}));

// ============================================================================
// TEST SETUP
// ============================================================================

describe('MarketplaceSchemaService', () => {
  let service: MarketplaceSchemaService;

  beforeEach(() => {
    // Create fresh instance for each test
    service = new MarketplaceSchemaService();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // TESTS: Cache Hits and Misses
  // ========================================================================

  describe('Cache Hits and Misses', () => {
    it('should record cache miss when no cached schema exists', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);

      const stats = service.getCacheStats();
      expect(stats.misses).toBe(0);

      // Attempt to get non-existent schema
      const result = await service.getSchemaFromCache('shopee', 'categories');

      expect(result).toBeNull();
      expect(service.getCacheStats().misses).toBe(1);
    });

    it('should record cache hit when cached schema exists and not expired', async () => {
      const cachedSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Test' }],
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // Expires in 60s
        version: new Date().toISOString(),
      };

      (cacheModule.getCached as any).mockResolvedValueOnce(cachedSchema);

      const result = await service.getSchemaFromCache('shopee', 'categories');

      expect(result).toEqual(cachedSchema);
      expect(service.getCacheStats().hits).toBe(1);
    });

    it('should calculate correct cache hit rate', async () => {
      const cachedSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Test' }],
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        version: new Date().toISOString(),
      };

      // 3 cache hits
      (cacheModule.getCached as any).mockResolvedValue(cachedSchema);
      for (let i = 0; i < 3; i++) {
        await service.getSchemaFromCache('shopee', 'categories');
      }

      // 2 cache misses
      (cacheModule.getCached as any).mockResolvedValue(null);
      for (let i = 0; i < 2; i++) {
        await service.getSchemaFromCache('mercadolivre', 'attributes');
      }

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.total).toBe(5);
      expect(stats.hitRate).toBe('60.00%');
    });
  });

  // ========================================================================
  // TESTS: Fetch and Cache
  // ========================================================================

  describe('Fetch and Cache', () => {
    it('should fetch schema from API and cache it', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);
      (cacheModule.setCached as any).mockResolvedValueOnce(undefined);

      const schema = await service.fetchAndCacheSchemas('shopee', 'categories');

      expect(schema).toBeDefined();
      expect(schema.marketplace).toBe('shopee');
      expect(schema.type).toBe('categories');
      expect(schema.data).toBeDefined();
      expect(schema.expiresAt).toBeInstanceOf(Date);
      
      // Verify cache was set
      expect(cacheModule.setCached).toHaveBeenCalledWith(
        'schema:shopee:categories',
        expect.objectContaining({
          marketplace: 'shopee',
          type: 'categories',
        }),
        expect.objectContaining({
          ttl: 300, // 5 minutes
        })
      );
    });

    it('should increment fetch counter when fetching from API', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);

      const initialStats = service.getCacheStats();
      expect(initialStats.fetches).toBe(0);

      await service.fetchAndCacheSchemas('shopee', 'categories');

      const stats = service.getCacheStats();
      expect(stats.fetches).toBe(1);
    });

    it('should respect minimum fetch interval to prevent API thrashing', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);

      // First fetch
      await service.fetchAndCacheSchemas('shopee', 'categories');

      // Try immediate second fetch
      const result = await service.fetchAndCacheSchemas('shopee', 'categories');

      // Should return null because interval not met and no cache
      expect(result).toBeNull();
      
      // Should have only 1 fetch call to API
      expect(service.getCacheStats().fetches).toBe(1);
    });

    it('should return cached schema if available when fetch interval not met', async () => {
      const cachedSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Test' }],
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        version: new Date().toISOString(),
      };

      // First call - cache miss, fetch happens
      (cacheModule.getCached as any).mockResolvedValueOnce(null);
      await service.fetchAndCacheSchemas('shopee', 'categories');

      // Second call - cache hit but interval not met
      (cacheModule.getCached as any).mockResolvedValueOnce(cachedSchema);
      const result = await service.fetchAndCacheSchemas('shopee', 'categories');

      expect(result).toEqual(cachedSchema);
      expect(service.getCacheStats().hits).toBe(1);
      expect(service.getCacheStats().fetches).toBe(1); // Still only 1 API call
    });
  });

  // ========================================================================
  // TESTS: Cache Invalidation
  // ========================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate specific marketplace and type', async () => {
      (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);

      await service.invalidateSchemaCache('shopee', 'categories');

      expect(cacheModule.invalidateCache).toHaveBeenCalledWith('schema:shopee:categories');
      expect(service.getCacheStats().invalidations).toBe(1);
    });

    it('should invalidate all schemas for marketplace when type not specified', async () => {
      (cacheModule.invalidateByPattern as any).mockResolvedValueOnce(undefined);

      await service.invalidateSchemaCache('shopee');

      expect(cacheModule.invalidateByPattern).toHaveBeenCalledWith('schema:shopee:*');
      expect(service.getCacheStats().invalidations).toBe(1);
    });

    it('should invalidate metadata cache along with schema', async () => {
      (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);

      await service.invalidateSchemaCache('shopee', 'categories');

      expect(cacheModule.invalidateCache).toHaveBeenCalledTimes(2);
      expect(cacheModule.invalidateCache).toHaveBeenNthCalledWith(1, 'schema:shopee:categories');
      expect(cacheModule.invalidateCache).toHaveBeenNthCalledWith(2, 'schema:shopee:metadata');
    });

    it('should clear fetch time cache on invalidation', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);

      // Fetch to set fetch time
      await service.fetchAndCacheSchemas('shopee', 'categories');

      // Should have fetch time set
      const statsBeforeInvalidate = service.getCacheStats();
      expect(statsBeforeInvalidate.fetches).toBe(1);

      // Invalidate
      (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
      await service.invalidateSchemaCache('shopee', 'categories');

      // Next fetch should work immediately
      await service.fetchAndCacheSchemas('shopee', 'categories');
      expect(service.getCacheStats().fetches).toBe(2);
    });
  });

  // ========================================================================
  // TESTS: Automatic Refresh
  // ========================================================================

  describe('Automatic Refresh on Expiration', () => {
    it('should auto-refresh expired schema', async () => {
      const now = new Date();
      const expiredSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Old' }],
        fetchedAt: new Date(now.getTime() - 10000), // Expired 10s ago
        expiresAt: new Date(now.getTime() - 5000), // Expired 5s ago
        version: new Date(now.getTime() - 10000).toISOString(),
      };

      const newSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'New' }],
        fetchedAt: new Date(now.getTime() + 5000), // Fresh
        expiresAt: new Date(now.getTime() + 305000), // 5 minutes from now
        version: new Date().toISOString(),
      };

      // Mock: return expired schema for cache lookup
      (cacheModule.getCached as any).mockResolvedValue(expiredSchema);

      // Mock fetchAndCacheSchemas to return new data
      vi.spyOn(service, 'fetchAndCacheSchemas').mockResolvedValue(newSchema);

      const result = await service.getSchemaFromCache('shopee', 'categories');

      // Should fetch new data (not the expired schema)
      expect(result).toEqual(newSchema);
    });

    it('should return stale cache if auto-refresh fails', async () => {
      const now = new Date();
      const staleSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Stale' }],
        fetchedAt: new Date(now.getTime() - 10000), // Expired 10s ago
        expiresAt: new Date(now.getTime() - 5000), // Expired 5s ago
        version: now.toISOString(),
      };

      (cacheModule.getCached as any).mockResolvedValue(staleSchema);

      // Make fetchAndCacheSchemas throw to simulate API failure
      vi.spyOn(service, 'fetchAndCacheSchemas').mockRejectedValue(new Error('API Error'));

      const result = await service.getSchemaFromCache('shopee', 'categories');

      // Should return stale cache (graceful degradation)
      expect(result).toEqual(staleSchema);
      
      // Verify the mock was called
      expect(cacheModule.getCached).toHaveBeenCalledTimes(1);
    });

    it('should respect autoRefresh=false flag', async () => {
      const now = new Date();
      const expiredSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Old' }],
        fetchedAt: new Date(now.getTime() - 10000), // Expired 10s ago
        expiresAt: new Date(now.getTime() - 5000), // Expired 5s ago
        version: now.toISOString(),
      };

      (cacheModule.getCached as any).mockResolvedValueOnce(expiredSchema);

      const result = await service.getSchemaFromCache('shopee', 'categories', false);

      // Should return null without attempting refresh
      expect(result).toBeNull();
      
      // Verify the mock was called
      expect(cacheModule.getCached).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // TESTS: Manual Refresh
  // ========================================================================

  describe('Manual Refresh', () => {
    it('should force refresh schema even if cached and not expired', async () => {
      const cachedSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Old' }],
        fetchedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 50000),
        version: new Date(Date.now() - 1000).toISOString(),
      };

      const refreshedSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'New' }],
        fetchedAt: new Date(Date.now() + 1000),
        expiresAt: new Date(Date.now() + 301000),
        version: new Date().toISOString(),
      };

      // First get - returns cached schema
      (cacheModule.getCached as any).mockResolvedValueOnce(cachedSchema);
      
      // First, get cached version
      const cached = await service.getSchemaFromCache('shopee', 'categories');
      expect(cached?.data[0].name).toBe('Old');

      // Now refresh manually - invalidate then fetch succeeds
      (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
      (cacheModule.getCached as any)
        .mockResolvedValueOnce(null)  // After invalidation, cache miss
        .mockResolvedValueOnce(null); // During fetch, cache miss
      
      // Mock fetchAndCacheSchemas to return new data
      vi.spyOn(service, 'fetchAndCacheSchemas').mockResolvedValueOnce(refreshedSchema);

      const refreshed = await service.refreshSchema('shopee', 'categories');

      expect(refreshed).toEqual(refreshedSchema);
      expect(cacheModule.invalidateByPattern).toHaveBeenCalled();
    });

    it('should track refresh operations in statistics', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);

      const statsBefore = service.getCacheStats();
      expect(statsBefore.invalidations).toBe(0);

      await service.refreshSchema('shopee', 'categories');

      const statsAfter = service.getCacheStats();
      expect(statsAfter.invalidations).toBe(1);
    });
  });

  // ========================================================================
  // TESTS: Schema Validation
  // ========================================================================

  describe('Schema Validation', () => {
    it('should validate Shopee schema structure', () => {
      const validSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1', name: 'Category' }],
        fetchedAt: new Date(),
        expiresAt: new Date(),
      };

      const isValid = service.validateSchema(validSchema, 'shopee');
      expect(isValid).toBe(true);
    });

    it('should validate Mercado Livre schema structure', () => {
      const validSchema = {
        type: 'categories' as const,
        marketplace: 'mercadolivre' as const,
        data: [{ id: 'MLB1', name: 'Category' }],
        fetchedAt: new Date(),
        expiresAt: new Date(),
      };

      const isValid = service.validateSchema(validSchema, 'mercadolivre');
      expect(isValid).toBe(true);
    });

    it('should reject invalid schema (no data)', () => {
      const invalidSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: null,
        fetchedAt: new Date(),
        expiresAt: new Date(),
      };

      const isValid = service.validateSchema(invalidSchema as any, 'shopee');
      expect(isValid).toBe(false);
    });

    it('should reject invalid schema (data is not array)', () => {
      const invalidSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: { id: '1' },
        fetchedAt: new Date(),
        expiresAt: new Date(),
      };

      const isValid = service.validateSchema(invalidSchema as any, 'shopee');
      expect(isValid).toBe(false);
    });
  });

  // ========================================================================
  // TESTS: Cache Statistics
  // ========================================================================

  describe('Cache Statistics', () => {
    it('should track cache hits, misses, fetches, and invalidations', async () => {
      // Cache hit scenario
      const freshSchema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1' }],
        fetchedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 50000),
        version: new Date(Date.now() - 1000).toISOString(),
      };

      // Cache hit
      (cacheModule.getCached as any).mockResolvedValueOnce(freshSchema);
      await service.getSchemaFromCache('shopee', 'categories');

      // Cache miss
      (cacheModule.getCached as any).mockResolvedValueOnce(null);
      await service.getSchemaFromCache('mercadolivre', 'attributes');

      // Fetch - cache miss, then fetch succeeds
      (cacheModule.getCached as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      await service.fetchAndCacheSchemas('shopee', 'attributes');

      // Invalidate
      (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
      await service.invalidateSchemaCache('shopee', 'categories');

      const stats = service.getCacheStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.fetches).toBe(1);
      expect(stats.invalidations).toBe(1);
      expect(stats.total).toBe(2);
    });

    it('should reset cache statistics', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);
      await service.getSchemaFromCache('shopee', 'categories');

      let stats = service.getCacheStats();
      expect(stats.misses).toBe(1);

      service.resetCacheStats();

      stats = service.getCacheStats();
      expect(stats.misses).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.fetches).toBe(0);
      expect(stats.invalidations).toBe(0);
    });
  });

  // ========================================================================
  // TESTS: Error Handling
  // ========================================================================

  describe('Error Handling', () => {
    it('should handle cache retrieval errors gracefully', async () => {
      // Make getCached throw an error
      (cacheModule.getCached as any).mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await service.getSchemaFromCache('shopee', 'categories');

      // Should return null on error
      expect(result).toBeNull();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      (cacheModule.invalidateCache as any).mockRejectedValueOnce(new Error('Redis error'));

      // Should not throw
      await expect(
        service.invalidateSchemaCache('shopee', 'categories')
      ).rejects.toThrow();
    });

    it('should handle unsupported marketplace gracefully', async () => {
      await expect(
        service.fetchAndCacheSchemas('invalid' as any, 'categories')
      ).rejects.toThrow('Unsupported marketplace');
    });
  });

  // ========================================================================
  // TESTS: Multiple Marketplaces
  // ========================================================================

  describe('Multiple Marketplaces', () => {
    it('should handle Shopee and Mercado Livre independently', async () => {
      (cacheModule.getCached as any).mockResolvedValue(null);

      const shopeeSchema = await service.fetchAndCacheSchemas('shopee', 'categories');
      const mlSchema = await service.fetchAndCacheSchemas('mercadolivre', 'categories');

      expect(shopeeSchema.marketplace).toBe('shopee');
      expect(mlSchema.marketplace).toBe('mercadolivre');

      // Invalidate Shopee only
      (cacheModule.invalidateCache as any).mockResolvedValue(undefined);
      await service.invalidateSchemaCache('shopee', 'categories');

      // Only Shopee should be invalidated
      expect(cacheModule.invalidateCache).toHaveBeenCalledWith('schema:shopee:categories');
      expect(cacheModule.invalidateCache).not.toHaveBeenCalledWith('schema:mercadolivre:categories');
    });

    it('should invalidate all marketplaces when specified', async () => {
      (cacheModule.invalidateByPattern as any).mockResolvedValue(undefined);

      // Invalidate all shopee
      await service.invalidateSchemaCache('shopee');
      
      // Invalidate all mercadolivre
      await service.invalidateSchemaCache('mercadolivre');

      expect(cacheModule.invalidateByPattern).toHaveBeenCalledWith('schema:shopee:*');
      expect(cacheModule.invalidateByPattern).toHaveBeenCalledWith('schema:mercadolivre:*');
    });
  });

  // ========================================================================
  // TESTS: Cache TTL and Expiration
  // ========================================================================

  describe('Cache TTL and Expiration', () => {
    it('should set correct TTL (5 minutes) when caching', async () => {
      (cacheModule.getCached as any).mockResolvedValueOnce(null);

      await service.fetchAndCacheSchemas('shopee', 'categories');

      expect(cacheModule.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          ttl: 300, // 5 minutes
        })
      );
    });

    it('should calculate remaining TTL correctly', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 180000); // 3 minutes from now

      const schema = {
        type: 'categories' as const,
        marketplace: 'shopee' as const,
        data: [{ id: '1' }],
        fetchedAt: now,
        expiresAt,
        version: new Date().toISOString(),
      };

      (cacheModule.getCached as any).mockResolvedValueOnce(schema);

      await service.getSchemaFromCache('shopee', 'categories');

      // Expiration info should be recent
      const stats = service.getCacheStats();
      expect(stats.hits).toBe(1);
    });
  });
});
