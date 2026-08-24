/**
 * Tipos relacionados a Produtos
 */

import type { Marketplace, SyncResult } from './marketplace.types';

export interface PortalProduct {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  price: number;
  cost?: number;
  images: string[];
  categoryId: string;
  attributes: Record<string, string>;
  sku: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceProduct {
  remoteId: string;
  marketplace: Marketplace;
  vendorId: string;
  productId: string; // FK to PortalProduct
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  marketplaceCategoryId: string;
  attributes: Record<string, string>;
  status: 'active' | 'inactive' | 'delisted';
  lastSyncedAt: Date;
  lastSyncedHash?: string; // For change detection
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSyncLog {
  id: string;
  vendorId: string;
  productId: string;
  marketplace: Marketplace;
  operation: 'create' | 'update' | 'delete' | 'fetch';
  status: 'success' | 'failure';
  result: SyncResult;
  errorDetails?: Record<string, any>;
  duration: number; // in milliseconds
  attemptNumber: number;
  createdAt: Date;
}

export interface ProductChangeDetection {
  productId: string;
  changedFields: (keyof PortalProduct)[];
  oldValues: Partial<PortalProduct>;
  newValues: Partial<PortalProduct>;
  detectedAt: Date;
}
