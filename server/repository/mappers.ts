// Prisma row -> domain type conversions. Domain types (src/domain/types.ts) use `undefined` for
// absent optional fields and carry no createdAt/updatedAt audit columns (see schema.prisma
// header note) — these mappers are the one place that difference is bridged.

import type {
  Ingredient,
  PurchaseBatch,
  ProcessingBatch,
  ProcessingOutput,
  WasteRecord,
  Menu,
  AddOn,
  Order,
  OrderItemLine,
  OrderItemAddOnLine,
  FifoAllocation,
  StockMovement,
  Store,
} from '../../src/domain/types';

export function toIngredient(row: any): Ingredient {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    baseUnit: row.baseUnit,
    trackingType: row.trackingType,
    standardCost: row.standardCost ?? undefined,
    lowStockThreshold: row.lowStockThreshold ?? undefined,
    active: row.active,
  };
}

export function toPurchaseBatch(row: any): PurchaseBatch {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    purchaseDate: row.purchaseDate,
    quantity: row.quantity,
    unit: row.unit,
    totalCost: row.totalCost,
    unitCost: row.unitCost,
    remainingQuantity: row.remainingQuantity,
    status: row.status,
    reference: row.reference ?? undefined,
  };
}

export function toProcessingBatch(row: any): ProcessingBatch {
  return {
    id: row.id,
    sourceBatchId: row.sourceBatchId,
    ingredientId: row.ingredientId,
    processedAt: row.processedAt,
    inputQuantity: row.inputQuantity,
    inputCost: row.inputCost,
    status: row.status,
  };
}

export function toProcessingOutput(row: any): ProcessingOutput {
  return {
    id: row.id,
    processingBatchId: row.processingBatchId,
    ingredientId: row.ingredientId,
    quantity: row.quantity,
    remainingQuantity: row.remainingQuantity,
    unitCost: row.unitCost,
    allocatedCost: row.allocatedCost,
    portionSize: row.portionSize ?? undefined,
    portionCount: row.portionCount ?? undefined,
    outputType: row.outputType,
    createdAt: row.createdAt,
    status: row.status,
  };
}

export function toWasteRecord(row: any): WasteRecord {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    sourceType: row.sourceType,
    sourceBatchId: row.sourceBatchId ?? undefined,
    processingBatchId: row.processingBatchId ?? undefined,
    quantity: row.quantity,
    unitCost: row.unitCost,
    wasteValue: row.wasteValue,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export function toMenu(row: any): Menu {
  return {
    id: row.id,
    name: row.name,
    sellingPrice: row.sellingPrice,
    recipe: (row.recipe ?? []).map((r: any) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
    active: row.active,
  };
}

export function toAddOn(row: any): AddOn {
  return {
    id: row.id,
    name: row.name,
    sellingPrice: row.sellingPrice,
    recipe: (row.recipe ?? []).map((r: any) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
    active: row.active,
  };
}

export function toFifoAllocation(row: any): FifoAllocation {
  return {
    id: row.id,
    orderId: row.orderId,
    ingredientId: row.ingredientId,
    sourceType: row.sourceType,
    sourceBatchId: row.sourceBatchId,
    quantityConsumed: row.quantityConsumed,
    unitCost: row.unitCost,
    allocatedCost: row.allocatedCost,
  };
}

export function toStockMovement(row: any): StockMovement {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    sourceType: row.sourceType,
    batchReference: row.batchReference ?? undefined,
    quantityDelta: row.quantityDelta,
    movementType: row.movementType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt,
  };
}

export function toOrder(row: any): Order {
  const items: OrderItemLine[] = (row.items ?? []).map((it: any) => ({
    id: it.id,
    menuId: it.menuId,
    quantity: it.quantity,
    unitSellingPrice: it.unitSellingPrice,
    lineRevenue: it.lineRevenue,
    lineCogs: it.lineCogs,
    lineProfit: it.lineProfit,
    addOns: (it.addOns ?? []).map(
      (a: any): OrderItemAddOnLine => ({
        addOnId: a.addOnId,
        quantity: a.quantity,
        unitSellingPrice: a.unitSellingPrice,
        revenue: a.revenue,
        cogs: a.cogs,
        lineProfit: a.lineProfit,
      })
    ),
  }));

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    sellingDate: row.sellingDate,
    soldAt: row.soldAt,
    items,
    totalRevenue: row.totalRevenue,
    totalCogs: row.totalCogs,
    totalProfit: row.totalProfit,
    status: row.status,
    fifoAllocations: (row.fifoAllocations ?? []).map(toFifoAllocation),
    editedAt: row.editedAt ?? undefined,
    voidedAt: row.voidedAt ?? undefined,
  };
}

export function toStore(row: any): Store {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    setupComplete: row.setupComplete,
  };
}

export const orderInclude = {
  items: { include: { addOns: true } },
  fifoAllocations: true,
} as const;
