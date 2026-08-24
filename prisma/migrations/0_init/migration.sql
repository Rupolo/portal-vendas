-- CreateTable Product
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION,
    "images" JSONB NOT NULL DEFAULT '[]',
    "categoryId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "weight" DOUBLE PRECISION,
    "dimensions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketplaceProduct
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION,
    "images" JSONB NOT NULL DEFAULT '[]',
    "categoryId" TEXT NOT NULL,
    "marketplaceCategoryId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable Inventory
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "shopeeQuantity" INTEGER NOT NULL DEFAULT 0,
    "mercadolivreQuantity" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketplaceAuth
CREATE TABLE "MarketplaceAuth" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenSalt" TEXT NOT NULL,
    "accessTokenAuthTag" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "scope" JSONB DEFAULT '[]',
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketplaceConfig
CREATE TABLE "MarketplaceConfig" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "syncFrequency" INTEGER NOT NULL DEFAULT 300000,
    "conflictStrategy" TEXT NOT NULL DEFAULT 'latest',
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerDocument" TEXT,
    "shippingAddress" JSONB NOT NULL,
    "billingAddress" JSONB,
    "paymentMethod" TEXT,
    "trackingNumber" TEXT,
    "estimatedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "isViewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable OrderItem
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "remoteProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "attributes" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProductSyncLog
CREATE TABLE "ProductSyncLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "errorDetails" JSONB,
    "duration" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable OrderSyncLog
CREATE TABLE "OrderSyncLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorDetails" JSONB,
    "duration" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable ConflictLog
CREATE TABLE "ConflictLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "localValue" TEXT NOT NULL,
    "remoteValue" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "resolvedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "ConflictLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable WebhookDelivery
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deliveryAttempt" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable SyncEvent
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "marketplace" TEXT,
    "vendorId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable DLQJob
