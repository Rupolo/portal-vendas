/**
 * BullMQ Queue Factory and Configuration
 * =====================================
 * 
 * Manages all queue instances for async processing with full BullMQ integration.
 * Provides 5 queues for marketplace synchronization and error recovery:
 * 
 * 1. **productSync** - Product publication and updates
 *    - Attempts: 5, Backoff: 5s exponential, Keep: 1 hour
 * 
 * 2. **inventorySync** - Inventory synchronization
 *    - Attempts: 5, Backoff: 5s exponential, Keep: 30 minutes
 * 
 * 3. **orderSync** - Order capture and status updates
 *    - Attempts: 3, Backoff: 5s exponential, Keep: 1 day (audit)
 * 
 * 4. **webhookProcessing** - Webhook event processing
 *    - Attempts: 5, Backoff: 2s exponential, No removal policy
 * 
 * 5. **errorRecovery** - Automatic error recovery
 *    - Attempts: 10, Backoff: 10s exponential, No removal policy
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Dead Letter Queue (DLQ) for failed jobs
 * - Job event listeners (completed, failed, stalled)
 * - Queue statistics and health checks
 * - Graceful shutdown support
 * 
 * @see config.ts for queue configuration
 * @example
 * ```typescript
 * import { getQueue, QUEUE_NAMES, createWorker } from '@/lib/queue';
 * 
 * // Add job to queue
 * const queue = getQueue(QUEUE_NAMES.PRODUCT_SYNC);
 * await queue.add('sync-product', { productId: '123' });
 * 
 * // Create worker for processing
 * createWorker(QUEUE_NAMES.PRODUCT_SYNC, async (job) => {
 *   console.log('Processing:', job.data);
 *   return { success: true };
 * });
 * ```
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { createClient } from 'redis';
import { config } from './config';

// ============================================================================
// REDIS CONNECTION CONFIGURATION
// ============================================================================

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: config.redis.retryStrategy,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  enableReadyCheck: config.redis.enableReadyCheck,
};

// ============================================================================
// QUEUE NAMES CONSTANTS
// ============================================================================

/**
 * Queue name constants for type-safe queue access
 * 
 * These names correspond directly to the configuration in config.ts
 * and are used throughout the application to reference queues.
 */
export const QUEUE_NAMES = {
  PRODUCT_SYNC: 'productSync',
  INVENTORY_SYNC: 'inventorySync',
  ORDER_SYNC: 'orderSync',
  WEBHOOK_PROCESSING: 'webhookProcessing',
  ERROR_RECOVERY: 'errorRecovery',
} as const;

/**
 * Type for queue names - ensures type-safe queue access
 */
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================================================
// QUEUE INSTANCES CACHE
// ============================================================================

/**
 * Singleton cache for queue instances
 * Each queue is instantiated once and reused throughout the application
 */
const queueInstances = new Map<QueueName, Queue>();

/**
 * Cache for worker instances
 * Each worker manages job processing for a specific queue
 */
const workerInstances = new Map<QueueName, Worker>();

/**
 * Cache for queue event listeners
 * Monitors queue events (waiting, active, completed, failed, stalled)
 */
const queueEventsInstances = new Map<QueueName, QueueEvents>();

// ============================================================================
// QUEUE FACTORY FUNCTIONS
// ============================================================================

/**
 * Get or create a queue instance with proper BullMQ configuration
 * 
 * Each queue is configured with options from config.ts:
 * - Retry policy (attempts + exponential backoff)
 * - Job removal policy (age-based cleanup)
 * - Redis connection settings
 * 
 * @param queueName - Name of the queue (must be a valid QueueName)
 * @returns Queue instance ready for job operations
 * 
 * @example
 * ```typescript
 * const productQueue = getQueue(QUEUE_NAMES.PRODUCT_SYNC);
 * const job = await productQueue.add('sync', { productId: '123' });
 * ```
 */
export function getQueue(queueName: QueueName): Queue {
  if (!queueInstances.has(queueName)) {
    // Get configuration for this queue from config.ts
    const queueConfig = config.queues[queueName as keyof typeof config.queues];

    if (!queueConfig) {
      throw new Error(`Queue configuration not found for: ${queueName}`);
    }

    // Create queue with proper configuration
    const queue = new Queue(queueName, {
      connection: redisConnection as any,
      defaultJobOptions: {
        attempts: queueConfig.defaultJobOptions.attempts,
        backoff: queueConfig.defaultJobOptions.backoff,
        removeOnComplete: queueConfig.defaultJobOptions.removeOnComplete as any,
      },
    });

    queueInstances.set(queueName, queue);

    // Setup event listeners
    setupQueueEventListeners(queueName);

    console.log(
      `[Queue] Created queue: ${queueName} (attempts: ${queueConfig.defaultJobOptions.attempts}, ` +
      `backoff: ${queueConfig.defaultJobOptions.backoff.delay}ms)`
    );
  }

  return queueInstances.get(queueName)!;
}

