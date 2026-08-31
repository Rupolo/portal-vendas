/**
 * Order Routing Service Tests
 * ============================
 * 
 * Unit and integration tests for the OrderRoutingService.
 * Tests cover:
 * - Order routing to providers
 * - Provider availability validation
 * - Multi-provider fallback
 * - Assignment tracking
 * 
 * @see order-routing.service.ts
 * @see provider.service.ts
 */

import { PrismaClient } from '@/generated/prisma';
import { orderRoutingService } from './order-routing.service';
import { providerService } from './provider.service';
import { QUEUE_NAMES, getQueue } from '../queue';

const prisma = new PrismaClient();

// ============================================================================
// MOCK DATA
// ============================================================================

const mockVendorId = 'vendor_test_001';
const mockOrderId = 'order_test_001';
const mockCustomerId = 'cust_test_001';

// Mock order data
const mockOrder = {
  id: mockOrderId,
  vendorId: mockVendorId,
  remoteId: 'remote_order_001',
  marketplace: 'shopee',
  status: 'pending',
  totalPrice: 199.90,
  subtotal: 179.90,
  shippingCost: 20,
  tax: 0,
  discountAmount: 0,
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerPhone: '+5511999999999',
  customerDocument: '12345678900',
  shippingAddress: {
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apt 45',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
    country: 'BR',
  },
  items: [
    {
      id: 'item_001',
      orderId: mockOrderId,
      productId: 'prod_001',
      remoteProductId: 'shopee_prod_001',
      title: 'Test Product',
      sku: 'TEST-SKU-001',
      quantity: 2,
      unitPrice: 89.95,
      totalPrice: 179.90,
      attributes: { color: 'red', size: 'M' },
      createdAt: new Date(),
    },
  ],
} as any;

// Mock provider data
const mockProvider = {
  id: 'provider_test_001',
  vendorId: mockVendorId,
  name: 'Test Provider',
  email: 'test@provider.com',
  isActive: true,
  isAvailable: true,
  categories: ['cat_001'],
  successRate: 98.5,
  responseTimeMinutes: 30,
} as any;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean up test data
 */
async function cleanupTestData() {
  await prisma.orderProviderAssignment.deleteMany({
    where: { orderId: mockOrderId },
  });
  await prisma.order.deleteMany({
    where: { id: mockOrderId },
  });
  await prisma.provider.deleteMany({
    where: { vendorId: mockVendorId },
  });
}

/**
 * Create test provider
 */
async function createTestProvider(overrides: Partial<typeof mockProvider> = {}) {
  return prisma.provider.create({
    data: {
      ...mockProvider,
      ...overrides,
      id: overrides.id || mockProvider.id,
    },
  });
}

/**
 * Create test order
 */
async function createTestOrder(overrides: Partial<typeof mockOrder> = {}) {
  return prisma.order.create({
    data: {
      ...mockOrder,
      ...overrides,
      id: overrides.id || mockOrderId,
    },
  });
}

// ============================================================================
// BEFORE ALL / AFTER ALL
// ============================================================================

