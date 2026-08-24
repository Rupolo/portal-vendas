/**
 * POST /api/marketplace/auth/connect
 * Connect a marketplace account with credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services';
import type { MarketplaceType } from '@/lib/types/marketplace.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { vendorId, marketplace, accessToken, refreshToken, expiresAt } = body;

    // Validate request
    if (!vendorId || !marketplace || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorId, marketplace, accessToken' },
        { status: 400 }
      );
    }

    // Validate marketplace
    const validMarketplaces = ['shopee', 'mercadolivre'];
    if (!validMarketplaces.includes(marketplace)) {
      return NextResponse.json(
        { error: 'Invalid marketplace. Must be one of: shopee, mercadolivre' },
        { status: 400 }
      );
    }

    // Validate credentials before storing
    const validation = await authService.validateMarketplaceCredentials(
      marketplace as MarketplaceType,
      accessToken
    );

    if (!validation.isValid) {
      return NextResponse.json(
        { error: `Credential validation failed: ${validation.error}` },
        { status: 400 }
      );
    }

    // Store credentials securely
    await authService.storeMarketplaceCredentials(
      vendorId,
      marketplace as MarketplaceType,
      accessToken,
      refreshToken,
      expiresAt ? new Date(expiresAt) : undefined
    );

    return NextResponse.json(
      {
        message: 'Marketplace account connected successfully',
        marketplace,
        vendor: vendorId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Marketplace auth connect error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to connect marketplace',
      },
      { status: 500 }
    );
  }
}
