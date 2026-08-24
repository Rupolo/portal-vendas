# Guia de Implementação - Padrões e Convenções

## Introdução

Este guia fornece instruções passo a passo para implementar novos módulos seguindo os padrões estabelecidos no projeto Portal Vendas.

## Passo 1: Definir Tipos

Sempre comece definindo os tipos TypeScript que seu módulo usará.

### Localização
`src/lib/types/seu-modulo.types.ts`

### Exemplo: Tipos de Sincronização

```typescript
/**
 * Tipos de Sincronização
 * =====================
 */

export type SyncStatus = 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';

export interface SyncResult {
  id: string;
  entityType: 'product' | 'order' | 'inventory';
  entityId: string;
  marketplace: 'shopee' | 'mercadolivre';
  status: SyncStatus;
  timestamp: Date;
  duration: number; // em ms
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SyncOptions {
  force?: boolean;
  marketplace?: 'shopee' | 'mercadolivre' | 'all';
  timeout?: number;
}

export interface SyncJob {
  id: string;
  type: 'product' | 'inventory' | 'order';
  data: unknown;
  options: SyncOptions;
}
```

### Adicionar Tipos ao Índice

Editar `src/lib/types/index.ts`:

```typescript
export type { 
  SyncStatus, 
  SyncResult, 
  SyncOptions, 
  SyncJob 
} from './sync.types';
```

## Passo 2: Implementar Serviço

Implementar a lógica de negócio em um arquivo de serviço.

### Localização
`src/lib/services/seu-modulo.service.ts`

### Exemplo: ProductSyncService

```typescript
/**
 * Serviço de Sincronização de Produtos
 * ===================================== 
 * 
 * Responsável por sincronizar produtos entre o Portal e Marketplaces.
 * 
 * @example
 * ```typescript
 * const syncService = new ProductSyncService();
 * const result = await syncService.syncProductToMarketplaces(productId);
 * ```
 */

import { config } from '@/lib';
import type { SyncResult, SyncOptions } from '@/lib/types';
import { ErrorHandlerService } from './error-handler.service';

/**
 * Interface para melhor documentação e mockagem em testes
 */
export interface IProductSyncService {
  syncProductToMarketplaces(productId: string, options?: SyncOptions): Promise<SyncResult>;
  batchSyncProducts(productIds: string[], options?: SyncOptions): Promise<SyncResult[]>;
  mapProductToMarketplace(productId: string, marketplace: 'shopee' | 'mercadolivre'): Promise<unknown>;
}

export class ProductSyncService implements IProductSyncService {
  private errorHandler: ErrorHandlerService;

  constructor() {
    this.errorHandler = new ErrorHandlerService();
  }

  /**
   * Sincronizar um produto para todos os marketplaces
   * 
   * @param productId ID do produto no Portal
   * @param options Opções de sincronização
   * @returns Resultado da sincronização
   * 
   * @throws Error se produto não existir
   * 
   * @example
   * ```typescript
   * const result = await service.syncProductToMarketplaces('prod-123', {
   *   force: true,
   *   marketplace: 'shopee'
   * });
   * ```
   */
  async syncProductToMarketplaces(
    productId: string,
    options?: SyncOptions
  ): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Validar entrada
      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Buscar produto
      const product = await this.fetchProduct(productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Sincronizar para cada marketplace
      const marketplaces = options?.marketplace === 'all' 
        ? ['shopee', 'mercadolivre'] as const
        : (options?.marketplace ? [options.marketplace] : ['shopee', 'mercadolivre']) as const;

      const results = await Promise.allSettled(
        marketplaces.map(mp => this.syncToMarketplace(productId, product, mp))
      );

      // Processar resultados
      const failed = results.filter((r) => r.status === 'rejected');
      
      if (failed.length > 0) {
        throw new Error(`Sync failed for ${failed.length} marketplace(s)`);
      }

      return {
        id: productId,
        entityType: 'product',
        entityId: productId,
        marketplace: options?.marketplace as any || 'all',
        status: 'success',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Classificar e logar erro
      const classifiedError = this.errorHandler.classifyError(error as Error);
      
      return {
        id: productId,
        entityType: 'product',
        entityId: productId,
        marketplace: 'all',
        status: 'failed',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: {
          code: classifiedError,
          message: (error as Error).message,
        },
      };
    }
  }

  async batchSyncProducts(
    productIds: string[],
    options?: SyncOptions
  ): Promise<SyncResult[]> {
    // Implementar sincronização em batch
    return Promise.all(
      productIds.map(id => this.syncProductToMarketplaces(id, options))
    );
  }

  async mapProductToMarketplace(
    productId: string,
    marketplace: 'shopee' | 'mercadolivre'
  ): Promise<unknown> {
    const product = await this.fetchProduct(productId);
    
    if (marketplace === 'shopee') {
      return this.mapToShopee(product);
    } else {
      return this.mapToMercadoLivre(product);
    }
  }

  // Métodos privados
  
  private async fetchProduct(productId: string): Promise<unknown> {
    // TODO: Implementar chamada ao banco/API
    return null;
  }

  private async syncToMarketplace(
    productId: string,
    product: unknown,
    marketplace: 'shopee' | 'mercadolivre'
  ): Promise<void> {
    // TODO: Implementar sincronização
  }

  private mapToShopee(product: unknown): unknown {
    // TODO: Implementar mapeamento
    return {};
  }

  private mapToMercadoLivre(product: unknown): unknown {
    // TODO: Implementar mapeamento
    return {};
  }
}
```