/**
 * Get all initialized queues
 * 
 * Useful for health checks and monitoring all queues at once
 * 
 * @returns Map of all instantiated queue instances
 */
export function getAllQueues(): Map<QueueName, Queue> {
  return new Map(queueInstances);
}

/**
 * Get a queue by name (alternative to getQueue for dynamic access)
 * 
 * @param name - Queue name as string
 * @returns Queue instance or undefined if not found
 */
export function getQueueByName(name: string): Queue | undefined {
  return queueInstances.get(name as QueueName);
}

// ============================================================================
// WORKER FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a worker for processing jobs in a specific queue
 * 
 * Workers process jobs from the queue with configurable concurrency.
 * Implements error handling and automatic retry logic.
 * 
 * @param queueName - Queue to process
 * @param processor - Async function that processes each job
 * @param options - Worker options (concurrency, etc.)
 * @returns Worker instance
 * 
 * @example
 * ```typescript
 * createWorker(QUEUE_NAMES.PRODUCT_SYNC, async (job) => {
 *   const { productId } = job.data;
 *   await syncProductToMarketplaces(productId);
 *   return { synced: true };
 * }, { concurrency: 5 });
 * ```
 */
export function createWorker(
  queueName: QueueName,
  processor: (job: any) => Promise<any>,
  options?: { concurrency?: number }
): Worker {
  // Return existing worker if already created
  if (workerInstances.has(queueName)) {
    console.log(`[Worker] Returning existing worker for queue: ${queueName}`);
    return workerInstances.get(queueName)!;
  }

  // Ensure queue exists first
  const queue = getQueue(queueName);

  // Create new worker
  const worker = new Worker(queueName, processor, {
    connection: redisConnection as any,
    concurrency: options?.concurrency || config.sync.maxConcurrentJobs,
  });

  // Setup event listeners for monitoring
  worker.on('completed', (job, result) => {
    console.log(
      `[Worker ${queueName}] Job ${job.id} completed`,
      result ? `(result: ${JSON.stringify(result).substring(0, 100)})` : ''
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[Worker ${queueName}] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err instanceof Error ? err.message : String(err)
    );
  });

  worker.on('error', (err) => {
    console.error(`[Worker ${queueName}] Worker error:`, err instanceof Error ? err.message : String(err));
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker ${queueName}] Job ${jobId} has stalled (will be retried)`);
  });

  workerInstances.set(queueName, worker);

  console.log(
    `[Worker] Created worker for queue: ${queueName} (concurrency: ${options?.concurrency || config.sync.maxConcurrentJobs})`
  );

  return worker;
}

/**
 * Get existing worker for a queue
 * 
 * @param queueName - Queue name
 * @returns Worker instance or undefined if not created yet
 */
export function getWorker(queueName: QueueName): Worker | undefined {
  return workerInstances.get(queueName);
}

/**
 * Close a specific worker
 * 
 * @param queueName - Queue name
 */
export async function closeWorker(queueName: QueueName): Promise<void> {
  const worker = workerInstances.get(queueName);
  if (worker) {
    await worker.close();
    workerInstances.delete(queueName);
    console.log(`[Worker] Closed worker for queue: ${queueName}`);
  }
}

// ============================================================================
// QUEUE EVENTS AND LISTENERS
// ============================================================================

/**
 * Setup comprehensive event listeners for queue monitoring
 * 
 * Tracks job lifecycle:
 * - waiting: Job queued, awaiting processing
 * - active: Job started processing
 * - completed: Job finished successfully
 * - failed: Job failed after all retries
 * - stalled: Job processing took too long (stalled)
 * 
 * @param queueName - Queue to monitor
 */
function setupQueueEventListeners(queueName: QueueName): void {
  const queueEvents = new QueueEvents(queueName, { connection: redisConnection as any });

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`[${queueName}] Job ${jobId} is waiting (queued)`);
  });

  queueEvents.on('active', ({ jobId, prev }) => {
    console.log(`[${queueName}] Job ${jobId} is active (prev: ${prev})`);
  });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(
      `[${queueName}] Job ${jobId} completed`,
      returnvalue ? `(result: ${JSON.stringify(returnvalue).substring(0, 100)})` : ''
    );
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[${queueName}] Job ${jobId} failed: ${failedReason}`);
  });

  queueEvents.on('stalled', ({ jobId }) => {
    console.warn(`[${queueName}] Job ${jobId} has stalled (will retry)`);
  });

  queueEvents.on('drained', () => {
    console.log(`[${queueName}] Queue drained (no more jobs)`);
  });

  queueEventsInstances.set(queueName, queueEvents);
}

