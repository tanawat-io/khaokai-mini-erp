// Non-mutating preview of what createOrder/editOrder would actually do — used by the New
// Order / Edit Order screens to show live "estimated cost" and stock-availability feedback
// before the user confirms. Runs the SAME sequential-FIFO-over-a-shrinking-pool logic as the
// real engine (against a cloned working copy) so the preview number matches what gets
// committed on confirm, rather than a separate weighted-average guess.

import type { AddOn, FifoAllocation, Ingredient, Menu, ProcessingOutput, PurchaseBatch, StockMovement } from './types';
import { getEligibleLots, planFifoConsumption, type StockLot } from './fifo';
import { aggregateRequiredQuantities, getStandardCostAvailableQuantity, type OrderDraft, type StockShortage } from './stockCheck';
import { round2 } from './costing';

export interface PreviewLineResult {
  lineIndex: number;
  menuRevenue: number;
  menuCogs: number;
  addOnResults: Array<{ addOnId: string; revenue: number; cogs: number }>;
}

export interface OrderPreview {
  ok: boolean;
  shortages: StockShortage[];
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  lines: PreviewLineResult[];
}

function cloneLotPool(
  ingredientIds: string[],
  ingredientsById: Map<string, Ingredient>,
  purchaseBatches: PurchaseBatch[],
  processingOutputs: ProcessingOutput[],
  reverseFirst: FifoAllocation[] = []
): Map<string, StockLot[]> {
  const pool = new Map<string, StockLot[]>();
  for (const id of ingredientIds) {
    const trackingType = ingredientsById.get(id)?.trackingType ?? 'raw_by_weight';
    pool.set(
      id,
      getEligibleLots(id, trackingType, purchaseBatches, processingOutputs).map((l) => ({ ...l }))
    );
  }
  // Simulate reversing a set of allocations (used when previewing an EDIT: the real
  // editOrder engine reverses the order's own prior consumption before re-checking
  // availability, so the preview must do the same or it will look falsely short).
  for (const alloc of reverseFirst) {
    const lots = pool.get(alloc.ingredientId);
    if (!lots) continue;
    const lot = lots.find((l) => l.sourceBatchId === alloc.sourceBatchId);
    if (lot) {
      lot.remainingQuantity = round2(lot.remainingQuantity + alloc.quantityConsumed);
    } else {
      // The lot is no longer eligible in the real data (e.g. status flipped) — reintroduce
      // it as a virtual lot so the reversed quantity is still counted as available.
      lots.push({
        sourceType: alloc.sourceType,
        sourceBatchId: alloc.sourceBatchId,
        ingredientId: alloc.ingredientId,
        date: '0000-00-00', // oldest possible — matches FIFO's "already own this stock" intent
        unitCost: alloc.unitCost,
        remainingQuantity: alloc.quantityConsumed,
      });
      lots.sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  return pool;
}

function consumeFromPool(
  ingredientId: string,
  qty: number,
  pool: Map<string, StockLot[]>,
  ingredientsById: Map<string, Ingredient>
): number {
  if (qty <= 0) return 0;
  const ingredient = ingredientsById.get(ingredientId);
  if (ingredient?.trackingType === 'standard_cost') {
    return round2(qty * (ingredient.standardCost ?? 0));
  }
  const lots = pool.get(ingredientId) ?? [];
  const result = planFifoConsumption(qty, lots);
  for (const alloc of result.allocations) {
    const lot = lots.find((l) => l.sourceBatchId === alloc.sourceBatchId);
    if (lot) lot.remainingQuantity = round2(lot.remainingQuantity - alloc.quantity);
  }
  return round2(result.totalCost);
}

/**
 * Always safe to call on any draft (including incomplete ones); never mutates real data.
 *
 * `reverseFirst` (optional): when previewing an EDIT to an existing order, pass that order's
 * current `fifoAllocations` so the preview simulates the same "reverse old consumption, then
 * check availability" sequence the real editOrder engine performs — otherwise the preview
 * would report the order's own already-consumed stock as unavailable to itself.
 *
 * `reverseFirstStandardCost` (optional): the standard_cost analog of `reverseFirst` — for an
 * order being edited, the quantity to add back per ingredient (i.e. `-net` of that order's
 * standard_cost stock_movements, BUSINESS_RULES.md §8a) before checking availability.
 */
export function previewOrder(
  draft: OrderDraft,
  menus: Menu[],
  addOns: AddOn[],
  ingredients: Ingredient[],
  purchaseBatches: PurchaseBatch[],
  processingOutputs: ProcessingOutput[],
  stockMovements: StockMovement[],
  reverseFirst: FifoAllocation[] = [],
  reverseFirstStandardCost: Map<string, number> = new Map()
): OrderPreview {
  const menusById = new Map(menus.map((m) => [m.id, m]));
  const addOnsById = new Map(addOns.map((a) => [a.id, a]));
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));

  const required = aggregateRequiredQuantities(draft, menusById, addOnsById, ingredientsById);
  const ingredientIds = new Set([...required.keys(), ...reverseFirst.map((a) => a.ingredientId)]);
  const pool = cloneLotPool([...ingredientIds], ingredientsById, purchaseBatches, processingOutputs, reverseFirst);

  const shortages: StockShortage[] = [];
  for (const [ingredientId, requiredQty] of required.entries()) {
    const trackingType = ingredientsById.get(ingredientId)?.trackingType ?? 'raw_by_weight';
    const available =
      trackingType === 'standard_cost'
        ? round2(getStandardCostAvailableQuantity(ingredientId, stockMovements) + (reverseFirstStandardCost.get(ingredientId) ?? 0))
        : round2((pool.get(ingredientId) ?? []).reduce((s, l) => s + l.remainingQuantity, 0));
    if (available < requiredQty - 1e-9) {
      shortages.push({ ingredientId, required: requiredQty, available, shortage: round2(requiredQty - available) });
    }
  }
  const check = { ok: shortages.length === 0, shortages };

  const lines: PreviewLineResult[] = [];
  let totalRevenue = 0;
  let totalCogs = 0;

  draft.lines.forEach((line, lineIndex) => {
    const menu = menusById.get(line.menuId);
    if (!menu) {
      lines.push({ lineIndex, menuRevenue: 0, menuCogs: 0, addOnResults: [] });
      return;
    }
    let menuCogs = 0;
    for (const item of menu.recipe) {
      menuCogs += consumeFromPool(item.ingredientId, item.quantity * line.quantity, pool, ingredientsById);
    }
    const menuRevenue = round2(line.unitSellingPrice * line.quantity);

    const addOnResults = line.addOns.map((addOnLine) => {
      const addOn = addOnsById.get(addOnLine.addOnId);
      if (!addOn) return { addOnId: addOnLine.addOnId, revenue: 0, cogs: 0 };
      let cogs = 0;
      for (const item of addOn.recipe) {
        cogs += consumeFromPool(item.ingredientId, item.quantity * addOnLine.quantity, pool, ingredientsById);
      }
      return { addOnId: addOn.id, revenue: round2(addOn.sellingPrice * addOnLine.quantity), cogs: round2(cogs) };
    });

    totalRevenue += menuRevenue + addOnResults.reduce((s, a) => s + a.revenue, 0);
    totalCogs += menuCogs + addOnResults.reduce((s, a) => s + a.cogs, 0);

    lines.push({ lineIndex, menuRevenue, menuCogs: round2(menuCogs), addOnResults });
  });

  return {
    ok: check.ok,
    shortages: check.shortages,
    totalRevenue: round2(totalRevenue),
    totalCogs: round2(totalCogs),
    totalProfit: round2(totalRevenue - totalCogs),
    lines,
  };
}
