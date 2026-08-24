/**
 * Validação de Configuração
 * =========================
 * 
 * Este arquivo fornece funções utilitárias para validar
 * variáveis de ambiente e configurações em tempo de execução.
 */

import { config } from './config';

// ============================================================================
// TIPOS
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// VALIDADORES
// ============================================================================

/**
 * Valida configuração de conexão com o banco de dados
 */
export function validateDatabaseConfig(): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.database.url) {
    errors.push({
      field: 'database.url',
      message: 'DATABASE_URL must be configured',
      severity: 'error',
    });
  }

  // Validar que a URL é uma conexão PostgreSQL válida
  if (config.database.url && !config.database.url.startsWith('postgresql://')) {
    errors.push({
      field: 'database.url',
      message: 'DATABASE_URL must start with postgresql://',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Valida configuração de Redis
 */
export function validateRedisConfig(): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.redis.host) {
    errors.push({
      field: 'redis.host',
      message: 'REDIS_HOST must be configured',
      severity: 'error',
    });
  }

  if (config.redis.port <= 0 || config.redis.port > 65535) {
    errors.push({
      field: 'redis.port',
      message: 'REDIS_PORT must be a valid port number (1-65535)',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Valida configuração de marketplaces
 */
export function validateMarketplaceConfig(): ValidationError[] {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validar Shopee em produção
  if (config.app.isProduction) {
    if (!config.marketplaces.shopee.apiKey) {
      warnings.push({
        field: 'marketplaces.shopee.apiKey',
        message: 'Shopee API key not configured',
        severity: 'warning',
      });
    }
    if (!config.marketplaces.shopee.apiSecret) {
      warnings.push({
        field: 'marketplaces.shopee.apiSecret',
        message: 'Shopee API secret not configured',
        severity: 'warning',
      });
    }

    // Validar Mercado Livre em produção
    if (!config.marketplaces.mercadolivre.clientId) {
      warnings.push({
        field: 'marketplaces.mercadolivre.clientId',
        message: 'Mercado Livre client ID not configured',
        severity: 'warning',
      });
    }
    if (!config.marketplaces.mercadolivre.clientSecret) {
      warnings.push({
        field: 'marketplaces.mercadolivre.clientSecret',
        message: 'Mercado Livre client secret not configured',
        severity: 'warning',
      });
    }
  }

  return errors.length > 0 ? errors : warnings;
}

/**
 * Valida configuração de segurança
 */
export function validateSecurityConfig(): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.app.isProduction && config.security.encryptionSecret === 'dev-secret-change-in-production') {
    errors.push({
      field: 'security.encryptionSecret',
      message: 'ENCRYPTION_SECRET must be changed in production',
      severity: 'error',
    });
  }

  if (config.security.tokenSaltLength < 16) {
    errors.push({
      field: 'security.tokenSaltLength',
      message: 'Token salt length must be at least 16 bytes',
      severity: 'error',
    });
  }

  return errors;
}

// ============================================================================
// FUNÇÕES PÚBLICAS
// ============================================================================

/**
 * Valida todas as configurações críticas
 * 
 * @returns Resultado da validação com erros e avisos
 * 
 * @example
 * ```typescript
 * const validation = validateAllConfig();
 * if (!validation.isValid) {
 *   console.error('Configuration errors:', validation.errors);
 *   process.exit(1);
 * }
 * ```
 */
export function validateAllConfig(): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  // Validar cada grupo de configuração
  [
    validateDatabaseConfig(),
    validateRedisConfig(),
    validateMarketplaceConfig(),
    validateSecurityConfig(),
  ].forEach(results => {
    results.forEach(result => {
      if (result.severity === 'error') {
        allErrors.push(result);
      } else {
        allWarnings.push(result);
      }
    });
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Valida e exibe resultados da validação de configuração
 * Útil para startup checks
 * 
 * @param throwOnError Se true, lança erro quando há falhas críticas
 * 
 * @example
 * ```typescript
 * // No server.ts ou main.ts:
 * validateAndLogConfig(true); // Lançará erro em produção se config for inválida
 * ```
 */
export function validateAndLogConfig(throwOnError: boolean = config.app.isProduction): void {
  const result = validateAllConfig();

  if (result.errors.length > 0) {
    console.error('❌ Configuration Errors:');
    result.errors.forEach(error => {
      console.error(`  - [${error.field}] ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Configuration Warnings:');
    result.warnings.forEach(warning => {
      console.warn(`  - [${warning.field}] ${warning.message}`);
    });
  }

  if (result.isValid) {
    console.log('✅ Configuration validated successfully');
  }

  if (!result.isValid && throwOnError) {
    throw new Error('Configuration validation failed');
  }
}

/**
 * Obtém a configuração de um campo específico com type-safety
 * 
 * @example
 * ```typescript
 * const dbUrl = getConfig<string>('database.url');
 * const redisPort = getConfig<number>('redis.port');
 * ```
 */
export function getConfig<T = unknown>(path: string): T | undefined {
  const keys = path.split('.');
  let value: any = config;

  for (const key of keys) {
    value = value?.[key];
  }

  return value as T | undefined;
}

/**
 * Verificar se variável de ambiente está definida
 */
export function isEnvVarDefined(envVar: string): boolean {
  return process.env[envVar] !== undefined && process.env[envVar] !== '';
}

/**
 * Obter múltiplas variáveis de ambiente com valores padrão
 * 
 * @example
 * ```typescript
 * const { db, redis } = getEnvVars({
 *   db: ['DATABASE_URL'],
 *   redis: ['REDIS_HOST', 'REDIS_PORT'],
 * });
 * ```
 */
export function getEnvVars(
  varMap: Record<string, string[]>
): Record<string, Record<string, string | undefined>> {
  const result: Record<string, Record<string, string | undefined>> = {};

  for (const [group, vars] of Object.entries(varMap)) {
    result[group] = {};
    for (const varName of vars) {
      result[group][varName] = process.env[varName];
    }
  }

  return result;
}
