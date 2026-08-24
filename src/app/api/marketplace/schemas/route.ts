/**
 * GET /api/marketplace/schemas
 * ============================
 * 
 * Fetch marketplace schemas (categories/attributes) with caching.
 * Returns cached schema if available, otherwise fetches from marketplace API.
 * 
 * Query Parameters:
 * - marketplace: 'shopee' | 'mercadolivre' (required)
 * - type: 'categories' | 'attributes' | 'all' (optional, default: 'all')
 * - refresh: boolean (optional, force refresh from API)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: MarketplaceSchema,
 *   source: 'cache' | 'api',
 *   cacheInfo: {
 *     isCached: boolean,
 *     expiresAt: string,
 *     ttl: number
 *   }
 * }
 * 
 * @example
 * // Get Shopee categories from cache
 * GET /api/marketplace/schemas?marketplace=shopee&type=categories
 * 
 * // Force refresh Mercado Livre schemas
 * GET /api/marketplace/schemas?marketplace=mercadolivre&refresh=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { marketplaceSchemaService, type Marketplace, type SchemaType, type MarketplaceSchema } from '@/lib/services/marketplace-schema.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SchemaCacheInfo {
  isCached: boolean;
  expiresAt?: string;
  ttl?: number;
}

interface SchemasResponse {
  success: boolean;
  data?: MarketplaceSchema;
  source?: 'cache' | 'api';
  cacheInfo?: SchemaCacheInfo;
  error?: string;
  message?: string;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * GET handler for fetching marketplace schemas
 * 
 * @param request - Next.js request object
 * @returns JSON response with schema data
 */
export async function GET(request: NextRequest): Promise<NextResponse<SchemasResponse>> {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const marketplace = searchParams.get('marketplace') as Marketplace | null;
    const type = (searchParams.get('type') || 'all') as SchemaType;
    const refresh = searchParams.get('refresh') === 'true';

    // Validate marketplace parameter
    if (!marketplace || !['shopee', 'mercadolivre'].includes(marketplace)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing marketplace parameter',
          message: "marketplace must be 'shopee' or 'mercadolivre'",
        },
        { status: 400 }
      );
    }

    // Validate type parameter
    if (!['categories', 'attributes', 'all'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid type parameter',
          message: "type must be 'categories', 'attributes', or 'all'",
        },
        { status: 400 }
      );
    }

    console.log('[Schemas API] GET request:', { marketplace, type, refresh });

    let schema: MarketplaceSchema | null = null;
    let source: 'cache' | 'api' = 'cache';
    let cacheInfo: SchemaCacheInfo = { isCached: false };

    try {
      if (refresh) {
        // Force refresh from API
        console.log(`[Schemas API] Force refresh requested for ${marketplace} ${type}`);
        schema = await marketplaceSchemaService.refreshSchema(marketplace, type);
        source = 'api';
        cacheInfo = {
          isCached: true,
          expiresAt: schema.expiresAt.toISOString(),
          ttl: Math.round((schema.expiresAt.getTime() - Date.now()) / 1000),
        };
      } else {
        // Try cache first
        schema = await marketplaceSchemaService.getSchemaFromCache(marketplace, type);

        if (schema) {
          source = 'cache';
          cacheInfo = {
            isCached: true,
            expiresAt: schema.expiresAt.toISOString(),
            ttl: Math.round((schema.expiresAt.getTime() - Date.now()) / 1000),
          };
        } else {
          // Cache miss, fetch from API
          console.log(`[Schemas API] Cache miss for ${marketplace} ${type}, fetching from API...`);
          schema = await marketplaceSchemaService.fetchAndCacheSchemas(marketplace, type);
          source = 'api';
          cacheInfo = {
            isCached: true,
            expiresAt: schema.expiresAt.toISOString(),
            ttl: Math.round((schema.expiresAt.getTime() - Date.now()) / 1000),
          };
        }
      }

      if (!schema) {
        throw new Error('Failed to retrieve schema');
      }

      // Validate schema
      if (!marketplaceSchemaService.validateSchema(schema, marketplace)) {
        console.warn(`[Schemas API] Invalid schema structure for ${marketplace}`);
      }

      const response: SchemasResponse = {
        success: true,
        data: schema,
        source,
        cacheInfo,
      };

      console.log(`[Schemas API] ✓ Retrieved ${marketplace} ${type} from ${source}`);

      return NextResponse.json(response, { status: 200 });
    } catch (fetchError) {
      console.error(`[Schemas API] Failed to fetch schema for ${marketplace}:`, fetchError);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch schema',
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Schemas API] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for invalidating specific marketplace schema
 * 
 * Alternative to POST /api/marketplace/schemas/invalidate
 * 
 * Query Parameters:
 * - marketplace: 'shopee' | 'mercadolivre' (required)
 * - type: 'categories' | 'attributes' | 'all' (optional)
 * 
 * @param request - Next.js request object
 * @returns JSON response with invalidation status
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const marketplace = searchParams.get('marketplace') as Marketplace | null;
    const type = (searchParams.get('type') || 'all') as SchemaType | undefined;

    if (!marketplace || !['shopee', 'mercadolivre'].includes(marketplace)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing marketplace parameter',
        },
        { status: 400 }
      );
    }

    console.log('[Schemas API] DELETE request (invalidate):', { marketplace, type });

    await marketplaceSchemaService.invalidateSchemaCache(marketplace, type);

    const stats = marketplaceSchemaService.getCacheStats();

    return NextResponse.json(
      {
        success: true,
        message: `Successfully invalidated cache for ${marketplace}${type ? ` ${type}` : ''}`,
        invalidated: { marketplace, type: type || 'all' },
        cacheStats: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Schemas API] Error during invalidation:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
