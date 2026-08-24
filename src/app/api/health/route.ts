/**
 * GET /api/health
 * Health check endpoint for monitoring
 */

import { NextResponse } from 'next/server';
import { checkRedisHealth, getQueueStats } from '@/lib/queue';
import { QUEUE_NAMES } from '@/lib/queue';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    // Ensure Redis is connected on first health check
    if (!redis.isConnected && !redis.isConnecting) {
      try {
        await redis.connect();
      } catch (error) {
        console.warn('[Health] Failed to connect Redis:', error instanceof Error ? error.message : String(error));
      }
    }

    // Check Redis connection
    const redisHealthy = await checkRedisHealth();

    // Get queue statistics
    const queueStats = {
      productSync: await getQueueStats(QUEUE_NAMES.PRODUCT_SYNC),
      inventorySync: await getQueueStats(QUEUE_NAMES.INVENTORY_SYNC),
      orderSync: await getQueueStats(QUEUE_NAMES.ORDER_SYNC),
      webhookProcessing: await getQueueStats(QUEUE_NAMES.WEBHOOK_PROCESSING),
      errorRecovery: await getQueueStats(QUEUE_NAMES.ERROR_RECOVERY),
    };

    const status = redisHealthy ? 'healthy' : 'degraded';
    const statusCode = redisHealthy ? 200 : 503;

    return NextResponse.json(
      {
        status,
        timestamp: new Date(),
        checks: {
          redis: redisHealthy ? 'ok' : 'failed',
          redisConnected: redis.isConnected,
          queues: 'ok',
        },
        queues: queueStats,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('[Health] Error checking health:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
