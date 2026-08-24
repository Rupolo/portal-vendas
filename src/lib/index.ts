/**
 * Índice de Exportações - src/lib
 * ================================
 * 
 * Este arquivo exporta todos os módulos principais da camada lib,
 * facilitando importações e mantendo uma estrutura centralizada.
 * 
 * CONVENÇÃO DE IMPORTAÇÃO:
 * - Importar do 'src/lib' em vez de caminhos relativos
 * - Evitar importações circulares
 * - Agrupar importações por tipo (config, types, services, utils)
 * 
 * @example Correto:
 * ```typescript
 * import { config } from '@/lib';
 * import { InventoryService } from '@/lib/services';
 * import type { Product } from '@/lib/types';
 * ```
 * 
 * @example Evitar:
 * ```typescript
 * import { config } from '../../../../lib/config';
 * import { InventoryService } from '../../services/inventory.service';
 * ```
 */

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

export { config, validateConfig } from './config';
export { 
  validateAllConfig, 
  validateAndLogConfig,
  validateDatabaseConfig,
  validateRedisConfig,
  validateMarketplaceConfig,
  validateSecurityConfig,
  getConfig,
  isEnvVarDefined,
  getEnvVars,
} from './config.validation';

export type { 
  ValidationError, 
  ValidationResult 
} from './config.validation';

export type { 
  Config,
} from './config';

export type {
  Environment,
  LogLevel,
  ConflictResolutionStrategy,
  AppConfig,
  RedisConfig,
  DatabaseConfig,
  MarketplaceBaseConfig,
  ShopeeConfig,
  MercadoLivreConfig,
  MarketplacesConfig,
  BullMQBackoffConfig,
  BullMQJobOptions,
  QueueConfig,
  QueuesConfig,
  CacheConfig,
  SyncConfig,
  SecurityConfig,
  LoggingConfig,
  NotificationsConfig,
  FullConfig,
  ConfigPath,
} from './config.types';

// ============================================================================
// TIPOS
// ============================================================================

export * from './types';

// ============================================================================
// SERVIÇOS
// ============================================================================

export * from './services';

// ============================================================================
// DATABASE - PRISMA CLIENT
// ============================================================================

export { prisma, default as prismaClient } from './prisma';
export type { Prisma } from './prisma';

// ============================================================================
// CACHE
// ============================================================================

export { 
  getCached, 
  setCached, 
  invalidateCache, 
  invalidateMultiple, 
  invalidateByPattern,
  cacheMarketplaceSchema,
  getCachedMarketplaceSchema,
  cacheProduct,
  getCachedProduct,
  cacheInventory,
  getCachedInventory,
  cacheOrder,
  getCachedOrder,
  batchGet,
  batchSet,
  incrementCounter,
  decrementCounter,
  closeCacheConnection,
} from './cache';

// ============================================================================
// REDIS
// ============================================================================

export {
  redis,
  getRedis,
  initializeRedis,
  shutdownRedis,
  type RedisClientInstance,
} from './redis';

// ============================================================================
// FILA (BULLMQ)
// ============================================================================

export * from './queue';

// ============================================================================
// UTILITÁRIOS
// ============================================================================

// Exportar utilitários conforme forem criados
// export * from './utils';

// ============================================================================
// NOTA: Outros módulos na raiz de src/lib (como format.ts, mercadolivre.ts)
// devem ser importados diretamente conforme necessário
// ============================================================================
