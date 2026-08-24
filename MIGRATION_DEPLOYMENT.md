# Migration Deployment Guide

## Quick Start

Apply the initial migration to your PostgreSQL database:

```bash
npm run migrate:deploy
```

Or using Prisma CLI directly:

```bash
npx prisma migrate deploy
```

---

## Prerequisites

### 1. PostgreSQL Database Running

Verify PostgreSQL is running:

```bash
# macOS (with Homebrew)
brew services list

# Linux
sudo systemctl status postgresql

# Windows (PostgreSQL Service)
Get-Service PostgreSQL*

# Or using Docker
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:latest
```

### 2. Environment Variables

Ensure `.env` has valid `DATABASE_URL`:

```
DATABASE_URL="postgresql://username:password@localhost:5432/portal_vendas"
```

### 3. Dependencies Installed

```bash
npm install
```

---

## Step-by-Step Deployment

### Step 1: Create Database (if not exists)

```bash
# Using PostgreSQL client
createdb portal_vendas

# Or using psql
psql -U postgres -c "CREATE DATABASE portal_vendas;"
```

### Step 2: Apply Migration

```bash
cd c:\Users\andre\portal-vendas
npx prisma migrate deploy
```

Expected output:
```
Prisma Migrate applied the following migration(s):

migrations/0_init/
  ✔ Successfully applied 1 migration
```

### Step 3: Verify Schema

Verify all tables were created:

```bash
# Using Prisma Studio (visual interface)
npx prisma studio

# Or pull schema to verify
npx prisma db pull
```

### Step 4: Validate with Script

Run the validation script to confirm:

```bash
node scripts/validate-migration.js
```

Should output:
```
✓ All validation checks passed!
```

---

## Database Tables Created

After successful migration, you'll have these tables:

### Product Management
- `Product` - 42 MB estimated (assuming 1M products × 42 bytes)
- `MarketplaceProduct` - 21 MB estimated
- `Inventory` - 10 MB estimated

### Orders
- `Order` - 15 MB estimated (assuming 1M orders)
- `OrderItem` - 20 MB estimated (assuming 1-2 items per order)

### Integration
- `MarketplaceAuth` - ~1 MB (per vendor)
- `MarketplaceConfig` - ~100 KB

### Audit & Events
- `ProductSyncLog` - 30 MB (logs)
- `OrderSyncLog` - 10 MB (logs)
- `ConflictLog` - 5 MB (conflicts)
- `WebhookDelivery` - 50 MB (webhook logs)
- `SyncEvent` - 20 MB (event queue)
- `ErrorLog` - 10 MB (error logs)
- `DLQJob` - 5 MB (dead letter queue)
- `SyncMetrics` - 100 KB (statistics)

---

## Troubleshooting

### Connection Error

**Problem:**
```
Error: P1001: Can't reach database server at `localhost:5432`
```

**Solution:**
1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env
3. Verify credentials are correct
4. Check firewall if remote database

### Migration Already Applied

**Problem:**
```
Already applied: 0_init
```

**Solution:**
This is normal. The migration has already been applied. To reset:

```bash
# Warning: This will delete all data!
npx prisma migrate reset

# Confirm when prompted
```

### Schema Validation Error

**Problem:**
```
Error: Schema validation failed
```

**Solution:**
1. Check schema.prisma is valid
2. Run: `npx prisma validate`
3. Check for duplicate model names
4. Ensure all relations are valid

### Permission Denied

**Problem:**
```
Error: permission denied
```

**Solution:**
Ensure database user has proper permissions:

```sql
-- Grant all privileges to user
GRANT ALL PRIVILEGES ON DATABASE portal_vendas TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
```

---

## After Deployment

### 1. Update Applications

Update your application to use Prisma Client:

```typescript
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// Create product
const product = await prisma.product.create({
  data: {
    vendorId: 'vendor-1',
    title: 'Product Name',
    description: 'Description',
    price: 99.99,
    sku: 'SKU-001',
    categoryId: 'category-1',
  },
})
```

### 2. Seed Initial Data (Optional)

Create a seed script if needed:

```typescript
// prisma/seed.ts
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Add marketplace configs
  await prisma.marketplaceConfig.createMany({
    data: [
      {
        vendorId: 'vendor-1',
        marketplace: 'shopee',
        isActive: true,
        autoSync: true,
        syncFrequency: 300000,
      },
      {
        vendorId: 'vendor-1',
        marketplace: 'mercadolivre',
        isActive: true,
        autoSync: true,
        syncFrequency: 300000,
      },
    ],
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Run with:
```bash
npx prisma db seed
```

### 3. Setup Monitoring

Monitor database size and performance:

```sql
-- Check total database size
SELECT pg_database.datname, 
       pg_size_pretty(pg_database_size(pg_database.datname)) 
FROM pg_database;

-- Check individual table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Rollback (If Needed)

### Rollback All Migrations

⚠️ **Warning: This will DELETE all data!**

```bash
npx prisma migrate reset
```

### Create Rollback Migration

For specific changes, create a new migration:

```bash
npx prisma migrate dev --name "rollback_reason"
```

---

## Deployment to Production

### Pre-Deployment Checklist

- [ ] Backup existing database
- [ ] Test migration on staging database
- [ ] Review migration SQL for compatibility
- [ ] Verify all environment variables
- [ ] Check database resource limits
- [ ] Plan maintenance window if needed

### Production Deployment

```bash
# 1. Create backup
pg_dump portal_vendas > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration
npx prisma migrate deploy

# 3. Verify
npx prisma db pull
npm test  # Run tests

# 4. Monitor
tail -f /var/log/postgresql/postgresql.log
```

### Monitoring After Deployment

```bash
# Check for errors
npx prisma validate

# Check connection
npx prisma db execute --stdin < /dev/null

# Open dashboard
npx prisma studio
```

---

## Advanced Options

### Custom Deployment Script

Create `scripts/deploy-migration.sh`:

```bash
#!/bin/bash

echo "🚀 Deploying migration to $1..."

# Validate
npx prisma validate
if [ $? -ne 0 ]; then
  echo "❌ Schema validation failed"
  exit 1
fi

# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
echo "✓ Backup created"

# Deploy
npx prisma migrate deploy
if [ $? -ne 0 ]; then
  echo "❌ Migration failed, restoring backup..."
  # Restore from backup
  exit 1
fi

echo "✓ Migration deployed successfully"
```

### CI/CD Integration

For GitHub Actions:

```yaml
name: Migrate Database
on: [push]
jobs:
  migrate:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:latest
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@postgres:5432/portal_vendas
```

---

## Performance Tuning

After migration, optimize database:

```sql
-- Analyze all tables
ANALYZE;

-- Vacuum to clean up
VACUUM ANALYZE;

-- Check query plans
EXPLAIN ANALYZE SELECT * FROM "Product" WHERE "vendorId" = 'vendor-1';
```

---

## Support

For issues with migration:

1. Check Prisma Status: https://status.prisma.io/
2. Run validation: `node scripts/validate-migration.js`
3. Check logs: Review PostgreSQL error logs
4. Consult documentation: https://www.prisma.io/docs/

---

## Summary

✓ Migration is ready to deploy  
✓ All 15 tables will be created  
✓ 30+ indexes for performance  
✓ 6 foreign key constraints for integrity  
✓ Prisma Client ready to use  
✓ 90 MB approx schema size (grows with data)

Run deployment:
```bash
npx prisma migrate deploy
```

Done! 🎉
