# Estrutura de Diretórios e Padrões de Importação

## Visão Geral

Este documento descreve a arquitetura de diretórios do Portal Vendas e os padrões de importação recomendados para manter o código organizado, escalável e fácil de manter.

## Estrutura de Diretórios

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # Endpoints da API REST
│   │   ├── marketplace/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── inventory/
│   │   ├── webhooks/
│   │   │   ├── shopee/
│   │   │   └── mercadolivre/
│   │   └── config/
│   ├── carrinho/                 # Página de carrinho
│   ├── produto/                  # Página de produto
│   ├── layout.tsx                # Layout raiz
│   ├── page.tsx                  # Página inicial
│   └── globals.css               # Estilos globais
│
├── lib/                          # Camada de lógica compartilhada
│   ├── config.ts                 # Configuração centralizada (PRINCIPAL)
│   ├── config.validation.ts      # Validação de configuração
│   ├── config.types.ts           # Tipos de configuração
│   ├── index.ts                  # Índice de exportações (PRINCIPAL)
│   │
│   ├── services/                 # Serviços de negócio
│   │   ├── index.ts              # Exportações
│   │   ├── auth.service.ts       # Autenticação e tokens
│   │   ├── error-handler.service.ts
│   │   ├── inventory.service.ts
│   │   ├── webhook-validator.service.ts
│   │   ├── rate-limiter.service.ts
│   │   ├── product-sync.service.ts (a criar)
│   │   ├── order-management.service.ts (a criar)
│   │   └── conflict-resolver.service.ts (a criar)
│   │
│   ├── types/                    # Definições de tipos TypeScript
│   │   ├── index.ts              # Exportações
│   │   ├── product.types.ts
│   │   ├── order.types.ts
│   │   ├── marketplace.types.ts
│   │   ├── sync.types.ts
│   │   ├── auth.types.ts
│   │   ├── error.types.ts
│   │   └── ...
│   │
│   ├── utils/                    # Funções utilitárias
│   │   ├── index.ts              # Exportações
│   │   ├── date.utils.ts         # Manipulação de datas
│   │   ├── string.utils.ts       # Manipulação de strings
│   │   ├── crypto.utils.ts       # Criptografia
│   │   └── validation.utils.ts   # Validação
│   │
│   ├── cache.ts                  # Gerenciamento de cache Redis
│   ├── queue.ts                  # BullMQ queues factory
│   ├── mercadolivre.ts           # Cliente Mercado Livre
│   ├── format.ts                 # Formatadores
│   ├── types.ts                  # Tipos gerais
│   └── cart-context.tsx          # React context do carrinho
│
├── jobs/                         # Workers de processamento assíncrono
│   ├── product-sync.job.ts       # Worker para sincronização de produtos
│   ├── inventory-sync.job.ts     # Worker para sincronização de estoque
│   ├── order-sync.job.ts         # Worker para processamento de pedidos
│   ├── webhook-processor.job.ts  # Worker para processar webhooks
│   └── error-recovery.job.ts     # Worker para recuperação de erros
│
├── components/                   # Componentes React reutilizáveis
│   ├── ...
│   └── ...
│
├── data/                         # Dados estáticos
│   └── ...
│
├── generated/                    # Código gerado (Prisma, etc)
│   └── ...
│
└── middleware.ts (futuro)        # Middleware do Next.js

prisma/
├── schema.prisma                 # Definição do banco de dados
├── migrations/                   # Histórico de migrações
│   └── ...
└── seed.ts                       # Script de seed

