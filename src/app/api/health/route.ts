/**
 * GET /api/health
 * Comprehensive health check endpoint for monitoring all infrastructure components
 * 
 * Returns:
 * - 200: All systems healthy
 * - 503: One or more systems unhealthy
 * 
 * Query params:
 * - ?verbose=true - Include detailed component information
 * - ?simple=true - Return minimal health status only
 */

import { NextResponse, NextRequest } from 'next/server';
import { performHealthCheck, logHealthReport, HealthStatus } from '@/lib/health-check';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const verbose = searchParams.get('verbose') === 'true';
    const simple = searchParams.get('simple') === 'true';

    // Ensure Redis is connected on first health check
    if (!redis.isConnected && !redis.isConnecting) {
      try {
        await redis.connect();
      } catch (error) {
        console.warn('[Health] Failed to connect Redis:', error instanceof Error ? error.message : String(error));
      }
    }

    // Perform comprehensive health check
    const healthReport = await performHealthCheck();

    // Determine HTTP status code
    const statusCode =
      healthReport.status === HealthStatus.HEALTHY ? 200 :
      healthReport.status === HealthStatus.DEGRADED ? 503 :
      503;

    // Log health report in verbose mode
    if (verbose) {
      logHealthReport(healthReport);
    }

    // Return simple response if requested
    if (simple) {
      return NextResponse.json(
        {
          status: healthReport.status,
          timestamp: healthReport.timestamp,
        },
        { status: statusCode }
      );
    }

    // Return full health report
    return NextResponse.json(healthReport, { status: statusCode });
  } catch (error) {
    console.error('[Health] Error checking health:', error);

    return NextResponse.json(
      {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
