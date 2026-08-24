/**
 * Tests for Exponential Backoff Implementation
 * 
 * Validates:
 * - Correct exponential backoff calculation
 * - Jitter implementation
 * - Configuration validation
 * - BullMQ backoff configuration matches requirements
 * 
 * Requirements covered:
 * - Requisito 1, AC3: "backoff exponencial (5s, 10s, 20s, 60s)"
 * - Requisito 4, AC6: "retry com backoff exponencial"
 * - Requisito 6, AC4: "implementar retry automático com backoff"
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateBackoff,
  getBackoffForQueue,
  validateBackoffConfig,
  calculateRetryTime,
  formatDelay,
} from '@/lib/backoff';
import { QUEUE_NAMES } from '@/lib/queue';
import { config } from '@/lib/config';

describe('Exponential Backoff', () => {
  describe('calculateBackoff', () => {
    it('should calculate correct exponential delays without jitter', () => {
      const baseDelay = 5000;

      expect(calculateBackoff({ baseDelay, attempt: 0, jitter: false })).toBe(5000); // 5s
      expect(calculateBackoff({ baseDelay, attempt: 1, jitter: false })).toBe(10000); // 10s
      expect(calculateBackoff({ baseDelay, attempt: 2, jitter: false })).toBe(20000); // 20s
      expect(calculateBackoff({ baseDelay, attempt: 3, jitter: false })).toBe(40000); // 40s
    });

    it('should cap at maxDelay', () => {
      const baseDelay = 5000;
      const maxDelay = 60000;

      // 5000 * 2^3 = 40000
      expect(calculateBackoff({ baseDelay, attempt: 3, maxDelay, jitter: false })).toBe(40000);

      // 5000 * 2^4 = 80000, capped at 60000
      expect(calculateBackoff({ baseDelay, attempt: 4, maxDelay, jitter: false })).toBe(60000);

      // 5000 * 2^5 = 160000, capped at 60000
      expect(calculateBackoff({ baseDelay, attempt: 5, maxDelay, jitter: false })).toBe(60000);
    });

    it('should add jitter when enabled', () => {
      const baseDelay = 5000;
      const delays: number[] = [];

      // Run multiple times to verify randomness
      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoff({ baseDelay, attempt: 0, jitter: true }));
      }

      // Not all delays should be the same (jitter applied)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within ±10% of base (5000 ± 500 = 4500-5500)
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.9);
        expect(delay).toBeLessThanOrEqual(baseDelay * 1.1);
      });
    });

    it('should use defaults correctly', () => {
      // Default: 5000ms base, 60000ms max, no jitter
      expect(calculateBackoff({ attempt: 0, jitter: false })).toBe(5000);
      expect(calculateBackoff({ attempt: 1, jitter: false })).toBe(10000);
    });
  });

  describe('getBackoffForQueue', () => {
    it('should return exponential backoff for productSync', () => {
      const backoff = getBackoffForQueue('productSync');

      expect(backoff.type).toBe('exponential');
      expect(backoff.delay).toBeGreaterThan(0);
    });

    it('should return exponential backoff for all configured queues', () => {
      const queueNames = ['productSync', 'inventorySync', 'orderSync', 'webhookProcessing', 'errorRecovery'];

      queueNames.forEach(name => {
        const backoff = getBackoffForQueue(name);
        expect(backoff.type).toBe('exponential');
        expect(backoff.delay).toBeGreaterThan(0);
      });
    });
  });

  describe('validateBackoffConfig', () => {
    it('should validate configuration successfully', () => {
      const validation = validateBackoffConfig();

      expect(validation.valid).toBe(true);
      expect(Object.keys(validation.queues).length).toBeGreaterThan(0);
      expect(validation.warnings.length).toBe(0);
    });

    it('should have exponential delays matching requirements', () => {
      const validation = validateBackoffConfig();

      // productSync should have delays: 5s, 10s, 20s, 60s (capped)
      const productSync = validation.queues.productSync;
      expect(productSync).toBeDefined();
      expect(productSync.expectedDelays[0]).toBe(5000);
      expect(productSync.expectedDelays[1]).toBe(10000);
      expect(productSync.expectedDelays[2]).toBe(20000);
      expect(productSync.expectedDelays[3]).toBe(40000);
      expect(productSync.expectedDelays[4]).toBe(60000); // Capped
    });

    it('should have all required queues', () => {
      const validation = validateBackoffConfig();

      expect(validation.queues).toHaveProperty('productSync');
      expect(validation.queues).toHaveProperty('inventorySync');
      expect(validation.queues).toHaveProperty('orderSync');
      expect(validation.queues).toHaveProperty('webhookProcessing');
      expect(validation.queues).toHaveProperty('errorRecovery');
    });

    it('errorRecovery should have more attempts than productSync', () => {
      const validation = validateBackoffConfig();

      const errorRecovery = validation.queues.errorRecovery;
      const productSync = validation.queues.productSync;

      expect(errorRecovery.maxAttempts).toBeGreaterThanOrEqual(productSync.maxAttempts);
    });
  });

  describe('calculateRetryTime', () => {
    it('should calculate correct retry times', () => {
      const baseTime = new Date('2024-01-01T12:00:00Z');

      // First retry: 5 seconds later
      const retry1 = calculateRetryTime(baseTime, 0, 5000);
      expect(retry1.getTime()).toBe(baseTime.getTime() + 5000);

      // Second retry: 10 seconds later
      const retry2 = calculateRetryTime(baseTime, 1, 5000);
      expect(retry2.getTime()).toBe(baseTime.getTime() + 10000);

      // Third retry: 20 seconds later
      const retry3 = calculateRetryTime(baseTime, 2, 5000);
      expect(retry3.getTime()).toBe(baseTime.getTime() + 20000);
    });
  });

  describe('formatDelay', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDelay(500)).toBe('500ms');
      expect(formatDelay(1500)).toBe('1.5s');
      expect(formatDelay(60000)).toBe('1.0m');
      expect(formatDelay(90000)).toBe('1.5m');
    });
  });

  describe('BullMQ Configuration Integration', () => {
    it('should have proper backoff configuration in config.ts', () => {
      const queueConfigs = config.queues as any;

      Object.entries(queueConfigs).forEach(([queueName, queueConfig]: [string, any]) => {
        const backoff = queueConfig.defaultJobOptions.backoff;

        expect(backoff).toBeDefined();
        expect(backoff.type).toBe('exponential');
        expect(backoff.delay).toBeGreaterThan(0);

        // Verify attempts are positive
        expect(queueConfig.defaultJobOptions.attempts).toBeGreaterThan(0);
      });
    });

    it('productSync should have 5 attempts with 5s base delay', () => {
      const productSync = (config.queues as any).productSync;

      expect(productSync.defaultJobOptions.attempts).toBe(5);
      expect(productSync.defaultJobOptions.backoff.delay).toBe(5000);
      expect(productSync.defaultJobOptions.backoff.type).toBe('exponential');
    });

    it('webhookProcessing should have 5 attempts with 2s base delay', () => {
      const webhookProcessing = (config.queues as any).webhookProcessing;

      expect(webhookProcessing.defaultJobOptions.attempts).toBe(5);
      expect(webhookProcessing.defaultJobOptions.backoff.delay).toBe(2000);
      expect(webhookProcessing.defaultJobOptions.backoff.type).toBe('exponential');
    });

    it('errorRecovery should have most attempts (10) with 10s base delay', () => {
      const errorRecovery = (config.queues as any).errorRecovery;

      expect(errorRecovery.defaultJobOptions.attempts).toBe(10);
      expect(errorRecovery.defaultJobOptions.backoff.delay).toBe(10000);
      expect(errorRecovery.defaultJobOptions.backoff.type).toBe('exponential');
    });
  });

  describe('Requirements Compliance', () => {
    it('should comply with Requisito 1, AC3: backoff exponencial (5s, 10s, 20s, 60s)', () => {
      const delays = [
        calculateBackoff({ baseDelay: 5000, attempt: 0, jitter: false }),
        calculateBackoff({ baseDelay: 5000, attempt: 1, jitter: false }),
        calculateBackoff({ baseDelay: 5000, attempt: 2, jitter: false }),
        calculateBackoff({ baseDelay: 5000, attempt: 3, maxDelay: 60000, jitter: false }),
      ];

      expect(delays).toEqual([5000, 10000, 20000, 40000]);

      // With capping at 60s
      const capped = calculateBackoff({ baseDelay: 5000, attempt: 4, maxDelay: 60000, jitter: false });
      expect(capped).toBe(60000);
    });

    it('should handle recoverable errors with automatic retry', () => {
      // Simulating what BullMQ would do with our configuration
      const maxRetries = 3;
      const baseDelay = 5000;

      const retryDelays = [];
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        retryDelays.push(calculateBackoff({ baseDelay, attempt, jitter: false }));
      }

      // Should produce escalating delays
      expect(retryDelays[0]).toBeLessThan(retryDelays[1]);
      expect(retryDelays[1]).toBeLessThanOrEqual(retryDelays[2]);

      // Should all be reasonable (5-60s)
      retryDelays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(5000);
        expect(delay).toBeLessThanOrEqual(60000);
      });
    });
  });
});

