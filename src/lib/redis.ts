/**
 * Redis Client Instance and Connection Management
 * ===============================================
 * 
 * This module provides a singleton Redis client instance configured for:
 * - Cache management (TTLs: schemas 300s, products 60s, inventory 30s, etc)
 * - Job queue with BullMQ (productSync, inventorySync, orderSync, etc)
 * - Session storage (future use)
 * 
 * Configuration is sourced from src/lib/config.ts with sensible defaults.
 * 
 * Features:
 * - Automatic connection retry with exponential backoff
 * - Connection timeout handling
 * - Error logging and event listeners
 * - Health check method for monitoring
 * - Graceful shutdown support
 * 
 * @see config.ts for connection settings
 * @example
 * ```typescript
 * import { redis } from '@/lib/redis';
 * 
 * // Check if connected
 * if (redis.isConnected) {
 *   const value = await redis.get('key');
 * }
 * 
 * // Manual health check
 * const isHealthy = await redis.ping();
 * ```
 */

import { createClient, type RedisClientType } from 'redis';
import { config } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface RedisClientInstance {
  client: RedisClientType;
  isConnected: boolean;
  isConnecting: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<number>;
}

// ============================================================================
// REDIS CLIENT SINGLETON
// ============================================================================

let redisClient: RedisClientType | null = null;
let isConnected = false;
let isConnecting = false;

/**
 * Create and configure Redis client
 * 
 * Uses configuration from config.ts:
 * - Host: REDIS_HOST (default: localhost)
 * - Port: REDIS_PORT (default: 6379)
 * - Password: REDIS_PASSWORD (optional)
 * - Database: 0
 * - Retry strategy: Exponential backoff (50ms * times, max 2000ms)
 */
function createRedisClient(): RedisClientType {
  const client = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
      reconnectStrategy: (retries: number) => {
        const delay = Math.min(retries * 50, 2000);
        console.log(
          `[Redis] Reconnecting... (attempt ${retries + 1}, delay: ${delay}ms)`
        );
        return delay;
      },
      connectTimeout: 10000, // 10 second connection timeout
    },
    password: config.redis.password || undefined,
  }) as RedisClientType;

  // Setup event listeners
  setupEventListeners(client);

  return client;
}

/**
 * Setup Redis client event listeners
 */
function setupEventListeners(client: RedisClientType): void {
  /**
   * Connection established
   */
  client.on('connect', () => {
    isConnected = true;
    console.log(
      `[Redis] Connected successfully to ${config.redis.host}:${config.redis.port}`
    );
  });

  /**
   * Connection lost
   */
  client.on('disconnect', () => {
    isConnected = false;
    console.warn('[Redis] Disconnected');
  });

  /**
   * Connection error
   */
  client.on('error', (error: Error) => {
    console.error('[Redis] Connection error:', {
      message: error.message,
      code: (error as any).code,
      errno: (error as any).errno,
    });
  });

  /**
   * Reconnection attempt
   */
  client.on('reconnecting', () => {
    console.warn('[Redis] Reconnection attempt in progress...');
  });

  /**
   * Ready to use
   */
  client.on('ready', () => {
    console.log('[Redis] Client ready for commands');
  });
}

/**
 * Get or create Redis client instance
 */
