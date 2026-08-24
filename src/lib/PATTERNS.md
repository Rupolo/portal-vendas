# Padrões Rápidos - Referência de Importações

## Localização Rápida

```
src/lib/
├── config.ts                    # 🔧 Configuração centralizada
├── index.ts                     # 📍 Índice principal - importar daqui!
├── services/index.ts            # 📍 Todos os serviços
├── types/index.ts              # 📍 Todos os tipos
└── utils/index.ts              # 📍 Utilitários
```

## Importações Corretas

### ✅ Configuração

```typescript
import { config } from '@/lib';
import { validateConfig, validateAndLogConfig } from '@/lib';
import type { Config, ConfigPath } from '@/lib';
```

### ✅ Serviços

```typescript
import { 
  ProductSyncService, 
  InventoryService,
  AuthService 
} from '@/lib/services';

const service = new ProductSyncService();
```

### ✅ Tipos

```typescript
import type { 
  Product, 
  Order, 
  SyncResult 
} from '@/lib/types';

function process(product: Product): void { }
```

### ✅ Utilitários

```typescript
import { formatDate, encrypt } from '@/lib/utils';

const formatted = formatDate(new Date());
```

## Anti-padrões ❌

```typescript
// ❌ NÃO FAZER ISSO

// Caminho relativo
import { config } from '../../../../lib/config';

// Import direto sem usar índice
import { InventoryService } from '@/lib/services/inventory.service';

// Importação circular
import { A } from './a';
// e em a.ts:
import { B } from './b';
```

## Estrutura de Arquivo Novo

### 1️⃣ Tipo

```typescript
// src/lib/types/novo.types.ts
export type MyType = { /* ... */ };
export interface MyInterface { /* ... */ }
```

### 2️⃣ Serviço

```typescript
// src/lib/services/novo.service.ts
export class MyService {
  async doSomething(): Promise<void> { }
}
```

### 3️⃣ Índice

```typescript
// src/lib/types/index.ts (adicionar)
export type { MyType, MyInterface } from './novo.types';

// src/lib/services/index.ts (adicionar)
export { MyService } from './novo.service';
```

### 4️⃣ Usar

```typescript
import { MyService } from '@/lib/services';
import type { MyType } from '@/lib/types';

const service = new MyService();
const data: MyType = { };
```

## Configuração

```typescript
import { config } from '@/lib';

// Acessar variáveis
const dbUrl = config.database.url;
const redisHost = config.redis.host;
const shopeeKey = config.marketplaces.shopee.apiKey;
const cacheSchemasTTL = config.cache.schemas; // 300 segundos

// Validar em startup
import { validateAndLogConfig } from '@/lib';
validateAndLogConfig(); // Log + throw em produção
```

## Exemplo Mínimo

```typescript
// src/lib/services/exemplo.service.ts
export class ExemploService {
  async executar(): Promise<string> {
    return 'sucesso';
  }
}

// src/lib/types/exemplo.types.ts
export interface ExemploResult {
  status: string;
  timestamp: Date;
}

// Usar em componente/api
import { ExemploService } from '@/lib/services';
import type { ExemploResult } from '@/lib/types';

async function handler(): Promise<ExemploResult> {
  const service = new ExemploService();
  const status = await service.executar();
  return { status, timestamp: new Date() };
}
```

## Testes

```typescript
import { describe, it, expect } from 'vitest';
import { MyService } from '@/lib/services';
import type { MyType } from '@/lib/types';

describe('MyService', () => {
  it('deve fazer algo', async () => {
    const service = new MyService();
    const result = await service.doSomething();
    expect(result).toBeDefined();
  });
});
```

## Inicialização (Server)

```typescript
// pages/api/init.ts
import { validateAndLogConfig } from '@/lib';

export default function handler(req, res) {
  validateAndLogConfig(true); // Erro em produção se inválido
  
  // ... rest da lógica
  
  res.status(200).json({ ready: true });
}
```

---

**Dúvidas?** Ver `STRUCTURE.md` para documentação completa
