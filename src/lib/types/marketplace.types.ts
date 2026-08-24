/**
 * Tipos relacionados a Marketplaces
 */

export enum Marketplace {
  SHOPEE = 'shopee',
  MERCADO_LIVRE = 'mercadolivre',
}

export type MarketplaceType = 'shopee' | 'mercadolivre';

export interface MarketplaceCredentials {
  vendorId: string;
  marketplace: Marketplace;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string[];
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceConfig {
  vendorId: string;
  marketplace: Marketplace;
  isActive: boolean;
  autoSync: boolean;
  syncFrequency: number; // in milliseconds
  conflictStrategy: 'latest' | 'local-priority' | 'remote-priority' | 'inventory-min';
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceSchema {
  marketplace: Marketplace;
  categories: Category[];
  attributes: AttributeDefinition[];
  requirements: FieldRequirement[];
  lastFetched: Date;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  attributes: string[];
}

export interface AttributeDefinition {
  id: string;
  name: string;
  type: 'text' | 'select' | 'numeric' | 'datetime';
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
}

export interface FieldRequirement {
  field: string;
  marketplace: Marketplace;
  required: boolean;
  type: string;
  maxLength?: number;
  pattern?: string;
}

export interface SyncResult {
  success: boolean;
  marketplace: Marketplace;
  remoteId?: string;
  timestamp: Date;
  error?: SyncError;
  warnings?: string[];
}

export interface SyncError {
  code: string;
  message: string;
  detail?: Record<string, any>;
  recoverable: boolean;
}
