/**
 * Order Routing Service (Dropshipping Core)
 * ==========================================
 * 
 * Handles order routing to providers for dropshipping model.
 * Key differences from traditional e-commerce:
 * - NO inventory check - providers maintain stock
 * - Order flows: Marketplace → Order → Assign Provider → Notify Provider → Confirm → Ship
 * - Fallback: Try multiple providers if primary unavailable
 * 
 * Features:
 * - Route orders to providers based on category and availability
 * - Track provider assignments with timestamps
 * - Notify providers via BullMQ queue
 * - Multi-provider fallback with priority configuration
 * - Re-rotation if provider becomes unavailable
 * 
 * @see schema.prisma for OrderProviderAssignment model
 * @see provider.service.ts for provider validation
 * @see queue.ts for BullMQ integration
 * @see config.ts for queue configuration
 * 
 * Requirements: 2, 4, 5, 6
 * Effort: 4 hours
 */

import { PrismaClient } from '@/generated/prisma';
import { config } from '../config';
import { providerService } from './provider.service';
import { getQueue, QUEUE_NAMES, addJob } from '../queue';
import type { Order } from '@/generated/prisma';

const prisma = new PrismaClient();

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type ProviderAssignmentStatus = 
  | 'pending' 
  | 'assigned' 
  | 'confirmed' 
  | 'shipped' 
  | 'delivered' 
  | 'failed' 
  | 'cancelled';

export interface ProviderAssignment {
  id: string;
  orderId: string;
  providerId: string;
  status: ProviderAssignmentStatus;
  assignedAt: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  trackingNumber?: string;
  providerResponse?: any;
  retryCount: number;
  lastRetryAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderRoutingOptions {
  vendorId: string;
  preferredProviderId?: string; // If specified, try this provider first
  fallbackEnabled?: boolean; // Enable multi-provider fallback
  notifyOnComplete?: boolean;
}

export interface RoutingResult {
  success: boolean;
  assignmentId?: string;
  providerId?: string;
  status: 'assigned' | 'failed' | 'no_provider';
  error?: string;
  providersTried?: string[];
  providerResponse?: any;
}

// ============================================================================
// ORDER ROUTING SERVICE
// ============================================================================

export class OrderRoutingService {
  // ============================================================================
  // CORE ROUTING METHODS
  // ============================================================================

