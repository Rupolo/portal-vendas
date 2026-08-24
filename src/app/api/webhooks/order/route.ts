/**
 * POST /api/webhooks/order
 * Webhook endpoint for order events from Shopee and Mercado Livre
 * Validates signature, checks idempotency, and queues for processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookValidatorService, rateLimiterService } from '@/lib/services';
import { getQueue } from '@/lib/queue';
import type { Marketplace } from '@/lib/types';

// Store webhook delivery IDs for idempotency check (in-memory for now, would be Redis/DB in production)
const recentDeliveries = new Set<string>();

// Cleanup old delivery IDs every 1 hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    recentDeliveries.clear();
  }, 60 * 60 * 1000);
}

export async function POST(request: NextRequest) {
  try {
    // Get marketplace from query params
    const { searchParams } = new URL(request.url);
    const marketplace = searchParams.get('marketplace') as Marketplace;

    if (!marketplace || !['shopee', 'mercadolivre'].includes(marketplace)) {
      return NextResponse.json(
        { error: 'Invalid or missing marketplace parameter' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // Check rate limit
    const rateLimitStatus = rateLimiterService.isMarketplaceAllowed(marketplace);

    if (!rateLimitStatus.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitStatus.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimitStatus.retryAfter) } }
      );
    }

    // Read request body
    const body = await request.text();

    // Get headers for validation
    const timestamp = request.headers.get('x-shopee-timestamp');
    const signature = request.headers.get('x-shopee-signature') ||
                      request.headers.get('x-mercadolivre-signature') ||
                      request.headers.get('x-signature') || '';

    const xSignature = request.headers.get('x-signature-sha256');

    // Get webhook secrets from environment
    const webhookSecret = process.env[`${marketplace.toUpperCase()}_WEBHOOK_SECRET`];

    if (!webhookSecret) {
      console.error(`[Webhook] Missing webhook secret for ${marketplace}`);
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Validate webhook signature
    const validationResult = webhookValidatorService.validateWebhook(
      marketplace,
      {
        body,
        signature,
        timestamp: timestamp || undefined,
        xSignature: xSignature || undefined,
      },
      { webhookSecret }
    );

    if (!validationResult.isValid) {
      console.warn(`[Webhook] Invalid signature for ${marketplace}: ${validationResult.error}`);
      return NextResponse.json(
        { error: validationResult.error || 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload = webhookValidatorService.parseWebhookPayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate payload structure
    const structureValidation = webhookValidatorService.validatePayloadStructure(
      marketplace,
      payload
    );

    if (!structureValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid payload structure', errors: structureValidation.errors },
        { status: 400 }
      );
    }

    // Extract webhook ID for idempotency
    const webhookId = webhookValidatorService.extractWebhookId(marketplace, payload);

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Could not extract webhook ID from payload' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (recentDeliveries.has(webhookId)) {
      console.log(`[Webhook] Duplicate delivery detected: ${webhookId}`);
      // Return success for duplicate to prevent retries
      return NextResponse.json(
        { message: 'Webhook received (duplicate)' },
        { status: 200 }
      );
    }

    recentDeliveries.add(webhookId);

    // Extract event type
    const eventType = webhookValidatorService.extractEventType(marketplace, payload);

    // Queue for processing
    const queue = getQueue('webhookProcessing');

    try {
      const job = await queue.add(`webhook-${marketplace}`, {
        marketplace,
        webhookId,
        eventType,
        payload,
        receivedAt: new Date(),
        ip,
      });

      console.log(`[Webhook] Queued webhook processing job: ${job.id}`);

      return NextResponse.json(
        {
          message: 'Webhook received and queued for processing',
          jobId: job.id,
          webhookId,
        },
        { status: 202 } // Accepted
      );
    } catch (queueError) {
      console.error('[Webhook] Failed to queue job:', queueError);

      return NextResponse.json(
        { error: 'Failed to queue webhook for processing' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Health check for webhook endpoint
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      status: 'ok',
      message: 'Webhook endpoint is ready',
      timestamp: new Date(),
    },
    { status: 200 }
  );
}
