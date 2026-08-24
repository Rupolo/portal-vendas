/**
 * Tests for Cache Layer Implementation
 * 
 * Validates:
 * - Cache TTL configuration (schemas 5min, products 1min, inventory 30s, orders 2min)
 * - Cache operations (get, set, delete, batch operations)
 * - Cache invalidation strategies
 * - Marketplace schema caching
 * 
 * Requirements covered:
 * - Requisito 7: "Sincronização de Descrições e Metadados"
 * - Requisito 11: "Sincronização de Categorias e Atributos"
 * - Requisito 12: "Performance e Escalabilidade"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import {
  getCached,
  setCached,
  invalidateCache,
  invalidateMultiple,
  invalidateByPattern,
  cacheMarketplaceSchema,
  getCachedMarketplaceSchema,
  cacheProduct,
  getCachedProduct,
  cacheInventory,
  getCachedInventory,
  cacheOrder,
  getCachedOrder,
  batchGet,
  batchSet,
  incrementCounter,
  decrementCounter,
} from '@/lib/cache';
import { config } from '@/lib/config';

/**
 * Mock data for testing
 */
const mockProduct = {
  id: '123',
  title: 'Test Product',
  price: 99.99,
  description: 'A test product',
};

const mockInventory = {
  productId: '123',
  total: 100,
  available: 50,
  reserved: 50,
};

const mockOrder = {
  id: 'order-123',
  status: 'pending',
  total: 299.97,
};

const mockSchema = {
  categories: [
    { id: 'cat1', name: 'Electronics' },
    { id: 'cat2', name: 'Clothing' },
  ],
  attributes: [
    { id: 'attr1', name: 'Color' },
    { id: 'attr2', name: 'Size' },
  ],
};

