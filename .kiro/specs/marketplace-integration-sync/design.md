# Design Técnico — Sincronização de Marketplaces

## Overview

O Portal Vendas é uma plataforma centralizada que sincroniza produtos, estoque e pedidos entre múltiplos marketplaces (Shopee e Mercado Livre). O design implementa uma arquitetura orientada a eventos com fila de processamento distribuída, tratamento robusto de erros, e segurança criptografada.

**Objetivo**: Permitir que vendedores gerenciem inventário e vendas consolidados, com sincronização automática, tratamento de conflitos e visibilidade completa em tempo real.

---

## Architecture

### Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                     Portal Vendas (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  Frontend/UI     │  │  API Routes      │  │  Webhooks    │   │
│  │  - Dashboard     │  │  - Sync Control  │  │  - Listeners │   │
│  │  - Settings      │  │  - Product API   │  │  - Handlers  │   │
│  │  - Orders        │  │  - Order API     │  │              │   │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘   │
│           │                      │                   │            │
│           └──────────────────────┼───────────────────┘            │
│                                  │                                │
│  ┌──────────────────────────────▼──────────────────────────────┐ │
│  │         Service Layer (Business Logic)                      │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │ │
│  │  │ ProductService │  │ OrderService   │  │ SyncService    │ │ │
│  │  │ - Sync logic   │  │ - Order logic  │  │ - Orchestration│ │ │
│  │  │ - Mapping      │  │ - Status track │  │ - Retry logic  │ │ │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │ │
│  └──────────────────────────────┬───────────────────────────────┘ │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐ │
│  │         Queue System (BullMQ)                               │ │
│  │  - Product Sync Queue                                       │ │
│  │  - Order Sync Queue                                         │ │
│  │  - Webhook Processing Queue                                 │ │
│  │  - Error Recovery Queue                                     │ │
│  └──────────────────────────────┬───────────────────────────────┘ │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐ │
│  │         Data Access Layer                                   │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │ │
│  │  │   Database     │  │    Cache       │  │    Vault       │ │ │
│  │  │  - Products    │  │  - Redis       │  │  - Tokens      │ │ │
│  │  │  - Orders      │  │  - API Schemas │  │  - Secrets     │ │ │
│  │  │  - Sync Logs   │  │                │  │  - Encrypted   │ │ │
│  │  │  - Auth Tokens │  │                │  │                │ │ │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                                              │
         │                                              │
┌────────▼────────────────────────────────────────────▼────────────┐
│              External Marketplaces                                │
│  ┌──────────────┐                    ┌──────────────┐             │
│  │   Shopee     │                    │ Mercado Livre│             │
│  │   API v2.0   │                    │   API        │             │
│  │              │                    │              │             │
│  │ - Products   │                    │ - Search     │             │
│  │ - Orders     │                    │ - Items      │             │
│  │ - Inventory  │                    │ - Orders     │             │
│  │ - Webhooks   │                    │ - Webhooks   │             │
│  └──────────────┘                    └──────────────┘             │
└────────────────────────────────────────────────────────────────────┘
```

### Componentes Principais

| Componente | Responsabilidade | Tecnologia |
|---|---|---|
| **Frontend** | Dashboard de sincronização, configurações, visualização de erros | React/TypeScript |
| **API Routes** | Endpoints REST, webhooks, sincronização manual | Next.js API Routes |
| **Services** | Lógica de negócio, mapeamento de dados, orquestração | TypeScript Classes |
| **Queue System** | Processamento assíncrono em batch | BullMQ + Redis |
| **Database** | Persistência de produtos, pedidos, logs, tokens | PostgreSQL |
| **Cache Layer** | Cache de schemas, respostas de API | Redis |
| **Vault** | Armazenamento seguro de tokens e secrets | Environment + Encryption |

---

## Components and Interfaces

### 1. Product Synchronization Component

```typescript
// src/lib/services/product-sync.service.ts
interface ProductSyncService {
  // Sincronizar um produto para todos os marketplaces
  syncProductToMarketplaces(product: PortalProduct): Promise<SyncResult>;
  
  // Sincronizar múltiplos produtos em batch
  batchSyncProducts(products: PortalProduct[]): Promise<SyncResult[]>;
  
  // Buscar produto de um marketplace
  fetchMarketplaceProduct(marketplace: Marketplace, id: string): Promise<RemoteProduct>;
  
  // Mapear dados de Portal para formato do Marketplace
  mapProductToMarketplace(product: PortalProduct, marketplace: Marketplace): Promise<MarketplaceProduct>;
  
  // Detectar conflitos de dados
  detectConflicts(local: PortalProduct, remote: RemoteProduct): ConflictDetails[];
  
  // Resolver conflitos baseado em estratégia
  resolveConflict(conflict: ConflictDetails, strategy: ResolutionStrategy): Promise<PortalProduct>;
}
```

### 2. Inventory Synchronization Component

```typescript
// src/lib/services/inventory-sync.service.ts
interface InventorySyncService {
  // Sincronizar estoque para todos os marketplaces
  syncInventory(productId: string, quantity: number): Promise<SyncResult>;
  
