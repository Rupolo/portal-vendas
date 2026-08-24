/**
 * Marketplace Schema Service - Property-Based Tests
 * ==================================================
 * 
 * Property-based tests using fast-check to verify cache consistency
 * across arbitrary sequences of operations.
 * 
 * **Validates: Requirements 11, 12**
 * - Req 11: Synchronization of categories and attributes
 * - Req 12: Performance and scalability of synchronization
 * 
 * Tests verify cache consistency properties:
 * 1. Cache identity: Same key always returns same value until invalidation
 * 2. Cache expiration: Expired cache is refreshed or returns null
 * 3. Cache invalidation: Invalidated cache is no longer retrievable
 * 4. Fetch isolation: Multiple fetches are independent
 * 5. Concurrent safety: Operations don't interfere with each other
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { marketplaceSchemaService, MarketplaceSchemaService, type Marketplace, type SchemaType } from './marketplace-schema.service';
import * as cacheModule from '../cache';

// ============================================================================
// SETUP AND MOCKS
// ============================================================================

vi.mock('../cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateByPattern: vi.fn(),
}));

// ============================================================================
// GENERATORS AND HELPERS
// ============================================================================

/**
 * Generate arbitrary marketplace values
 */
const marketplaceArbitrary = fc.constantFrom<Marketplace>('shopee', 'mercadolivre');

/**
 * Generate arbitrary schema type values
 */
const schemaTypeArbitrary = fc.constantFrom<SchemaType>('categories', 'attributes', 'all');

/**
 * Generate arbitrary schema objects
 */
const schemaArbitrary = fc.record({
  categories: fc.array(
    fc.record({
      id: fc.string(),
      name: fc.string(),
    }),
    { minLength: 1, maxLength: 10 }
  ),
});

/**
 * Generate cache expiration states
 */
const expirationStateArbitrary = fc.oneof(
  fc.constant('fresh'), // Cache is fresh, not expired
  fc.constant('expired'), // Cache has expired
  fc.constant('missing') // Cache doesn't exist
);

/**
 * Generate operation sequences
 */
