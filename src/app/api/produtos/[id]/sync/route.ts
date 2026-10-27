/**
 * API Route: Sync Product to Marketplaces
 * ========================================
 * 
 * POST /api/products/[id]/sync
 * 
 * Triggers synchronization of a product to all configured marketplaces
 * (Shopee and Mercado Livre). Creates queue jobs for async processing
 * and stores remote IDs from each marketplace.
 * 
 * Request Body:
 * - marketplaces?: string[] - Specific marketplaces to sync (default: all configured)
 * - force?: boolean - Skip change detection, force sync (default: false)
 * 
 * Response:
 * - jobIds: string[] - Queue job IDs for tracking
 * - status: 'syncing' - Indicates sync is in progress
 * 
 * Status Codes:
 * - 200: Sync triggered successfully
 * - 400: Invalid request body
 * - 404: Product not found
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getQueue, QUEUE_NAMES, addJob } from '@/lib/queue';
import { productSyncService } from '@/lib/services/product-sync.service';
import type { Marketplace } from '@/lib/types/marketplace.types';
import { config } from '@/lib/config';

const prisma = new PrismaClient();

/**
 * POST: Trigger product sync to marketplaces
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const body = await request.json();
    const { marketplaces, force = false } = body;

    // Validate request body
    if (marketplaces && !Array.isArray(marketplaces)) {
      return NextResponse.json(
        { error: 'marketplaces must be an array of marketplace names' },
        { status: 400 }
      );
    }

    // Validate product ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID format' },
        { status: 400 }
      );
    }

    // Get configured marketplaces if none specified
    const targetMarketplaces: Marketplace[] = marketplaces
      ? (marketplaces as Marketplace[])
      : ['shopee', 'mercadolivre'];

    // Validate marketplaces
    const validMarketplaces = ['shopee', 'mercadolivre'];
    for (const mp of targetMarketplaces) {
      if (!validMarketplaces.includes(mp)) {
        return NextResponse.json(
          { error: `Invalid marketplace: ${mp}` },
          { status: 400 }
        );
      }
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Add sync jobs to queue for each marketplace
    const queue = getQueue(QUEUE_NAMES.PRODUCT_SYNC);
    const jobIds: string[] = [];

    for (const marketplace of targetMarketplaces) {
      const job = await queue.add(
        'sync-new-product',
        {
          productId,
          marketplace,
          forceSync: force,
        },
        {
          priority: 10, // High priority for new products
        }
      );
      jobIds.push(job.id!);
    }

    console.log(
      `[ProductSyncRoute] Sync triggered for product ${productId} ` +
      `to ${targetMarketplaces.length} marketplace(s): ${targetMarketplaces.join(', ')}`
    );

    return NextResponse.json({
      success: true,
      productId,
      jobIds,
      status: 'syncing',
      message: `Syncing to ${targetMarketplaces.length} marketplace(s)`,
    });
  } catch (error) {
    console.error('[ProductSyncRoute] Error triggering product sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger product sync' },
      { status: 500 }
    );
  }
}

/**
 * GET: Check sync status for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    // Get all marketplace products for this product
    const marketplaceProducts = await prisma.marketplaceProduct.findMany({
      where: {
        productId,
      },
      orderBy: {
        lastSyncedAt: 'desc',
      },
    });

    // Get sync logs
    const syncLogs = await prisma.productSyncLog.findMany({
      where: {
        productId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Last 10 sync operations
    });

    return NextResponse.json({
      productId,
      marketplaceProducts,
      syncLogs,
      lastSyncedAt: marketplaceProducts[0]?.lastSyncedAt || null,
    });
  } catch (error) {
    console.error('[ProductSyncRoute] Error checking sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    );
  }
}