### Adicionar Serviço ao Índice

Editar `src/lib/services/index.ts`:

```typescript
export { ProductSyncService } from './product-sync.service';
export type { IProductSyncService } from './product-sync.service';
```

## Passo 3: Implementar Job (se assíncrono)

Para operações assíncronas via BullMQ, implementar um job worker.

### Localização
`src/jobs/seu-modulo.job.ts`

### Exemplo: Product Sync Job

```typescript
/**
 * Job de Sincronização de Produtos
 * =================================
 * 
 * Worker que processa jobs de sincronização de produtos
 * da fila 'productSync' (BullMQ).
 */

import { Job } from 'bullmq';
import { ProductSyncService } from '@/lib/services';
import { config } from '@/lib';
import type { SyncJob } from '@/lib/types';

const syncService = new ProductSyncService();

/**
 * Processar job de sincronização de produto
 * 
 * @param job Job do BullMQ com dados de sincronização
 */
export async function processProductSyncJob(
  job: Job<SyncJob, unknown, string>
): Promise<void> {
  console.log(`[Job ${job.id}] Sincronizando produto ${job.data.data}`);

  try {
    // Sincronizar produto
    const result = await syncService.syncProductToMarketplaces(
      job.data.data as string,
      job.data.options
    );

    if (result.status === 'failed') {
      throw new Error(result.error?.message);
    }

    // Registrar progresso
    await job.progress(100);
    
    console.log(`[Job ${job.id}] ✅ Sincronização concluída`);
  } catch (error) {
    console.error(`[Job ${job.id}] ❌ Erro:`, error);
    throw error; // BullMQ fará retry automaticamente
  }
}

/**
 * Enfileirar sincronização de produto
 * 
 * @param productId ID do produto
 * @param options Opções de sincronização
 */
export async function enqueueSyncProduct(
  productId: string,
  options?: { force?: boolean; marketplace?: string }
): Promise<void> {
  // Implementar enfileiramento
  // TODO: Obter queue e adicionar job
}
```

## Passo 4: Criar Utilitários (opcional)

Se tiver funções reutilizáveis, criar arquivo de utilitários.

### Localização
`src/lib/utils/seu-modulo.utils.ts`

### Exemplo: Utilitários de Sincronização

```typescript
/**
 * Utilitários de Sincronização
 * ===========================
 */

/**
 * Formatar resultado de sincronização para exibição
 */
export function formatSyncResult(result: SyncResult): string {
  const status = result.status.toUpperCase();
  const duration = `${result.duration}ms`;
  
  return `[${status}] ${result.entityType}:${result.entityId} (${duration})`;
}

/**
 * Calcular próxima tentativa com backoff exponencial
 */
export function calculateNextRetry(
  attempt: number,
  baseDelay: number = 5000
): Date {
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * delay * 0.1; // 10% jitter
  
  return new Date(Date.now() + delay + jitter);
}

/**
 * Validar se pode sincronizar agora
 */
export function canSyncNow(lastSync?: Date, minInterval: number = 60000): boolean {
  if (!lastSync) return true;
  
  return Date.now() - lastSync.getTime() >= minInterval;
}
```

### Adicionar ao Índice de Utils

Editar `src/lib/utils/index.ts`:

```typescript
export { 
  formatSyncResult, 
  calculateNextRetry, 
  canSyncNow 
} from './sync.utils';
```

## Passo 5: Testes Unitários

Criar testes para o serviço.

### Localização
`src/lib/services/__tests__/seu-modulo.service.test.ts`

### Exemplo: Testes de ProductSyncService