  // Processar alteração de estoque de webhook
  handleInventoryWebhook(event: WebhookEvent): Promise<void>;
  
  // Atualizar estoque local quando recebe notificação
  updateLocalInventory(productId: string, quantity: number): Promise<void>;
  
  // Desativar anúncio quando estoque = 0
  deactivateWhenOutOfStock(productId: string): Promise<void>;
  
  // Restaurar estoque quando pedido é cancelado
  restoreInventory(orderId: string): Promise<void>;
  
  // Detectar race conditions
  acquireInventoryLock(productId: string): Promise<Lock>;
}
```

### 3. Order Management Component

```typescript
// src/lib/services/order-management.service.ts
interface OrderManagementService {
  // Capturar pedido via webhook
  captureOrderFromWebhook(event: WebhookEvent): Promise<Order>;
  
  // Armazenar pedido no banco
  storeOrder(order: RemoteOrder): Promise<StoredOrder>;
  
  // Atualizar status do pedido
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
  
  // Sincronizar status de volta para marketplace
  syncOrderStatusToMarketplace(orderId: string, status: OrderStatus): Promise<void>;
  
  // Listar pedidos com paginação
  listOrders(filter: OrderFilter): Promise<Order[]>;
  
  // Obter detalhes de um pedido
  getOrderDetails(orderId: string): Promise<OrderWithItems>;
}
```

### 4. Authentication Component

```typescript
// src/lib/services/auth.service.ts
interface AuthenticationService {
  // Validar e armazenar credenciais
  storeMarketplaceCredentials(marketplace: Marketplace, credentials: Credentials): Promise<void>;
  
  // Renovar token expirado
  refreshToken(marketplace: Marketplace): Promise<Token>;
  
  // Validar token antes de usar
  validateToken(marketplace: Marketplace): Promise<boolean>;
  
  // Criptografar token em repouso
  encryptToken(token: string): string;
  
  // Descriptografar token
  decryptToken(encrypted: string): string;
  
  // Notificar quando token expirou
  notifyTokenExpiration(marketplace: Marketplace): Promise<void>;
}
```

### 5. Webhook Handler Component

```typescript
// src/lib/services/webhook-handler.service.ts
interface WebhookHandlerService {
  // Validar assinatura do webhook
  validateWebhookSignature(event: WebhookEvent, signature: string, marketplace: Marketplace): boolean;
  
  // Enfileirar webhook para processamento
  enqueueWebhook(event: WebhookEvent): Promise<void>;
  
  // Processar webhook de ordem
  processOrderWebhook(event: WebhookEvent): Promise<void>;
  
  // Processar webhook de inventário
  processInventoryWebhook(event: WebhookEvent): Promise<void>;
  
  // Processar webhook de produto
  processProductWebhook(event: WebhookEvent): Promise<void>;
  
  // Registrar tentativa de reentrega
  retryWebhookDelivery(webhookId: string): Promise<void>;
}
```

### 6. Error Handling & Retry Component

```typescript
// src/lib/services/error-handler.service.ts
interface ErrorHandlingService {
  // Classificar tipo de erro
  classifyError(error: Error): ErrorClassification;
  
  // Determinar se erro é recuperável
  isRecoverable(error: Error): boolean;
  
  // Implementar retry com backoff exponencial
  retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T>;
  
  // Circuit breaker pattern
  executeWithCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T>;
  
  // Registrar erro para auditoria
  logError(error: SyncError): Promise<void>;
  
  // Notificar admin sobre erro crítico
  notifyAdminOfError(error: SyncError): Promise<void>;
}
```

### 7. Conflict Resolution Component

```typescript
// src/lib/services/conflict-resolver.service.ts
interface ConflictResolutionService {
  // Detectar conflito entre local e remoto
  detectConflict(local: any, remote: any): Conflict | null;
  
  // Aplicar estratégia de resolução
  resolveByStrategy(
    conflict: Conflict,
    strategy: 'latest' | 'local-priority' | 'remote-priority' | 'inventory-min'
  ): any;
  
  // Notificar vendedor sobre conflito não resolvível
  notifyVendorForManualResolution(conflict: Conflict): Promise<void>;
  
  // Aplicar resolução manual do vendedor
  applyManualResolution(conflict: Conflict, vendorChoice: any): Promise<void>;
  
  // Sincronizar resolução para todos os marketplaces
  syncResolutionToMarketplaces(productId: string, resolution: any): Promise<void>;
}
```

---

## Data Models

### Product Model

```typescript
// src/lib/types/product.ts
interface PortalProduct {
  id: string;                          // SKU único do Portal
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  attributes: Record<string, any>;     // Atributos específicos
  images: string[];                    // URLs de imagens
  status: 'active' | 'draft' | 'inactive';
  inventory: Inventory;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  marketplaceIds: {
    shopee?: string;
    mercadolivre?: string;
  };
}