const operationArbitrary = fc.constantFrom<'fetch' | 'get' | 'invalidate' | 'refresh'>(
  'fetch',
  'get',
  'invalidate',
  'refresh'
);

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('MarketplaceSchemaService - Property-Based Tests', () => {
  let service: MarketplaceSchemaService;

  beforeEach(() => {
    service = new MarketplaceSchemaService();
    vi.clearAllMocks();

    // Default mock implementations
    (cacheModule.getCached as any).mockResolvedValue(null);
    (cacheModule.setCached as any).mockResolvedValue(undefined);
    (cacheModule.invalidateCache as any).mockResolvedValue(undefined);
    (cacheModule.invalidateByPattern as any).mockResolvedValue(undefined);
  });

  /**
   * Property 1: Cache Identity
   * 
   * Fetching the same schema twice without invalidation should return
   * the same data (from cache the second time).
   */
  describe('Property 1: Cache Identity', () => {
    it(
      'should return identical data on repeated fetches without invalidation',
      async () => {
        await fc.assert(
          fc.asyncProperty(marketplaceArbitrary, schemaTypeArbitrary, async (marketplace, type) => {
            const mockSchema = {
              type,
              marketplace,
              data: [{ id: '1', name: 'Test' }],
              fetchedAt: new Date(),
              expiresAt: new Date(Date.now() + 60000),
              version: new Date().toISOString(),
            };

            // First fetch - from API
            (cacheModule.getCached as any).mockResolvedValueOnce(null);
            const first = await service.fetchAndCacheSchemas(marketplace, type);

            // Second fetch - from cache
            (cacheModule.getCached as any).mockResolvedValueOnce(mockSchema);
            const second = await service.getSchemaFromCache(marketplace, type);

            // Both should have same structure
            expect(first.marketplace).toBe(second?.marketplace);
            expect(first.type).toBe(second?.type);
          })
        );
      }
    );
  });

  /**
   * Property 2: Cache Expiration Consistency
   * 
   * Once a schema expires, subsequent requests should either:
   * - Return null (if autoRefresh=false)
   * - Return fresh data (if autoRefresh=true)
   */
  describe('Property 2: Cache Expiration Consistency', () => {
    it(
      'should handle expired cache consistently',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            marketplaceArbitrary,
            schemaTypeArbitrary,
            expirationStateArbitrary,
            async (marketplace, type, expirationState) => {
              if (expirationState === 'missing') {
                (cacheModule.getCached as any).mockResolvedValueOnce(null);
                const result = await service.getSchemaFromCache(marketplace, type, false);
                expect(result).toBeNull();
              } else if (expirationState === 'expired') {
                const expiredSchema = {
                  type,
                  marketplace,
                  data: [{ id: '1' }],
                  fetchedAt: new Date(),
                  expiresAt: new Date(Date.now() - 1000), // Already expired
                  version: new Date().toISOString(),
                };

                (cacheModule.getCached as any).mockResolvedValueOnce(expiredSchema);
                const result = await service.getSchemaFromCache(marketplace, type, false);

                // With autoRefresh=false, should return null for expired cache
                expect(result).toBeNull();
              } else {
                // Fresh cache
                const freshSchema = {
                  type,
                  marketplace,
                  data: [{ id: '1' }],
                  fetchedAt: new Date(),
                  expiresAt: new Date(Date.now() + 60000),
                  version: new Date().toISOString(),
                };

                (cacheModule.getCached as any).mockResolvedValueOnce(freshSchema);
                const result = await service.getSchemaFromCache(marketplace, type);

                expect(result).toBeDefined();
                expect(result?.data).toEqual(freshSchema.data);
              }
            }
          )
        );
      }
    );
  });

  /**
   * Property 3: Cache Invalidation Idempotency
   * 
   * Invalidating the same cache multiple times should be idempotent
   * (no different effect than invalidating once).
   */
  describe('Property 3: Cache Invalidation Idempotency', () => {
    it(
      'should handle multiple invalidations of same cache consistently',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            marketplaceArbitrary,
            schemaTypeArbitrary,
            fc.integer({ min: 1, max: 5 }),
            async (marketplace, type, invalidationCount) => {
              let invalidationCalls = 0;

              (cacheModule.invalidateCache as any).mockImplementation(async () => {
                invalidationCalls++;
              });

              // Invalidate multiple times
              for (let i = 0; i < invalidationCount; i++) {
                await service.invalidateSchemaCache(marketplace, type);
              }

              // Each invalidation should call the underlying cache invalidation
              expect(invalidationCalls).toBe(invalidationCount * 2); // schema + metadata
              expect(service.getCacheStats().invalidations).toBe(invalidationCount);
            }
          )
        );
      }
    );
  });

  /**
   * Property 4: Fetch Sequence Validity
   * 
   * For any sequence of marketplaces and types, fetching should always
   * produce valid schema objects with required fields.
   */
  describe('Property 4: Fetch Sequence Validity', () => {
    it(
      'should produce valid schemas for all marketplace/type combinations',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.tuple(marketplaceArbitrary, schemaTypeArbitrary), {
              minLength: 1,
              maxLength: 10,
            }),
            async (requests) => {
              (cacheModule.getCached as any).mockResolvedValue(null);

              for (const [marketplace, type] of requests) {
                const schema = await service.fetchAndCacheSchemas(marketplace, type);

                // All schemas must have these fields
                expect(schema).toHaveProperty('marketplace', marketplace);
                expect(schema).toHaveProperty('type', type);
                expect(schema).toHaveProperty('data');
                expect(schema).toHaveProperty('fetchedAt');
                expect(schema).toHaveProperty('expiresAt');
                expect(schema.data).toBeDefined();
                expect(schema.expiresAt.getTime()).toBeGreaterThan(schema.fetchedAt.getTime());
              }

              // Stats should reflect all fetches
              expect(service.getCacheStats().fetches).toBe(requests.length);
            }
          )
        );
      }
    );
  });

  /**
   * Property 5: Cache Statistics Monotonicity
   * 
   * Cache statistics (hits, misses, fetches, invalidations) should only
   * increase or stay the same, never decrease.
   */
  describe('Property 5: Cache Statistics Monotonicity', () => {
    it(
      'should monotonically increase cache statistics',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(operationArbitrary, { minLength: 1, maxLength: 20 }),
            marketplaceArbitrary,
            schemaTypeArbitrary,
            async (operations, marketplace, type) => {
              const statsHistory: Array<ReturnType<typeof service.getCacheStats>> = [];
              statsHistory.push(service.getCacheStats());

              const mockSchema = {
                type,
                marketplace,
                data: [{ id: '1' }],
                fetchedAt: new Date(),
                expiresAt: new Date(Date.now() + 60000),
                version: new Date().toISOString(),
              };

              for (const op of operations) {
                if (op === 'fetch') {
                  (cacheModule.getCached as any).mockResolvedValueOnce(null);
                  await service.fetchAndCacheSchemas(marketplace, type);
                } else if (op === 'get') {
                  (cacheModule.getCached as any).mockResolvedValueOnce(mockSchema);
                  await service.getSchemaFromCache(marketplace, type);
                } else if (op === 'invalidate') {
                  (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
                  await service.invalidateSchemaCache(marketplace, type);
                } else if (op === 'refresh') {
                  (cacheModule.getCached as any).mockResolvedValueOnce(null);
                  (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
                  await service.refreshSchema(marketplace, type);
                }

                statsHistory.push(service.getCacheStats());
              }

              // Verify monotonicity
              for (let i = 1; i < statsHistory.length; i++) {
                const prev = statsHistory[i - 1];
                const curr = statsHistory[i];

                expect(curr.hits).toBeGreaterThanOrEqual(prev.hits);
                expect(curr.misses).toBeGreaterThanOrEqual(prev.misses);
                expect(curr.fetches).toBeGreaterThanOrEqual(prev.fetches);
                expect(curr.invalidations).toBeGreaterThanOrEqual(prev.invalidations);
              }
            }
          )
        );
      }
    );
  });

  /**
   * Property 6: Schema Type Independence
   * 
   * Caching of different schema types (categories vs attributes) should
   * not interfere with each other.
   */
  describe('Property 6: Schema Type Independence', () => {
    it(
      'should keep different schema types independent',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            marketplaceArbitrary,
            async (marketplace) => {
              (cacheModule.getCached as any).mockResolvedValue(null);

              // Fetch both types
              const categories = await service.fetchAndCacheSchemas(marketplace, 'categories');
              const attributes = await service.fetchAndCacheSchemas(marketplace, 'attributes');

              // Should be different
              expect(categories.type).not.toBe(attributes.type);
              expect(categories.type).toBe('categories');
              expect(attributes.type).toBe('attributes');

              // Invalidate only categories
              (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
              await service.invalidateSchemaCache(marketplace, 'categories');

              // Attributes should still be queryable
              (cacheModule.getCached as any).mockResolvedValueOnce(attributes);
              const stillCached = await service.getSchemaFromCache(marketplace, 'attributes');
              expect(stillCached).toBeDefined();
            }
          )
        );
      }
    );
  });

  /**
   * Property 7: Marketplace Independence
   * 
   * Caching of different marketplaces (Shopee vs Mercado Livre) should
   * not interfere with each other.
   */
  describe('Property 7: Marketplace Independence', () => {
    it(
      'should keep different marketplaces independent',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            schemaTypeArbitrary,
            async (type) => {
              (cacheModule.getCached as any).mockResolvedValue(null);

              // Fetch from both marketplaces
              const shopee = await service.fetchAndCacheSchemas('shopee', type);
              const ml = await service.fetchAndCacheSchemas('mercadolivre', type);

              // Should be different
              expect(shopee.marketplace).not.toBe(ml.marketplace);
              expect(shopee.marketplace).toBe('shopee');
              expect(ml.marketplace).toBe('mercadolivre');

              // Invalidate only Shopee
              (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
              await service.invalidateSchemaCache('shopee', type);

              // ML should still be queryable
              (cacheModule.getCached as any).mockResolvedValueOnce(ml);
              const stillCached = await service.getSchemaFromCache('mercadolivre', type);
              expect(stillCached).toBeDefined();
              expect(stillCached?.marketplace).toBe('mercadolivre');
            }
          )
        );
      }
    );
  });

  /**
   * Property 8: Cache Hit Rate Consistency
   * 
   * Cache hit rate should be consistent across repeated operations with
   * the same parameters.
   */
  describe('Property 8: Cache Hit Rate Consistency', () => {
    it(
      'should maintain consistent hit rate for repeated queries',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            marketplaceArbitrary,
            schemaTypeArbitrary,
            fc.integer({ min: 2, max: 10 }),
            async (marketplace, type, repeatCount) => {
              const mockSchema = {
                type,
                marketplace,
                data: [{ id: '1' }],
                fetchedAt: new Date(),
                expiresAt: new Date(Date.now() + 60000),
                version: new Date().toISOString(),
              };

              // First call is a miss
              (cacheModule.getCached as any).mockResolvedValueOnce(null);
              await service.fetchAndCacheSchemas(marketplace, type);

              // Subsequent calls are hits
              (cacheModule.getCached as any).mockResolvedValue(mockSchema);
              for (let i = 0; i < repeatCount; i++) {
                await service.getSchemaFromCache(marketplace, type);
              }

              const stats = service.getCacheStats();

              // Should have 1 fetch, 0 initial misses (fetch doesn't count toward miss)
              // and repeatCount hits
              expect(stats.fetches).toBe(1);
              expect(stats.hits).toBe(repeatCount);
            }
          )
        );
      }
    );
  });

  /**
   * Property 9: TTL Expiration Window
   * 
   * Schemas should expire within the configured TTL window (5 minutes).
   * Expiration time should be >= current time + TTL.
   */
  describe('Property 9: TTL Expiration Window', () => {
    it(
      'should set expiration within correct TTL window',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            marketplaceArbitrary,
            schemaTypeArbitrary,
            async (marketplace, type) => {
              (cacheModule.getCached as any).mockResolvedValueOnce(null);

              const beforeFetch = Date.now();
              const schema = await service.fetchAndCacheSchemas(marketplace, type);
              const afterFetch = Date.now();

              // Expiration should be set for 5 minutes (300 seconds) from fetch time
              const expectedMinExpiration = beforeFetch + 300 * 1000;
              const expectedMaxExpiration = afterFetch + 300 * 1000 + 1000; // Allow 1s margin

              const actualExpiration = schema.expiresAt.getTime();

              expect(actualExpiration).toBeGreaterThanOrEqual(expectedMinExpiration);
              expect(actualExpiration).toBeLessThanOrEqual(expectedMaxExpiration);
            }
          )
        );
      }
    );
  });

  /**
   * Property 10: Operation Commutativity for Different Keys
   * 
   * Operations on different cache keys should be commutative (order doesn't matter
   * for the final result when keys are different).
   */
  describe('Property 10: Operation Commutativity for Different Keys', () => {
    it(
      'should handle different keys independently regardless of order',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.tuple(marketplaceArbitrary, schemaTypeArbitrary, schemaTypeArbitrary).filter(
              ([m, t1, t2]) => t1 !== t2
            ),
            async ([marketplace, type1, type2]) => {
              const schema1 = {
                type: type1,
                marketplace,
                data: [{ id: '1' }],
                fetchedAt: new Date(),
                expiresAt: new Date(Date.now() + 60000),
                version: new Date().toISOString(),
              };

              const schema2 = {
                type: type2,
                marketplace,
                data: [{ id: '2' }],
                fetchedAt: new Date(),
                expiresAt: new Date(Date.now() + 60000),
                version: new Date().toISOString(),
              };

              // Order 1: Fetch type1 then type2
              (cacheModule.getCached as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
              await service.fetchAndCacheSchemas(marketplace, type1);
              await service.fetchAndCacheSchemas(marketplace, type2);

              const stats1 = service.getCacheStats();

              // Reset
              service.resetCacheStats();
              vi.clearAllMocks();

              // Order 2: Fetch type2 then type1
              (cacheModule.getCached as any)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
              await service.fetchAndCacheSchemas(marketplace, type2);
              await service.fetchAndCacheSchemas(marketplace, type1);

              const stats2 = service.getCacheStats();

              // Final stats should be the same regardless of order
              expect(stats1.fetches).toBe(stats2.fetches);
              expect(stats1.hits).toBe(stats2.hits);
            }
          )
        );
      }
    );
  });
});