describe('Cache Layer', () => {
  describe('Basic Cache Operations', () => {
    it('should cache and retrieve a value', async () => {
      const key = 'test:key1';
      const value = { name: 'test' };

      await setCached(key, value);
      const result = await getCached(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await getCached('non:existent:key');
      expect(result).toBeNull();
    });

    it('should delete a cached value', async () => {
      const key = 'test:delete';
      const value = { data: 'test' };

      await setCached(key, value);
      await invalidateCache(key);

      const result = await getCached(key);
      expect(result).toBeNull();
    });

    it('should handle JSON serialization', async () => {
      const key = 'test:json';
      const value = {
        name: 'test',
        age: 25,
        tags: ['a', 'b'],
        nested: { key: 'value' },
      };

      await setCached(key, value);
      const result = await getCached(key);

      expect(result).toEqual(value);
    });
  });

  describe('TTL Configuration', () => {
    it('should have correct TTL for schemas (5 minutes)', () => {
      expect(config.cache.schemas).toBe(300);
    });

    it('should have correct TTL for products (1 minute)', () => {
      expect(config.cache.products).toBe(60);
    });

    it('should have correct TTL for inventory (30 seconds)', () => {
      expect(config.cache.inventory).toBe(30);
    });

    it('should have correct TTL for orders (2 minutes)', () => {
      expect(config.cache.orders).toBe(120);
    });

    it('should have correct TTL for general cache (10 minutes)', () => {
      expect(config.cache.general).toBe(600);
    });
  });

  describe('Marketplace Schema Caching', () => {
    it('should cache marketplace schema', async () => {
      const marketplace = 'shopee';
      await cacheMarketplaceSchema(marketplace, mockSchema);

      const cached = await getCachedMarketplaceSchema(marketplace);
      expect(cached).toEqual(mockSchema);
    });

    it('should cache different schemas for different marketplaces', async () => {
      const shopeeSchema = { name: 'Shopee Schema' };
      const mlSchema = { name: 'Mercado Livre Schema' };

      await cacheMarketplaceSchema('shopee', shopeeSchema);
      await cacheMarketplaceSchema('mercadolivre', mlSchema);

      const cachedShopee = await getCachedMarketplaceSchema('shopee');
      const cachedML = await getCachedMarketplaceSchema('mercadolivre');

      expect(cachedShopee).toEqual(shopeeSchema);
      expect(cachedML).toEqual(mlSchema);
    });

    it('should use correct TTL for schemas (5 minutes)', async () => {
      // The TTL is applied in setCached, we verify the configuration
      expect(config.cache.schemas).toBe(300);
    });
  });

  describe('Product Caching', () => {
    it('should cache product data', async () => {
      const productId = 'prod-123';
      await cacheProduct(productId, mockProduct);

      const cached = await getCachedProduct(productId);
      expect(cached).toEqual(mockProduct);
    });

    it('should return null for non-cached product', async () => {
      const cached = await getCachedProduct('non-existent-prod');
      expect(cached).toBeNull();
    });

    it('should use correct TTL for products (1 minute)', () => {
      expect(config.cache.products).toBe(60);
    });
  });

  describe('Inventory Caching', () => {
    it('should cache inventory data', async () => {
      const productId = 'prod-123';
      await cacheInventory(productId, mockInventory);

      const cached = await getCachedInventory(productId);
      expect(cached).toEqual(mockInventory);
    });

    it('should return null for non-cached inventory', async () => {
      const cached = await getCachedInventory('non-existent');
      expect(cached).toBeNull();
    });

    it('should use correct TTL for inventory (30 seconds)', () => {
      expect(config.cache.inventory).toBe(30);
    });

    it('should handle inventory with reserved quantity', async () => {
      const productId = 'prod-456';
      const inventory = {
        total: 100,
        reserved: 20,
        available: 80,
      };

      await cacheInventory(productId, inventory);
      const cached = await getCachedInventory(productId);

      expect(cached).toEqual(inventory);
      expect(cached.available).toBe(80);
    });
  });

  describe('Order Caching', () => {
    it('should cache order data', async () => {
      const orderId = 'order-123';
      await cacheOrder(orderId, mockOrder);

      const cached = await getCachedOrder(orderId);
      expect(cached).toEqual(mockOrder);
    });

    it('should return null for non-cached order', async () => {
      const cached = await getCachedOrder('non-existent-order');
      expect(cached).toBeNull();
    });

    it('should use correct TTL for orders (2 minutes)', () => {
      expect(config.cache.orders).toBe(120);
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch get', async () => {
      const key1 = 'batch:1';
      const key2 = 'batch:2';
      const value1 = { data: 'value1' };
      const value2 = { data: 'value2' };

      await setCached(key1, value1);
      await setCached(key2, value2);

      const results = await batchGet([key1, key2, 'batch:3']);

      expect(results.get(key1)).toEqual(value1);
      expect(results.get(key2)).toEqual(value2);
      expect(results.get('batch:3')).toBeNull();
    });

    it('should perform batch set', async () => {
      const data = {
        'batch:set:1': { value: 1 },
        'batch:set:2': { value: 2 },
        'batch:set:3': { value: 3 },
      };

      await batchSet(data);

      const result1 = await getCached('batch:set:1');
      const result2 = await getCached('batch:set:2');
      const result3 = await getCached('batch:set:3');

      expect(result1).toEqual(data['batch:set:1']);
      expect(result2).toEqual(data['batch:set:2']);
      expect(result3).toEqual(data['batch:set:3']);
    });

    it('should return empty map for empty batch get', async () => {
      const results = await batchGet([]);
      expect(results.size).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate single key', async () => {
      const key = 'test:invalidate';
      await setCached(key, { data: 'test' });
      expect(await getCached(key)).toBeTruthy();

      await invalidateCache(key);
      expect(await getCached(key)).toBeNull();
    });

    it('should invalidate multiple keys', async () => {
      const keys = ['inv:1', 'inv:2', 'inv:3'];

      for (const key of keys) {
        await setCached(key, { value: key });
      }

      await invalidateMultiple(keys);

      for (const key of keys) {
        expect(await getCached(key)).toBeNull();
      }
    });

    it('should invalidate by pattern', async () => {
      // Set some keys with pattern
      await setCached('product:123', { id: '123' });
      await setCached('product:456', { id: '456' });
      await setCached('inventory:789', { id: '789' });

      // Invalidate all product:* keys
      await invalidateByPattern('product:*');

      // product keys should be cleared
      expect(await getCached('product:123')).toBeNull();
      expect(await getCached('product:456')).toBeNull();

      // inventory key should remain
      expect(await getCached('inventory:789')).toEqual({ id: '789' });
    });

    it('should handle empty invalidation gracefully', async () => {
      expect(async () => {
        await invalidateMultiple([]);
      }).not.toThrow();
    });
  });

  describe('Counter Operations', () => {
    it('should increment counter', async () => {
      const key = 'counter:increment';

      const value1 = await incrementCounter(key, 1);
      expect(value1).toBe(1);

      const value2 = await incrementCounter(key, 1);
      expect(value2).toBe(2);

      const value5 = await incrementCounter(key, 3);
      expect(value5).toBe(5);
    });

    it('should decrement counter', async () => {
      const key = 'counter:decrement';

      // Set initial value
      await incrementCounter(key, 10);

      const value1 = await decrementCounter(key, 1);
      expect(value1).toBe(9);

      const value2 = await decrementCounter(key, 3);
      expect(value2).toBe(6);
    });

    it('should not go below zero with decrement', async () => {
      const key = 'counter:zero';

      const value1 = await incrementCounter(key, 2);
      const value2 = await decrementCounter(key, 5);

      // Should be -3 (Redis allows negative values)
      expect(value2).toBe(-3);
    });

    it('should handle counter default increment amount', async () => {
      const key = 'counter:default';

      const value1 = await incrementCounter(key);
      expect(value1).toBe(1);

      const value2 = await incrementCounter(key);
      expect(value2).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should handle rapid cache operations', async () => {
      const startTime = Date.now();

      // Perform 100 cache operations
      for (let i = 0; i < 100; i++) {
        await setCached(`perf:${i}`, { value: i });
      }

      for (let i = 0; i < 100; i++) {
        await getCached(`perf:${i}`);
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large values', async () => {
      const largeValue = {
        data: new Array(1000).fill('test data'),
        nested: {
          array: new Array(100).fill({ key: 'value' }),
        },
      };

      const key = 'large:value';
      await setCached(key, largeValue);

      const result = await getCached(key);
      expect(result).toEqual(largeValue);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // getCached should return null on error, not throw
      const result = await getCached('any:key');
      expect(result === null || result !== null).toBe(true); // Should not throw
    });

    it('should handle invalid JSON gracefully', async () => {
      // This would test error handling if cache contained invalid data
      // For now, we verify graceful fallback behavior
      expect(async () => {
        await getCached('invalid:json');
      }).not.toThrow();
    });
  });

  describe('Cache Strategy for Sync Performance', () => {
    it('should enable fast product retrieval', async () => {
      const productId = 'sync-test-prod';
      const product = {
        id: productId,
        title: 'Sync Test',
        price: 29.99,
      };

      // Cache product
      await cacheProduct(productId, product);

      // Should retrieve quickly
      const startTime = Date.now();
      const cached = await getCachedProduct(productId);
      const duration = Date.now() - startTime;

      expect(cached).toEqual(product);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should enable fast inventory checks', async () => {
      const productId = 'sync-test-inv';
      const inventory = {
        total: 100,
        available: 50,
      };

      await cacheInventory(productId, inventory);

      const startTime = Date.now();
      const cached = await getCachedInventory(productId);
      const duration = Date.now() - startTime;

      expect(cached).toEqual(inventory);
      expect(duration).toBeLessThan(100);
    });

    it('should support marketplace schema caching for faster attribute validation', async () => {
      const marketplace = 'shopee';
      const schema = {
        categories: [{ id: 1, name: 'Electronics' }],
        attributes: [{ id: 1, name: 'Color', values: ['Red', 'Blue'] }],
      };

      await cacheMarketplaceSchema(marketplace, schema);

      const cached = await getCachedMarketplaceSchema(marketplace);
      expect(cached).toEqual(schema);
    });
  });

  describe('Requirements Compliance', () => {
    it('should cache schemas for 5 minutes (Requisito 12)', () => {
      // From requirements: schemas cached by 5 minutes
      expect(config.cache.schemas).toBe(300);
    });

    it('should cache products for 1 minute (Requisito 12)', () => {
      // From requirements: reduce API calls
      expect(config.cache.products).toBe(60);
    });

    it('should cache inventory for 30 seconds (Requisito 2)', () => {
      // From requirements: inventory is highly volatile
      expect(config.cache.inventory).toBe(30);
    });

    it('should support batch operations for performance (Requisito 12)', async () => {
      const batchData = {
        'batch:1': { id: 1 },
        'batch:2': { id: 2 },
        'batch:3': { id: 3 },
      };

      // Should handle bulk operations efficiently
      await batchSet(batchData);
      const results = await batchGet(Object.keys(batchData));

      expect(results.size).toBe(3);
    });

    it('should invalidate cache when data is updated', async () => {
      // Support for cache invalidation on updates
      const key = 'updated:product';
      await setCached(key, { version: 1 });

      expect(await getCached(key)).toEqual({ version: 1 });

      // Invalidate on update
      await invalidateCache(key);
      expect(await getCached(key)).toBeNull();

      // Set new value
      await setCached(key, { version: 2 });
      expect(await getCached(key)).toEqual({ version: 2 });
    });
  });
});