interface Inventory {
  total: number;
  reserved: number;                    // Reservado por pedidos
  available: number;
  by_marketplace: {
    shopee: number;
    mercadolivre: number;
  };
}

interface MarketplaceProduct {
  marketplace: 'shopee' | 'mercadolivre';
  remoteId: string;
  title: string;
  price: number;
  originalPrice?: number;
  inventory: number;
  status: string;
  lastSyncedAt: Date;
  errorLog?: SyncError[];
}

interface SyncStatus {
  productId: string;
  marketplace: Marketplace;
  status: 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
  lastAttempt: Date;
  attempts: number;
  nextRetry?: Date;
  error?: string;
  conflictDetails?: ConflictDetails;
}
```

### Order Model

```typescript
// src/lib/types/order.ts
interface Order {
  id: string;                          // ID único do Portal
  marketplaceOrderId: string;          // ID no marketplace
  marketplace: Marketplace;
  status: OrderStatus;
  items: OrderItem[];
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  shippingAddress: {
    street: string;
    number: string;
    complement?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billingAddress?: object;
  totalPrice: number;
  shippingPrice?: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  tracking?: {
    number?: string;
    carrier?: string;
    estimatedDelivery?: Date;
  };
}

interface OrderItem {
  id: string;
  portalProductId: string;
  title: string;
  quantity: number;
  price: number;
  originalPrice?: number;
}

type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
type PaymentStatus = 'pending' | 'approved' | 'denied' | 'refunded';
```

### Synchronization Log Model

```typescript
// src/lib/types/sync-log.ts
interface SyncLog {
  id: string;
  entityType: 'product' | 'order' | 'inventory';
  entityId: string;
  marketplace: Marketplace;
  operation: 'create' | 'update' | 'delete' | 'sync-from' | 'conflict-detected';
  status: 'success' | 'failed' | 'retry' | 'conflict';
  timestamp: Date;
  duration: number;                    // em ms
  attempt: number;
  nextRetry?: Date;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  conflictData?: ConflictDetails;
  auditTrail: {
    userId: string;
    action: string;
    changes: Record<string, any>;
  };
}

interface ConflictDetails {
  field: string;
  localValue: any;
  remoteValue: any;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: 'latest' | 'local' | 'remote' | 'manual';
  resolutionValue: any;
}
```

### Authentication Model

```typescript
// src/lib/types/auth.ts
interface MarketplaceAuth {
  id: string;
  marketplace: Marketplace;
  vendorId: string;
  accessToken: string;                 // Criptografado
  refreshToken?: string;               // Criptografado
  tokenType: string;
  expiresAt: Date;
  createdAt: Date;
  lastRefreshedAt?: Date;
  status: 'active' | 'expired' | 'invalid';
  permissions: string[];               // Escopos de acesso
}

interface TokenEncryption {
  algorithm: 'AES-256-GCM';
  encryptedToken: string;
  iv: string;                          // Initialization Vector
  authTag: string;                     // Authentication tag
  salt: string;
}
```

### Database Schema (PostgreSQL)

```sql
-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY,
  portal_sku VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  category VARCHAR(255),
  attributes JSONB,
  images TEXT[],
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_synced_at TIMESTAMP,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Marketplace product mappings
CREATE TABLE marketplace_products (
  id UUID PRIMARY KEY,
  portal_product_id UUID NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  remote_id VARCHAR(255) NOT NULL,
  remote_title VARCHAR(255),
  remote_price DECIMAL(10, 2),
  remote_inventory INT,
  remote_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'pending',
  error_log JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (portal_product_id, marketplace),
  FOREIGN KEY (portal_product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  marketplace_order_id VARCHAR(255) NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  portal_order_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  vendor_id UUID NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  shipping_address JSONB,
  billing_address JSONB,
  total_price DECIMAL(10, 2),
  shipping_price DECIMAL(10, 2),
  payment_method VARCHAR(100),
  notes TEXT,
  tracking_number VARCHAR(255),
  tracking_carrier VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (marketplace, marketplace_order_id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  portal_product_id UUID NOT NULL,
  marketplace_product_id VARCHAR(255),
  title VARCHAR(255),
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2),
  original_price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (portal_product_id) REFERENCES products(id)
);

-- Inventory management
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE,
  total_quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT GENERATED ALWAYS AS (total_quantity - reserved_quantity) STORED,
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Marketplace inventory sync (by marketplace)
CREATE TABLE marketplace_inventory (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  last_synced_at TIMESTAMP,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (product_id, marketplace),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Sync logs (auditoria)
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  marketplace VARCHAR(50),
  operation VARCHAR(50),
  status VARCHAR(50) NOT NULL,
  duration_ms INT,
  attempt INT DEFAULT 1,
  next_retry TIMESTAMP,
  error JSONB,
  conflict_data JSONB,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Marketplace authentication
CREATE TABLE marketplace_auth (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_type VARCHAR(50),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_refreshed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  permissions TEXT[],
  UNIQUE (vendor_id, marketplace),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Webhooks received (para retry logic)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY,
  marketplace VARCHAR(50) NOT NULL,
  event_type VARCHAR(100),
  payload JSONB NOT NULL,
  signature VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Sync configuration per vendor
CREATE TABLE sync_configuration (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL UNIQUE,
  marketplace VARCHAR(50),
  sync_frequency INT DEFAULT 300,                  -- segundos (5 min)
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  conflict_resolution_strategy VARCHAR(50) DEFAULT 'latest',
  inventory_sync_enabled BOOLEAN DEFAULT TRUE,
  order_sync_enabled BOOLEAN DEFAULT TRUE,
  max_retries INT DEFAULT 3,
  retry_backoff_base INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Create indexes for performance
CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_marketplace_products_portal_id ON marketplace_products(portal_product_id);
CREATE INDEX idx_marketplace_products_marketplace ON marketplace_products(marketplace);
CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_orders_marketplace ON orders(marketplace);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_sync_logs_entity ON sync_logs(entity_type, entity_id);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
```

---

## Synchronization Flows

### Flow 1: Product Sync (Portal → Marketplace)

```
User publishes product in Portal
        │
        ▼
┌─────────────────────────────────────┐
│ ProductSyncService.syncProduct()    │
│ - Validate product data             │
│ - Map to Shopee format              │
│ - Map to Mercado Livre format       │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Enqueue to Product Sync Queue       │
│ - Job per marketplace               │
│ - Priority: 'high'                  │
└─────────────────────────────────────┘
        │
        ├─────────────────┬─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐   ┌──────────────┐   (Waiting)
│  Shopee Job  │   │   ML Job     │
└──────┬───────┘   └──────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────────────────────┐
│ Execute API Call             │
│ - POST /product/add or /PUT  │
│ - Include auth token         │
│ - Timeout: 30s               │
└──────────────────────────────┘
       │
       ├─────────────┬──────────────┬──────────────┐
       ▼             ▼              ▼              ▼
    Success       Timeout      Auth Error      Rate Limit
       │             │              │              │
       ▼             ▼              ▼              ▼
   Store ID    Retry x3      Refresh Token   Exponential
   Update      (5s, 10s,     & Retry         Backoff
   Mapping     20s)          OR Notify       (next job)
   Log         Then          Admin           Log & Notify
   Success     Manual        Log Error       Retry Later
               Log
```

### Flow 2: Inventory Sync (Bidirectional)

```
Scenario A: Inventory changed in Portal
└─ User updates stock to 50 units
   │
   ▼
┌─────────────────────────────┐
│ Lock acquired (Redis)       │ → Prevents race conditions
└─────────────────────────────┘
   │
   ▼
┌─────────────────────────────┐
│ Update Portal inventory      │
│ - available = 50             │
└─────────────────────────────┘
   │
   ▼
┌─────────────────────────────┐
│ Enqueue Inventory Sync       │
│ - Shopee: 50 units          │
│ - Mercado Livre: 50 units   │
└─────────────────────────────┘
   │
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
Shopee API    ML API         Release Lock
   │              │
   (if success)   (if success)
   │              │
   ▼              ▼
Log Success    Log Success
   │              │
   └──────────┬───┘
              ▼
        Update last_synced_at

Scenario B: Inventory changed in Marketplace (via Webhook)
└─ Webhook received: order placed, stock now 45 units
   │
   ▼
┌──────────────────────────────┐
│ Validate webhook signature   │
└──────────────────────────────┘
   │
   ▼
┌──────────────────────────────┐
│ Enqueue to Webhook Queue     │
└──────────────────────────────┘
   │
   ▼
┌──────────────────────────────┐
│ InventorySyncService         │
│ .handleInventoryWebhook()    │
└──────────────────────────────┘
   │
   ▼
┌──────────────────────────────┐
│ Acquire Lock for product     │
└──────────────────────────────┘
   │
   ▼
┌──────────────────────────────┐
│ Deduct from Portal inventory │
│ - Check if out of stock      │
└──────────────────────────────┘
   │
   ├─────────────────────┬─────────────────────┐
   │ (if stock = 0)      │ (if stock > 0)      │
   ▼                     ▼                     ▼
Deactivate          Update inventory      Release lock
listing on          on other platform     Log success
other               Release lock
marketplaces        Log success
Release lock
```

### Flow 3: Order Capture (Marketplace → Portal)

```
Order placed on Shopee/ML
        │
        ▼
Marketplace sends Webhook
        │
        ▼
┌────────────────────────────────┐
│ POST /api/webhooks/order       │
│ - Validate signature           │
│ - Check duplicate (idempotent) │
└────────────────────────────────┘
        │
        ▼
    Valid?
    ├─── No ──→ Return 400
    │
    ├─── Yes
        │
        ▼
┌────────────────────────────────┐
│ Enqueue to Webhook Queue       │
│ Priority: 'critical'           │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│ OrderManagementService         │
│ .captureOrderFromWebhook()     │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│ Extract order items            │
│ Lookup portal product IDs      │
│ Check inventory availability   │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│ Store in Orders table          │
│ Create OrderItems rows         │
│ Update inventory (reserved)    │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│ Log order capture              │
│ Send notification to vendor    │
└────────────────────────────────┘
        │
        ▼
Response 200 OK (to webhook)
```

### Flow 4: Error Handling with Retry

```
API Call Fails
        │
        ▼
┌────────────────────────┐
│ Error Classification   │
├────────────────────────┤
│ • Timeout              │
│ • Auth error (401)     │
│ • Rate limit (429)     │
│ • Server error (5xx)   │
│ • Bad request (4xx)    │
└────────────────────────┘
        │
    ┌───┴────────────────────────┬────────────────┐
    │                            │                │
    ▼                            ▼                ▼
Recoverable              Partially               Not
(timeout, 429, 5xx)      Recoverable            Recoverable
    │                    (401/403)              (400, invalid
    │                         │                 product)
    ▼                         ▼                 │
Backoff Logic           Refresh Token          ▼
    │                   & Retry or            Manual
    │                   Notify Admin          Intervention
    │                         │               Required
    ├─ Attempt 1: wait 5s     │               │
    │                         │               ▼
    ├─ Attempt 2: wait 10s    │             Log Error
    │                         │             Notify Admin
    ├─ Attempt 3: wait 20s    │             Mark Failed
    │                         │             Keep for Manual
    ├─ Attempt 4: wait 60s    │             Review
    │                         │
    ├─ After 4 attempts       │
    ▼                         ▼
If all fail:            If refresh fails:
Log to SyncError        Notify admin to
Mark as 'retry'         re-authenticate
Schedule manual         Mark as 'blocked'
check (1 hour)          Pause sync
Notify admin
Circuit Breaker
activates (if
>50% fail)
```

---

## API Endpoints

### Product Endpoints

```
POST   /api/products
  Body: { title, description, price, category, images, attributes }
  Response: { id, status: 'success' | 'error' }

PUT    /api/products/:id
  Body: { title?, description?, price?, ... }
  Response: { id, lastSyncedAt, syncStatus }

DELETE /api/products/:id
  Response: { success: boolean }

GET    /api/products/:id/sync-status
  Response: { productId, syncStatuses: SyncStatus[] }

POST   /api/products/:id/force-sync
  Query: ?marketplaces=shopee,mercadolivre
  Response: { jobIds, status }

GET    /api/products/:id/history
  Query: ?limit=50&offset=0
  Response: { logs: SyncLog[] }
```

### Inventory Endpoints

```
PUT    /api/inventory/:productId
  Body: { quantity: number }
  Response: { productId, quantity, syncStatus }

GET    /api/inventory/:productId
  Response: { 
    total: number,
    reserved: number,
    available: number,
    by_marketplace: { shopee, mercadolivre }
  }

POST   /api/inventory/:productId/lock
  Response: { lockId, expiresAt }

DELETE /api/inventory/:productId/lock/:lockId
  Response: { success: boolean }
```

### Order Endpoints

```
GET    /api/orders
  Query: ?status=pending&marketplace=shopee&limit=20&offset=0
  Response: { orders: Order[], total, hasMore }

GET    /api/orders/:orderId
  Response: Order with items and shipping details

PUT    /api/orders/:orderId/status
  Body: { status: 'processing' | 'shipped' | 'delivered' | 'cancelled' }
  Response: { orderId, status, synced_to_marketplace: boolean }

PUT    /api/orders/:orderId/tracking
  Body: { number: string, carrier: string }
  Response: { orderId, tracking, synced_to_marketplace: boolean }

GET    /api/orders/marketplace/:marketplace
  Query: ?limit=50&offset=0
  Response: { orders: Order[] }
```

### Webhook Endpoints

```
POST   /api/webhooks/shopee
  Headers: X-Shopee-Signature
  Body: Shopee webhook payload
  Response: { status: 'received' }

POST   /api/webhooks/mercadolivre
  Headers: Authorization (token)
  Body: Mercado Livre webhook payload
  Response: { status: 'received' }

GET    /api/webhooks/deliveries
  Query: ?status=failed&marketplace=shopee&limit=50
  Response: { deliveries: WebhookDelivery[] }

POST   /api/webhooks/deliveries/:id/retry
  Response: { deliveryId, status: 'queued' }
```

### Configuration Endpoints

```
GET    /api/config/sync
  Response: SyncConfiguration

PUT    /api/config/sync
  Body: { 
    sync_frequency: number,
    auto_sync_enabled: boolean,
    conflict_resolution_strategy: string,
    ...
  }
  Response: SyncConfiguration

POST   /api/marketplace/auth/connect
  Body: { marketplace: string, authCode: string }
  Response: { marketplace, status: 'connected' | 'error' }

DELETE /api/marketplace/auth/:marketplace
  Response: { success: boolean }

POST   /api/marketplace/auth/:marketplace/refresh
  Response: { marketplace, expiresAt }
```

### Dashboard Endpoints

```
GET    /api/dashboard/sync-status
  Response: {
    overall_status: 'healthy' | 'warning' | 'critical',
    marketplaces: {
      shopee: { status, last_sync, product_count, error_count },
      mercadolivre: { status, last_sync, product_count, error_count }
    },
    recent_errors: SyncError[],
    sync_queue_length: number
  }

GET    /api/dashboard/metrics
  Query: ?from=2024-01-01&to=2024-01-31
  Response: {
    total_syncs: number,
    successful: number,
    failed: number,
    avg_sync_time_ms: number,
    error_breakdown: { [errorCode]: count }
  }

GET    /api/dashboard/marketplace/:marketplace
  Response: {
    status: string,
    products_synced: number,
    products_failed: number,
    orders_captured: number,
    last_sync: Date,
    recent_errors: SyncError[]
  }
```

---

## Error Handling Strategy

### Error Classification

```typescript
enum ErrorType {
  // Recoverable
  TIMEOUT = 'TIMEOUT',                 // Retry with backoff
  RATE_LIMIT = 'RATE_LIMIT',           // Exponential backoff
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // Retry
  
  // Potentially Recoverable (need token refresh)
  UNAUTHORIZED = 'UNAUTHORIZED',       // Refresh token & retry
  FORBIDDEN = 'FORBIDDEN',             // Notify admin
  
  // Not Recoverable
  BAD_REQUEST = 'BAD_REQUEST',         // Log & manual review
  NOT_FOUND = 'NOT_FOUND',             // Log & notify
  INVALID_PRODUCT = 'INVALID_PRODUCT', // Data mapping issue
  
  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',     // Retry
}

interface ErrorStrategy {
  type: ErrorType;
  recoverable: boolean;
  maxRetries: number;
  baseDelayMs: number;
  notifyAdmin: boolean;
  pauseSync: boolean;
}
```

### Retry Policy with Exponential Backoff

```typescript
const retryPolicies: Record<ErrorType, ErrorStrategy> = {
  [ErrorType.TIMEOUT]: {
    recoverable: true,
    maxRetries: 4,
    baseDelayMs: 5000,          // 5s, 10s, 20s, 60s
    notifyAdmin: false,
    pauseSync: false
  },
  [ErrorType.RATE_LIMIT]: {
    recoverable: true,
    maxRetries: 5,
    baseDelayMs: 10000,         // 10s, 20s, 40s, 80s, 160s
    notifyAdmin: false,
    pauseSync: false
  },
  [ErrorType.UNAUTHORIZED]: {
    recoverable: true,
    maxRetries: 2,
    baseDelayMs: 5000,
    notifyAdmin: true,
    pauseSync: true
  },
  [ErrorType.BAD_REQUEST]: {
    recoverable: false,
    maxRetries: 0,
    baseDelayMs: 0,
    notifyAdmin: true,
    pauseSync: false
  }
};

// Backoff calculation: delay = baseDelayMs * (2 ^ attempt)
// Attempt 1: 5s
// Attempt 2: 10s
// Attempt 3: 20s
// Attempt 4: 60s (capped)
```

### Circuit Breaker Pattern

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;            // 5 failures
  successThreshold: number;            // 2 successes to recover
  timeout: number;                     // 60 seconds
  halfOpenRequests: number;            // 3 requests in half-open state
}

enum CircuitState {
  CLOSED = 'CLOSED',                   // Normal operation
  OPEN = 'OPEN',                       // Stop requests
  HALF_OPEN = 'HALF_OPEN'              // Testing recovery
}

// When OPEN: Reject new requests, notify admin
// After timeout: Transition to HALF_OPEN
// In HALF_OPEN: Allow limited requests
// If success: CLOSED
// If fail: OPEN again
```

---

## Security

### Token Management

```typescript
interface TokenVault {
  // Criptografar token antes de armazenar
  encryptAndStore(marketplace: Marketplace, token: string): Promise<void>;
  
  // Descriptografar token quando necessário
  retrieveAndDecrypt(marketplace: Marketplace): Promise<string>;
  
  // Validar expiração
  isTokenExpired(marketplace: Marketplace): boolean;
  
  // Renovar token usando refresh_token
  refreshExpiredToken(marketplace: Marketplace): Promise<void>;
}

// Encryption: AES-256-GCM
// Storage: database column encrypted_token
// Key management: Environment variable (rotated)
// Separate IV and auth tag for additional security
```

### Webhook Validation

```typescript
// Shopee webhook signature validation
function validateShopeeWebhook(payload: string, signature: string): boolean {
  const computedSignature = crypto
    .createHmac('sha256', SHOPEE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

// Mercado Livre webhook token validation
function validateMercadoLivreWebhook(token: string): boolean {
  return token === MERCADO_LIVRE_WEBHOOK_TOKEN;
}

// Rate limiting on webhook endpoints
// - Max 100 requests per minute per marketplace
// - Idempotency keys to prevent duplicate processing
```

### Data Encryption in Transit

```typescript
// HTTPS only (enforce in middleware)
// TLS 1.3+
// Certificate pinning for API calls to marketplaces

// Webhook payload encryption
interface SecureWebhookPayload {
  encrypted: string;                   // AES-256-GCM encrypted
  iv: string;                          // Initialization vector
  authTag: string;                     // Authentication tag
}
```

---

## Queue System (BullMQ)

### Queue Architecture

```typescript
interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
    removeOnComplete: boolean;
    removeOnFail: boolean;
  };
}

// Queues
const productSyncQueue = new Queue('product-sync', queueConfig);
const inventorySyncQueue = new Queue('inventory-sync', queueConfig);
const orderSyncQueue = new Queue('order-sync', queueConfig);
const webhookProcessingQueue = new Queue('webhook-processing', queueConfig);
const errorRecoveryQueue = new Queue('error-recovery', queueConfig);

// Priorities
interface JobPriority {
  CRITICAL = 1,                        // Order webhooks
  HIGH = 2,                            // Product updates
  NORMAL = 3,                          // Regular sync
  LOW = 4                              // Batch jobs
}
```

### Job Processing

```typescript
productSyncQueue.process(
  5,  // 5 workers (concurrency)
  async (job) => {
    const { productId, marketplaces } = job.data;
    
    try {
      job.progress(10);
      
      // Get product data
      const product = await db.products.findById(productId);
      job.progress(30);
      
      // Sync to each marketplace
      const results = await Promise.allSettled(
        marketplaces.map(mp => syncToMarketplace(product, mp))
      );
      
      job.progress(80);
      
      // Log results
      await logSyncResults(productId, results);
      
      job.progress(100);
      return { success: true, productId };
      
    } catch (error) {
      // Automatic retry via BullMQ
      throw error;
    }
  }
);

// Event listeners
productSyncQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

productSyncQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err.message);
  notifyAdminOfFailure(job, err);
});

productSyncQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`);
});
```

### Queue Metrics & Monitoring

```typescript
async function getQueueMetrics() {
  return {
    productSync: {
      waiting: await productSyncQueue.getWaitingCount(),
      active: await productSyncQueue.getActiveCount(),
      completed: await productSyncQueue.getCompletedCount(),
      failed: await productSyncQueue.getFailedCount(),
      delayed: await productSyncQueue.getDelayedCount()
    },
    inventorySync: { ... },
    orderSync: { ... },
    webhookProcessing: { ... },
    errorRecovery: { ... }
  };
}

// Setup dashboard to display queue status
// Alert if any queue has >1000 waiting jobs
// Alert if failure rate >10%
```

---

## Scalability

### Horizontal Scaling

```
Portal Vendas (Horizontal Scaling)

Load Balancer (Nginx/HAProxy)
        │
        ├─────────────┬─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
    Instance 1   Instance 2   Instance 3   Instance N
    (Next.js)    (Next.js)    (Next.js)    (Next.js)
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
    PostgreSQL (Primary)        Redis Cluster
    + Replicas                  (Queue + Cache)
        │                           │
        └─────────────┬─────────────┘
                      │
            ┌─────────┴──────────┐
            ▼                    ▼
        Shopee API          Mercado Livre API
```

### Database Optimization

```sql
-- Connection pooling
-- PgBouncer: 100 connections per instance

-- Query optimization
CREATE INDEX idx_sync_status ON marketplace_products(sync_status, marketplace);
CREATE INDEX idx_inventory_product ON marketplace_inventory(product_id, marketplace);
CREATE INDEX idx_orders_status_date ON orders(status, created_at DESC);

-- Partitioning for large tables
ALTER TABLE sync_logs PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_2024 VALUES LESS THAN (2025),
  PARTITION p_2025 VALUES LESS THAN (2026),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Replication for read-heavy operations
-- Primary: write operations
-- Replica 1: Dashboard queries
-- Replica 2: Analytics & reporting
```

### Cache Strategy

```typescript
interface CacheConfig {
  // Cache API schemas from marketplaces (5 minutes)
  MARKETPLACE_SCHEMA: 300,
  
  // Cache product data (1 minute)
  PRODUCT_DATA: 60,
  
  // Cache inventory (30 seconds - frequent updates)
  INVENTORY: 30,
  
  // Cache order summaries (2 minutes)
  ORDER_SUMMARY: 120,
  
  // Cache sync status (10 seconds)
  SYNC_STATUS: 10
}

// Use Redis with TTL
// Invalidate on write
// L1: In-memory cache (lru-cache)
// L2: Redis (distributed)
```

### Rate Limiting

```typescript
// Apply rate limiting to marketplace APIs
interface RateLimitConfig {
  shopee: {
    requestsPerSecond: 10,
    burstSize: 20
  },
  mercadolivre: {
    requestsPerSecond: 5,
    burstSize: 10
  }
}

// Token bucket algorithm
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }
    
