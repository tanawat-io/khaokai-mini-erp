// Read-side aggregations for Dashboard and Stock screens. Voided orders are always excluded
// from financial/order-count aggregates (BUSINESS_RULES.md §11, §17).

import type { Ingredient, Order, ProcessingOutput, PurchaseBatch, StockMovement } from './types';
import { getEligibleLots, totalAvailable } from './fifo';
import { weightedAverageCost } from './costing';
import { round2 } from './costing';
import { getStandardCostAvailableQuantity } from './stockCheck';

export interface DashboardTotals {
  revenue: number;
  cogs: number;
  profit: number;
  orderCount: number;
}

export function computeDashboardTotals(orders: Order[]): DashboardTotals {
  const active = orders.filter((o) => o.status === 'active');
  const revenue = round2(active.reduce((s, o) => s + o.totalRevenue, 0));
  const cogs = round2(active.reduce((s, o) => s + o.totalCogs, 0));
  return {
    revenue,
    cogs,
    profit: round2(revenue - cogs),
    orderCount: active.length,
  };
}

export interface IngredientStockSummary {
  ingredient: Ingredient;
  availableQuantity: number;
  stockValue: number;
  estimatedCost: number; // weighted-average, DISPLAY ONLY
  batchCount: number;
  isLowStock: boolean;
}

export function computeIngredientStock(
  ingredient: Ingredient,
  purchaseBatches: PurchaseBatch[],
  processingOutputs: ProcessingOutput[],
  stockMovements: StockMovement[]
): IngredientStockSummary {
  // standard_cost ingredients have no lots (fifo.ts excludes their purchase batches from
  // eligibility) — availability is derived from the movement ledger instead (BUSINESS_RULES.md
  // §8a). This is the fix for the Phase 3A gap where this previously read purchase-batch
  // remainingQuantity, which consumption never decremented for this tracking type.
  if (ingredient.trackingType === 'standard_cost') {
    const availableQuantity = getStandardCostAvailableQuantity(ingredient.id, stockMovements);
    const estimatedCost = round2(ingredient.standardCost ?? 0);
    const stockValue = round2(availableQuantity * estimatedCost);
    const isLowStock = ingredient.lowStockThreshold != null && availableQuantity < ingredient.lowStockThreshold;
    return { ingredient, availableQuantity, stockValue, estimatedCost, batchCount: 0, isLowStock };
  }

  const lots = getEligibleLots(ingredient.id, ingredient.trackingType, purchaseBatches, processingOutputs);
  const availableQuantity = round2(totalAvailable(lots));
  const stockValue = round2(lots.reduce((s, l) => s + l.remainingQuantity * l.unitCost, 0));
  const estimatedCost = round2(weightedAverageCost(ingredient.id, purchaseBatches));
  const isLowStock = ingredient.lowStockThreshold != null && availableQuantity < ingredient.lowStockThreshold;

  return {
    ingredient,
    availableQuantity,
    stockValue,
    estimatedCost,
    batchCount: lots.length,
    isLowStock,
  };
}
