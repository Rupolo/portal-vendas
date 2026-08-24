/**
 * Marketplace Schema Service
 * ==========================
 * 
 * Manages caching and fetching of marketplace schemas (categories and attributes)
 * from Shopee and Mercado Livre APIs with automatic refresh and manual invalidation.
 * 
 * Features:
 * - Cache marketplace schemas with 5-minute TTL
 * - Automatic refresh when cache expires
 * - Manual cache invalidation
 * - Logging for cache hits and misses
 * - Type-safe schema operations
 * 
 * @see config.ts for cache TTL configuration (cache.schemas = 300 seconds = 5 min)
 * @example
 * ```typescript
 * import { marketplaceSchemaService } from '@/lib/services/marketplace-schema.service';
 * 
 * // Fetch and cache schemas
 * const categories = await marketplaceSchemaService.fetchAndCacheSchemas('shopee', 'categories');
 * 
 * // Get from cache (with automatic refresh if expired)
 * const cached = await marketplaceSchemaService.getSchemaFromCache('shopee', 'categories');
 * 
 * // Manual invalidation
 * await marketplaceSchemaService.invalidateSchemaCache('shopee', 'categories');
 * ```
 */

import { config } from '../config';
import { getCached, setCached, invalidateCache, invalidateByPattern } from '../cache';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Supported marketplace types
 */
export type Marketplace = 'shopee' | 'mercadolivre';

/**
 * Supported schema types
 */
export type SchemaType = 'categories' | 'attributes' | 'all';

/**
 * Marketplace schema structure
 */
export interface MarketplaceSchema {
  type: SchemaType;
  marketplace: Marketplace;
  data: any;
  fetchedAt: Date;
  expiresAt: Date;
  version?: string;
}

/**
 * Cache key patterns
 */
const CACHE_KEY_PATTERNS = {
  SCHEMA: (marketplace: Marketplace, type: SchemaType) => 
    `schema:${marketplace}:${type}`,
  
  SCHEMA_METADATA: (marketplace: Marketplace) => 
    `schema:${marketplace}:metadata`,
  
  SCHEMA_WILDCARD: (marketplace: Marketplace) => 
    `schema:${marketplace}:*`,
};

/**
 * Shopee schema type
 */
interface ShopeeSchema {
  categories?: any[];
  attributes?: any[];
}

/**
 * Mercado Livre schema type
 */
interface MercadoLivreSchema {
  categories?: any[];
  attributes?: any[];
}

// ============================================================================
// MARKETPLACE SCHEMA SERVICE
// ============================================================================

export class MarketplaceSchemaService {
  /**
   * Cache statistics for monitoring
   */
  private cacheStats = {
    hits: 0,
    misses: 0,
    fetches: 0,
    invalidations: 0,
  };

  /**
   * Last fetch timestamp per marketplace to prevent excessive API calls
   */
  private lastFetchTime = new Map<string, number>();

  /**
   * Minimum time between fetches (1 minute)
   */
  private MIN_FETCH_INTERVAL = 60000;

