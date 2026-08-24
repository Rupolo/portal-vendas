/**
 * Exponential Backoff Utilities
 * =============================
 * 
 * Implements exponential backoff with jitter for retry operations.
 * This prevents thundering herd problem and distributes load across time.
 * 
 * Formula: delay = min(baseDelay * (2 ^ attempt), maxDelay) + jitter
 * 
 * Example:
 * - Attempt 1: 5s (5000ms * 2^0 = 5000)
 * - Attempt 2: 10s (5000ms * 2^1 = 10000)
 * - Attempt 3: 20s (5000ms * 2^2 = 20000)
 * - Attempt 4: 40s (5000ms * 2^3 = 40000)
 * - Attempt 5: 60s (capped at maxDelay = 60000)
 * 
 * This matches the design requirements:
 * @see requirements.md - Requisito 1, AC3: "backoff exponencial (5s, 10s, 20s, 60s)"
 */

import { config } from './config';

/**
 * Backoff options
 */
export interface BackoffOptions {
  baseDelay?: number;
  maxDelay?: number;
  attempt?: number;
  jitter?: boolean;
}

/**
 * Calculate exponential backoff delay
 * 
 * Uses formula: delay = min(baseDelay * (2 ^ attempt), maxDelay)
 * 
 * @param options - Backoff configuration
 * @returns Delay in milliseconds
 * 
 * @example
 * ```typescript
 * // For productSync: 5s, 10s, 20s, 60s
 * calculateBackoff({ baseDelay: 5000, attempt: 0 }); // 5000
 * calculateBackoff({ baseDelay: 5000, attempt: 1 }); // 10000
 * calculateBackoff({ baseDelay: 5000, attempt: 2 }); // 20000
 * calculateBackoff({ baseDelay: 5000, attempt: 3 }); // 40000 (or capped at 60000)
 * ```
 */
export function calculateBackoff(options: BackoffOptions = {}): number {
  const {
    baseDelay = 5000, // 5 seconds default
    maxDelay = 60000, // 60 seconds max
    attempt = 0,
    jitter = true,
  } = options;

  // Exponential formula: baseDelay * (2 ^ attempt)
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Cap at maxDelay
  let delay = Math.min(exponentialDelay, maxDelay);

  // Add jitter if enabled (±10% randomness)
  if (jitter) {
    const jitterAmount = delay * 0.1;
    const jitterValue = (Math.random() - 0.5) * 2 * jitterAmount;
    delay = Math.max(0, delay + jitterValue);
  }

  return Math.floor(delay);
}

/**
 * Get backoff configuration for a specific queue type
 * 
 * Provides queue-specific backoff settings from config
 * 
 * @param queueName - Name of the queue
 * @returns Backoff configuration or default
 */
export function getBackoffForQueue(
  queueName: string
): { type: string; delay: number } {
  const queueConfig = (config.queues as any)[queueName];
  
  if (queueConfig?.defaultJobOptions?.backoff) {
    return queueConfig.defaultJobOptions.backoff;
  }

  // Default fallback
  return {
    type: 'exponential',
    delay: 5000,
  };
}

/**
 * Validate exponential backoff configuration
 * 
 * Ensures backoff is properly configured and would produce expected delays
 * 
 * @returns Validation result
 */
export function validateBackoffConfig(): {
  valid: boolean;
  queues: Record<string, any>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const queues: Record<string, any> = {};

  // Check each queue's backoff configuration
  for (const [queueName, queueConfig] of Object.entries(config.queues as any)) {
    const backoff = queueConfig.defaultJobOptions?.backoff;
    
    if (!backoff) {
      warnings.push(`Queue "${queueName}" has no backoff configuration`);
      continue;
    }

    if (backoff.type !== 'exponential') {
      warnings.push(`Queue "${queueName}" uses ${backoff.type} backoff, not exponential`);
      continue;
    }

    if (!backoff.delay || backoff.delay < 1000) {
      warnings.push(`Queue "${queueName}" has very low base delay: ${backoff.delay}ms`);
    }

    // Calculate expected delays for this queue
    const maxAttempts = queueConfig.defaultJobOptions?.attempts || 5;
    const expectedDelays = [];
    
    for (let i = 0; i < maxAttempts; i++) {
      expectedDelays.push(calculateBackoff({
        baseDelay: backoff.delay,
        attempt: i,
        jitter: false,
      }));
    }

    queues[queueName] = {
      baseDelay: backoff.delay,
      maxAttempts,
      expectedDelays,
    };
  }

  return {
    valid: warnings.length === 0,
    queues,
    warnings,
  };
}

/**
 * Log backoff configuration for debugging
 */
export function logBackoffConfig(): void {
  const validation = validateBackoffConfig();

  console.log('\n=== Exponential Backoff Configuration ===');

  for (const [queueName, config] of Object.entries(validation.queues)) {
    console.log(`\n${queueName}:`);
    console.log(`  Base Delay: ${config.baseDelay}ms`);
    console.log(`  Max Attempts: ${config.maxAttempts}`);
    console.log(`  Expected Delays (without jitter):`);
    config.expectedDelays.forEach((delay: number, index: number) => {
      console.log(`    Attempt ${index + 1}: ${delay}ms (${(delay / 1000).toFixed(1)}s)`);
    });
  }

  if (validation.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    validation.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }

  console.log('\n========================================\n');
}

/**
 * Calculate when a job will be retried
 * 
 * Useful for logging and monitoring
 * 
 * @param currentTime - Current timestamp
 * @param attempt - Current attempt number
 * @param baseDelay - Base delay in ms
 * @returns Estimated retry time
 */
export function calculateRetryTime(
  currentTime: Date,
  attempt: number,
  baseDelay: number = 5000
): Date {
  const delay = calculateBackoff({
    baseDelay,
    attempt,
    jitter: false, // Use exact time for prediction
  });

  return new Date(currentTime.getTime() + delay);
}

/**
 * Format backoff delay as human-readable string
 * 
 * @param delayMs - Delay in milliseconds
 * @returns Formatted string
 */
export function formatDelay(delayMs: number): string {
  if (delayMs < 1000) {
    return `${delayMs}ms`;
  } else if (delayMs < 60000) {
    return `${(delayMs / 1000).toFixed(1)}s`;
  } else {
    return `${(delayMs / 60000).toFixed(1)}m`;
  }
}