/**
 * Get queue events monitor for a specific queue
 * 
 * Use this to subscribe to queue events programmatically
 * 
 * @param queueName - Queue name
 * @returns QueueEvents instance
 */
export function getQueueEvents(queueName: QueueName): QueueEvents {
  if (!queueEventsInstances.has(queueName)) {
    setupQueueEventListeners(queueName);
  }

  return queueEventsInstances.get(queueName)!;
}

// ============================================================================
// CLEANUP AND LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * Close all queues, workers, and event listeners
 * 
 * Should be called during application shutdown to ensure
 * proper cleanup and Redis connection closure.
 * 
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await closeAllQueues();
 *   process.exit(0);
 * });
 * ```
 */
export async function closeAllQueues(): Promise<void> {
  console.log('[Queue] Starting graceful shutdown...');

  // Close workers first (they process jobs)
  for (const [name, worker] of workerInstances.entries()) {
    try {
      await worker.close();
      console.log(`[Queue] Closed worker: ${name}`);
    } catch (err) {
      console.error(`[Queue] Error closing worker ${name}:`, err instanceof Error ? err.message : String(err));
    }
  }

  // Close queue events
  for (const [name, events] of queueEventsInstances.entries()) {
    try {
      await events.close();
      console.log(`[Queue] Closed queue events: ${name}`);
    } catch (err) {
      console.error(`[Queue] Error closing events ${name}:`, err instanceof Error ? err.message : String(err));
    }
  }

  // Close queues last
  for (const [name, queue] of queueInstances.entries()) {
    try {
      await queue.close();
      console.log(`[Queue] Closed queue: ${name}`);
    } catch (err) {
      console.error(`[Queue] Error closing queue ${name}:`, err instanceof Error ? err.message : String(err));
    }
  }

  queueInstances.clear();
  workerInstances.clear();
  queueEventsInstances.clear();

  console.log('[Queue] Graceful shutdown complete');
}

/**
 * Close a specific queue and its associated resources
 * 
 * @param queueName - Queue name to close
 */
export async function closeQueue(queueName: QueueName): Promise<void> {
  try {
    // Close worker
    await closeWorker(queueName);

    // Close events
    const events = queueEventsInstances.get(queueName);
    if (events) {
      await events.close();
      queueEventsInstances.delete(queueName);
    }

    // Close queue
    const queue = queueInstances.get(queueName);
    if (queue) {
      await queue.close();
      queueInstances.delete(queueName);
    }

    console.log(`[Queue] Closed queue and resources: ${queueName}`);
  } catch (err) {
    console.error(
      `[Queue] Error closing queue ${queueName}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

// ============================================================================
// HEALTH CHECKS AND MONITORING
// ============================================================================

/**
 * Check Redis connection health
 * 
 * Verifies that Redis is accessible and responsive
 * 
 * @returns true if Redis is healthy, false otherwise
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = createClient(redisConnection as any);
    await client.connect();
    const ping = await client.ping();
    await client.disconnect();
    return ping === 'PONG';
  } catch (error) {
    console.error('[Queue] Redis health check failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get statistics for all queues
 * 
 * Returns job counts (waiting, active, completed, failed, etc.)
 * for each queue
 * 
 * @returns Map of queue statistics
 */
export async function getAllQueueStats(): Promise<Map<QueueName, Record<string, any>>> {
  const stats = new Map<QueueName, Record<string, any>>();

  for (const [name, queue] of queueInstances.entries()) {
    try {
      const counts = await queue.getJobCounts();
      const size = await queue.count();

      stats.set(name, {
        queue: name,
        total: size,
        ...counts,
      });
    } catch (err) {
      console.error(`[Queue] Error getting stats for ${name}:`, err);
      stats.set(name, { queue: name, error: 'Failed to get stats' });
    }
  }

  return stats;
}

/**
 * Get statistics for a specific queue
 * 
 * @param queueName - Queue name
 * @returns Queue statistics including job counts
 */
