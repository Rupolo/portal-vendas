# Redis Client Usage Guide

## Overview

The Redis client is a singleton instance available at `@/lib/redis`. It handles:
- Cache management (products, inventory, orders, schemas)
- BullMQ queue connections
- Session storage (future)

## Configuration

Redis is configured in `src/lib/config.ts` with the following defaults:
- **Host**: `localhost` (override with `REDIS_HOST` env var)
- **Port**: `6379` (override with `REDIS_PORT` env var)
- **Password**: Optional (set via `REDIS_PASSWORD` env var)
- **Database**: `0`
- **Retry Strategy**: Exponential backoff (50ms × attempts, max 2000ms)
- **Connection Timeout**: 10 seconds

## Basic Usage

### Connection Management

```typescript
import { redis, initializeRedis, shutdownRedis } from '@/lib/redis';

// Initialize on app startup
await initializeRedis();

// Check connection status
if (redis.isConnected) {
  console.log('Redis is connected');
}

// Perform health check
const isHealthy = await redis.ping();

// Shutdown on app termination
await shutdownRedis();
```

### Basic Operations

```typescript
import { redis } from '@/lib/redis';

// Set a value
await redis.set('my-key', 'my-value');

// Get a value
const value = await redis.get('my-key');

// Set with expiration (TTL in seconds)
await redis.set('temp-key', 'temp-value', { EX: 300 }); // 5 minutes

// Delete a key
await redis.del('my-key');
```

### Advanced Operations

For advanced Redis operations (transactions, scripting, Lua scripts), use the underlying client:

```typescript
import { getRedis } from '@/lib/redis';

const client = getRedis();

// Multi commands
const multi = client.multi();
multi.set('key1', 'value1');
multi.set('key2', 'value2');
await multi.exec();

// Increment counter
await client.incr('counter');

// List operations
await client.lPush('mylist', 'item1');
await client.lPush('mylist', 'item2');
```

## Cache TTL Configuration

The following TTL values are defined in `src/lib/config.ts`:

```typescript
cache: {
  schemas: 300,      // 5 minutes - marketplace category/attribute schemas
  products: 60,      // 1 minute - product data
  inventory: 30,     // 30 seconds - inventory/stock data (highly volatile)
  orders: 120,       // 2 minutes - order data
  general: 600,      // 10 minutes - general cache
}
```

### Using Cache with TTL

```typescript
import { redis } from '@/lib/redis';
import { config } from '@/lib/config';

// Cache a product (1 minute TTL)
const productData = JSON.stringify(product);
await redis.set('product:123', productData, { 
  EX: config.cache.products 
});

// Cache inventory (30 seconds TTL)
await redis.set('inventory:456', quantityString, { 
  EX: config.cache.inventory 
});

// Retrieve from cache
const cached = await redis.get('product:123');
```

## Integration with BullMQ

BullMQ uses the same Redis connection configured in `src/lib/config.ts`:

```typescript
import { getQueue, QUEUE_NAMES } from '@/lib/queue';

const productSyncQueue = getQueue(QUEUE_NAMES.PRODUCT_SYNC);

// Add a job
await productSyncQueue.add('sync-job', {
  productId: '123',
  marketplace: 'shopee',
}, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
});
```

## Error Handling

The Redis client handles errors gracefully:

```typescript
import { redis } from '@/lib/redis';

try {
  const value = await redis.get('my-key');
} catch (error) {
  console.error('Redis operation failed:', error);
  // Implement fallback logic
}
```

## Event Listeners

Redis client events are logged automatically:
- `connect` - Connection established
- `disconnect` - Connection lost
- `error` - Connection or operation error
- `reconnecting` - Reconnection attempt
- `ready` - Client ready for commands

## Examples by Use Case

### Caching Product Data

```typescript
import { redis } from '@/lib/redis';
import { config } from '@/lib/config';

export async function cacheProduct(product: Product) {
  const key = `product:${product.id}`;
  const data = JSON.stringify(product);
  
  await redis.set(key, data, { 
    EX: config.cache.products 
  });
}

export async function getCachedProduct(productId: string) {
  const key = `product:${productId}`;
  const data = await redis.get(key);
  
  return data ? JSON.parse(data) : null;
}
```

### Managing Inventory Cache

```typescript
import { redis } from '@/lib/redis';
import { config } from '@/lib/config';

export async function updateInventoryCache(productId: string, quantity: number) {
  const key = `inventory:${productId}`;
  
  await redis.set(key, String(quantity), { 
    EX: config.cache.inventory // 30 seconds
  });
}

export async function getInventoryFromCache(productId: string) {
  const key = `inventory:${productId}`;
  const quantity = await redis.get(key);
  
  return quantity ? parseInt(quantity, 10) : null;
}
```

### Implementing a Rate Limiter

```typescript
import { redis } from '@/lib/redis';

export async function checkRateLimit(
  identifier: string, 
  limit: number = 100, 
  windowSeconds: number = 60
) {
  const key = `ratelimit:${identifier}`;
  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) + 1 : 1;
  
  if (count === 1) {
    // First request in this window
    await redis.set(key, '1', { EX: windowSeconds });
  } else if (count > limit) {
    // Rate limit exceeded
    return false;
  } else {
    // Update counter
    await redis.client.incr(key);
  }
  
  return true;
}
```

### Webhook Deduplication

```typescript
import { redis } from '@/lib/redis';

export async function isWebhookProcessed(webhookId: string) {
  const key = `webhook:${webhookId}`;
  const exists = await redis.get(key);
  
  if (exists) {
    return true; // Already processed
  }
  
  // Mark as processed (keep for 24 hours for deduplication)
  await redis.set(key, 'true', { EX: 86400 });
  return false;
}
```

## Monitoring and Debugging

Check Redis connection in health endpoint:

```bash
curl http://localhost:3000/api/health
```

Response includes:
```json
{
  "status": "healthy",
  "checks": {
    "redis": "ok",
    "redisConnected": true,
    "queues": "ok"
  }
}
```

## Best Practices

1. **Always use TTL**: Set expiration time to prevent memory bloat
2. **Key naming convention**: Use colons for hierarchy (`product:123`, `inventory:456`)
3. **Error handling**: Always wrap Redis calls in try-catch
4. **Connection checks**: Use `redis.isConnected` before assuming availability
5. **Graceful degradation**: Have fallback logic if Redis is unavailable
6. **Type safety**: Serialize/deserialize JSON data properly
7. **Batch operations**: Use `batchGet` and `batchSet` for multiple operations
8. **Monitoring**: Regularly check queue sizes and connection status

## Troubleshooting

### Redis connection refuses
- Check if Redis server is running
- Verify `REDIS_HOST` and `REDIS_PORT` environment variables
- Check firewall rules

### Slow Redis operations
- Check Redis memory usage
- Review TTL configuration
- Monitor network latency

### Connection drops
- Check Redis server logs
- Verify network connectivity
- Check connection timeout settings in `config.ts`

## Related Files

- `src/lib/redis.ts` - Main Redis client implementation
- `src/lib/config.ts` - Redis configuration
- `src/lib/queue.ts` - BullMQ queue factory
- `src/lib/cache.ts` - Alternative cache helper (legacy)
- `src/tests/redis.test.ts` - Redis client tests