  /**
   * Fetch and cache marketplace schemas from APIs
   * 
   * Makes API calls to marketplace to fetch categories and attributes,
   * then caches them with 5-minute TTL.
   * 
   * @param marketplace - Marketplace to fetch from ('shopee' or 'mercadolivre')
   * @param type - Schema type to fetch ('categories', 'attributes', or 'all')
   * @returns Fetched schema object
   * @throws Error if API call fails
   * 
   * @example
   * ```typescript
   * const categories = await schemaService.fetchAndCacheSchemas('shopee', 'categories');
   * ```
   */
  async fetchAndCacheSchemas(marketplace: Marketplace, type: SchemaType = 'all'): Promise<MarketplaceSchema> {
    const cacheKey = CACHE_KEY_PATTERNS.SCHEMA(marketplace, type);
    const lastFetch = this.lastFetchTime.get(cacheKey) || 0;
    const now = Date.now();

    // Prevent excessive API calls (rate limiting)
    if (now - lastFetch < this.MIN_FETCH_INTERVAL) {
      console.log(
        `[MarketplaceSchemaService] Fetch interval not met for ${marketplace} ${type}. ` +
        `Will retry in ${this.MIN_FETCH_INTERVAL - (now - lastFetch)}ms`
      );
      
      // Return cached version if available
      const cached = await getCached<MarketplaceSchema>(cacheKey);
      if (cached) {
        this.cacheStats.hits++;
        console.log(`[MarketplaceSchemaService] Returning cached schema for ${marketplace} ${type} (cache hit)`);
        return cached;
      }
    }

    try {
      this.cacheStats.fetches++;
      
      console.log(`[MarketplaceSchemaService] Fetching ${type} schemas from ${marketplace}...`);

      // Fetch from marketplace API
      const schema = await this.fetchFromMarketplaceAPI(marketplace, type);

      // Create schema object with metadata
      const schemaWithMetadata: MarketplaceSchema = {
        type,
        marketplace,
        data: schema,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + config.cache.schemas * 1000),
        version: new Date().toISOString(),
      };

      // Cache with 5-minute TTL
      await setCached(cacheKey, schemaWithMetadata, {
        ttl: config.cache.schemas,
      });

      // Update last fetch time
      this.lastFetchTime.set(cacheKey, now);

      console.log(
        `[MarketplaceSchemaService] ✓ Cached ${marketplace} ${type} schemas ` +
        `(expires in ${config.cache.schemas}s)`
      );

      return schemaWithMetadata;
    } catch (error) {
      console.error(
        `[MarketplaceSchemaService] Failed to fetch schemas from ${marketplace}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Get schema from cache with automatic refresh if expired
   * 
   * Returns cached schema if available and not expired.
   * If expired, attempts to automatically refresh from API.
   * If cache miss, returns null.
   * 
   * @param marketplace - Marketplace to get schema for
   * @param type - Schema type to retrieve
   * @param autoRefresh - Whether to auto-refresh if expired (default: true)
   * @returns Cached schema or null if not found
   * 
   * @example
   * ```typescript
   * const schema = await schemaService.getSchemaFromCache('shopee', 'categories');
   * if (schema) {
   *   console.log('Using cached categories:', schema.data);
   * } else {
   *   console.log('No cached schema found');
   * }
   * ```
   */
  async getSchemaFromCache(
    marketplace: Marketplace,
    type: SchemaType = 'all',
    autoRefresh: boolean = true
  ): Promise<MarketplaceSchema | null> {
    const cacheKey = CACHE_KEY_PATTERNS.SCHEMA(marketplace, type);

    try {
      // Try to get from cache
      const cached = await getCached<MarketplaceSchema>(cacheKey);

      if (cached) {
        // Check if expired
        const expiresAt = new Date(cached.expiresAt);
        const isExpired = new Date() > expiresAt;

        if (!isExpired) {
          this.cacheStats.hits++;
          console.log(
            `[MarketplaceSchemaService] Cache hit for ${marketplace} ${type} ` +
            `(expires in ${Math.round((expiresAt.getTime() - Date.now()) / 1000)}s)`
          );
          return cached;
        } else if (autoRefresh) {
          // Cache expired, attempt refresh
          console.log(
            `[MarketplaceSchemaService] Cache expired for ${marketplace} ${type}, refreshing...`
          );
          try {
            return await this.fetchAndCacheSchemas(marketplace, type);
          } catch (refreshError) {
            // If refresh fails, return stale cache anyway
            console.warn(
              `[MarketplaceSchemaService] Auto-refresh failed, returning stale cache for ${marketplace} ${type}`
            );
            return cached;
          }
        }
      }

      // Cache miss
      this.cacheStats.misses++;
      console.log(`[MarketplaceSchemaService] Cache miss for ${marketplace} ${type}`);
      return null;
    } catch (error) {
      console.error(
        `[MarketplaceSchemaService] Error retrieving cache for ${marketplace} ${type}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Invalidate cache for specific schema
   * 
   * Removes cached schema, forcing next request to fetch from API.
   * 
   * @param marketplace - Marketplace to invalidate
   * @param type - Schema type to invalidate (optional, defaults to all)
   * 
   * @example
   * ```typescript
   * // Invalidate specific schema
   * await schemaService.invalidateSchemaCache('shopee', 'categories');
   * 
   * // Invalidate all schemas for marketplace
   * await schemaService.invalidateSchemaCache('shopee');
   * ```
   */
  async invalidateSchemaCache(marketplace: Marketplace, type?: SchemaType): Promise<void> {
    try {
      if (type) {
        // Invalidate specific schema type
        const cacheKey = CACHE_KEY_PATTERNS.SCHEMA(marketplace, type);
        await invalidateCache(cacheKey);
        
        // Also invalidate metadata cache
        await invalidateCache(CACHE_KEY_PATTERNS.SCHEMA_METADATA(marketplace));
        
        this.cacheStats.invalidations++;
        
        console.log(`[MarketplaceSchemaService] ✓ Invalidated cache for ${marketplace} ${type}`);
      } else {
        // Invalidate all schemas for marketplace
        const pattern = CACHE_KEY_PATTERNS.SCHEMA_WILDCARD(marketplace);
        await invalidateByPattern(pattern);
        
        this.cacheStats.invalidations++;
        
        console.log(`[MarketplaceSchemaService] ✓ Invalidated all schemas for ${marketplace}`);
      }

      // Clear fetch time cache to allow immediate refetch
      if (type) {
        this.lastFetchTime.delete(CACHE_KEY_PATTERNS.SCHEMA(marketplace, type));
      } else {
        // Clear all fetch times for this marketplace
        for (const key of this.lastFetchTime.keys()) {
          if (key.includes(`schema:${marketplace}:`)) {
            this.lastFetchTime.delete(key);
          }
        }
      }
    } catch (error) {
      console.error(
        `[MarketplaceSchemaService] Failed to invalidate cache for ${marketplace}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Manually refresh schema by fetching from API
   * 
   * Forces a refresh even if cached data exists and hasn't expired.
   * Useful for periodic updates or after marketplace updates.
   * 
   * @param marketplace - Marketplace to refresh
   * @param type - Schema type to refresh
   * @returns Refreshed schema
   * 
   * @example
   * ```typescript
   * const fresh = await schemaService.refreshSchema('shopee', 'categories');
   * ```
   */
  async refreshSchema(marketplace: Marketplace, type: SchemaType = 'all'): Promise<MarketplaceSchema> {
    console.log(`[MarketplaceSchemaService] Manually refreshing ${marketplace} ${type}...`);
    
    // Invalidate cache first
    await this.invalidateSchemaCache(marketplace, type);
    
    // Fetch fresh data
    return this.fetchAndCacheSchemas(marketplace, type);
  }

  /**
   * Validate schema structure
   * 
   * Checks if schema has required fields for the marketplace
   * 
   * @param schema - Schema to validate
   * @param marketplace - Marketplace type
   * @returns true if valid, false otherwise
   */
  validateSchema(schema: MarketplaceSchema, marketplace: Marketplace): boolean {
    if (!schema || !schema.data) {
      return false;
    }

    if (marketplace === 'shopee') {
      return Array.isArray(schema.data);
    }

    if (marketplace === 'mercadolivre') {
      return Array.isArray(schema.data);
    }

    return false;
  }

  /**
   * Get cache statistics
   * 
   * Returns current cache hit/miss/fetch statistics
   * 
   * @returns Cache statistics object
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 'N/A';

    return {
      ...this.cacheStats,
      total,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Reset cache statistics
   * 
   * Clears all cache statistics counters
   */
  resetCacheStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      fetches: 0,
      invalidations: 0,
    };
    console.log(`[MarketplaceSchemaService] Cache statistics reset`);
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Fetch schemas from marketplace API
   * 
   * This is a placeholder implementation that will call real marketplace APIs.
   * In production, this would integrate with Shopee and Mercado Livre APIs.
   * 
   * @param marketplace - Marketplace to fetch from
   * @param type - Schema type to fetch
   * @returns Schema data
   * @private
   */
  private async fetchFromMarketplaceAPI(
    marketplace: Marketplace,
    type: SchemaType
  ): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    if (marketplace === 'shopee') {
      return this.fetchShopeeSchema(type);
    } else if (marketplace === 'mercadolivre') {
      return this.fetchMercadoLivreSchema(type);
    }

    throw new Error(`Unsupported marketplace: ${marketplace}`);
  }

  /**
   * Fetch Shopee marketplace schema
   * 
   * TODO: Integrate with real Shopee API (https://partner.shopeemall.com/api/v2)
   * 
   * @param type - Schema type to fetch
   * @returns Shopee schema data
   * @private
   */
  private async fetchShopeeSchema(type: SchemaType): Promise<ShopeeSchema> {
    console.log(`[MarketplaceSchemaService] Fetching Shopee ${type} from API...`);

    // TODO: Call actual Shopee API
    // const response = await fetch(`${config.marketplaces.shopee.baseUrl}/product/get_categories`, {
    //   headers: {
    //     'X-Shopee-Access-Token': shopeeToken,
    //     'X-Partner-ID': config.marketplaces.shopee.partnerId,
    //   }
    // });

    // Mock data for development
    if (type === 'categories' || type === 'all') {
      return {
        categories: [
          { id: '1', name: 'Eletrônicos' },
          { id: '2', name: 'Moda' },
          { id: '3', name: 'Casa' },
        ],
        attributes: type === 'all' ? [] : undefined,
      };
    }

    return {};
  }

  /**
   * Fetch Mercado Livre marketplace schema
   * 
   * TODO: Integrate with real Mercado Livre API (https://api.mercadolibre.com)
   * 
   * @param type - Schema type to fetch
   * @returns Mercado Livre schema data
   * @private
   */
  private async fetchMercadoLivreSchema(type: SchemaType): Promise<MercadoLivreSchema> {
    console.log(`[MarketplaceSchemaService] Fetching Mercado Livre ${type} from API...`);

    // TODO: Call actual Mercado Livre API
    // const response = await fetch(`${config.marketplaces.mercadolivre.baseUrl}/categories/MLB1`, {
    //   headers: {
    //     'Authorization': `Bearer ${mercadoLivreToken}`,
    //   }
    // });

    // Mock data for development
    if (type === 'categories' || type === 'all') {
      return {
        categories: [
          { id: 'MLB1', name: 'Eletrônicos' },
          { id: 'MLB2', name: 'Moda' },
          { id: 'MLB3', name: 'Casa' },
        ],
        attributes: type === 'all' ? [] : undefined,
      };
    }

    return {};
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance of MarketplaceSchemaService
 * 
 * Use this instance throughout the application to access marketplace schemas
 */
export const marketplaceSchemaService = new MarketplaceSchemaService();

export default marketplaceSchemaService;