  /**
   * Route an order to a provider (dropshipping core)
   * 
   * This is the main entry point for order routing. It:
   * 1. Finds available providers for the order's category
   * 2. Assigns order to the best provider
   * 3. Creates assignment record
   * 4. Triggers provider notification job
   * 
   * In dropshipping, there's NO inventory check - providers maintain stock.
   * We only validate provider availability (isActive && isAvailable).
   * 
   * @param order - Order to route (must have vendorId and items)
   * @param options - Routing options
   * @returns Routing result with assignment ID and status
   * 
   * @example
   * ```typescript
   * const result = await orderRoutingService.routeOrderToProvider(order, {
   *   vendorId: 'vendor_123',
   *   fallbackEnabled: true,
   * });
   * 
   * if (result.success) {
   *   console.log(`Order routed to provider ${result.providerId}`);
   * }
   * ```
   */
  async routeOrderToProvider(
    order: Order,
    options: OrderRoutingOptions = {}
  ): Promise<RoutingResult> {
    const { vendorId, fallbackEnabled = true, preferredProviderId } = options;

    console.log(
      `[OrderRoutingService] Routing order ${order.id} (vendor: ${vendorId})...`
    );

    try {
      // Get category IDs from order items
      const categoryIds = await this.getOrderCategoryIds(order);

      // Find providers for these categories
      let providers = await this.getProvidersByCategories(
        vendorId,
        categoryIds,
        { isActive: true, isAvailable: true }
      );

      if (providers.length === 0) {
        console.warn(
          `[OrderRoutingService] No available providers found for categories: ${categoryIds.join(', ')}`
        );
        return {
          success: false,
          status: 'no_provider',
          error: 'No available providers found for order categories',
        };
      }

      // If preferred provider specified, move it to front of list
      if (preferredProviderId) {
        providers = this.moveToFront(providers, preferredProviderId);
      }

      // Track providers tried for fallback
      const providersTried: string[] = [];
      let lastError: string | undefined;

      // Try to assign to a provider
      for (const provider of providers) {
        providersTried.push(provider.id);

        const assignment = await this.allocateOrderToProvider(
          order.id,
          provider.id,
          { vendorId }
        );

        if (assignment) {
          console.log(
            `[OrderRoutingService] ✓ Order ${order.id} assigned to provider ${provider.id}`
          );

          // Trigger provider notification
          if (options.notifyOnComplete !== false) {
            await this.notifyProviderOfOrder(order, provider.id, assignment.id);
          }

          return {
            success: true,
            assignmentId: assignment.id,
            providerId: provider.id,
            status: 'assigned',
            providersTried,
            providerResponse: assignment.providerResponse,
          };
        }

        // Store last error for fallback context
        lastError = 'Provider allocation failed';
      }

      // Fallback enabled: Try remaining providers
      if (fallbackEnabled && providers.length > 1) {
        console.log(
          `[OrderRoutingService] Fallback: trying remaining providers...`
        );
        
        // Try with fallback strategy (lower priority)
        const fallbackResult = await this.handleFallback(
          order,
          { ...options, providersTried, lastError }
        );

        if (fallbackResult.success) {
          return fallbackResult;
        }
      }

      // All providers unavailable
      console.error(
        `[OrderRoutingService] ✗ All providers unavailable for order ${order.id}`
      );

      // Notify vendor that no provider is available
      await this.notifyVendorOfProviderIssue(order, providersTried, lastError);

      return {
        success: false,
        status: 'failed',
        error: lastError || 'All providers unavailable',
        providersTried,
      };
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error routing order ${order.id}:`,
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Allocate order to a specific provider
   * 
   * Creates an OrderProviderAssignment record and validates provider availability.
   * In dropshipping, we don't check inventory - we only verify the provider
   * can receive orders (isActive && isAvailable).
   * 
   * @param orderId - Order ID to allocate
   * @param providerId - Provider to allocate to
   * @param options - Allocation options
   * @returns Assignment record or null if allocation failed
   * 
   * @example
   * ```typescript
   * const assignment = await orderRoutingService.allocateOrderToProvider(
   *   'order_123',
   *   'provider_456',
   *   { vendorId: 'vendor_123' }
   * );
   * 
   * if (assignment) {
   *   console.log('Order allocated:', assignment.id);
   * }
   * ```
   */
  async allocateOrderToProvider(
    orderId: string,
    providerId: string,
    options: { vendorId: string }
  ): Promise<ProviderAssignment | null> {
    const { vendorId } = options;

    console.log(
      `[OrderRoutingService] Allocating order ${orderId} to provider ${providerId}...`
    );

    try {
      // Validate provider availability (dropshipping: no inventory check)
      const isAvailable = await providerService.validateProviderAvailability(
        providerId
      );

      if (!isAvailable) {
        console.warn(
          `[OrderRoutingService] Provider ${providerId} not available for allocation`
        );
        return null;
      }

      // Check if order already has an active assignment
      const existingAssignment = await prisma.orderProviderAssignment.findFirst({
        where: {
          orderId,
          status: { in: ['pending', 'assigned', 'confirmed'] },
        },
      });

      if (existingAssignment) {
        console.warn(
          `[OrderRoutingService] Order ${orderId} already has active assignment: ${existingAssignment.id}`
        );
        return existingAssignment as any;
      }

      // Create assignment record
      const assignment = await prisma.orderProviderAssignment.create({
        data: {
          orderId,
          providerId,
          status: 'pending',
          assignedAt: new Date(),
        },
        include: {
          order: true,
          provider: true,
        },
      });

      console.log(
        `[OrderRoutingService] ✓ Created assignment ${assignment.id} for order ${orderId}`
      );

      return assignment as any;
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error allocating order ${orderId} to provider ${providerId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Validate provider stock (dropshipping context)
   * 
   * KEY DIFFERENCE: In dropshipping, providers maintain their own stock.
   * We don't check inventory - we only validate that the provider can
   * receive orders (isActive && isAvailable).
   * 
   * @param providerId - Provider ID to validate
   * @returns true if provider is available for orders
   * 
   * @example
   * ```typescript
   * const available = await orderRoutingService.validateProviderStock('provider_123');
   * if (available) {
   *   // Provider can receive orders (no inventory check needed)
   * }
   * ```
   */
  async validateProviderStock(providerId: string): Promise<boolean> {
    try {
      // In dropshipping, stock validation = provider availability
      // Providers maintain their own inventory
      const isAvailable = await providerService.validateProviderAvailability(
        providerId
      );

      console.log(
        `[OrderRoutingService] Provider ${providerId} stock validation: ${isAvailable ? '✓ available' : '✗ unavailable'}`
      );

      return isAvailable;
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error validating provider stock ${providerId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Notify provider of new order
   * 
   * Creates a BullMQ job to notify the provider. The worker will:
   * - Send customer data (shipping address)
   * - Send order details
   * - Wait for provider confirmation
   * - Update assignment status
   * 
   * @param order - Order that was routed
   * @param providerId - Provider to notify
   * @param assignmentId - Assignment record ID
   * @returns Job ID for tracking
   * 
   * @example
   * ```typescript
   * const jobId = await orderRoutingService.notifyProviderOfOrder(
   *   order,
   *   'provider_123',
   *   'assignment_456'
   * );
   * 
   * console.log('Notification job created:', jobId);
   * ```
   */
  async notifyProviderOfOrder(
    order: Order,
    providerId: string,
    assignmentId: string
  ): Promise<string | null> {
    try {
      const queue = getQueue(QUEUE_NAMES.PROVIDER_NOTIFICATION);

      const job = await queue.add('notify-provider', {
        orderId: order.id,
        providerId,
        assignmentId,
        customerData: {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
          address: order.shippingAddress,
        },
        orderDetails: {
          totalPrice: order.totalPrice,
          itemsCount: order.items.length,
          marketplace: order.marketplace,
        },
      }, {
        attempts: config.queues.providerNotification.defaultJobOptions.attempts,
        backoff: config.queues.providerNotification.defaultJobOptions.backoff,
      });

      console.log(
        `[OrderRoutingService] ✓ Created notification job ${job.id} for provider ${providerId}`
      );

      return job.id;
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error creating notification job:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  // ============================================================================
  // MULTI-PROVIDER FALLBACK
  // ============================================================================

  /**
   * Handle fallback to multiple providers
   * 
   * If the primary provider is unavailable, try secondary providers
   * based on category priority configuration.
   * 
   * @param order - Order that needs fallback routing
   * @param options - Fallback options
   * @returns Routing result from fallback attempt
   */
  private async handleFallback(
    order: Order,
    options: OrderRoutingOptions & { providersTried?: string[]; lastError?: string }
  ): Promise<RoutingResult> {
    const { vendorId, providersTried = [], lastError } = options;

    console.log(
      `[OrderRoutingService] Handling fallback for order ${order.id}...`
    );

    try {
      // Get category IDs
      const categoryIds = await this.getOrderCategoryIds(order);

      // Get ALL providers for these categories (not just available)
      const allProviders = await this.getProvidersByCategories(
        vendorId,
        categoryIds,
        { isActive: true }
      );

      // Filter out providers already tried
      const remainingProviders = allProviders.filter(
        p => !providersTried.includes(p.id)
      );

      if (remainingProviders.length === 0) {
        console.warn(
          `[OrderRoutingService] No remaining providers for fallback (tried: ${providersTried.join(', ')})`
        );
        return {
          success: false,
          status: 'failed',
          error: lastError || 'All providers unavailable',
          providersTried,
        };
      }

      // Try remaining providers
      for (const provider of remainingProviders) {
        const assignment = await this.allocateOrderToProvider(
          order.id,
          provider.id,
          { vendorId }
        );

        if (assignment) {
          console.log(
            `[OrderRoutingService] ✓ Fallback: order ${order.id} assigned to provider ${provider.id}`
          );

          await this.notifyProviderOfOrder(order, provider.id, assignment.id);

          return {
            success: true,
            assignmentId: assignment.id,
            providerId: provider.id,
            status: 'assigned',
            providersTried: [...providersTried, provider.id],
            providerResponse: assignment.providerResponse,
          };
        }
      }

      // All fallback providers also unavailable
      console.error(
        `[OrderRoutingService] ✗ All fallback providers unavailable for order ${order.id}`
      );

      return {
        success: false,
        status: 'failed',
        error: lastError || 'All providers unavailable',
        providersTried: [...providersTried, ...remainingProviders.map(p => p.id)],
      };
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error in fallback:`,
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        providersTried,
      };
    }
  }