    // Wait until token available
    await this.waitForToken();
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('ProductSyncService', () => {
  describe('mapProductToMarketplace', () => {
    it('should map Portal product to Shopee format', async () => {
      const portal = createMockProduct();
      const result = await service.mapProductToMarketplace(portal, 'shopee');
      
      expect(result.name).toBe(portal.title);
      expect(result.description_type).toBe('html');
    });
    
    it('should handle missing optional fields', async () => {
      const portal = createMockProduct({ originalPrice: undefined });
      const result = await service.mapProductToMarketplace(portal, 'mercadolivre');
      
      expect(result.original_price).toBeUndefined();
    });
  });
  
  describe('detectConflicts', () => {
    it('should detect price difference', () => {
      const local = { price: 100 };
      const remote = { price: 95 };
      
      const conflicts = service.detectConflicts(local, remote);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].field).toBe('price');
    });
  });
});
```

### Integration Tests

```typescript
describe('Marketplace Sync Integration', () => {
  it('should sync product end-to-end', async () => {
    // Create product in Portal
    const product = await createProduct({
      title: 'Test Product',
      price: 100
    });
    
    // Trigger sync
    await triggerSync(product.id);
    
    // Verify in Shopee
    const shopeeProduct = await fetchFromShopee(product.id);
    expect(shopeeProduct.name).toBe('Test Product');
    
    // Verify in Mercado Livre
    const mlProduct = await fetchFromML(product.id);
    expect(mlProduct.title).toBe('Test Product');
  });
  
  it('should handle webhook with idempotency', async () => {
    const webhook = createMockOrderWebhook();
    
    // First call
    const result1 = await handleWebhook(webhook);
    expect(result1.orderId).toBeDefined();
    
    // Second call (duplicate)
    const result2 = await handleWebhook(webhook);
    expect(result2.orderId).toBe(result1.orderId);
  });
});
```

### Load Testing

```typescript
// k6 script for load testing
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp up
    { duration: '5m', target: 100 },    // Stay at 100
    { duration: '2m', target: 200 },    // Ramp to 200
    { duration: '5m', target: 200 },    // Stay at 200
    { duration: '2m', target: 0 }       // Ramp down
  ]
};

