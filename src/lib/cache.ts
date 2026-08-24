/**
 * Cache layer helper with Redis
 * Manages TTLs, invalidation, and batch operations
 */

import { createClient, type RedisClientType } from 'redis';
import { config } from './config';

let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): RedisClientType {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password || undefined,
    }) as RedisClientType;

    redisClient.on('error', (err: Error) => {
      console.error('[Cache] Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('[Cache] Redis connected');
    });

    // Connect to Redis
    redisClient.connect().catch(err => {
      console.error('[Cache] Failed to connect to Redis:', err);
    });
  }

  return redisClient;
}

interface CacheOptions {
  ttl?: number;
  useCompression?: boolean;
}

/**
 * Get value from cache
 */
export async function getCached<T = any>(
  key: string,
  options?: CacheOptions
): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`[Cache] Get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in cache
 */
export async function setCached<T = any>(
  key: string,
  value: T,
  options?: CacheOptions
): Promise<void> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    const ttl = options?.ttl;

    if (ttl) {
      await client.setEx(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    console.error(`[Cache] Set error for key ${key}:`, error);
  }
}

/**
 * Delete value from cache
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    console.error(`[Cache] Delete error for key ${key}:`, error);
  }
}

/**
 * Invalidate multiple cache keys
 */
export async function invalidateMultiple(keys: string[]): Promise<void> {
  try {
    const client = getRedisClient();
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error(`[Cache] Delete multiple error:`, error);
  }
}

/**
 * Invalidate by pattern (e.g., "product:*")
 */
export async function invalidateByPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error(`[Cache] Pattern invalidation error:`, error);
  }
}

/**
 * Cache marketplace schemas with 5-minute TTL
 */
export async function cacheMarketplaceSchema(
  marketplace: string,
  schema: any
): Promise<void> {
  const key = `schema:${marketplace}`;
  await setCached(key, schema, { ttl: config.cache.schemas });
}

/**
 * Get cached marketplace schema
 */
export async function getCachedMarketplaceSchema(
  marketplace: string
): Promise<any | null> {
  const key = `schema:${marketplace}`;
  return getCached(key);
}

/**
 * Cache product data with 1-minute TTL
 */
export async function cacheProduct(productId: string, product: any): Promise<void> {
  const key = `product:${productId}`;
  await setCached(key, product, { ttl: config.cache.products });
}

/**
 * Get cached product
 */
export async function getCachedProduct(productId: string): Promise<any | null> {
  const key = `product:${productId}`;
  return getCached(key);
}

/**
 * Cache inventory with 30-second TTL
 */
export async function cacheInventory(productId: string, inventory: any): Promise<void> {
  const key = `inventory:${productId}`;
  await setCached(key, inventory, { ttl: config.cache.inventory });
}

/**
 * Get cached inventory
 */
export async function getCachedInventory(productId: string): Promise<any | null> {
  const key = `inventory:${productId}`;
  return getCached(key);
}

/**
 * Cache order with 2-minute TTL
 */
export async function cacheOrder(orderId: string, order: any): Promise<void> {
  const key = `order:${orderId}`;
  await setCached(key, order, { ttl: config.cache.orders });
}

/**
 * Get cached order
 */
export async function getCachedOrder(orderId: string): Promise<any | null> {
  const key = `order:${orderId}`;
  return getCached(key);
}

/**
 * Batch get operation
 */
export async function batchGet<T = any>(keys: string[]): Promise<Map<string, T | null>> {
  try {
    const client = getRedisClient();
    const values = await client.mGet(keys);

    const result = new Map<string, T | null>();

    keys.forEach((key, index) => {
      const value = values[index];
      result.set(key, value ? JSON.parse(value) : null);
    });

    return result;
  } catch (error) {
    console.error('[Cache] Batch get error:', error);
    return new Map();
  }
}

/**
 * Batch set operation
 */
export async function batchSet<T = any>(
  data: Record<string, T>,
  ttl?: number
): Promise<void> {
  try {
    const client = getRedisClient();

    for (const [key, value] of Object.entries(data)) {
      if (ttl) {
        await client.setEx(key, ttl, JSON.stringify(value));
      } else {
        await client.set(key, JSON.stringify(value));
      }
    }
  } catch (error) {
    console.error('[Cache] Batch set error:', error);
  }
}

/**
 * Increment counter
 */
export async function incrementCounter(key: string, amount: number = 1): Promise<number> {
  try {
    const client = getRedisClient();
    return await client.incrBy(key, amount);
  } catch (error) {
    console.error(`[Cache] Increment error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Decrement counter
 */
export async function decrementCounter(key: string, amount: number = 1): Promise<number> {
  try {
    const client = getRedisClient();
    return await client.decrBy(key, amount);
  } catch (error) {
    console.error(`[Cache] Decrement error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Close Redis connection
 */
export async function closeCacheConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Cache] Redis connection closed');
  }
}
