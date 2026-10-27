/**
 * Provider Notification Worker
 * ============================
 * 
 * Processes jobs to notify providers of new orders in the dropshipping model.
 * Uses BullMQ for queue processing with automatic retries.
 * 
 * Features:
 * - Send customer data to provider (shipping address)
 * - Send order details
 * - Wait for provider confirmation
 * - Update assignment status
 * - Handle provider API failures with retries
 * 
 * @see queue.ts for BullMQ queue setup
 * @see order-routing.service.ts for order routing
 * @see config.ts for job configuration
 * 
 * Requirements: 4, 5
 * Effort: 2 hours
 */

import { PrismaClient } from '@/generated/prisma';
import { providerService } from '../services/provider.service';
import { orderRoutingService } from '../services/order-routing.service';
import type { Job } from 'bullmq';

const prisma = new PrismaClient();

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface ProviderNotificationData {
  orderId: string;
  providerId: string;
  assignmentId: string;
  customerData: {
    name: string;
    email: string;
    phone?: string;
    address: any; // { street, number, complement, neighborhood, city, state, zipCode, country }
  };
  orderDetails: {
    totalPrice: number;
    itemsCount: number;
    marketplace: string;
  };
}

// ============================================================================
// PROVIDER NOTIFICATION WORKER
// ============================================================================

/**
 * Process provider notification job
 * 
 * This worker:
 * 1. Retrieves the provider's API credentials
 * 2. Sends order details to the provider
 * 3. Waits for confirmation
 * 4. Updates the assignment status
 * 
 * @param job - BullMQ job with notification data
 * @returns Processing result
 */
export async function processProviderNotification(
  job: Job<ProviderNotificationData>
): Promise<{ success: boolean; providerResponse?: any }> {
  const { orderId, providerId, assignmentId, customerData, orderDetails } = job.data;

  console.log(
    `[ProviderNotificationWorker] Processing notification for order ${orderId} to provider ${providerId}`
  );

  try {
    // Get provider credentials
    const credentials = await providerService.getProviderCredentials(providerId);

    if (!credentials) {
      console.error(
        `[ProviderNotificationWorker] No credentials found for provider ${providerId}`
      );
      throw new Error('Provider credentials not found');
    }

    // Build notification payload
    const notificationPayload = {
      orderId,
      customer: customerData,
      order: {
        totalPrice: orderDetails.totalPrice,
        itemsCount: orderDetails.itemsCount,
        marketplace: orderDetails.marketplace,
      },
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[ProviderNotificationWorker] Sending notification to provider ${providerId}...`
    );

    // Call provider API (simulated)
    const providerResponse = await callProviderAPI(
      credentials.endpointUrl || '',
      credentials.apiKey,
      'notify-order',
      notificationPayload
    );

    console.log(
      `[ProviderNotificationWorker] ✓ Provider ${providerId} confirmed order ${orderId}`
    );

    // Update assignment status to confirmed
    await orderRoutingService.updateAssignmentStatus(assignmentId, 'confirmed', {
      providerResponse,
      confirmedAt: new Date(),
    });

    return {
      success: true,
      providerResponse,
    };
  } catch (error) {
    console.error(
      `[ProviderNotificationWorker] Error processing notification for order ${orderId}:`,
      error instanceof Error ? error.message : String(error)
    );

    // Update assignment status to failed
    await orderRoutingService.updateAssignmentStatus(assignmentId, 'failed', {
      lastRetryAt: new Date(),
      failureReason: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Simulate calling provider API
 * 
 * In production, this would make actual HTTP requests to the provider's API.
 * For now, it simulates a successful response with a delay.
 * 
 * @param endpointUrl - Provider API endpoint
 * @param apiKey - Provider API key
 * @param operation - Operation to perform
 * @param payload - Request payload
 * @returns Provider response
 */
async function callProviderAPI(
  endpointUrl: string,
  apiKey: string,
  operation: string,
  payload: any
): Promise<any> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // TODO: Implement actual HTTP request to provider API
  // Example:
  // const response = await fetch(`${endpointUrl}/api/v1/${operation}`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${apiKey}`,
  //   },
  //   body: JSON.stringify(payload),
  // });
  // return await response.json();

  // Simulate successful response
  return {
    success: true,
    confirmationId: `CONF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    message: 'Order received by provider',
    expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  };
}

/**
 * Handle job completion
 * 
 * @param job - Completed job
 * @param result - Result from processor
 */
export function handleJobCompletion(
  job: Job,
  result: any
): void {
  console.log(
    `[ProviderNotificationWorker] Job ${job.id} completed successfully`,
    result ? `(response: ${JSON.stringify(result).substring(0, 100)})` : ''
  );
}

/**
 * Handle job failure
 * 
 * @param job - Failed job
 * @param error - Error that caused failure
 */
export function handleJobFailure(
  job: Job,
  error: Error
): void {
  console.error(
    `[ProviderNotificationWorker] Job ${job.id} failed after ${job.attemptsMade} attempts:`,
    error.message
  );
}

// ============================================================================
// WORKER CREATION HELPER
// ============================================================================

/**
 * Create a worker for provider notification queue
 * 
 * @param queue - BullMQ queue instance
 * @returns Worker instance
 */
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../queue';

export function createProviderNotificationWorker(queue: Queue): Worker {
  return new Worker(queue.name, processProviderNotification, {
    connection: redisConnection as any,
    concurrency: 10, // Process up to 10 notifications concurrently
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  processProviderNotification as processor,
  createProviderNotificationWorker,
  callProviderAPI,
  handleJobCompletion,
  handleJobFailure,
};

export default processProviderNotification;