export default function() {
  // Test product sync endpoint
  let res = http.post('http://localhost:3000/api/products/sync', {
    productIds: ['prod-1', 'prod-2', 'prod-3']
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  });
  
  sleep(1);
}
```

---

## Monitoring & Observability

### Logging

```typescript
// Structured logging
logger.info('Product sync started', {
  productId: 'prod-123',
  marketplace: 'shopee',
  timestamp: new Date().toISOString(),
  tags: ['sync', 'product']
});

logger.error('Sync failed', {
  productId: 'prod-123',
  marketplace: 'shopee',
  error: 'TIMEOUT',
  statusCode: 408,
  duration: 30000
});
```

### Metrics

```typescript
// Key metrics to track
- sync_duration_ms (histogram)
- sync_success_total (counter)
- sync_failure_total (counter)
- queue_length (gauge)
- webhook_latency_ms (histogram)
- api_error_rate (gauge)
- inventory_conflicts_total (counter)
```

### Alerts

```
Alert conditions:
- Sync success rate < 95% for 10 minutes
- Queue length > 10,000 items
- Webhook latency > 5 seconds
- Circuit breaker OPEN for any marketplace
- Unhandled errors > 10 per minute
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [x] Database schema design
- [x] API endpoints structure
- [x] Queue system setup (BullMQ + Redis)
- [x] Error handling framework

### Phase 2: Core Sync (Week 3-4)
- [ ] Product sync service
- [ ] Inventory sync service
- [ ] Token management & encryption
- [ ] Basic retry logic

### Phase 3: Order & Webhooks (Week 5-6)
- [ ] Order capture from webhooks
- [ ] Order status synchronization
- [ ] Webhook validation & processing

### Phase 4: Dashboard & Monitoring (Week 7-8)
- [ ] Sync status dashboard
- [ ] Error monitoring
- [ ] Metrics collection

### Phase 5: Advanced Features (Week 9-10)
- [ ] Conflict resolution UI
- [ ] Manual sync controls
- [ ] Configuration management

---

## Next Steps

1. **Create API Routes**: Implement endpoints based on design
2. **Setup Database**: Configure PostgreSQL with schema
3. **Initialize Queue**: Setup BullMQ with Redis
4. **Implement Services**: Code sync, order, and auth services
5. **Add Monitoring**: Setup logging and alerting
6. **Write Tests**: Unit, integration, and load tests