```typescript
/**
 * Testes - ProductSyncService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductSyncService } from '../product-sync.service';
import type { SyncResult } from '@/lib/types';

describe('ProductSyncService', () => {
  let service: ProductSyncService;

  beforeEach(() => {
    service = new ProductSyncService();
  });

  describe('syncProductToMarketplaces', () => {
    it('deve sincronizar produto com sucesso', async () => {
      const productId = 'prod-123';
      
      // Mock de dados
      vi.spyOn(service as any, 'fetchProduct').mockResolvedValue({
        id: productId,
        title: 'Produto Teste',
      });

      const result = await service.syncProductToMarketplaces(productId);

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.entityId).toBe(productId);
    });

    it('deve falhar quando produto não existe', async () => {
      vi.spyOn(service as any, 'fetchProduct').mockResolvedValue(null);

      const result = await service.syncProductToMarketplaces('invalid-id');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('deve respeitar opção de force', async () => {
      const productId = 'prod-123';
      const syncSpy = vi.spyOn(service as any, 'syncToMarketplace');

      vi.spyOn(service as any, 'fetchProduct').mockResolvedValue({
        id: productId,
        title: 'Produto Teste',
      });

      await service.syncProductToMarketplaces(productId, { force: true });

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe('mapProductToMarketplace', () => {
    it('deve mapear para Shopee corretamente', async () => {
      const product = { id: '123', title: 'Test' };
      vi.spyOn(service as any, 'fetchProduct').mockResolvedValue(product);
      vi.spyOn(service as any, 'mapToShopee').mockReturnValue({ ...product, shopee: true });

      const result = await service.mapProductToMarketplace('123', 'shopee');

      expect(result).toHaveProperty('shopee', true);
    });

    it('deve mapear para Mercado Livre corretamente', async () => {
      const product = { id: '123', title: 'Test' };
      vi.spyOn(service as any, 'fetchProduct').mockResolvedValue(product);
      vi.spyOn(service as any, 'mapToMercadoLivre').mockReturnValue({ ...product, ml: true });

      const result = await service.mapProductToMarketplace('123', 'mercadolivre');

      expect(result).toHaveProperty('ml', true);
    });
  });
});
```

## Passo 6: Documentação

Adicionar documentação ao README.md ou arquivo de referência.

### Exemplo: Documentação de API

```markdown
## ProductSyncService

Serviço responsável por sincronizar produtos entre o Portal e Marketplaces.

### Métodos

#### `syncProductToMarketplaces(productId, options?)`

Sincroniza um produto para todos os marketplaces configurados.

**Parâmetros:**
- `productId` (string): ID do produto no Portal
- `options` (SyncOptions, opcional):
  - `force` (boolean): Forçar sincronização mesmo se sincronizado recentemente
  - `marketplace` ('shopee' | 'mercadolivre' | 'all'): Qual(is) marketplace(s)
  - `timeout` (number): Timeout em ms

**Retorna:** Promise<SyncResult>

**Exemplo:**
```typescript
const result = await syncService.syncProductToMarketplaces('prod-123', {
  marketplace: 'shopee'
});
```

#### `batchSyncProducts(productIds, options?)`

Sincroniza múltiplos produtos em paralelo.

**Parâmetros:**
- `productIds` (string[]): Array de IDs de produtos
- `options` (SyncOptions, opcional): Mesmas opções acima

**Retorna:** Promise<SyncResult[]>

### Eventos

O serviço emite eventos de sincronização que podem ser observados:

```typescript
// Quando sincronização é concluída
bus.on('sync:complete', (result: SyncResult) => {
  console.log('Sync done:', result);
});

// Quando sincronização falha
bus.on('sync:error', (error: SyncError) => {
  console.error('Sync failed:', error);
});
```
```

## Checklist de Implementação

- [ ] Tipos definidos em `src/lib/types/seu-modulo.types.ts`
- [ ] Serviço implementado em `src/lib/services/seu-modulo.service.ts`
- [ ] Índices atualizados (`index.ts`)
- [ ] Job implementado em `src/jobs/seu-modulo.job.ts` (se assíncrono)
- [ ] Utilitários criados em `src/lib/utils/seu-modulo.utils.ts` (se necessário)
- [ ] Testes unitários implementados
- [ ] Testes passando
- [ ] Documentação completa
- [ ] PR review realizado
- [ ] Merged para develop

## Linting e Formatação

Antes de fazer commit, executar:

```bash
# ESLint
npm run lint

# Prettier
npm run format

# Type check
npm run type-check

# Testes
npm run test
```

## Troubleshooting Comum

### Problema: "Cannot find module '@/lib/services'"

**Solução:**
1. Verificar se arquivo existe
2. Verificar tsconfig.json path aliases
3. Verificar se index.ts exporta corretamente

### Problema: Tipos não são reconhecidos

**Solução:**
1. Importar com `import type`
2. Usar path absoluto `@/lib/types`
3. Executar `npm run type-check`

### Problema: Importação circular

**Solução:**
1. Usar interfaces para quebrar dependências
2. Mover código compartilhado para arquivo separado
3. Usar lazy imports se necessário

## Recursos

- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Vitest Documentation](https://vitest.dev/)
- [BullMQ Docs](https://docs.bullmq.io/)

---

**Versão:** 1.0  
**Última atualização:** 2024
