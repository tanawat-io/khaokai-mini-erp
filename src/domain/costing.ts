// Costing rules that are NOT FIFO: weighted-average (display-only) and processing cost allocation.
// CALCULATION_ENGINE.md §4 (weighted-average, display/estimate only — never actual COGS),
// §6 (processing cost allocation, input-gram basis).

import type { PurchaseBatch } from './types';

/**
 * Weighted-average cost across an ingredient's purchase batches. DISPLAY / ESTIMATE ONLY —
 * never used for actual order-time COGS (that is always FIFO). Used for e.g. the Menu list's
 * "current estimated cost" before any order has consumed stock.
 */
export function weightedAverageCost(ingredientId: string, purchaseBatches: PurchaseBatch[]): number {
  const batches = purchaseBatches.filter((b) => b.ingredientId === ingredientId && b.status !== 'void');
  const totalValue = batches.reduce((sum, b) => sum + b.totalCost, 0);
  const totalQty = batches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalQty === 0) return 0;
  return totalValue / totalQty;
}

export interface ProcessingOutputGroup {
  portionSize: number;
  portionCount: number;
}

export interface ProcessingAllocationResult {
  unitCost: number; // cost per gram (input-gram basis)
  outputs: Array<ProcessingOutputGroup & { quantity: number; allocatedCost: number }>;
  wasteQuantity: number;
  wasteCost: number;
  totalAllocated: number; // should equal inputCost, subject to rounding
}

/**
 * Allocates a processing batch's input cost across its outputs and waste on an
 * INPUT-GRAM basis (CALCULATION_ENGINE.md §6, approved design decision): every gram of
 * input — usable output and waste alike — carries the same per-gram cost. Waste is a
 * real, recorded loss (not absorbed into output cost).
 */
export function allocateProcessingCost(
  inputQuantity: number,
  inputCost: number,
  outputGroups: ProcessingOutputGroup[],
  wasteQuantity: number
): ProcessingAllocationResult {
  const unitCost = inputCost / inputQuantity;
  const outputs = outputGroups.map((g) => {
    const quantity = g.portionSize * g.portionCount;
    return { ...g, quantity, allocatedCost: round2(quantity * unitCost) };
  });
  const wasteCost = round2(wasteQuantity * unitCost);
  const totalAllocated = round2(outputs.reduce((s, o) => s + o.allocatedCost, 0) + wasteCost);
  return { unitCost, outputs, wasteQuantity, wasteCost, totalAllocated };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