function getRedisClient(): RedisClientType {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Connect to Redis
 */
async function connectRedis(): Promise<void> {
  if (isConnected) {
    console.log('[Redis] Already connected');
    return;
  }

  if (isConnecting) {
    console.log('[Redis] Connection already in progress');
    return;
  }

  try {
    isConnecting = true;
    const client = getRedisClient();

    console.log(
      `[Redis] Connecting to ${config.redis.host}:${config.redis.port}...`
    );

    await client.connect();

    // Verify connection with ping
    const pong = await client.ping();
    if (pong === 'PONG') {
      isConnected = true;
      console.log('[Redis] Connection verified with PING');
    }
  } catch (error) {
    isConnected = false;
    console.error('[Redis] Failed to connect:', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnect from Redis
 */
async function disconnectRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    console.log('[Redis] Disconnecting...');
    await redisClient.disconnect();
    isConnected = false;
    console.log('[Redis] Disconnected successfully');
  } catch (error) {
    console.error('[Redis] Error during disconnect:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Check Redis connection health
 * 
 * @returns true if Redis is healthy and responds to PING
 */
async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();

    // If not connected, attempt connection first
    if (!isConnected && !isConnecting) {
      await connectRedis();
    }

    const response = await client.ping();
    return response === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get value from Redis
 */
async function getFromRedis(key: string): Promise<string | null> {
  const client = getRedisClient();
  const value = await client.get(key);
  return value as string | null;
}

/**
 * Set value in Redis with optional expiration
 */
async function setInRedis(
  key: string,
  value: string,
  options?: { EX?: number }
): Promise<void> {
  const client = getRedisClient();

  if (options?.EX) {
    await client.setEx(key, options.EX, value);
  } else {
    await client.set(key, value);
  }
}

/**
 * Delete key from Redis
 */
async function deleteFromRedis(key: string): Promise<number> {
  const client = getRedisClient();
  return client.del(key);
}

// ============================================================================
// EXPORTED REDIS CLIENT INSTANCE
// ============================================================================

/**
 * Redis client instance
 * 
 * Provides methods for cache management and job queue operations.
 * Should be connected during application startup.
 * 
 * @example
 * ```typescript
 * // In your server startup
 * await redis.connect();
 * 
 * // Check connection
 * if (redis.isConnected) {
 *   const cached = await redis.get('my-key');
 * }
 * 
 * // On shutdown
 * await redis.disconnect();
 * ```
 */
export const redis: RedisClientInstance = {
  client: getRedisClient(),

  get isConnected() {
    return isConnected;
  },

  get isConnecting() {
    return isConnecting;
  },

  async connect() {
    return connectRedis();
  },

  async disconnect() {
    return disconnectRedis();
  },

  async ping() {
    return pingRedis();
  },

  async get(key: string) {
    return getFromRedis(key);
  },

  async set(key: string, value: string, options?: { EX?: number }) {
    return setInRedis(key, value, options);
  },

  async del(key: string) {
    return deleteFromRedis(key);
  },
};

/**
 * Export the underlying RedisClientType for advanced operations
 * when needed (e.g., transactions, scripting, advanced data structures)
 */
export function getRedis(): RedisClientType {
  return redis.client;
}

// ============================================================================
// INITIALIZATION HELPER FOR APPLICATION STARTUP
// ============================================================================

/**
 * Initialize Redis connection on application startup
 * 
 * Should be called during Next.js server initialization (e.g., in next.config.js
 * or in a startup hook in API routes)
 * 
 * @returns true if connection was successful, false otherwise
 * @example
 * ```typescript
 * // In your layout or startup file
 * import { initializeRedis } from '@/lib/redis';
 * 
 * if (typeof window === 'undefined') {
 *   initializeRedis().catch(err => {
 *     console.error('Failed to initialize Redis:', err);
 *     process.exit(1);
 *   });
 * }
 * ```
 */
export async function initializeRedis(): Promise<boolean> {
  try {
    await redis.connect();
    const isHealthy = await redis.ping();

    if (isHealthy) {
      console.log('[Redis] Initialization successful');
      return true;
    } else {
      console.error('[Redis] Initialization failed - ping unsuccessful');
      return false;
    }
  } catch (error) {
    console.error('[Redis] Initialization error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Graceful shutdown helper
 * 
 * Should be called when application shuts down to ensure
 * Redis connection is properly closed
 * 
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await shutdownRedis();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownRedis(): Promise<void> {
  console.log('[Redis] Starting graceful shutdown...');
  await redis.disconnect();
}
