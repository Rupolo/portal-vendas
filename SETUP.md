# Portal Vendas - Setup Guide

## Overview

Portal Vendas is a centralized e-commerce platform for managing products and orders across multiple marketplaces (Shopee and Mercado Livre) with real-time synchronization.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm or yarn

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your:
- Database credentials
- Redis connection details
- Marketplace API keys and secrets
- Encryption secret

### 3. Database Setup

Initialize PostgreSQL database:

```bash
# Create database
createdb portal_vendas

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# (Optional) Seed with sample data
npx prisma db seed
```

### 4. Redis Setup

Start Redis (if not running):

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7

# Or if installed locally
redis-server
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
portal-vendas/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/             # API routes and webhooks
│   │   │   ├── marketplace/auth/   # Marketplace authentication
│   │   │   ├── webhooks/           # Webhook handlers
│   │   │   ├── health/             # Health check
│   │   │   └── ...
│   │   ├── carrinho/        # Shopping cart page
│   │   ├── produto/         # Product detail page
│   │   └── page.tsx         # Home page
│   │
│   ├── lib/
│   │   ├── config.ts        # Centralized configuration
│   │   ├── cache.ts         # Redis cache layer
│   │   ├── queue.ts         # BullMQ queue factory
│   │   ├── types/           # TypeScript type definitions
│   │   │   ├── marketplace.types.ts
│   │   │   ├── product.types.ts
│   │   │   ├── order.types.ts
│   │   │   ├── auth.types.ts
│   │   │   ├── sync.types.ts
│   │   │   └── error.types.ts
│   │   │
│   │   └── services/        # Business logic services
│   │       ├── auth.service.ts             # Token management
│   │       ├── webhook-validator.service.ts # Webhook validation
│   │       ├── error-handler.service.ts     # Error handling & retry
│   │       ├── rate-limiter.service.ts      # Rate limiting
│   │       ├── inventory.service.ts         # Inventory management
│   │       └── index.ts
│   │
│   ├── components/          # React components
│   └── data/                # Static data
│
├── prisma/
│   └── schema.prisma        # Database schema
│
├── public/                  # Static assets
├── .env.example             # Environment variables template
├── tsconfig.json            # TypeScript configuration
├── next.config.ts           # Next.js configuration
└── package.json             # Dependencies and scripts
```

## Database Schema

The system uses PostgreSQL with the following main tables:

### Core Tables

- **Product**: Portal products with metadata
- **MarketplaceProduct**: Product mappings to marketplace listings
- **Inventory**: Stock levels across marketplaces
- **Order**: Customer orders from marketplaces
- **OrderItem**: Individual items in orders

### Integration Tables

- **MarketplaceAuth**: Encrypted credentials for marketplace APIs
- **MarketplaceConfig**: Configuration per marketplace per vendor
- **WebhookDelivery**: Webhook event tracking and retry logic
- **SyncEvent**: Sync operation tracking

### Audit Tables

- **ProductSyncLog**: Product synchronization history
- **OrderSyncLog**: Order synchronization history
- **ConflictLog**: Data conflict tracking and resolution
- **ErrorLog**: Error tracking and classification
- **SyncMetrics**: Performance metrics per marketplace

## Key Services

### AuthService
Handles secure storage and validation of marketplace tokens using AES-256-GCM encryption.

```typescript
import { authService } from '@/lib/services';

// Store credentials securely
await authService.storeMarketplaceCredentials(
  vendorId,
  'shopee',
  accessToken,
  refreshToken,
  expiresAt
);

// Validate token
const result = authService.validateTokenResult(credentials);
```

### WebhookValidatorService
Validates webhook signatures from marketplaces using HMAC-SHA256.

```typescript
import { webhookValidatorService } from '@/lib/services';

// Validate webhook
const validation = webhookValidatorService.validateWebhook('shopee', {
  body,
  signature,
  timestamp,
}, { webhookSecret });
```

### ErrorHandlerService
Classifies errors and implements retry logic with exponential backoff and circuit breaker pattern.

```typescript
import { errorHandlerService } from '@/lib/services';

// Retry with backoff
await errorHandlerService.retryWithBackoff(
  () => someAsyncOperation(),
  { maxRetries: 5, baseDelay: 5000 }
);

// Use circuit breaker
await errorHandlerService.executeWithCircuitBreaker(
  'marketplace-api',
  () => callMarketplaceAPI()
);
```

### RateLimiterService
Implements token bucket algorithm for rate limiting webhooks (100 req/min per marketplace).

```typescript
import { rateLimiterService } from '@/lib/services';

// Check rate limit
const status = rateLimiterService.isMarketplaceAllowed('shopee');
if (!status.allowed) {
  // Return 429 Too Many Requests
}
```

### InventoryService
Manages product inventory with atomic operations and distributed locking.

```typescript
import { inventoryService } from '@/lib/services';

// Update inventory
await inventoryService.updateInventory(productId, quantity);

// Reserve for order
const result = await inventoryService.reserveInventory(productId, quantity);

// Get available quantity
const available = await inventoryService.getAvailableQuantity(productId);
```

## Queue System (BullMQ)

Five main queues handle async processing:

1. **productSync** - Product synchronization to marketplaces
2. **inventorySync** - Inventory updates
3. **orderSync** - Order capture and processing
4. **webhookProcessing** - Webhook event handling
5. **errorRecovery** - Recovery of failed operations

### Adding Jobs to Queue

```typescript
import { getQueue } from '@/lib/queue';

const queue = getQueue('productSync');
await queue.add('sync-job', {
  productId: '123',
  marketplaces: ['shopee', 'mercadolivre']
});
```

## API Endpoints

### Marketplace Authentication

- `POST /api/marketplace/auth/connect` - Connect marketplace account
- `DELETE /api/marketplace/auth/:marketplace?vendorId=X` - Disconnect marketplace
- `POST /api/marketplace/auth/:marketplace` - Refresh token

### Webhooks

- `POST /api/webhooks/order?marketplace=shopee` - Receive order webhooks

### Health & Monitoring

- `GET /api/health` - System health check

## Development Tasks

Key implementation phases:

- [x] Phase 1: Infrastructure Setup
  - [x] Directory structure and config
  - [x] PostgreSQL schema
  - [x] Redis and BullMQ
  - [x] Cache layer

- [x] Phase 2: Auth & Security
  - [x] Token vault with encryption
  - [x] Webhook validation
  - [x] Rate limiting
  - [x] Error handling

- [ ] Phase 3: Product Sync
- [ ] Phase 4: Inventory Management
- [ ] Phase 5: Order Capture
- [ ] Phase 6: Conflict Resolution
- [ ] Phase 7: Dashboard & Monitoring
- [ ] Phase 8-10: Additional features and testing

## Testing

Run tests with:

```bash
npm run test          # Unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Environment Variables

Ensure all environment variables from `.env.example` are set on your production server.

### Database Migrations

```bash
npx prisma migrate deploy
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Queue Monitoring

Check Redis queue status:

```bash
# Using redis-cli
redis-cli
> KEYS queue:*
> LLEN queue:productSync
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check connection
psql postgresql://user:password@localhost:5432/portal_vendas

# View connection string from environment
echo $DATABASE_URL
```

### Redis Connection Issues

```bash
# Test connection
redis-cli ping
# Should return: PONG
```

### Prisma Client Generation

```bash
# Regenerate Prisma client
npx prisma generate

# Show Prisma status
npx prisma info
```

## Support

For issues or questions, refer to:
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Shopee Partner API](https://open.shopee.com)
- [Mercado Livre Developers](https://developers.mercadolibre.com.br)
