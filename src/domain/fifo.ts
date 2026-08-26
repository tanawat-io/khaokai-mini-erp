// FIFO stock-consumption engine. Pure functions — no repository mutation here.
// BUSINESS_RULES.md §8, CALCULATION_ENGINE.md §6 (input-gram basis), §8 (FIFO).

import type { PurchaseBatch, ProcessingOutput, TrackingType } from './types';

export interface StockLot {
  sourceType: 'purchase_batch' | 'processing_output';
  sourceBatchId: string;
  ingredientId: string;
  date: string; // purchaseDate or createdAt — FIFO ordering key
  unitCost: number;
  remainingQuantity: number;
}

export interface LotAllocation {
  sourceType: 'purchase_batch' | 'processing_output';
  sourceBatchId: string;
  quantity: number;
  unitCost: number;
  cost: number;
}

export interface FifoResult {
  allocations: LotAllocation[];
  totalCost: number;
  fulfilled: boolean;
  shortfall: number; // 0 if fulfilled
}

/**
 * Eligible lots for an ingredient: status=active AND remainingQuantity>0, spanning both
 * purchase batches and processing outputs (BUSINESS_RULES.md §8). Sorted oldest-first.
 * V1 has no expiration concept — eligibility is status + remaining quantity only.
 *
 * For `processed_batch` ingredients (DATABASE.md §5), raw purchase batches are NOT
 * FIFO-eligible on their own — that tracking type "must go through Processing before it
 * becomes consumable stock." Only their ProcessingOutput rows count as available/consumable;
 * the raw purchase batch remains visible only as processing input, never orderable directly.
 *
 * For `standard_cost` ingredients (BUSINESS_RULES.md §8a), purchase batches are still created
 * (price history), but they are NOT FIFO-eligible either — that tracking type opts out of
 * lot-level tracking entirely. Its available quantity is derived from stock movements instead
 * (see stockCheck.ts), never from summing lot remaining quantity.
 */
export function getEligibleLots(
  ingredientId: string,
  trackingType: TrackingType,
  purchaseBatches: PurchaseBatch[],
  processingOutputs: ProcessingOutput[]
): StockLot[] {
  const fromPurchases: StockLot[] =
    trackingType === 'processed_batch' || trackingType === 'standard_cost'
      ? []
      : purchaseBatches
          .filter((b) => b.ingredientId === ingredientId && b.status === 'active' && b.remainingQuantity > 0)
          .map((b) => ({
            sourceType: 'purchase_batch' as const,
            sourceBatchId: b.id,
            ingredientId: b.ingredientId,
            date: b.purchaseDate,
            unitCost: b.unitCost,
            remainingQuantity: b.remainingQuantity,
          }));

  const fromProcessing: StockLot[] = processingOutputs
    .filter((o) => o.ingredientId === ingredientId && o.status === 'active' && o.remainingQuantity > 0)
    .map((o) => ({
      sourceType: 'processing_output',
      sourceBatchId: o.id,
      ingredientId: o.ingredientId,
      date: o.createdAt,
      unitCost: o.unitCost,
      remainingQuantity: o.remainingQuantity,
    }));

  return [...fromPurchases, ...fromProcessing].sort((a, b) => a.date.localeCompare(b.date));
}

export function totalAvailable(lots: StockLot[]): number {
  return lots.reduce((sum, l) => sum + l.remainingQuantity, 0);
}

/**
 * Plans FIFO consumption of `requiredQty` from a lot list. Does NOT mutate `lots` —
 * returns allocations for the caller to commit. If lots run out early, `fulfilled=false`
 * and `shortfall` reports the unmet amount (still returns partial allocations for context).
 */
export function planFifoConsumption(requiredQty: number, lots: StockLot[]): FifoResult {
  const allocations: LotAllocation[] = [];
  let remaining = requiredQty;
  let totalCost = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.remainingQuantity, remaining);
    if (take <= 0) continue;
    const cost = take * lot.unitCost;
    allocations.push({ sourceType: lot.sourceType, sourceBatchId: lot.sourceBatchId, quantity: take, unitCost: lot.unitCost, cost });
    totalCost += cost;
    remaining -= take;
  }

  return {
    allocations,
    totalCost,
    fulfilled: remaining <= 1e-9,
    shortfall: Math.max(0, remaining),
  };
}
