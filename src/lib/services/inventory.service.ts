/**
 * Inventory Service
 * Manages product inventory with atomic operations and distributed locking
 */

import { config } from '../config';

export interface InventoryState {
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  error?: string;
}

export class InventoryService {
  private reservations = new Map<string, { productId: string; quantity: number; expiresAt: Date }>();
  private locks = new Map<string, { acquiredAt: Date; ttl: number }>();

  /**
   * Update inventory quantity
   */
  async updateInventory(productId: string, quantity: number): Promise<void> {
    try {
      // Acquire lock to prevent race conditions
      const lockId = await this.acquireInventoryLock(productId, 5000);

      if (!lockId) {
        throw new Error(`Failed to acquire lock for product ${productId}`);
      }

      try {
        // TODO: Update in database via Prisma
        // const inventory = await db.inventory.update({
        //   where: { productId },
        //   data: { totalQuantity: quantity, availableQuantity: quantity }
        // });

        console.log(`[InventoryService] Updated inventory for product ${productId}: ${quantity}`);
      } finally {
        await this.releaseInventoryLock(lockId);
      }
    } catch (error) {
      throw new Error(
        `Failed to update inventory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(productId: string, quantity: number): Promise<ReservationResult> {
    try {
      const lockId = await this.acquireInventoryLock(productId, 5000);

      if (!lockId) {
        return {
          success: false,
          error: `Failed to acquire lock for product ${productId}`,
        };
      }

      try {
        // Check available quantity
        const available = await this.getAvailableQuantity(productId);

        if (available < quantity) {
          return {
            success: false,
            error: `Insufficient inventory. Available: ${available}, Requested: ${quantity}`,
          };
        }

        // Create reservation
        const reservationId = `res_${productId}_${Date.now()}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        this.reservations.set(reservationId, {
          productId,
          quantity,
          expiresAt,
        });

        // TODO: Update reserved quantity in database
        // await db.inventory.update({
        //   where: { productId },
        //   data: { reservedQuantity: { increment: quantity } }
        // });

        console.log(
          `[InventoryService] Reserved ${quantity} units of product ${productId}, reservation: ${reservationId}`
        );

        return {
          success: true,
          reservationId,
        };
      } finally {
        await this.releaseInventoryLock(lockId);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reservation failed',
      };
    }
  }

  /**
   * Release a reservation
   */
  async releaseReservation(reservationId: string): Promise<void> {
    try {
      const reservation = this.reservations.get(reservationId);

      if (!reservation) {
        throw new Error(`Reservation ${reservationId} not found`);
      }

      const lockId = await this.acquireInventoryLock(reservation.productId, 5000);

      if (!lockId) {
        throw new Error(`Failed to acquire lock for product ${reservation.productId}`);
      }

      try {
        // TODO: Update reserved quantity in database
        // await db.inventory.update({
        //   where: { productId: reservation.productId },
        //   data: { reservedQuantity: { decrement: reservation.quantity } }
        // });

        this.reservations.delete(reservationId);

        console.log(
          `[InventoryService] Released reservation ${reservationId} for product ${reservation.productId}`
        );
      } finally {
        await this.releaseInventoryLock(lockId);
      }
    } catch (error) {
      throw new Error(
        `Failed to release reservation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get available quantity
   */
  async getAvailableQuantity(productId: string): Promise<number> {
    try {
      // TODO: Fetch from database via Prisma
      // const inventory = await db.inventory.findUnique({
      //   where: { productId }
      // });

      // return inventory?.availableQuantity || 0;

      return 0; // Placeholder
    } catch (error) {
      console.error(`[InventoryService] Failed to get available quantity:`, error);
      return 0;
    }
  }

  /**
   * Get total inventory state
   */
  async getInventoryState(productId: string): Promise<InventoryState> {
    try {
      // TODO: Fetch from database via Prisma
      // const inventory = await db.inventory.findUnique({
      //   where: { productId }
      // });

      // return {
      //   totalQuantity: inventory?.totalQuantity || 0,
      //   availableQuantity: inventory?.availableQuantity || 0,
      //   reservedQuantity: inventory?.reservedQuantity || 0
      // };

      return {
        totalQuantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
      };
    } catch (error) {
      console.error(`[InventoryService] Failed to get inventory state:`, error);
      return {
        totalQuantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
      };
    }
  }

  /**
   * Check if product is out of stock
   */
  async checkOutOfStock(productId: string): Promise<boolean> {
    const available = await this.getAvailableQuantity(productId);
    return available === 0;
  }

  /**
   * Acquire distributed lock (Redis or DB-based)
   */
  async acquireInventoryLock(
    productId: string,
    ttlMs: number = 5000
  ): Promise<string | null> {
    try {
      const lockId = `lock_${productId}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + ttlMs);

      this.locks.set(lockId, {
        acquiredAt: new Date(),
        ttl: ttlMs,
      });

      console.log(`[InventoryService] Acquired lock for product ${productId}: ${lockId}`);

      return lockId;
    } catch (error) {
      console.error(`[InventoryService] Failed to acquire lock:`, error);
      return null;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseInventoryLock(lockId: string): Promise<void> {
    try {
      this.locks.delete(lockId);
      console.log(`[InventoryService] Released lock: ${lockId}`);
    } catch (error) {
      console.error(`[InventoryService] Failed to release lock:`, error);
    }
  }

  /**
   * Check inventory across all marketplaces
   */
  async getInventoryByMarketplace(productId: string): Promise<Record<string, number>> {
    try {
      // TODO: Fetch from database
      // const inventory = await db.inventory.findUnique({
      //   where: { productId }
      // });

      // return {
      //   shopee: inventory?.shopeeQuantity || 0,
      //   mercadolivre: inventory?.mercadolivreQuantity || 0
      // };

      return {
        shopee: 0,
        mercadolivre: 0,
      };
    } catch (error) {
      console.error(`[InventoryService] Failed to get inventory by marketplace:`, error);
      return {};
    }
  }

  /**
   * Sync inventory across marketplaces
   */
  async syncInventoryToMarketplaces(productId: string): Promise<void> {
    try {
      const state = await this.getInventoryState(productId);

      console.log(`[InventoryService] Syncing inventory for product ${productId}:`, state);

      // TODO: Call marketplace APIs to update inventory
      // await shopeeService.updateInventory(productId, state.availableQuantity);
      // await mercadolivreService.updateInventory(productId, state.availableQuantity);
    } catch (error) {
      throw new Error(
        `Failed to sync inventory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Cleanup expired reservations
   */
  cleanupExpiredReservations(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, reservation] of this.reservations.entries()) {
      if (now > reservation.expiresAt) {
        this.reservations.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[InventoryService] Cleaned up ${cleaned} expired reservations`);
    }

    return cleaned;
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();

// Cleanup expired reservations every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    inventoryService.cleanupExpiredReservations();
  }, 5 * 60 * 1000);
}
