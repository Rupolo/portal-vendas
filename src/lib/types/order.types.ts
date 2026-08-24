/**
 * Tipos relacionados a Pedidos
 */

import type { Marketplace } from './marketplace.types';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  DISPUTED = 'disputed',
}

export interface Order {
  id: string;
  vendorId: string;
  remoteId: string;
  marketplace: Marketplace;
  status: OrderStatus;
  totalPrice: number;
  subtotal: number;
  shippingCost: number;
  tax: number;
  discountAmount?: number;
  customer: Customer;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  notes?: string;
  isViewed: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  document?: string;
  isVerified: boolean;
}

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string; // FK to PortalProduct
  remoteProductId: string;
  title: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  attributes?: Record<string, string>;
}

export interface OrderSyncLog {
  id: string;
  vendorId: string;
  orderId: string;
  marketplace: Marketplace;
  operation: 'capture' | 'status-update' | 'fetch';
  status: 'success' | 'failure';
  errorDetails?: Record<string, any>;
  duration: number; // in milliseconds
  attemptNumber: number;
  createdAt: Date;
}

export interface WebhookDelivery {
  id: string;
  vendorId: string;
  marketplace: Marketplace;
  webhookId: string;
  event: string;
  payload: Record<string, any>;
  signature: string;
  status: 'delivered' | 'failed' | 'pending';
  deliveryAttempt: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}