CREATE TABLE "DLQJob" (
    "id" TEXT NOT NULL,
    "originalJobId" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "errorStack" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 1,
    "lastFailureAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DLQJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable ErrorLog
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "marketplace" TEXT,
    "classification" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "recoverable" BOOLEAN NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "alertedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable SyncMetrics
CREATE TABLE "SyncMetrics" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalSyncs" INTEGER NOT NULL,
    "successfulSyncs" INTEGER NOT NULL,
    "failedSyncs" INTEGER NOT NULL,
    "averageDuration" DOUBLE PRECISION NOT NULL,
    "maxDuration" INTEGER NOT NULL,
    "minDuration" INTEGER NOT NULL,
    "productsSynced" INTEGER NOT NULL,
    "ordersCaptured" INTEGER NOT NULL,
    "conflictsDetected" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Product_vendorId_idx
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex Product_sku_idx
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex Product_createdAt_idx
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex MarketplaceProduct_vendorId_idx
CREATE INDEX "MarketplaceProduct_vendorId_idx" ON "MarketplaceProduct"("vendorId");

-- CreateIndex MarketplaceProduct_productId_idx
CREATE INDEX "MarketplaceProduct_productId_idx" ON "MarketplaceProduct"("productId");

-- CreateIndex MarketplaceProduct_marketplace_idx
CREATE INDEX "MarketplaceProduct_marketplace_idx" ON "MarketplaceProduct"("marketplace");

-- CreateIndex MarketplaceProduct_createdAt_idx
CREATE INDEX "MarketplaceProduct_createdAt_idx" ON "MarketplaceProduct"("createdAt");

-- CreateIndex MarketplaceProduct_remoteId_marketplace_vendorId_key
CREATE UNIQUE INDEX "MarketplaceProduct_remoteId_marketplace_vendorId_key" ON "MarketplaceProduct"("remoteId", "marketplace", "vendorId");

-- CreateIndex Inventory_vendorId_idx
CREATE INDEX "Inventory_vendorId_idx" ON "Inventory"("vendorId");

-- CreateIndex Inventory_lastSyncedAt_idx
CREATE INDEX "Inventory_lastSyncedAt_idx" ON "Inventory"("lastSyncedAt");

-- CreateIndex Inventory_productId_key
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- CreateIndex MarketplaceAuth_vendorId_marketplace_key
CREATE UNIQUE INDEX "MarketplaceAuth_vendorId_marketplace_key" ON "MarketplaceAuth"("vendorId", "marketplace");

-- CreateIndex MarketplaceAuth_vendorId_idx
CREATE INDEX "MarketplaceAuth_vendorId_idx" ON "MarketplaceAuth"("vendorId");

-- CreateIndex MarketplaceAuth_marketplace_idx
CREATE INDEX "MarketplaceAuth_marketplace_idx" ON "MarketplaceAuth"("marketplace");

-- CreateIndex MarketplaceAuth_expiresAt_idx
CREATE INDEX "MarketplaceAuth_expiresAt_idx" ON "MarketplaceAuth"("expiresAt");

-- CreateIndex MarketplaceConfig_vendorId_marketplace_key
CREATE UNIQUE INDEX "MarketplaceConfig_vendorId_marketplace_key" ON "MarketplaceConfig"("vendorId", "marketplace");

-- CreateIndex MarketplaceConfig_vendorId_idx
CREATE INDEX "MarketplaceConfig_vendorId_idx" ON "MarketplaceConfig"("vendorId");

-- CreateIndex Order_vendorId_idx
CREATE INDEX "Order_vendorId_idx" ON "Order"("vendorId");

-- CreateIndex Order_marketplace_idx
CREATE INDEX "Order_marketplace_idx" ON "Order"("marketplace");

-- CreateIndex Order_status_idx
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex Order_createdAt_idx
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex Order_remoteId_marketplace_vendorId_key
CREATE UNIQUE INDEX "Order_remoteId_marketplace_vendorId_key" ON "Order"("remoteId", "marketplace", "vendorId");

-- CreateIndex OrderItem_orderId_idx
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex OrderItem_productId_idx
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex ProductSyncLog_vendorId_idx
CREATE INDEX "ProductSyncLog_vendorId_idx" ON "ProductSyncLog"("vendorId");

-- CreateIndex ProductSyncLog_productId_idx
CREATE INDEX "ProductSyncLog_productId_idx" ON "ProductSyncLog"("productId");

-- CreateIndex ProductSyncLog_marketplace_idx
CREATE INDEX "ProductSyncLog_marketplace_idx" ON "ProductSyncLog"("marketplace");

-- CreateIndex ProductSyncLog_status_idx
CREATE INDEX "ProductSyncLog_status_idx" ON "ProductSyncLog"("status");

-- CreateIndex ProductSyncLog_createdAt_idx
CREATE INDEX "ProductSyncLog_createdAt_idx" ON "ProductSyncLog"("createdAt");

-- CreateIndex OrderSyncLog_vendorId_idx
CREATE INDEX "OrderSyncLog_vendorId_idx" ON "OrderSyncLog"("vendorId");

-- CreateIndex OrderSyncLog_orderId_idx
CREATE INDEX "OrderSyncLog_orderId_idx" ON "OrderSyncLog"("orderId");

-- CreateIndex OrderSyncLog_marketplace_idx
CREATE INDEX "OrderSyncLog_marketplace_idx" ON "OrderSyncLog"("marketplace");

-- CreateIndex OrderSyncLog_status_idx
CREATE INDEX "OrderSyncLog_status_idx" ON "OrderSyncLog"("status");

-- CreateIndex OrderSyncLog_createdAt_idx
CREATE INDEX "OrderSyncLog_createdAt_idx" ON "OrderSyncLog"("createdAt");

-- CreateIndex ConflictLog_vendorId_idx
CREATE INDEX "ConflictLog_vendorId_idx" ON "ConflictLog"("vendorId");

-- CreateIndex ConflictLog_entityId_idx
CREATE INDEX "ConflictLog_entityId_idx" ON "ConflictLog"("entityId");

-- CreateIndex ConflictLog_marketplace_idx
CREATE INDEX "ConflictLog_marketplace_idx" ON "ConflictLog"("marketplace");

-- CreateIndex ConflictLog_createdAt_idx
CREATE INDEX "ConflictLog_createdAt_idx" ON "ConflictLog"("createdAt");

-- CreateIndex WebhookDelivery_vendorId_idx
CREATE INDEX "WebhookDelivery_vendorId_idx" ON "WebhookDelivery"("vendorId");

-- CreateIndex WebhookDelivery_marketplace_idx
CREATE INDEX "WebhookDelivery_marketplace_idx" ON "WebhookDelivery"("marketplace");

-- CreateIndex WebhookDelivery_status_idx
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- CreateIndex WebhookDelivery_createdAt_idx
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- CreateIndex WebhookDelivery_webhookId_marketplace_vendorId_key
CREATE UNIQUE INDEX "WebhookDelivery_webhookId_marketplace_vendorId_key" ON "WebhookDelivery"("webhookId", "marketplace", "vendorId");

-- CreateIndex SyncEvent_vendorId_idx
CREATE INDEX "SyncEvent_vendorId_idx" ON "SyncEvent"("vendorId");

-- CreateIndex SyncEvent_status_idx
CREATE INDEX "SyncEvent_status_idx" ON "SyncEvent"("status");

-- CreateIndex SyncEvent_createdAt_idx
CREATE INDEX "SyncEvent_createdAt_idx" ON "SyncEvent"("createdAt");

-- CreateIndex DLQJob_queue_idx
CREATE INDEX "DLQJob_queue_idx" ON "DLQJob"("queue");

-- CreateIndex DLQJob_vendorId_idx
CREATE INDEX "DLQJob_vendorId_idx" ON "DLQJob"("vendorId");

-- CreateIndex DLQJob_createdAt_idx
CREATE INDEX "DLQJob_createdAt_idx" ON "DLQJob"("createdAt");

-- CreateIndex ErrorLog_vendorId_idx
CREATE INDEX "ErrorLog_vendorId_idx" ON "ErrorLog"("vendorId");

-- CreateIndex ErrorLog_classification_idx
CREATE INDEX "ErrorLog_classification_idx" ON "ErrorLog"("classification");

-- CreateIndex ErrorLog_createdAt_idx
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex SyncMetrics_date_idx
CREATE INDEX "SyncMetrics_date_idx" ON "SyncMetrics"("date");

-- CreateIndex SyncMetrics_vendorId_marketplace_date_key
CREATE UNIQUE INDEX "SyncMetrics_vendorId_marketplace_date_key" ON "SyncMetrics"("vendorId", "marketplace", "date");

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSyncLog" ADD CONSTRAINT "ProductSyncLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSyncLog" ADD CONSTRAINT "OrderSyncLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