export async function getQueueStats(queueName: QueueName) {
  const queue = getQueue(queueName);
  const counts = await queue.getJobCounts();
  const size = await queue.count();

  return {
    queue: queueName,
    total: size,
    ...counts,
  };
}

/**
 * Log statistics for all queues
 * 
 * Useful for monitoring and debugging
 */
export async function logAllQueueStats(): Promise<void> {
  const stats = await getAllQueueStats();

  console.log('\n=== Queue Statistics ===');
  for (const [name, data] of stats.entries()) {
    console.log(`\n${name}:`);
    console.log(`  Total: ${data.total}`);
    console.log(`  Waiting: ${data.waiting || 0}`);
    console.log(`  Active: ${data.active || 0}`);
    console.log(`  Completed: ${data.completed || 0}`);
    console.log(`  Failed: ${data.failed || 0}`);
    console.log(`  Delayed: ${data.delayed || 0}`);
  }
  console.log('\n====================\n');
}

// ============================================================================
// JOB OPERATIONS
// ============================================================================

/**
 * Clear a queue completely (remove all jobs)
 * 
 * ⚠️  USE WITH CAUTION - This will remove all pending jobs!
 * 
 * @param queueName - Queue to clear
 */
export async function clearQueue(queueName: QueueName): Promise<void> {
  try {
    const queue = getQueue(queueName);
    await queue.drain();
    console.log(`[Queue] Cleared all jobs from queue: ${queueName}`);
  } catch (err) {
    console.error(`[Queue] Error clearing queue ${queueName}:`, err);
  }
}

/**
 * Add a job to a queue
 * 
 * @param queueName - Target queue
 * @param data - Job data
 * @param options - Job options (delay, priority, attempts)
 * @returns Job ID
 * 
 * @example
 * ```typescript
 * const jobId = await addJob(
 *   QUEUE_NAMES.PRODUCT_SYNC,
 *   { productId: '123', marketplace: 'shopee' },
 *   { priority: 10 }
 * );
 * ```
 */
export async function addJob(
  queueName: QueueName,
  data: any,
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  }
): Promise<string> {
  try {
    const queue = getQueue(queueName);
    const job = await queue.add(`${queueName}-job`, data, {
      ...options,
    });

    console.log(`[Queue] Added job ${job.id} to queue: ${queueName}`);
    return job.id!;
  } catch (err) {
    console.error(`[Queue] Error adding job to ${queueName}:`, err);
    throw err;
  }
}

/**
 * Add multiple jobs to a queue in batch
 * 
 * More efficient than adding jobs one by one
 * 
 * @param queueName - Target queue
 * @param jobs - Array of job data objects
 * @returns Array of job IDs
 * 
 * @example
 * ```typescript
 * const jobIds = await addBulkJobs(
 *   QUEUE_NAMES.PRODUCT_SYNC,
 *   [
 *     { productId: '1' },
 *     { productId: '2' },
 *     { productId: '3' },
 *   ]
 * );
 * ```
 */
export async function addBulkJobs(
  queueName: QueueName,
  jobs: any[],
  options?: {
    delay?: number;
    priority?: number;
  }
): Promise<string[]> {
  try {
    const queue = getQueue(queueName);
    const bulkOps = jobs.map((data) => ({
      name: `${queueName}-job`,
      data,
      opts: options,
    }));

    const added = await queue.addBulk(bulkOps);

    console.log(`[Queue] Added ${added.length} jobs to queue: ${queueName}`);
    return added.map((job) => job.id!);
  } catch (err) {
    console.error(`[Queue] Error adding bulk jobs to ${queueName}:`, err);
    throw err;
  }
}

/**
 * Get a job by ID
 * 
 * @param queueName - Queue name
 * @param jobId - Job ID
 * @returns Job object or null if not found
 */
export async function getJob(queueName: QueueName, jobId: string) {
  try {
    const queue = getQueue(queueName);
    return await queue.getJob(jobId);
  } catch (err) {
    console.error(`[Queue] Error getting job ${jobId}:`, err);
    return null;
  }
}

/**
 * Remove a job from queue
 * 
 * @param queueName - Queue name
 * @param jobId - Job ID
 */
export async function removeJob(queueName: QueueName, jobId: string): Promise<void> {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[Queue] Removed job ${jobId} from queue: ${queueName}`);
    }
  } catch (err) {
    console.error(`[Queue] Error removing job ${jobId}:`, err);
  }
}
