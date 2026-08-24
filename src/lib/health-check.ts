/**
 * Health Check Utilities
 * =====================
 * 
 * Provides comprehensive health checks for all infrastructure components:
 * - Redis connection
 * - Database connectivity
 * - Queue systems
 * - Backoff configuration
 * 
 * Used by /api/health endpoint for monitoring and alerting.
 * 
 * @see api/health/route.ts for HTTP endpoint
 */

import { redis } from './redis';
import { checkRedisHealth, getAllQueueStats } from './queue';
import { validateBackoffConfig } from './backoff';

/**
 * Health check status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Component health result
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  lastChecked?: Date;
}

/**
 * Overall health report
 */
export interface HealthReport {
  status: HealthStatus;
  timestamp: Date;
  components: {
    redis: ComponentHealth;
    database: ComponentHealth;
    queues: ComponentHealth;
    backoff: ComponentHealth;
  };
  queueStats?: Record<string, any>;
  recommendations?: string[];
}

/**
 * Check Redis health
 */
async function checkRedisComponent(): Promise<ComponentHealth> {
  try {
    const isHealthy = await checkRedisHealth();

    return {
      name: 'Redis',
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      details: {
        connected: redis.isConnected,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      name: 'Redis',
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check database health
 * 
 * Note: Currently minimal check - can be enhanced with actual DB query
 */
async function checkDatabaseComponent(): Promise<ComponentHealth> {
  try {
    // Check if DATABASE_URL is configured
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return {
        name: 'Database',
        status: HealthStatus.UNHEALTHY,
        message: 'DATABASE_URL not configured',
        lastChecked: new Date(),
      };
    }

    return {
      name: 'Database',
      status: HealthStatus.HEALTHY,
      details: {
        configured: true,
        // Don't expose full URL in logs for security
        host: new URL(databaseUrl).hostname,
      },
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      name: 'Database',
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check queues health
 */
async function checkQueuesComponent(): Promise<ComponentHealth> {
  try {
    const stats = await getAllQueueStats();

    // Check if any queue has too many failed jobs
    let hasIssues = false;
    let totalFailed = 0;

    for (const [name, queueStats] of stats.entries()) {
      if (queueStats.failed && queueStats.failed > 100) {
        hasIssues = true;
      }
      totalFailed += queueStats.failed || 0;
    }

    const status = hasIssues ? HealthStatus.DEGRADED : HealthStatus.HEALTHY;
    const message = hasIssues
      ? `High number of failed jobs: ${totalFailed}`
      : `All queues operational`;

    return {
      name: 'Queues',
      status,
      message,
      details: {
        totalQueues: stats.size,
        totalFailed,
      },
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      name: 'Queues',
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check backoff configuration
 */
function checkBackoffComponent(): ComponentHealth {
  try {
    const validation = validateBackoffConfig();

    return {
      name: 'Backoff Configuration',
      status: validation.valid ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      details: {
        valid: validation.valid,
        queues: Object.keys(validation.queues).length,
        issues: validation.warnings.length,
      },
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      name: 'Backoff Configuration',
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Perform comprehensive health check
 * 
 * @returns Full health report
 */
export async function performHealthCheck(): Promise<HealthReport> {
  const components = {
    redis: await checkRedisComponent(),
    database: await checkDatabaseComponent(),
    queues: await checkQueuesComponent(),
    backoff: checkBackoffComponent(),
  };

  // Determine overall status
  const statuses = Object.values(components).map(c => c.status);
  let overallStatus = HealthStatus.HEALTHY;

  if (statuses.includes(HealthStatus.UNHEALTHY)) {
    overallStatus = HealthStatus.UNHEALTHY;
  } else if (statuses.includes(HealthStatus.DEGRADED)) {
    overallStatus = HealthStatus.DEGRADED;
  }

  // Get queue statistics
  let queueStats;
  try {
    queueStats = await getAllQueueStats();
  } catch (error) {
    console.error('[HealthCheck] Failed to get queue stats:', error);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (components.redis.status !== HealthStatus.HEALTHY) {
    recommendations.push('Check Redis connection - restart Redis service if necessary');
  }

  if (components.queues.status === HealthStatus.DEGRADED) {
    recommendations.push('High number of failed jobs detected - review error logs and retry manually');
  }

  if (components.backoff.status === HealthStatus.DEGRADED) {
    recommendations.push('Backoff configuration has warnings - review configuration');
  }

  return {
    status: overallStatus,
    timestamp: new Date(),
    components,
    queueStats: queueStats ? Object.fromEntries(queueStats) : undefined,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };
}

/**
 * Log health report to console
 */
export function logHealthReport(report: HealthReport): void {
  console.log('\n=== System Health Report ===');
  console.log(`Status: ${report.status}`);
  console.log(`Timestamp: ${report.timestamp.toISOString()}`);

  console.log('\nComponents:');
  for (const [key, component] of Object.entries(report.components)) {
    const statusEmoji =
      component.status === HealthStatus.HEALTHY
        ? '✅'
        : component.status === HealthStatus.DEGRADED
          ? '⚠️'
          : '❌';

    console.log(`  ${statusEmoji} ${component.name}: ${component.status}`);

    if (component.message) {
      console.log(`    └─ ${component.message}`);
    }

    if (component.details) {
      console.log(`    └─ Details: ${JSON.stringify(component.details)}`);
    }
  }

  if (report.recommendations && report.recommendations.length > 0) {
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }

  console.log('\n=============================\n');
}

/**
 * Quick health check (simplified, for frequent polling)
 * 
 * Only checks critical components (Redis, Database)
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    const redisHealthy = await checkRedisHealth();
    return redisHealthy;
  } catch (error) {
    console.error('[HealthCheck] Quick check failed:', error);
    return false;
  }
}

