/**
 * Tipos de Configuração
 * ====================
 * 
 * Define os tipos TypeScript para todas as configurações da aplicação,
 * garantindo type-safety ao acessar variáveis de configuração.
 */

// ============================================================================
// TIPOS BÁSICOS
// ============================================================================

export type Environment = 'development' | 'production' | 'test';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type ConflictResolutionStrategy = 
  | 'latest' 
  | 'local-priority' 
  | 'remote-priority' 
  | 'inventory-min';

// ============================================================================
// CONFIGURAÇÃO DE APLICAÇÃO
// ============================================================================

export interface AppConfig {
  env: Environment;
  isDevelopment: boolean;
  isProduction: boolean;
  url: string;
  apiUrl: string;
}

// ============================================================================
// CONFIGURAÇÃO DE CONEXÕES
// ============================================================================

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryStrategy: (times: number) => number;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
}

export interface DatabaseConfig {
  url: string;
  pool: {
    min: number;
    max: number;
  };
}

// ============================================================================
// CONFIGURAÇÃO DE MARKETPLACES
// ============================================================================

export interface MarketplaceBaseConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface ShopeeConfig extends MarketplaceBaseConfig {
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  partnerId?: string;
  rateLimitRequests: number;
  rateLimitWindowMs: number;
}

export interface MercadoLivreConfig extends MarketplaceBaseConfig {
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  accessToken?: string;
  rateLimitRequests: number;
  rateLimitWindowMs: number;
}

export interface MarketplacesConfig {
  shopee: ShopeeConfig;
  mercadolivre: MercadoLivreConfig;
}

// ============================================================================
// CONFIGURAÇÃO DE BULLMQ
// ============================================================================

export interface BullMQBackoffConfig {
  type: 'exponential' | 'fixed';
  delay: number;
}

export interface BullMQJobOptions {
  attempts: number;
  backoff: BullMQBackoffConfig;
  removeOnComplete: {
    age: number; // em segundos
  };
}

export interface QueueConfig {
  name: string;
  defaultJobOptions: BullMQJobOptions;
}

export interface QueuesConfig {
  productSync: QueueConfig;
  inventorySync: QueueConfig;
  orderSync: QueueConfig;
  webhookProcessing: QueueConfig;
  errorRecovery: QueueConfig;
}

// ============================================================================
// CONFIGURAÇÃO DE CACHE
// ============================================================================

export interface CacheConfig {
  schemas: number;
  products: number;
  inventory: number;
  orders: number;
  general: number;
}

// ============================================================================
// CONFIGURAÇÃO DE SINCRONIZAÇÃO
// ============================================================================

export interface SyncConfig {
  defaultFrequency: number; // em ms
  maxConcurrentJobs: number;
  webhookTimeout: number; // em ms
  webhookRetryCount: number;
  webhookRetryDelay: number; // em ms
  defaultConflictStrategy: ConflictResolutionStrategy;
}

// ============================================================================
// CONFIGURAÇÃO DE SEGURANÇA
// ============================================================================

export interface WebhookRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface SecurityConfig {
  tokenEncryptionAlgorithm: string;
  tokenSaltLength: number;
  tokenIVLength: number;
  encryptionSecret: string;
  webhookRateLimit: WebhookRateLimitConfig;
}

// ============================================================================
// CONFIGURAÇÃO DE LOGGING
// ============================================================================

export interface LogFormatConfig {
  timestamp: boolean;
  json: boolean;
}

export interface LoggingConfig {
  level: LogLevel;
  maxSize: string;
  maxFiles: string;
  dir: string;
  format: LogFormatConfig;
}

// ============================================================================
// CONFIGURAÇÃO DE NOTIFICAÇÕES
// ============================================================================

export interface AlertThresholds {
  failureThreshold: number;
  queueThreshold: number;
}

export interface NotificationsConfig {
  adminEmail: string;
  enableEmailAlerts: boolean;
  alertThresholds: AlertThresholds;
}

// ============================================================================
// CONFIGURAÇÃO COMPLETA
// ============================================================================

export interface FullConfig {
  app: AppConfig;
  redis: RedisConfig;
  database: DatabaseConfig;
  marketplaces: MarketplacesConfig;
  queues: QueuesConfig;
  cache: CacheConfig;
  sync: SyncConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  notifications: NotificationsConfig;
}

// ============================================================================
// TIPOS DE ACESSO À CONFIGURAÇÃO
// ============================================================================

/**
 * Tipo para obter configuração com autocomplete em IDEs
 * 
 * @example
 * ```typescript
 * type DBUrl = ConfigPath<'database.url'>;
 * ```
 */
export type ConfigPath = 
  | 'app.env'
  | 'app.isDevelopment'
  | 'app.isProduction'
  | 'app.url'
  | 'app.apiUrl'
  | 'redis.host'
  | 'redis.port'
  | 'redis.password'
  | 'redis.db'
  | 'database.url'
  | 'database.pool.min'
  | 'database.pool.max'
  | 'marketplaces.shopee.baseUrl'
  | 'marketplaces.shopee.apiKey'
  | 'marketplaces.mercadolivre.baseUrl'
  | 'marketplaces.mercadolivre.clientId'
  | 'cache.schemas'
  | 'cache.products'
  | 'cache.inventory'
  | 'cache.orders'
  | 'sync.defaultFrequency'
  | 'security.encryptionSecret'
  | 'logging.level'
  | 'notifications.adminEmail';
