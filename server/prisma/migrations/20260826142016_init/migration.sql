-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "trackingType" TEXT NOT NULL,
    "standardCost" REAL,
    "lowStockThreshold" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "purchaseDate" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "totalCost" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "remainingQuantity" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseBatch_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceBatchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "processedAt" TEXT NOT NULL,
    "inputQuantity" REAL NOT NULL,
    "inputCost" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessingBatch_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "PurchaseBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcessingBatch_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessingOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processingBatchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "remainingQuantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "allocatedCost" REAL NOT NULL,
    "portionSize" REAL,
    "portionCount" INTEGER,
    "outputType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "ProcessingOutput_processingBatchId_fkey" FOREIGN KEY ("processingBatchId") REFERENCES "ProcessingBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcessingOutput_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WasteRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceBatchId" TEXT,
    "processingBatchId" TEXT,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "wasteValue" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "WasteRecord_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AddOnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addOnId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    CONSTRAINT "AddOnItem_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AddOnItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "sellingDate" TEXT NOT NULL,
    "soldAt" TEXT NOT NULL,
    "totalRevenue" REAL NOT NULL,
    "totalCogs" REAL NOT NULL,
    "totalProfit" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "editedAt" TEXT,
    "voidedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitSellingPrice" REAL NOT NULL,
    "lineRevenue" REAL NOT NULL,
    "lineCogs" REAL NOT NULL,
    "lineProfit" REAL NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItemAddOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitSellingPrice" REAL NOT NULL,
    "revenue" REAL NOT NULL,
    "cogs" REAL NOT NULL,
    "lineProfit" REAL NOT NULL,
    CONSTRAINT "OrderItemAddOn_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItemAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "batchReference" TEXT,
    "quantityDelta" REAL NOT NULL,
    "movementType" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FifoAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "quantityConsumed" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "allocatedCost" REAL NOT NULL,
    CONSTRAINT "FifoAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FifoAllocation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Ingredient_category_idx" ON "Ingredient"("category");

-- CreateIndex
CREATE INDEX "PurchaseBatch_ingredientId_idx" ON "PurchaseBatch"("ingredientId");

-- CreateIndex
CREATE INDEX "PurchaseBatch_status_idx" ON "PurchaseBatch"("status");

-- CreateIndex
CREATE INDEX "PurchaseBatch_purchaseDate_idx" ON "PurchaseBatch"("purchaseDate");

-- CreateIndex
CREATE INDEX "ProcessingBatch_ingredientId_idx" ON "ProcessingBatch"("ingredientId");

-- CreateIndex
CREATE INDEX "ProcessingBatch_sourceBatchId_idx" ON "ProcessingBatch"("sourceBatchId");

-- CreateIndex
CREATE INDEX "ProcessingOutput_ingredientId_idx" ON "ProcessingOutput"("ingredientId");

-- CreateIndex
CREATE INDEX "ProcessingOutput_processingBatchId_idx" ON "ProcessingOutput"("processingBatchId");

-- CreateIndex
CREATE INDEX "ProcessingOutput_status_idx" ON "ProcessingOutput"("status");

-- CreateIndex
CREATE INDEX "WasteRecord_ingredientId_idx" ON "WasteRecord"("ingredientId");

-- CreateIndex
CREATE INDEX "WasteRecord_sourceBatchId_idx" ON "WasteRecord"("sourceBatchId");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");

-- CreateIndex
CREATE INDEX "MenuItem_ingredientId_idx" ON "MenuItem"("ingredientId");

-- CreateIndex
CREATE INDEX "AddOnItem_addOnId_idx" ON "AddOnItem"("addOnId");

-- CreateIndex
CREATE INDEX "AddOnItem_ingredientId_idx" ON "AddOnItem"("ingredientId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_sellingDate_idx" ON "Order"("sellingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Order_sellingDate_orderNumber_key" ON "Order"("sellingDate", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_menuId_idx" ON "OrderItem"("menuId");

-- CreateIndex
CREATE INDEX "OrderItemAddOn_orderItemId_idx" ON "OrderItemAddOn"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemAddOn_addOnId_idx" ON "OrderItemAddOn"("addOnId");

-- CreateIndex
CREATE INDEX "StockMovement_ingredientId_idx" ON "StockMovement"("ingredientId");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "FifoAllocation_orderId_idx" ON "FifoAllocation"("orderId");

-- CreateIndex
CREATE INDEX "FifoAllocation_ingredientId_idx" ON "FifoAllocation"("ingredientId");

-- CreateIndex
CREATE INDEX "FifoAllocation_sourceBatchId_idx" ON "FifoAllocation"("sourceBatchId");