  /**
   * Notify vendor when all providers are unavailable
   * 
   * @param order - Order that couldn't be routed
   * @param providersTried - List of providers attempted
   * @param lastError - Last error encountered
   */
  private async notifyVendorOfProviderIssue(
    order: Order,
    providersTried: string[],
    lastError?: string
  ): Promise<void> {
    try {
      console.warn(
        `[OrderRoutingService] Notifying vendor ${order.vendorId} of provider issue for order ${order.id}`,
        `Providers tried: ${providersTried.join(', ')}${lastError ? `, Error: ${lastError}` : ''}`
      );

      // TODO: Implement actual vendor notification (email, push, etc.)
      // For now, log the issue for monitoring

      // Create a system notification for admin review
      await prisma.syncEvent.create({
        data: {
          type: 'provider_issue',
          vendorId: order.vendorId,
          entityId: order.id,
          entityType: 'order',
          operation: 'routing_failed',
          status: 'pending',
          error: `All providers unavailable. Tried: ${providersTried.join(', ')}. ${lastError || ''}`,
        },
      });
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error notifying vendor of provider issue:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get category IDs from order items
   */
  private async getOrderCategoryIds(order: Order): Promise<string[]> {
    try {
      // Get unique category IDs from order items
      const categoryIds = new Set<string>();

      for (const item of order.items) {
        if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { categoryId: true },
          });
          if (product?.categoryId) {
            categoryIds.add(product.categoryId);
          }
        }
      }

      return Array.from(categoryIds);
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error getting category IDs for order ${order.id}:`,
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Get providers by category IDs
   * 
   * @param vendorId - Vendor ID
   * @param categoryIds - Category IDs to filter by
   * @param filters - Additional filters (isActive, isAvailable)
   * @returns List of providers that handle these categories
   */
  private async getProvidersByCategories(
    vendorId: string,
    categoryIds: string[],
    filters?: { isActive?: boolean; isAvailable?: boolean }
  ): Promise<any[]> {
    try {
      const where: any = {
        vendorId,
        categories: { hasSome: categoryIds },
      };

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.isAvailable !== undefined) {
        where.isAvailable = filters.isAvailable;
      }

      const providers = await prisma.provider.findMany({
        where,
        orderBy: [
          { successRate: 'desc' }, // Prefer higher success rate
          { responseTimeMinutes: 'asc' }, // Prefer faster response
          { createdAt: 'asc' }, // Prefer older providers (established)
        ],
      });

      return providers;
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error getting providers for categories ${categoryIds.join(', ')}:`,
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Move provider to front of list (for preferred provider)
   */
  private moveToFront<T extends { id: string }>(
    providers: T[],
    providerId: string
  ): T[] {
    const index = providers.findIndex(p => p.id === providerId);
    if (index > 0) {
      const [provider] = providers.splice(index, 1);
      providers.unshift(provider);
    }
    return providers;
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(
    assignmentId: string,
    status: ProviderAssignmentStatus,
    data?: Partial<ProviderAssignment>
  ): Promise<ProviderAssignment | null> {
    try {
      const assignment = await prisma.orderProviderAssignment.update({
        where: { id: assignmentId },
        data: {
          status,
          ...data,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[OrderRoutingService] Updated assignment ${assignmentId} to status: ${status}`
      );

      return assignment as any;
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error updating assignment ${assignmentId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Re-route order to different provider
   * 
   * Used when current provider becomes unavailable or fails
   */
  async rerouteOrder(
    orderId: string,
    newProviderId: string,
    options: { vendorId: string }
  ): Promise<RoutingResult | null> {
    try {
      const { vendorId } = options;

      console.log(
        `[OrderRoutingService] Re-routing order ${orderId} to provider ${newProviderId}...`
      );

      // Find current assignment
      const currentAssignment = await prisma.orderProviderAssignment.findFirst({
        where: {
          orderId,
          status: { in: ['pending', 'assigned', 'confirmed'] },
        },
        orderBy: { assignedAt: 'desc' },
      });

      if (!currentAssignment) {
        console.warn(
          `[OrderRoutingService] No active assignment found for order ${orderId}`
        );
        return null;
      }

      // Mark current assignment as rerouted
      await prisma.orderProviderAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          status: 'rerouted',
          lastRetryAt: new Date(),
          failureReason: 'Order rerouted to different provider',
        },
      });

      // Allocate to new provider
      const newAssignment = await this.allocateOrderToProvider(
        orderId,
        newProviderId,
        { vendorId }
      );

      if (!newAssignment) {
        console.error(
          `[OrderRoutingService] Failed to allocate to new provider ${newProviderId}`
        );
        return null;
      }

      // Notify new provider
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (order) {
        await this.notifyProviderOfOrder(order, newProviderId, newAssignment.id);
      }

      return {
        success: true,
        assignmentId: newAssignment.id,
        providerId: newProviderId,
        status: 'assigned',
      };
    } catch (error) {
      console.error(
        `[OrderRoutingService] Error rerouting order ${orderId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance of OrderRoutingService
 */
export const orderRoutingService = new OrderRoutingService();
export default orderRoutingService;