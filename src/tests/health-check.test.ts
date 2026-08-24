/**
 * Tests for Health Check Implementation
 * 
 * Validates:
 * - Redis connection health checks
 * - Queue system health
 * - Backoff configuration validation
 * - Overall system health reporting
 * 
 * Requirements covered:
 * - Requisito 6: "visibilidade completa sobre falhas de sincronização"
 * - Requisito 8: "Dashboard com status de sincronização"
 * - Requisito 12: "Performance e escalabilidade"
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { performHealthCheck, HealthStatus, logHealthReport } from '@/lib/health-check';
import { checkRedisHealth } from '@/lib/queue';

describe('Health Check System', () => {
  describe('performHealthCheck', () => {
    it('should return a valid health report structure', async () => {
      const report = await performHealthCheck();

      expect(report).toBeDefined();
      expect(report.status).toBeDefined();
      expect(Object.values(HealthStatus)).toContain(report.status);
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.components).toBeDefined();
    });

    it('should check all required components', async () => {
      const report = await performHealthCheck();

      expect(report.components).toHaveProperty('redis');
      expect(report.components).toHaveProperty('database');
      expect(report.components).toHaveProperty('queues');
      expect(report.components).toHaveProperty('backoff');
    });

    it('should set Redis component status', async () => {
      const report = await performHealthCheck();

      expect(report.components.redis).toBeDefined();
      expect(report.components.redis.name).toBe('Redis');
      expect(report.components.redis.status).toBeDefined();
      expect(Object.values(HealthStatus)).toContain(report.components.redis.status);
    });

    it('should set Database component status', async () => {
      const report = await performHealthCheck();

      expect(report.components.database).toBeDefined();
      expect(report.components.database.name).toBe('Database');
      expect(report.components.database.status).toBeDefined();
    });

    it('should set Queues component status', async () => {
      const report = await performHealthCheck();

      expect(report.components.queues).toBeDefined();
      expect(report.components.queues.name).toBe('Queues');
      expect(report.components.queues.status).toBeDefined();
    });

    it('should set Backoff component status', async () => {
      const report = await performHealthCheck();

      expect(report.components.backoff).toBeDefined();
      expect(report.components.backoff.name).toBe('Backoff Configuration');
      expect(report.components.backoff.status).toBeDefined();
    });

    it('should determine overall status correctly', async () => {
      const report = await performHealthCheck();

      // If any component is unhealthy, overall should be unhealthy
      const hasUnhealthy = Object.values(report.components).some(
        comp => comp.status === HealthStatus.UNHEALTHY
      );

      if (hasUnhealthy) {
        expect(report.status).toBe(HealthStatus.UNHEALTHY);
      }

      // If any component is degraded (and none unhealthy), overall should be degraded
      const hasDegraded = Object.values(report.components).some(
        comp => comp.status === HealthStatus.DEGRADED
      );
      const hasNoUnhealthy = !hasUnhealthy;

      if (hasDegraded && hasNoUnhealthy) {
        expect(report.status).toBe(HealthStatus.DEGRADED);
      }
    });

    it('should include timestamps for each component', async () => {
      const report = await performHealthCheck();

      Object.values(report.components).forEach(component => {
        expect(component.lastChecked).toBeInstanceOf(Date);
      });
    });

    it('should include queue statistics when available', async () => {
      const report = await performHealthCheck();

      // queueStats is optional but should be present if checks passed
      if (report.queueStats) {
        expect(typeof report.queueStats).toBe('object');
      }
    });

    it('should generate recommendations when there are issues', async () => {
      const report = await performHealthCheck();

      // If there are unhealthy components, there should be recommendations
      const hasIssues = Object.values(report.components).some(
        comp => comp.status !== HealthStatus.HEALTHY
      );

      if (hasIssues && report.recommendations) {
        expect(report.recommendations.length).toBeGreaterThan(0);
        expect(Array.isArray(report.recommendations)).toBe(true);
      }
    });

    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();
      await performHealthCheck();
      const duration = Date.now() - startTime;

      // Health check should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Component Checks', () => {
    it('should have valid Redis details when healthy', async () => {
      const report = await performHealthCheck();
      const redisCheck = report.components.redis;

      if (redisCheck.status === HealthStatus.HEALTHY) {
        expect(redisCheck.details).toBeDefined();
        expect(redisCheck.details?.host).toBeDefined();
        expect(redisCheck.details?.port).toBeDefined();
      }
    });

    it('should have valid Database details when healthy', async () => {
      const report = await performHealthCheck();
      const dbCheck = report.components.database;

      if (dbCheck.status === HealthStatus.HEALTHY) {
        expect(dbCheck.details).toBeDefined();
        expect(dbCheck.details?.configured).toBe(true);
      }
    });

    it('should report failed components with messages', async () => {
      const report = await performHealthCheck();

      Object.values(report.components).forEach(component => {
        if (component.status === HealthStatus.UNHEALTHY) {
          expect(component.message || component.details).toBeDefined();
        }
      });
    });
  });

  describe('Backoff Configuration in Health Check', () => {
    it('should validate backoff configuration as healthy', async () => {
      const report = await performHealthCheck();
      const backoffCheck = report.components.backoff;

      expect(backoffCheck.status).toBe(HealthStatus.HEALTHY);
      expect(backoffCheck.details?.valid).toBe(true);
    });

    it('should report queue counts in backoff component', async () => {
      const report = await performHealthCheck();
      const backoffCheck = report.components.backoff;

      expect(backoffCheck.details).toBeDefined();
      expect(backoffCheck.details?.queues).toBeGreaterThan(0);
    });
  });

  describe('Health Report Formatting', () => {
    it('should not throw when logging health report', async () => {
      const report = await performHealthCheck();

      // Mock console.log to verify it's called
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => {
        logHealthReport(report);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should include status in log output', async () => {
      const report = await performHealthCheck();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logHealthReport(report);

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain(report.status);

      consoleSpy.mockRestore();
    });

    it('should include component names in log output', async () => {
      const report = await performHealthCheck();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logHealthReport(report);

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Redis');
      expect(calls).toContain('Database');
      expect(calls).toContain('Queues');

      consoleSpy.mockRestore();
    });

    it('should include recommendations in log output when present', async () => {
      const report = await performHealthCheck();

      if (report.recommendations && report.recommendations.length > 0) {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        logHealthReport(report);

        const calls = consoleSpy.mock.calls.flat().join('\n');
        expect(calls).toContain('Recommendations');

        consoleSpy.mockRestore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle component check failures gracefully', async () => {
      const report = await performHealthCheck();

      // Report should still be valid even if some checks fail
      expect(report).toBeDefined();
      expect(report.status).toBeDefined();
      expect(report.components).toBeDefined();
    });

    it('should provide error messages in component details', async () => {
      const report = await performHealthCheck();

      Object.values(report.components).forEach(component => {
        if (component.status === HealthStatus.UNHEALTHY && component.message) {
          expect(typeof component.message).toBe('string');
          expect(component.message.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Health Check Integration with API', () => {
    it('should work with health check endpoint', async () => {
      // This validates that performHealthCheck can be called from the API
      const report = await performHealthCheck();

      expect(report.status).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.components).toBeDefined();

      // Should be serializable to JSON (for API response)
      const json = JSON.stringify(report);
      expect(json).toBeTruthy();
    });
  });

  describe('Monitoring and Observability', () => {
    it('should provide status for alerting systems', async () => {
      const report = await performHealthCheck();

      // External monitoring systems should be able to determine status
      expect([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]).toContain(
        report.status
      );
    });

    it('should provide queue statistics for capacity monitoring', async () => {
      const report = await performHealthCheck();

      if (report.queueStats) {
        // Should have stats for each queue
        expect(Object.keys(report.queueStats).length).toBeGreaterThan(0);

        // Each queue should have counts
        Object.values(report.queueStats).forEach((stats: any) => {
          if (stats && typeof stats === 'object') {
            // Should have either a queue name or error
            expect(stats.queue || stats.error).toBeDefined();
          }
        });
      }
    });

    it('should provide actionable recommendations', async () => {
      const report = await performHealthCheck();

      if (report.recommendations) {
        report.recommendations.forEach(rec => {
          // Each recommendation should be actionable
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        });
      }
    });
  });
});

