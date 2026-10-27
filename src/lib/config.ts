/**
 * Configuração Centralizada da Aplicação
 * =======================================
 * 
 * Este arquivo define todas as configurações da aplicação:
 * - Conexões (Redis, Database)
 * - APIs de Marketplaces (Shopee, Mercado Livre)
 * - Filas de Processamento (BullMQ)
 * - Cache e Sincronização
 * - Segurança e Logging
 * 
 * As configurações são carregadas de variáveis de ambiente (.env)
 * com valores padrão para desenvolvimento.
 * 
 * @see .env.example para a lista completa de variáveis de ambiente
 */

// ============================================================================
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE CRÍTICAS
// ============================================================================
const requiredEnvVars = ['DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️  Variáveis de ambiente obrigatórias ausentes: ${missingEnvVars.join(', ')}`
  );
}

// ============================================================================
// CONFIGURAÇÃO CENTRALIZADA
// ============================================================================
export const config = {
  // ========================================================================
  // AMBIENTE
  // ========================================================================
  app: {
    env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    url: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:3000/api',
  },

  // ========================================================================
  // REDIS
  // ========================================================================
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },

  // ========================================================================
  // DATABASE
  // ========================================================================
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/portal_vendas',
    // Pool size é importante para performance sob concorrência
    pool: {
      min: 2,
      max: 10,
    },
  },

  // ========================================================================
  // MARKETPLACE APIs
  // ========================================================================
  marketplaces: {
    shopee: {
      baseUrl: 'https://partner.shopeemall.com/api/v2',
      timeout: 10000,
      maxRetries: 3,
      // Credenciais carregadas do .env
      apiKey: process.env.SHOPEE_API_KEY,
      apiSecret: process.env.SHOPEE_API_SECRET,
      webhookSecret: process.env.SHOPEE_WEBHOOK_SECRET,
      partnerId: process.env.SHOPEE_PARTNER_ID,
      // Rate limiting: Shopee permite ~100 req/min por padrão
      rateLimitRequests: 100,
      rateLimitWindowMs: 60000,
    },
    mercadolivre: {
      baseUrl: 'https://api.mercadolibre.com',
      timeout: 10000,
      maxRetries: 3,
      // Credenciais carregadas do .env
      clientId: process.env.MERCADOLIVRE_CLIENT_ID,
      clientSecret: process.env.MERCADOLIVRE_CLIENT_SECRET,
      webhookSecret: process.env.MERCADOLIVRE_WEBHOOK_SECRET,
      accessToken: process.env.MERCADOLIVRE_ACCESS_TOKEN,
      // Rate limiting: Mercado Livre permite ~600 req/15min
      rateLimitRequests: 40,
      rateLimitWindowMs: 60000,
    },
  },

  // ========================================================================
  // BULLMQ - FILAS DE PROCESSAMENTO ASSÍNCRONO
  // ========================================================================
  queues: {
    productSync: {
      name: 'productSync',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000, // Começa com 5s
        },
        removeOnComplete: {
          age: 3600, // Remove jobs bem-sucedidos após 1 hora
        },
      },
    },
    inventorySync: {
      name: 'inventorySync',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 1800, // Remove após 30 minutos
        },
      },
    },
    orderSync: {
      name: 'orderSync',
      defaultJobOptions: {
        attempts: 3, // Menos tentativas pois pedidos são críticos
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Mantém por 1 dia para auditoria
        },
      },
    },
    webhookProcessing: {
      name: 'webhookProcessing',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false, // Keep for audit trail
      },
    },
    orderRouting: {
      name: 'orderRouting',
      defaultJobOptions: {
        attempts: 3, // Critical orders - try 3 times
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep for 1 day for audit
        },
      },
    },
    providerNotification: {
      name: 'providerNotification',
      defaultJobOptions: {
        attempts: 5, // Provider notifications need retries
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
        },
      },
    },
    errorRecovery: {
      name: 'errorRecovery',
      defaultJobOptions: {
        attempts: 10,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: false, // Keep for audit trail
      },
    },
  },

  // ========================================================================
  // CACHE - TTLs (em segundos)
  // ========================================================================
  cache: {
    schemas: 300, // Schemas de categorias/atributos: 5 minutos
    products: 60, // Dados de produto: 1 minuto
    inventory: 30, // Estoque: 30 segundos (altamente volátil)
    orders: 120, // Pedidos: 2 minutos
    general: 600, // Cache geral: 10 minutos
  },

  // ========================================================================
  // SINCRONIZAÇÃO
  // ========================================================================
  sync: {
    // Frequência padrão de sincronização automática
    defaultFrequency: 300000, // 5 minutos em ms
    
    // Máximo de jobs concorrentes por tipo
    maxConcurrentJobs: 10,
    
    // Webhooks
    webhookTimeout: 30000, // 30 segundos para processar webhook
    webhookRetryCount: 10, // Tenta entregar webhook 10 vezes
    webhookRetryDelay: 3600000, // Máximo de 1 hora entre tentativas
    
    // Estratégias de resolução de conflito padrão
    defaultConflictStrategy: 'latest' as const,
  },

  // ========================================================================
  // SEGURANÇA
  // ========================================================================
  security: {
    // Criptografia de tokens
    tokenEncryptionAlgorithm: 'aes-256-gcm',
    tokenSaltLength: 16,
    tokenIVLength: 16,
    encryptionSecret: process.env.ENCRYPTION_SECRET || 'dev-secret-change-in-production',
    
    // Limite de taxa para webhooks
    webhookRateLimit: {
      maxRequests: 100,
      windowMs: 60000, // 1 minuto
    },
  },

  // ========================================================================
  // RATE LIMITING
  // ========================================================================
  rateLimiting: {
    webhooks: {
      maxRequests: 100,
      windowMs: 60000, // 1 minuto
    },
  },

  // ========================================================================
  // LOGGING
  // ========================================================================
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: '20m',
    maxFiles: '14d',
    dir: process.env.LOG_DIR || 'logs',
    // Estrutura de logs
    format: {
      timestamp: true,
      json: process.env.NODE_ENV === 'production',
    },
  },

  // ========================================================================
  // NOTIFICAÇÕES
  // ========================================================================
  notifications: {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@portal-vendas.com',
    enableEmailAlerts: process.env.NODE_ENV === 'production',
    alertThresholds: {
      // Alertar quando falhas consecutivas > N
      failureThreshold: 3,
      // Alertar quando fila tem > N items
      queueThreshold: 10000,
    },
  },
};

// ============================================================================
// TIPOS
// ============================================================================
export type Config = typeof config;

// ============================================================================
// VALIDAÇÃO
// ============================================================================
export function validateConfig(): void {
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required in environment variables');
  }

  if (config.app.isProduction) {
    if (!config.marketplaces.shopee.apiKey || !config.marketplaces.shopee.apiSecret) {
      console.warn('⚠️  Shopee credentials not configured in production');
    }
    if (!config.marketplaces.mercadolivre.clientId || !config.marketplaces.mercadolivre.clientSecret) {
      console.warn('⚠️  Mercado Livre credentials not configured in production');
    }
  }
}

// Executar validação ao importar
if (typeof window === 'undefined') {
  // Apenas em servidor (não em browser)
  validateConfig();
}