beforeAll(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

// ============================================================================
// TEST SUITE: OrderRoutingService
// ============================================================================

describe('OrderRoutingService', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  // ============================================================================
  // TEST: routeOrderToProvider
  // ============================================================================

  describe('routeOrderToProvider', () => {
    test('should route order to available provider', async () => {
      // Arrange
      await createTestProvider();
      await createTestOrder();

      // Act
      const result = await orderRoutingService.routeOrderToProvider(mockOrder, {
        vendorId: mockVendorId,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('assigned');
      expect(result.providerId).toBe(mockProvider.id);
      expect(result.assignmentId).toBeDefined();
    });

    test('should return no_provider when no providers available', async () => {
      // Arrange
      await createTestProvider({ isAvailable: false });
      await createTestOrder();

      // Act
      const result = await orderRoutingService.routeOrderToProvider(mockOrder, {
        vendorId: mockVendorId,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.status).toBe('no_provider');
    });

    test('should use preferred provider when specified', async () => {
      // Arrange
      const preferredProvider = await createTestProvider({
        id: 'provider_preferred',
        name: 'Preferred Provider',
      });
      const otherProvider = await createTestProvider({
        id: 'provider_other',
        name: 'Other Provider',
      });
      await createTestOrder();

      // Act
      const result = await orderRoutingService.routeOrderToProvider(mockOrder, {
        vendorId: mockVendorId,
        preferredProviderId: preferredProvider.id,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.providerId).toBe(preferredProvider.id);
    });

    test('should try fallback providers when primary unavailable', async () => {
      // Arrange
      const primaryProvider = await createTestProvider({
        id: 'provider_primary',
        name: 'Primary Provider',
        isAvailable: false, // Primary unavailable
      });
      const fallbackProvider = await createTestProvider({
        id: 'provider_fallback',
        name: 'Fallback Provider',
      });
      await createTestOrder();

      // Act
      const result = await orderRoutingService.routeOrderToProvider(mockOrder, {
        vendorId: mockVendorId,
        fallbackEnabled: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.providerId).toBe(fallbackProvider.id);
    });
  });

  // ============================================================================
  // TEST: allocateOrderToProvider
  // ============================================================================

  describe('allocateOrderToProvider', () => {
    test('should allocate order to provider', async () => {
      // Arrange
      await createTestProvider();
      await createTestOrder();

      // Act
      const result = await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Assert
      expect(result).toBeDefined();
      expect(result?.orderId).toBe(mockOrderId);
      expect(result?.providerId).toBe(mockProvider.id);
      expect(result?.status).toBe('pending');
    });

    test('should not allocate if provider unavailable', async () => {
      // Arrange
      await createTestProvider({ isAvailable: false });
      await createTestOrder();

      // Act
      const result = await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Assert
      expect(result).toBeNull();
    });

    test('should return existing assignment if order already allocated', async () => {
      // Arrange
      await createTestProvider();
      await createTestOrder();
      await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Act
      const result = await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Assert
      expect(result).toBeDefined();
      expect(result?.retryCount).toBe(0); // Existing assignment, not new allocation
    });
  });

  // ============================================================================
  // TEST: validateProviderStock
  // ============================================================================

  describe('validateProviderStock', () => {
    test('should return true for available provider', async () => {
      // Arrange
      await createTestProvider();

      // Act
      const result = await orderRoutingService.validateProviderStock(mockProvider.id);

      // Assert
      expect(result).toBe(true);
    });

    test('should return false for unavailable provider', async () => {
      // Arrange
      await createTestProvider({ isAvailable: false });

      // Act
      const result = await orderRoutingService.validateProviderStock(mockProvider.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // TEST: notifyProviderOfOrder
  // ============================================================================

  describe('notifyProviderOfOrder', () => {
    test('should create notification job', async () => {
      // Arrange
      const jobQueue = getQueue(QUEUE_NAMES.PROVIDER_NOTIFICATION);
      await createTestProvider();
      await createTestOrder();
      
      const assignment = await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Act
      const jobId = await orderRoutingService.notifyProviderOfOrder(
        mockOrder,
        mockProvider.id,
        assignment!.id
      );

      // Assert
      expect(jobId).toBeDefined();
    });

    test('should return null if queue unavailable', async () => {
      // Mock queue error
      jest.mock('../queue', () => ({
        getQueue: jest.fn().mockImplementation(() => ({
          add: jest.fn().mockRejectedValue(new Error('Queue error')),
        })),
      }));

      // Act
      const jobId = await orderRoutingService.notifyProviderOfOrder(
        mockOrder,
        mockProvider.id,
        'assignment_001'
      );

      // Assert
      expect(jobId).toBeNull();
    });
  });

  // ============================================================================
  // TEST: rerouteOrder
  // ============================================================================

  describe('rerouteOrder', () => {
    test('should reroute order to new provider', async () => {
      // Arrange
      const originalProvider = await createTestProvider({
        id: 'provider_original',
        name: 'Original Provider',
      });
      const newProvider = await createTestProvider({
        id: 'provider_new',
        name: 'New Provider',
      });
      await createTestOrder();

      // First allocation
      await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        originalProvider.id,
        { vendorId: mockVendorId }
      );

      // Act
      const result = await orderRoutingService.rerouteOrder(
        mockOrderId,
        newProvider.id,
        { vendorId: mockVendorId }
      );

      // Assert
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.providerId).toBe(newProvider.id);
    });

    test('should return null if no active assignment found', async () => {
      // Arrange
      await createTestOrder();

      // Act
      const result = await orderRoutingService.rerouteOrder(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // TEST: updateAssignmentStatus
  // ============================================================================

  describe('updateAssignmentStatus', () => {
    test('should update assignment status', async () => {
      // Arrange
      await createTestProvider();
      await createTestOrder();
      
      const assignment = await orderRoutingService.allocateOrderToProvider(
        mockOrderId,
        mockProvider.id,
        { vendorId: mockVendorId }
      );

      // Act
      const result = await orderRoutingService.updateAssignmentStatus(
        assignment!.id,
        'confirmed',
        { confirmedAt: new Date() }
      );

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe('confirmed');
    });
  });

  // ============================================================================
  // TEST: Multi-Provider Fallback
  // ============================================================================

  describe('Multi-Provider Fallback', () => {
    test('should try all available providers before failing', async () => {
      // Arrange
      const provider1 = await createTestProvider({
        id: 'provider_1',
        name: 'Provider 1',
      });
      const provider2 = await createTestProvider({
        id: 'provider_2',
        name: 'Provider 2',
      });
      await createTestOrder();

      // Act - Try to route with all providers unavailable
      await providerService.toggleAvailability(provider1.id, false);
      await providerService.toggleAvailability(provider2.id, false);

      const result = await orderRoutingService.routeOrderToProvider(mockOrder, {
        vendorId: mockVendorId,
        fallbackEnabled: true,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.providersTried?.length).toBe(2);
    });
  });
});

// ============================================================================
// PERFORMANCE TEST: 100 Simultaneous Orders
// ============================================================================

describe('Performance: 100 Simultaneous Orders', () => {
  test('should handle 100 simultaneous orders without race conditions', async () => {
    // Arrange
    await createTestProvider();
    const orders = [];
    for (let i = 0; i < 100; i++) {
      orders.push(await createTestOrder({ id: `order_perf_${i}` }));
    }

    // Act
    const results = await Promise.all(
      orders.map(order =>
        orderRoutingService.routeOrderToProvider(order, {
          vendorId: mockVendorId,
        })
      )
    );

    // Assert
    const successful = results.filter(r => r.success).length;
    expect(successful).toBe(100); // All orders should be routed
  }, 60000); // 60 second timeout for 100 orders
});