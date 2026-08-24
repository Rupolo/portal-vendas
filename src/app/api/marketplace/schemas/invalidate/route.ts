/**
 * POST /api/marketplace/schemas/invalidate
 * ========================================
 * 
 * Manual endpoint for invalidating cached marketplace schemas.
 * Allows admins/users to force cache refresh when schemas are updated.
 * 
 * Request body:
 * {
 *   marketplace?: 'shopee' | 'mercadolivre' (optional, invalidates all if not provided)
 *   type?: 'categories' | 'attributes' | 'all' (optional, defaults to 'all')
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   invalidated: {
 *     marketplace: string,
 *     type: string
 *   }
 * }
 * 
 * @example
 * // Invalidate Shopee categories only
 * POST /api/marketplace/schemas/invalidate
 * { "marketplace": "shopee", "type": "categories" }
 * 
 * // Invalidate all schemas for Shopee
 * POST /api/marketplace/schemas/invalidate
 * { "marketplace": "shopee" }
 * 
 * // Invalidate all schemas for all marketplaces
 * POST /api/marketplace/schemas/invalidate
 * {}
 */

import { NextRequest, NextResponse } from 'next/server';
import { marketplaceSchemaService, type Marketplace, type SchemaType } from '@/lib/services/marketplace-schema.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface InvalidateRequest {
  marketplace?: Marketplace;
  type?: SchemaType;
}

interface InvalidateResponse {
  success: boolean;
  message: string;
  invalidated: {
    marketplace: string[];
    types: string[];
  };
  cacheStats?: any;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * POST handler for schema cache invalidation
 * 
 * @param request - Next.js request object
 * @returns JSON response with invalidation status
 */
export async function POST(request: NextRequest): Promise<NextResponse<InvalidateResponse>> {
  try {
    // Parse request body
    const body = (await request.json().catch(() => ({}))) as InvalidateRequest;

    const marketplace = body.marketplace;
    const type = body.type;

    console.log('[Schemas API] Invalidate request:', { marketplace, type });

    // Validate inputs
    if (marketplace && !['shopee', 'mercadolivre'].includes(marketplace)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid marketplace: ${marketplace}. Must be 'shopee' or 'mercadolivre'`,
          invalidated: { marketplace: [], types: [] },
        },
        { status: 400 }
      );
    }

    if (type && !['categories', 'attributes', 'all'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid type: ${type}. Must be 'categories', 'attributes', or 'all'`,
          invalidated: { marketplace: [], types: [] },
        },
        { status: 400 }
      );
    }

    const invalidatedMarketplaces: string[] = [];
    const invalidatedTypes: string[] = [];

    // Handle different invalidation scenarios
    if (!marketplace) {
      // Invalidate all marketplaces
      for (const m of ['shopee', 'mercadolivre'] as const) {
        try {
          await marketplaceSchemaService.invalidateSchemaCache(m, type);
          invalidatedMarketplaces.push(m);
          if (type) {
            invalidatedTypes.push(type);
          } else {
            invalidatedTypes.push('all');
          }
        } catch (error) {
          console.error(`Failed to invalidate ${m}:`, error);
        }
      }
    } else {
      // Invalidate specific marketplace
      try {
        await marketplaceSchemaService.invalidateSchemaCache(marketplace, type);
        invalidatedMarketplaces.push(marketplace);
        if (type) {
          invalidatedTypes.push(type);
        } else {
          invalidatedTypes.push('all');
        }
      } catch (error) {
        console.error(`Failed to invalidate ${marketplace}:`, error);
        return NextResponse.json(
          {
            success: false,
            message: `Failed to invalidate cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
            invalidated: { marketplace: [], types: [] },
          },
          { status: 500 }
        );
      }
    }

    // Get updated cache statistics
    const cacheStats = marketplaceSchemaService.getCacheStats();

    const response: InvalidateResponse = {
      success: true,
      message: `Successfully invalidated ${invalidatedMarketplaces.length} marketplace(s)`,
      invalidated: {
        marketplace: invalidatedMarketplaces,
        types: invalidatedTypes,
      },
      cacheStats,
    };

    console.log('[Schemas API] ✓ Invalidation successful:', response);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Schemas API] Error during invalidation:', error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        invalidated: { marketplace: [], types: [] },
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for getting cache statistics
 * 
 * Returns current cache hit/miss statistics
 * 
 * @param request - Next.js request object
 * @returns JSON response with cache statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const stats = marketplaceSchemaService.getCacheStats();

    return NextResponse.json(
      {
        success: true,
        message: 'Cache statistics retrieved',
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Schemas API] Error retrieving stats:', error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