```

## Convenções de Nomenclatura

### Arquivos de Serviço

- **Padrão:** `nome.service.ts`
- **Exemplo:** `product-sync.service.ts`, `error-handler.service.ts`

### Arquivos de Tipo

- **Padrão:** `nome.types.ts`
- **Exemplo:** `product.types.ts`, `order.types.ts`

### Arquivos Utilitários

- **Padrão:** `nome.utils.ts` ou `nome.util.ts`
- **Exemplo:** `date.utils.ts`, `crypto.utils.ts`

### Arquivos de Job/Worker

- **Padrão:** `nome.job.ts`
- **Exemplo:** `product-sync.job.ts`, `webhook-processor.job.ts`

### Índices de Exportação

- **Nome:** `index.ts` em cada diretório
- **Propósito:** Centralizar exportações de um diretório

## Padrões de Importação

### ✅ RECOMENDADO: Usar atalhos de caminho absoluto

```typescript
// ✅ BOM: Usar path aliases (tsconfig.json configura '@/*')
import { config } from '@/lib';
import { InventoryService } from '@/lib/services';
import type { Product } from '@/lib/types';
import { encrypt } from '@/lib/utils';
```

**Benefícios:**
- Não se quebram com refatoração de diretórios
- Mais legíveis e fáceis de navegar
- Evita importações circulares
- Funciona bem com ferramentas de automação

### ❌ EVITAR: Caminhos relativos

```typescript
// ❌ RUIM: Usar caminhos relativos
import { config } from '../../../../lib/config';
import { InventoryService } from '../../services/inventory.service';
import type { Product } from '../types/product.types';
```

**Problemas:**
- Difícil de refatorar
- Propenso a erros quando mover arquivos
- Menos legível
- Quebra facilmente

### ✅ RECOMENDADO: Índices de diretório

```typescript
// ✅ BOM: Usar índices para manter estrutura limpa
import { InventoryService, AuthService } from '@/lib/services';
import type { Product, Order } from '@/lib/types';
import { formatDate, encrypt } from '@/lib/utils';
```

**Por quê:**
- Centraliza exportações
- Facilita manutenção
- Permite reorganizar internamente sem quebrar importações

### ❌ EVITAR: Importações diretas de arquivos

```typescript
// ❌ RUIM: Importar arquivo específico quando existe índice
import { InventoryService } from '@/lib/services/inventory.service';
import type { Product } from '@/lib/types/product.types';
```

**Problema:**
- Quebra encapsulamento
- Torna refatoração mais difícil

## Padrões Específicos por Diretório

### Importações de Configuração

```typescript
// Sempre importar de '@/lib'
import { config } from '@/lib';
import { validateAllConfig } from '@/lib';
import type { Config, ConfigPath } from '@/lib';

// Em arquivo de startup (pages/api/init.ts):
import { validateAndLogConfig } from '@/lib';
validateAndLogConfig(true); // Lança erro em produção
```

### Importações de Serviços

```typescript
// Opção 1: Importar múltiplos serviços
import { InventoryService, AuthService, ProductSyncService } from '@/lib/services';

// Opção 2: Usar serviço específico
import { InventoryService } from '@/lib/services';

// Instanciar e usar
const inventoryService = new InventoryService();
const quantity = await inventoryService.getAvailableQuantity(productId);
```

### Importações de Tipos

```typescript
// Usar 'type' para importações de tipo (TypeScript 3.8+)
import type { Product, Order, Inventory } from '@/lib/types';

// Combinado com valores
import { config } from '@/lib';
import type { Config } from '@/lib';

// Em função
async function syncProduct(product: Product): Promise<void> {
  // ...
}
```

### Importações de Utilitários

```typescript
// Importar funções individuais
import { formatDate, parseDate } from '@/lib/utils';
import { encrypt, decrypt } from '@/lib/utils';

// Ou como namespace (se preferir)
import * as dateUtils from '@/lib/utils';
```

## Estrutura de Índices (`index.ts`)

Cada diretório deve ter um `index.ts` que centraliza exportações:

### Exemplo: `src/lib/services/index.ts`

```typescript
// Exportar todas as classes de serviço
export { AuthService } from './auth.service';
export { InventoryService } from './inventory.service';
export { ErrorHandlerService } from './error-handler.service';
export { ProductSyncService } from './product-sync.service';

// Exportar tipos se tiverem
export type { IAuthService } from './auth.service';
export type { IInventoryService } from './inventory.service';
```

### Exemplo: `src/lib/types/index.ts`

```typescript
// Exportar todos os tipos
export type { Product, ProductStatus } from './product.types';
export type { Order, OrderStatus, OrderItem } from './order.types';
export type { Inventory, InventoryReservation } from './inventory.types';

// Reexportar tipos de configuração se necessário
export type { Config } from '../config';
```

## Regras de Ouro

### 1. Preferir Importações de Índices

```typescript
// ✅ BOM
import { InventoryService } from '@/lib/services';

// ❌ RUIM
import { InventoryService } from '@/lib/services/inventory.service';
```

### 2. Usar `type` para Tipos

```typescript
// ✅ BOM
import type { Product } from '@/lib/types';