import { marketplaceSchemaService, MarketplaceSchemaService, type Marketplace, type SchemaType } from './marketplace-schema.service';
import * as cacheModule from '../cache';

// ============================================================================
// SETUP AND MOCKS
// ============================================================================

vi.mock('../cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateByPattern: vi.fn(),
}));

// ============================================================================
// GENERATORS AND HELPERS
// ============================================================================

/**
 * Generate arbitrary marketplace values
 */
const marketplaceArbitrary = fc.constantFrom<Marketplace>('shopee', 'mercadolivre');

/**
 * Generate arbitrary schema type values
 */
const schemaTypeArbitrary = fc.constantFrom<SchemaType>('categories', 'attributes', 'all');

/**
 * Generate arbitrary schema objects
 */
const schemaArbitrary = fc.record({
  categories: fc.array(
    fc.record({
      id: fc.string(),
      name: fc.string(),
    }),
    { minLength: 1, maxLength: 10 }
  ),
});

/**
 * Generate cache expiration states
 */
const expirationStateArbitrary = fc.oneof(
  fc.constant('fresh'), // Cache is fresh, not expired
  fc.constant('expired'), // Cache has expired
  fc.constant('missing') // Cache doesn't exist
);

/**
 * Generate operation sequences
 */
const operationArbitrary = fc.constantFrom<'fetch' | 'get' | 'invalidate' | 'refresh'>(
  'fetch',
  'get',
  'invalidate',
  'refresh'
);

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('MarketplaceSchemaService - Property-Based Tests', () => {
  let service: MarketplaceSchemaService;

  beforeEach(() => {
    service = new MarketplaceSchemaService();
    vi.clearAllMocks();

    // Default mock implementations
    (cacheModule.getCached as any).mockResolvedValue(null);
    (cacheModule.setCached as any).mockResolvedValue(undefined);
    (cacheModule.invalidateCache as any).mockResolvedValue(undefined);
    (cacheModule.invalidateByPattern as any).mockResolvedValue(undefined);
  });

  /**
   * Property 1: Cache Identity
   * 
   * Fetching the same schema twice without invalidation should return
   * the same data (from cache the second time).
   */
  describe('Property 1: Cache Identity', () => {
    it(
      'should return identical data on repeated fetches without invalidation',
      fc.asyncProperty(marketplaceArbitrary, schemaTypeArbitrary, async (marketplace, type) => {
        const mockSchema = {
          type,
          marketplace,
          data: [{ id: '1', name: 'Test' }],
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: new Date().toISOString(),
        };

        // First fetch - from API
        (cacheModule.getCached as any).mockResolvedValueOnce(null);
        const first = await service.fetchAndCacheSchemas(marketplace, type);

        // Second fetch - from cache
        (cacheModule.getCached as any).mockResolvedValueOnce(mockSchema);
        const second = await service.getSchemaFromCache(marketplace, type);

        // Both should have same structure
        expect(first.marketplace).toBe(second?.marketplace);
        expect(first.type).toBe(second?.type);
      })
    );
  });

  /**
   * Property 2: Cache Expiration Consistency
   * 
   * Once a schema expires, subsequent requests should either:
   * - Return null (if autoRefresh=false)
   * - Return fresh data (if autoRefresh=true)
   */
  describe('Property 2: Cache Expiration Consistency', () => {
    it(
      'should handle expired cache consistently',
      fc.asyncProperty(
        marketplaceArbitrary,
        schemaTypeArbitrary,
        expirationStateArbitrary,
        async (marketplace, type, expirationState) => {
          if (expirationState === 'missing') {
            (cacheModule.getCached as any).mockResolvedValueOnce(null);
            const result = await service.getSchemaFromCache(marketplace, type, false);
            expect(result).toBeNull();
          } else if (expirationState === 'expired') {
            const expiredSchema = {
              type,
              marketplace,
              data: [{ id: '1' }],
              fetchedAt: new Date(),
              expiresAt: new Date(Date.now() - 1000), // Already expired
              version: new Date().toISOString(),
            };

            (cacheModule.getCached as any).mockResolvedValueOnce(expiredSchema);
            const result = await service.getSchemaFromCache(marketplace, type, false);

            // With autoRefresh=false, should return null for expired cache
            expect(result).toBeNull();
          } else {
            // Fresh cache
            const freshSchema = {
              type,
              marketplace,
              data: [{ id: '1' }],
              fetchedAt: new Date(),
              expiresAt: new Date(Date.now() + 60000),
              version: new Date().toISOString(),
            };

            (cacheModule.getCached as any).mockResolvedValueOnce(freshSchema);
            const result = await service.getSchemaFromCache(marketplace, type);

            expect(result).toBeDefined();
            expect(result?.data).toEqual(freshSchema.data);
          }
        }
      )
    );
  });

  /**
   * Property 3: Cache Invalidation Idempotency
   * 
   * Invalidating the same cache multiple times should be idempotent
   * (no different effect than invalidating once).
   */
  describe('Property 3: Cache Invalidation Idempotency', () => {
    it(
      'should handle multiple invalidations of same cache consistently',
      fc.asyncProperty(
        marketplaceArbitrary,
        schemaTypeArbitrary,
        fc.integer({ min: 1, max: 5 }),
        async (marketplace, type, invalidationCount) => {
          let invalidationCalls = 0;

          (cacheModule.invalidateCache as any).mockImplementation(async () => {
            invalidationCalls++;
          });

          // Invalidate multiple times
          for (let i = 0; i < invalidationCount; i++) {
            await service.invalidateSchemaCache(marketplace, type);
          }

          // Each invalidation should call the underlying cache invalidation
          expect(invalidationCalls).toBe(invalidationCount * 2); // schema + metadata
          expect(service.getCacheStats().invalidations).toBe(invalidationCount);
        }
      )
    );
  });

  /**
   * Property 4: Fetch Sequence Validity
   * 
   * For any sequence of marketplaces and types, fetching should always
   * produce valid schema objects with required fields.
   */
  describe('Property 4: Fetch Sequence Validity', () => {
    it(
      'should produce valid schemas for all marketplace/type combinations',
      fc.asyncProperty(
        fc.array(fc.tuple(marketplaceArbitrary, schemaTypeArbitrary), {
          minLength: 1,
          maxLength: 10,
        }),
        async (requests) => {
          (cacheModule.getCached as any).mockResolvedValue(null);

          for (const [marketplace, type] of requests) {
            const schema = await service.fetchAndCacheSchemas(marketplace, type);

            // All schemas must have these fields
            expect(schema).toHaveProperty('marketplace', marketplace);
            expect(schema).toHaveProperty('type', type);
            expect(schema).toHaveProperty('data');
            expect(schema).toHaveProperty('fetchedAt');
            expect(schema).toHaveProperty('expiresAt');
            expect(schema.data).toBeDefined();
            expect(schema.expiresAt.getTime()).toBeGreaterThan(schema.fetchedAt.getTime());
          }

          // Stats should reflect all fetches
          expect(service.getCacheStats().fetches).toBe(requests.length);
        }
      )
    );
  });

  /**
   * Property 5: Cache Statistics Monotonicity
   * 
   * Cache statistics (hits, misses, fetches, invalidations) should only
   * increase or stay the same, never decrease.
   */
  describe('Property 5: Cache Statistics Monotonicity', () => {
    it(
      'should monotonically increase cache statistics',
      fc.asyncProperty(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 20 }),
        marketplaceArbitrary,
        schemaTypeArbitrary,
        async (operations, marketplace, type) => {
          const statsHistory: Array<ReturnType<typeof service.getCacheStats>> = [];
          statsHistory.push(service.getCacheStats());

          const mockSchema = {
            type,
            marketplace,
            data: [{ id: '1' }],
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
            version: new Date().toISOString(),
          };

          for (const op of operations) {
            if (op === 'fetch') {
              (cacheModule.getCached as any).mockResolvedValueOnce(null);
              await service.fetchAndCacheSchemas(marketplace, type);
            } else if (op === 'get') {
              (cacheModule.getCached as any).mockResolvedValueOnce(mockSchema);
              await service.getSchemaFromCache(marketplace, type);
            } else if (op === 'invalidate') {
              (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
              await service.invalidateSchemaCache(marketplace, type);
            } else if (op === 'refresh') {
              (cacheModule.getCached as any).mockResolvedValueOnce(null);
              (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
              await service.refreshSchema(marketplace, type);
            }

            statsHistory.push(service.getCacheStats());
          }

          // Verify monotonicity
          for (let i = 1; i < statsHistory.length; i++) {
            const prev = statsHistory[i - 1];
            const curr = statsHistory[i];

            expect(curr.hits).toBeGreaterThanOrEqual(prev.hits);
            expect(curr.misses).toBeGreaterThanOrEqual(prev.misses);
            expect(curr.fetches).toBeGreaterThanOrEqual(prev.fetches);
            expect(curr.invalidations).toBeGreaterThanOrEqual(prev.invalidations);
          }
        }
      )
    );
  });

  /**
   * Property 6: Schema Type Independence
   * 
   * Caching of different schema types (categories vs attributes) should
   * not interfere with each other.
   */
  describe('Property 6: Schema Type Independence', () => {
    it(
      'should keep different schema types independent',
      fc.asyncProperty(
        marketplaceArbitrary,
        async (marketplace) => {
          (cacheModule.getCached as any).mockResolvedValue(null);

          // Fetch both types
          const categories = await service.fetchAndCacheSchemas(marketplace, 'categories');
          const attributes = await service.fetchAndCacheSchemas(marketplace, 'attributes');

          // Should be different
          expect(categories.type).not.toBe(attributes.type);
          expect(categories.type).toBe('categories');
          expect(attributes.type).toBe('attributes');

          // Invalidate only categories
          (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
          await service.invalidateSchemaCache(marketplace, 'categories');

          // Attributes should still be queryable
          (cacheModule.getCached as any).mockResolvedValueOnce(attributes);
          const stillCached = await service.getSchemaFromCache(marketplace, 'attributes');
          expect(stillCached).toBeDefined();
        }
      )
    );
  });

  /**
   * Property 7: Marketplace Independence
   * 
   * Caching of different marketplaces (Shopee vs Mercado Livre) should
   * not interfere with each other.
   */
  describe('Property 7: Marketplace Independence', () => {
    it(
      'should keep different marketplaces independent',
      fc.asyncProperty(
        schemaTypeArbitrary,
        async (type) => {
          (cacheModule.getCached as any).mockResolvedValue(null);

          // Fetch from both marketplaces
          const shopee = await service.fetchAndCacheSchemas('shopee', type);
          const ml = await service.fetchAndCacheSchemas('mercadolivre', type);

          // Should be different
          expect(shopee.marketplace).not.toBe(ml.marketplace);
          expect(shopee.marketplace).toBe('shopee');
          expect(ml.marketplace).toBe('mercadolivre');

          // Invalidate only Shopee
          (cacheModule.invalidateCache as any).mockResolvedValueOnce(undefined);
          await service.invalidateSchemaCache('shopee', type);

          // ML should still be queryable
          (cacheModule.getCached as any).mockResolvedValueOnce(ml);
          const stillCached = await service.getSchemaFromCache('mercadolivre', type);
          expect(stillCached).toBeDefined();
          expect(stillCached?.marketplace).toBe('mercadolivre');
        }
      )
    );
  });

  /**
   * Property 8: Cache Hit Rate Consistency
   * 
   * Cache hit rate should be consistent across repeated operations with
   * the same parameters.
   */
  describe('Property 8: Cache Hit Rate Consistency', () => {
    it(
      'should maintain consistent hit rate for repeated queries',
      fc.asyncProperty(
        marketplaceArbitrary,
        schemaTypeArbitrary,
        fc.integer({ min: 2, max: 10 }),
        async (marketplace, type, repeatCount) => {
          const mockSchema = {
            type,
            marketplace,
            data: [{ id: '1' }],
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
            version: new Date().toISOString(),
          };

          // First call is a miss
          (cacheModule.getCached as any).mockResolvedValueOnce(null);
          await service.fetchAndCacheSchemas(marketplace, type);

          // Subsequent calls are hits
          (cacheModule.getCached as any).mockResolvedValue(mockSchema);
          for (let i = 0; i < repeatCount; i++) {
            await service.getSchemaFromCache(marketplace, type);
          }

          const stats = service.getCacheStats();

          // Should have 1 fetch, 0 initial misses (fetch doesn't count toward miss)
          // and repeatCount hits
          expect(stats.fetches).toBe(1);
          expect(stats.hits).toBe(repeatCount);
        }
      )
    );
  });

  /**
   * Property 9: TTL Expiration Window
   * 
   * Schemas should expire within the configured TTL window (5 minutes).
   * Expiration time should be >= current time + TTL.
   */
  describe('Property 9: TTL Expiration Window', () => {
    it(
      'should set expiration within correct TTL window',
      fc.asyncProperty(
        marketplaceArbitrary,
        schemaTypeArbitrary,
        async (marketplace, type) => {
          (cacheModule.getCached as any).mockResolvedValueOnce(null);

          const beforeFetch = Date.now();
          const schema = await service.fetchAndCacheSchemas(marketplace, type);
          const afterFetch = Date.now();

          // Expiration should be set for 5 minutes (300 seconds) from fetch time
          const expectedMinExpiration = beforeFetch + 300 * 1000;
          const expectedMaxExpiration = afterFetch + 300 * 1000 + 1000; // Allow 1s margin

          const actualExpiration = schema.expiresAt.getTime();

          expect(actualExpiration).toBeGreaterThanOrEqual(expectedMinExpiration);
          expect(actualExpiration).toBeLessThanOrEqual(expectedMaxExpiration);
        }
      )
    );
  });

  /**
   * Property 10: Operation Commutativity for Different Keys
   * 
   * Operations on different cache keys should be commutative (order doesn't matter
   * for the final result when keys are different).
   */
  describe('Property 10: Operation Commutativity for Different Keys', () => {
    it(
      'should handle different keys independently regardless of order',
      fc.asyncProperty(
        fc.tuple(marketplaceArbitrary, schemaTypeArbitrary, schemaTypeArbitrary).filter(
          ([m, t1, t2]) => t1 !== t2
        ),
        async ([marketplace, type1, type2]) => {
          const schema1 = {
            type: type1,
            marketplace,
            data: [{ id: '1' }],
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
            version: new Date().toISOString(),
          };

          const schema2 = {
            type: type2,
            marketplace,
            data: [{ id: '2' }],
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
            version: new Date().toISOString(),
          };

          // Order 1: Fetch type1 then type2
          (cacheModule.getCached as any)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
          await service.fetchAndCacheSchemas(marketplace, type1);
          await service.fetchAndCacheSchemas(marketplace, type2);

          const stats1 = service.getCacheStats();

          // Reset
          service.resetCacheStats();
          vi.clearAllMocks();

          // Order 2: Fetch type2 then type1
          (cacheModule.getCached as any)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
          await service.fetchAndCacheSchemas(marketplace, type2);
          await service.fetchAndCacheSchemas(marketplace, type1);

          const stats2 = service.getCacheStats();

          // Final stats should be the same regardless of order
          expect(stats1.fetches).toBe(stats2.fetches);
          expect(stats1.hits).toBe(stats2.hits);
        }
      )
    );
  });
});
