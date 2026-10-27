import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceSchemaService } from './marketplace-schema.service';
import * as cacheModule from '../cache';

vi.mock('../cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateByPattern: vi.fn(),
}));

describe('MarketplaceSchemaService smoke tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create a schema service and cache a record', async () => {
    const service = new MarketplaceSchemaService();

    (cacheModule.getCached as any).mockResolvedValueOnce(null);
    (cacheModule.setCached as any).mockResolvedValueOnce(undefined);

    const schema = await service.fetchAndCacheSchemas('shopee', 'categories');

    expect(schema).not.toBeNull();
    if (!schema) {
      throw new Error('Expected schema to be created');
    }

    expect(schema.marketplace).toBe('shopee');
    expect(schema.type).toBe('categories');
    expect(schema.data).toBeDefined();
  });

  it('should return cached data when available', async () => {
    const service = new MarketplaceSchemaService();
    const cached = {
      type: 'attributes' as const,
      marketplace: 'mercadolivre' as const,
      data: [{ id: '1', name: 'category' }],
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      version: 'v1',
    };

    (cacheModule.getCached as any).mockResolvedValueOnce(cached);

    const result = await service.getSchemaFromCache('mercadolivre', 'attributes', false);

    expect(result).toEqual(cached);
  });
});
