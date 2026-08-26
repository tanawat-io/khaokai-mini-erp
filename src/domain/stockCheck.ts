// Order-level stock availability check. BUSINESS_RULES.md §18, CALCULATION_ENGINE.md §17 "Insufficient Stock":
// hard block, aggregated across every menu-item line AND every add-on line before any allocation is written.

import type { AddOn, Ingredient, Menu, PurchaseBatch, ProcessingOutput, StockMovement } from './types';
import { getEligibleLots, totalAvailable } from './fifo';

// Add-on quantity is INDEPENDENT from the parent menu line's quantity — see BUSINESS_RULES.md
// §4 and CALCULATION_ENGINE.md §11. "3x menu + 1x add-on" consumes 1 unit of the add-on total,
// not 1 per menu unit — never multiply addOnLine.quantity by the parent line's quantity.
export interface OrderDraftAddOnLine {
  addOnId: string;
  quantity: number;
}

export interface OrderDraftLine {
  menuId: string;
  quantity: number;
  unitSellingPrice: number; // manually controlled, defaults to menu.sellingPrice but user can override
  addOns: OrderDraftAddOnLine[];
}

export interface OrderDraft {
  lines: OrderDraftLine[];
}

export interface IngredientRequirement {
  ingredientId: string;
  required: number;
}

/**
 * Sums required quantity per ingredient across every menu-item line and every add-on line.
 * Standard_cost ingredients ARE included (BUSINESS_RULES.md §8a, Decision — Phase 2D): they
 * are not lot/FIFO-tracked, but they do have a finite, hard-blocked available quantity —
 * see `checkStockAvailability` below for how that quantity is derived for this tracking type.
 */
export function aggregateRequiredQuantities(
  draft: OrderDraft,
  menusById: Map<string, Menu>,
  addOnsById: Map<string, AddOn>,
  ingredientsById: Map<string, Ingredient>
): Map<string, number> {
  const required = new Map<string, number>();
  const add = (ingredientId: string, qty: number) => {
    required.set(ingredientId, (required.get(ingredientId) ?? 0) + qty);
  };

  for (const line of draft.lines) {
    const menu = menusById.get(line.menuId);
    if (!menu) continue;
    for (const item of menu.recipe) {
      add(item.ingredientId, item.quantity * line.quantity);
    }
    for (const addOnLine of line.addOns) {
      const addOn = addOnsById.get(addOnLine.addOnId);
      if (!addOn) continue;
      for (const item of addOn.recipe) {
        add(item.ingredientId, item.quantity * addOnLine.quantity);
      }
    }
  }

  return required;
}

export interface StockShortage {
  ingredientId: string;
  required: number;
  available: number;
  shortage: number;
}

export interface StockCheckResult {
  ok: boolean;
  shortages: StockShortage[];
}

/**
 * Available quantity for a `standard_cost` ingredient — a single running total derived from
 * its stock-movement history (BUSINESS_RULES.md §8a), never from summing lot remaining
 * quantity (standard_cost purchase batches are not FIFO-eligible, see fifo.ts).
 */
export function getStandardCostAvailableQuantity(ingredientId: string, stockMovements: StockMovement[]): number {
  return round2(
    stockMovements
      .filter((m) => m.ingredientId === ingredientId && m.sourceType === 'standard_cost')
      .reduce((sum, m) => sum + m.quantityDelta, 0)
  );
}

/** Hard block: any ingredient where required > available fails the whole order. No override, no negative stock. */
export function checkStockAvailability(
  required: Map<string, number>,
  ingredientsById: Map<string, Ingredient>,
  purchaseBatches: PurchaseBatch[],
  processingOutputs: ProcessingOutput[],
  stockMovements: StockMovement[]
): StockCheckResult {
  const shortages: StockShortage[] = [];

  for (const [ingredientId, requiredQty] of required.entries()) {
    const ingredient = ingredientsById.get(ingredientId);
    const trackingType = ingredient?.trackingType ?? 'raw_by_weight';

    if (trackingType === 'standard_cost') {
      // A standard_cost ingredient with no valid configured cost has, functionally, no usable
      // stock (it can never be legitimately consumed) — hard-block it the same way a quantity
      // shortage is blocked, rather than letting orderEngine silently cost it at 0 (Phase 3A gap #4).
      const cost = ingredient?.standardCost;
      const hasValidCost = typeof cost === 'number' && Number.isFinite(cost) && cost > 0;
      const available = hasValidCost ? getStandardCostAvailableQuantity(ingredientId, stockMovements) : 0;
      if (!hasValidCost || available < requiredQty - 1e-9) {
        shortages.push({ ingredientId, required: requiredQty, available, shortage: round2(requiredQty - available) });
      }
      continue;
    }

    const available = totalAvailable(getEligibleLots(ingredientId, trackingType, purchaseBatches, processingOutputs));
    if (available < requiredQty - 1e-9) {
      shortages.push({ ingredientId, required: requiredQty, available, shortage: round2(requiredQty - available) });
    }
  }

  return { ok: shortages.length === 0, shortages };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
