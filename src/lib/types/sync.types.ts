/**
 * Tipos relacionados a Sincronização
 */

import type { Marketplace } from './marketplace.types';

export interface SyncEvent {
  id: string;
  type: 'product' | 'inventory' | 'order' | 'status';
  marketplace: Marketplace;
  vendorId: string;
  entityId: string;
  entityType: 'product' | 'order' | 'inventory';
  operation: 'create' | 'update' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ConflictLog {
  id: string;
  vendorId: string;
  entityId: string;
  marketplace: Marketplace;
  field: string;
  localValue: any;
  remoteValue: any;
  strategy: 'latest' | 'local-priority' | 'remote-priority' | 'inventory-min';
  resolution: 'local' | 'remote' | 'manual' | 'auto';
  resolvedValue?: any;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SyncMetric {
  id: string;
  vendorId: string;
  marketplace: Marketplace;
  date: Date;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  productsSynced: number;
  ordersCaptured: number;
  conflictsDetected: number;
}

export interface RateLimiter {
  key: string; // marketplace or IP
  requests: number[];
  limit: number;
  windowMs: number;
}
