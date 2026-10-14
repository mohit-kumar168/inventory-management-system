-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INVENTORY_MANAGER', 'PROCUREMENT_MANAGER', 'FULFILLMENT_STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AddressLabel" AS ENUM ('HOME', 'WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_IN', 'SHIPMENT_OUT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'RETURN_IN', 'REVERSAL');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'PARTIALLY_CONSUMED', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarehouseTransferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'RESERVED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('RESTOCK', 'DAMAGED', 'DISPOSE', 'REPAIR');

-- CreateEnum
CREATE TYPE "IdempotencyScope" AS ENUM ('CREATE_SALES_ORDER', 'CREATE_PURCHASE_ORDER', 'CREATE_PAYMENT', 'CREATE_REFUND', 'INVENTORY_ADJUSTMENT', 'WAREHOUSE_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IdempotentResourceType" AS ENUM ('SALES_ORDER', 'PURCHASE_ORDER', 'PAYMENT', 'REFUND', 'INVENTORY_ADJUSTMENT', 'WAREHOUSE_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FULFILLMENT_STAFF',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" "AddressLabel" NOT NULL DEFAULT 'OTHER',
    "recipientName" TEXT NOT NULL,
    "phone" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "productStatus" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "onHandQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "unitCost" INTEGER,
    "notes" TEXT,
    "goodsReceiptItemId" TEXT,
    "shipmentItemId" TEXT,
    "transferItemId" TEXT,
    "adjustmentItemId" TEXT,
    "returnItemId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityConsumed" INTEGER NOT NULL DEFAULT 0,
    "quantityReleased" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "adjustmentNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustment_items" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transfers" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "WarehouseTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMPTZ(6),
    "receivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "quantityDispatched" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "purchaseOrderNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "shippingAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "orderedAt" TIMESTAMPTZ(6),
    "expectedAt" TIMESTAMPTZ(6),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedById" TEXT NOT NULL,
    "notes" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityAccepted" INTEGER NOT NULL,
    "quantityRejected" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "shippingAddressId" TEXT,
    "shippingRecipientName" TEXT,
    "shippingPhone" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "shippingAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "cancellationReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "orderedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "notes" TEXT,
    "dispatchedAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "returnId" TEXT,
    "providerReference" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "eventType" TEXT NOT NULL,
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "inspectionStatus" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "quantityRestocked" INTEGER NOT NULL DEFAULT 0,
    "disposition" "ReturnDisposition",
    "restockWarehouseId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "scope" "IdempotencyScope" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resourceType" "IdempotentResourceType" NOT NULL DEFAULT 'OTHER',
    "resourceId" TEXT,
    "status" "IdempotencyRecordStatus" NOT NULL DEFAULT 'PROCESSING',
    "requestHash" TEXT,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_role_idx" ON "users"("status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_parentId_idx" ON "product_categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_productStatus_idx" ON "products"("productStatus");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_status_idx" ON "warehouses"("status");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouseId_idx" ON "inventory_balances"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_productId_warehouseId_key" ON "inventory_balances"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_warehouseId_createdAt_idx" ON "stock_movements"("productId", "warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_movementType_createdAt_idx" ON "stock_movements"("movementType", "createdAt");

-- CreateIndex
CREATE INDEX "reservations_status_expiresAt_idx" ON "reservations"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "reservations_salesOrderItemId_warehouseId_idx" ON "reservations"("salesOrderItemId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_adjustmentNo_key" ON "inventory_adjustments"("adjustmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_idempotencyKey_key" ON "inventory_adjustments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "inventory_adjustments_warehouseId_status_idx" ON "inventory_adjustments"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "inventory_adjustment_items_productId_idx" ON "inventory_adjustment_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustment_items_adjustmentId_productId_key" ON "inventory_adjustment_items"("adjustmentId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_transfers_transferNo_key" ON "warehouse_transfers"("transferNo");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_transfers_idempotencyKey_key" ON "warehouse_transfers"("idempotencyKey");

-- CreateIndex
CREATE INDEX "warehouse_transfers_sourceWarehouseId_status_idx" ON "warehouse_transfers"("sourceWarehouseId", "status");

-- CreateIndex
CREATE INDEX "warehouse_transfers_destinationWarehouseId_status_idx" ON "warehouse_transfers"("destinationWarehouseId", "status");

-- CreateIndex
CREATE INDEX "warehouse_transfer_items_productId_idx" ON "warehouse_transfer_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_transfer_items_transferId_productId_key" ON "warehouse_transfer_items"("transferId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_purchaseOrderNo_key" ON "purchase_orders"("purchaseOrderNo");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_idempotencyKey_key" ON "purchase_orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "purchase_orders"("supplierId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_warehouseId_status_idx" ON "purchase_orders"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_productId_key" ON "purchase_order_items"("purchaseOrderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_receiptNo_key" ON "goods_receipts"("receiptNo");

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseOrderId_status_idx" ON "goods_receipts"("purchaseOrderId", "status");

-- CreateIndex
CREATE INDEX "goods_receipts_warehouseId_receivedAt_idx" ON "goods_receipts"("warehouseId", "receivedAt");

-- CreateIndex
CREATE INDEX "goods_receipt_items_purchaseOrderItemId_idx" ON "goods_receipt_items"("purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_items_goodsReceiptId_purchaseOrderItemId_key" ON "goods_receipt_items"("goodsReceiptId", "purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_orderNo_key" ON "sales_orders"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_idempotencyKey_key" ON "sales_orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_createdAt_idx" ON "sales_orders"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_orders_status_createdAt_idx" ON "sales_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "sales_orders_paymentStatus_idx" ON "sales_orders"("paymentStatus");

-- CreateIndex
CREATE INDEX "sales_order_items_productId_idx" ON "sales_order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_items_salesOrderId_productId_key" ON "sales_order_items"("salesOrderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipmentNo_key" ON "shipments"("shipmentNo");

-- CreateIndex
CREATE INDEX "shipments_salesOrderId_status_idx" ON "shipments"("salesOrderId", "status");

-- CreateIndex
CREATE INDEX "shipments_warehouseId_status_idx" ON "shipments"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "shipment_items_salesOrderItemId_idx" ON "shipment_items"("salesOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_items_shipmentId_salesOrderItemId_key" ON "shipment_items"("shipmentId", "salesOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_salesOrderId_paymentStatus_idx" ON "payments"("salesOrderId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerReference_key" ON "payments"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotencyKey_key" ON "refunds"("idempotencyKey");

-- CreateIndex
CREATE INDEX "refunds_paymentId_status_idx" ON "refunds"("paymentId", "status");

-- CreateIndex
CREATE INDEX "refunds_returnId_idx" ON "refunds"("returnId");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processingStatus_receivedAt_idx" ON "payment_webhook_events"("processingStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_webhook_events_paymentId_idx" ON "payment_webhook_events"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_providerEventId_key" ON "payment_webhook_events"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "returns_returnNo_key" ON "returns"("returnNo");

-- CreateIndex
CREATE INDEX "returns_salesOrderId_status_idx" ON "returns"("salesOrderId", "status");

-- CreateIndex
CREATE INDEX "returns_customerId_createdAt_idx" ON "returns"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "return_items_salesOrderItemId_idx" ON "return_items"("salesOrderItemId");

-- CreateIndex
CREATE INDEX "return_items_restockWarehouseId_idx" ON "return_items"("restockWarehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "return_items_returnId_salesOrderItemId_key" ON "return_items"("returnId", "salesOrderItemId");

-- CreateIndex
CREATE INDEX "idempotency_records_status_expiresAt_idx" ON "idempotency_records"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_scope_idempotencyKey_key" ON "idempotency_records"("scope", "idempotencyKey");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "goods_receipt_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shipmentItemId_fkey" FOREIGN KEY ("shipmentItemId") REFERENCES "shipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transferItemId_fkey" FOREIGN KEY ("transferItemId") REFERENCES "warehouse_transfer_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_adjustmentItemId_fkey" FOREIGN KEY ("adjustmentItemId") REFERENCES "inventory_adjustment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "return_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_items" ADD CONSTRAINT "inventory_adjustment_items_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "inventory_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_items" ADD CONSTRAINT "inventory_adjustment_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "warehouse_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_restockWarehouseId_fkey" FOREIGN KEY ("restockWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
