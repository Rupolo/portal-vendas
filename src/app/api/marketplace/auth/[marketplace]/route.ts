/**
 * DELETE /api/marketplace/auth/:marketplace
 * Disconnect a marketplace account
 *
 * POST /api/marketplace/auth/:marketplace/refresh
 * Manually refresh marketplace token
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services';
import type { MarketplaceType } from '@/lib/types/marketplace.types';

/**
 * DELETE - Disconnect marketplace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ marketplace: string }> }
) {
  try {
    const { marketplace } = await params;
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Missing query parameter: vendorId' },
        { status: 400 }
      );
    }

    // Validate marketplace
    const validMarketplaces = ['shopee', 'mercadolivre'];
    if (!validMarketplaces.includes(marketplace)) {
      return NextResponse.json(
        { error: 'Invalid marketplace' },
        { status: 400 }
      );
    }

    // Revoke credentials
    await authService.revokeMarketplaceCredentials(vendorId, marketplace as MarketplaceType);

    return NextResponse.json(
      {
        message: 'Marketplace account disconnected successfully',
        marketplace,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Marketplace auth disconnect error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to disconnect marketplace',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually refresh token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketplace: string }> }
) {
  try {
    const { marketplace } = await params;
    const body = await request.json();
    const { vendorId, refreshToken } = body;

    if (!vendorId || !refreshToken) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorId, refreshToken' },
        { status: 400 }
      );
    }

    // Validate marketplace
    const validMarketplaces = ['shopee', 'mercadolivre'];
    if (!validMarketplaces.includes(marketplace)) {
      return NextResponse.json(
        { error: 'Invalid marketplace' },
        { status: 400 }
      );
    }

    // Attempt token refresh
    const result = await authService.refreshToken(vendorId, marketplace as MarketplaceType, refreshToken);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: 'Token refreshed successfully',
        expiresAt: result.expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Marketplace auth refresh error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      },
      { status: 500 }
    );
  }
}