// ❌ RUIM
import { Product } from '@/lib/types'; // Se for apenas tipo
```

### 3. Agrupar Importações por Categoria

```typescript
// ✅ BOM: Agrupar logicamente
import { config } from '@/lib';
import { InventoryService, AuthService } from '@/lib/services';
import type { Product, Order } from '@/lib/types';
import { formatDate, encrypt } from '@/lib/utils';

// ❌ RUIM: Desordenado
import { formatDate } from '@/lib/utils';
import { config } from '@/lib';
import type { Product } from '@/lib/types';
import { InventoryService } from '@/lib/services';
```

### 4. Nunca Criar Importações Circulares

```typescript
// ❌ RUIM: Importação circular
// a.service.ts
import { BService } from '@/lib/services';
export class AService {
  constructor(private b: BService) {}
}

// b.service.ts
import { AService } from '@/lib/services';
export class BService {
  constructor(private a: AService) {}
}
```

**Solução:** Usar injeção de dependência ou interface

```typescript
// ✅ BOM: Usar interface
// a.service.ts
export interface IServiceB {
  doSomething(): void;
}

export class AService {
  constructor(private b: IServiceB) {}
}

// b.service.ts
export class BService implements IServiceB {
  doSomething(): void {}
}
```

## Inicialização da Aplicação

### Checklist de Startup

1. **Validar Configuração**

```typescript
// pages/api/init.ts ou middleware
import { validateAndLogConfig } from '@/lib';

export default function handler(req, res) {
  validateAndLogConfig(true); // Lança em produção
  res.status(200).json({ ready: true });
}
```

2. **Conectar ao Banco de Dados**

```typescript
// Feito automaticamente via Prisma client
import { prisma } from '@/lib/prisma'; // Quando for criado
```

3. **Conectar ao Redis**

```typescript
import { redisClient } from '@/lib/queue';
```

4. **Iniciar Filas**

```typescript
import { startQueues } from '@/lib/queue';

await startQueues();
```

## Exemplo Completo: Novo Endpoint

```typescript
// pages/api/products/[id]/sync.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { ProductSyncService } from '@/lib/services';
import { config, validateConfig } from '@/lib';
import type { Product } from '@/lib/types';

validateConfig();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    // Usar serviço
    const syncService = new ProductSyncService();
    const result = await syncService.syncProductToMarketplaces(id as string);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

## Comandos TypeScript

### Verificar Configuração

```bash
# Validar tipos TypeScript
npm run type-check

# Ver estrutura de tipos
npm run type-check -- --pretty
```

### Imports Automáticos

Configurar seu editor para:

1. **VS Code:**
   - Instalar ESLint extension
   - Adicionar ao `.vscode/settings.json`:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "dbaeumer.vscode-eslint"
  }
}
```

2. **WebStorm:**
   - Settings → Languages & Frameworks → TypeScript → Imports
   - Marcar "Use paths from tsconfig.json"

## Boas Práticas

### Encapsulamento

- Manter lógica de negócio nos serviços
- Utilitários são funções puras
- Tipos definem contrato

```typescript
// ✅ BOM: Lógica encapsulada
export class InventoryService {
  private inventoryLock = new Map();
  
  async updateInventory(productId: string, qty: number): Promise<void> {
    // Lógica de lock, validação, etc
  }
}

// ✅ BOM: Função pura
export function calculateDiscount(price: number, discount: number): number {
  return price * (1 - discount / 100);
}
```

### Reutilização

- Sempre extrair código duplicado para utils ou serviços
- Criar abstrações quando função é usada 2+ vezes

### Manutenibilidade

- Adicionar documentação em functions públicas
- Usar tipos ao invés de any
- Adicionar testes para lógica crítica

## Troubleshooting

### Erro: "Cannot find module '@/lib'"

**Solução:** Verificar `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Erro: "Circular dependency detected"

**Solução:** Refatorar para remover ciclo:
- Mover código compartilhado para novo arquivo
- Usar interfaces para quebrar dependência

### Imports lentos em desenvolvimento

**Solução:**
- Usar imports nomeados em vez de `import *`
- Evitar re-exports desnecessários em índices

## Referências

- [TypeScript Handbook - Modules](https://www.typescriptlang.org/docs/handbook/2/modules.html)
- [Next.js Absolute Imports](https://nextjs.org/docs/advanced-features/module-path-aliases)
- [Module Resolution](https://www.typescriptlang.org/tsconfig#moduleResolution)

---

**Última atualização:** 2024
**Versão:** 1.0
