/**
 * Prisma Client Singleton
 * ========================
 * 
 * Este arquivo exporta uma única instância de Prisma Client, aplicando
 * o padrão singleton para garantir que apenas uma conexão com o banco
 * de dados seja mantida durante toda a vida útil da aplicação.
 * 
 * A instância é lazy-loaded na primeira importação e reutilizada
 * em todas as requisições subsequentes.
 * 
 * IMPORTANTE: Em desenvolvimento, Next.js recarrega módulos durante
 * hot reloads. Para evitar múltiplas conexões, armazenamos a instância
 * em globalThis durante desenvolvimento.
 * 
 * @see https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-instantiation-issue
 * @see config.ts para configurações de conexão (pool size: min 2, max 10)
 * 
 * CONFIGURAÇÃO DE CONNECTION POOLING:
 * O Prisma reconhece parâmetros de pool na DATABASE_URL:
 * - connection_limit: máximo de conexões (default: 10)
 * - pool_size: mínimo de conexões mantidas (default: 2)
 * 
 * Exemplo: postgresql://user:pwd@host/db?connection_limit=10&pool_size=2
 * 
 * @example Uso básico:
 * ```typescript
 * import { prisma } from '@/lib';
 * 
 * const products = await prisma.product.findMany();
 * ```
 * 
 * @example Uso em serviços:
 * ```typescript
 * import { prisma } from '@/lib';
 * 
 * export class ProductService {
 *   async getProduct(id: string) {
 *     return prisma.product.findUnique({ where: { id } });
 *   }
 * }
 * ```
 * 
 * @example Uso em transações:
 * ```typescript
 * import { prisma } from '@/lib';
 * 
 * await prisma.$transaction(async (tx) => {
 *   await tx.product.update(...);
 *   await tx.inventory.update(...);
 * });
 * ```
 */

import { PrismaClient as BasePrismaClient, type Prisma } from '../generated/prisma/client';
import { config } from './config';

// ============================================================================
// TYPES
// ============================================================================

export type PrismaClient = InstanceType<typeof BasePrismaClient>;

/**
 * Tipo para globais de desenvolvimento
 */
declare global {
  var prisma: PrismaClient | undefined;
}

// ============================================================================
// PRISMA CLIENT SINGLETON
// ============================================================================

/**
 * Função que cria ou retorna a instância existente do Prisma Client.
 * 
 * Em desenvolvimento, armazena a instância em globalThis para evitar
 * recreação da conexão durante hot reloads.
 * 
 * Em produção, retorna uma nova instância com logs desabilitados.
 * 
 * Configurações aplicadas:
 * - Connection pooling: min 2, max 10 (via DATABASE_URL connection_limit e pool_size)
 * - Log level: desabilitado por padrão
 * - Timeout: Padrão do Prisma (15s)
 * 
 * @returns Instância singleton do Prisma Client
 */
function getPrismaClient(): PrismaClient {
  // Em produção, criar nova instância a cada chamada é aceitável
  // pois o Node.js mantém a conexão viva durante o lifetime da aplicação
  if (config.app.isProduction) {
    return new (BasePrismaClient as any)() as PrismaClient;
  }

  // Em desenvolvimento, reutilizar instância para evitar múltiplas conexões
  // durante hot reloads do Next.js
  if (!global.prisma) {
    global.prisma = new (BasePrismaClient as any)() as PrismaClient;
    console.log('✅ Prisma Client initialized (singleton pattern - development mode)');
  }

  return global.prisma;
}

/**
 * Instância singleton do Prisma Client
 * 
 * Use esta instância em toda a aplicação para:
 * - Consultas ao banco de dados
 * - Operações CRUD
 * - Transações
 * - Raw queries
 * 
 * SINGLETON PATTERN:
 * - Uma única instância é mantida durante toda a vida da aplicação
 * - Em desenvolvimento, reutiliza a instância durante hot reloads
 * - Em produção, cria uma nova instância que reutiliza o pool
 * - Connection pooling (min: 2, max: 10) é configurado via DATABASE_URL
 * 
 * @see getPrismaClient() para mais detalhes sobre a implementação
 */
export const prisma = getPrismaClient();

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Disconnect graceful ao encerrar a aplicação
 * 
 * Garante que todas as conexões do pool sejam fechadas corretamente
 */
if (typeof window === 'undefined') {
  // Apenas em servidor
  process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM recebido, encerrando Prisma Client...');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('📴 SIGINT recebido, encerrando Prisma Client...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { Prisma };

export default prisma;
