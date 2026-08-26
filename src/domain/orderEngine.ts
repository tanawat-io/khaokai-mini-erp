// Order lifecycle: create, edit, void. Encodes BUSINESS_RULES.md §16-18 and
// CALCULATION_ENGINE.md §15-17 exactly: hard-block insufficient stock (aggregated across
// menu + add-on lines before any allocation is written), edits scope to the edited order
// only with atomic rollback on failure, and void (never hard-delete) semantics.

import type { AddOn, FifoAllocation, Ingredient, Menu, Order, OrderItemAddOnLine, OrderItemLine, ProcessingOutput, PurchaseBatch, StockMovement } from './types';
import { getEligibleLots, planFifoConsumption, type LotAllocation } from './fifo';
import { aggregateRequiredQuantities, checkStockAvailability, type OrderDraft, type StockShortage } from './stockCheck';
import { round2 } from './costing';

export interface OrderEngineContext {
  menus: Menu[];
  addOns: AddOn[];
  ingredients: Ingredient[];
  purchaseBatches: PurchaseBatch[]; // mutated in place on commit
  processingOutputs: ProcessingOutput[]; // mutated in place on commit
  stockMovements: StockMovement[]; // append-only ledger — standard_cost consumption/reversal only (BUSINESS_RULES.md §8a)
  orders: Order[]; // used to compute next order number per selling date
  genId: () => string;
  now: () => string; // ISO datetime
}

export type OrderResult = { ok: true; order: Order } | { ok: false; shortages: StockShortage[] };

function nextOrderNumber(orders: Order[], sellingDate: string): number {
  const sameDay = orders.filter((o) => o.sellingDate === sellingDate);
  return sameDay.length === 0 ? 1 : Math.max(...sameDay.map((o) => o.orderNumber)) + 1;
}

/** Consumes `qty` of `ingredientId` via live FIFO (mutates real batches) and returns the allocations + cost. Caller must have already passed the aggregate stock check. */
function commitFifoConsumption(
  ingredientId: string,
  trackingType: Ingredient['trackingType'],
  qty: number,
  ctx: OrderEngineContext
): { allocations: LotAllocation[]; cost: number } {
  if (qty <= 0) return { allocations: [], cost: 0 };
  const lots = getEligibleLots(ingredientId, trackingType, ctx.purchaseBatches, ctx.processingOutputs);
  const result = planFifoConsumption(qty, lots);
  // Mutate real batches/outputs to reflect consumption.
  for (const alloc of result.allocations) {
    if (alloc.sourceType === 'purchase_batch') {
      const batch = ctx.purchaseBatches.find((b) => b.id === alloc.sourceBatchId)!;
      batch.remainingQuantity = round2(batch.remainingQuantity - alloc.quantity);
      if (batch.remainingQuantity <= 1e-9) batch.status = 'depleted';
    } else {
      const output = ctx.processingOutputs.find((o) => o.id === alloc.sourceBatchId)!;
      output.remainingQuantity = round2(output.remainingQuantity - alloc.quantity);
      if (output.remainingQuantity <= 1e-9) output.status = 'void'; // depleted processing output — no separate 'depleted' state for outputs, treated as exhausted
    }
  }
  return { allocations: result.allocations, cost: round2(result.totalCost) };
}

/**
 * Consumes `qty` of an ingredient using the costing path appropriate to its tracking_type:
 * `standard_cost` ingredients bypass FIFO (cost = qty * standardCost, no FifoAllocation row —
 * BUSINESS_RULES.md §8a) but ARE stock-checked and movement-tracked like any other ingredient;
 * `checkStockAvailability` must have already validated a positive `standardCost` and sufficient
 * available quantity before this runs (see stockCheck.ts) — the throw below is an unreachable
 * defensive assertion, not a user-facing error path. Everything else goes through live FIFO.
 */
function consumeIngredient(
  ingredientId: string,
  qty: number,
  ctx: OrderEngineContext,
  ingredientsById: Map<string, Ingredient>,
  orderId: string
): { allocations: LotAllocation[]; cost: number } {
  const ingredient = ingredientsById.get(ingredientId);
  if (ingredient?.trackingType === 'standard_cost') {
    const standardCost = ingredient.standardCost;
    if (typeof standardCost !== 'number' || !Number.isFinite(standardCost) || standardCost <= 0) {
      throw new Error(`Ingredient ${ingredientId} (standard_cost) has no valid standardCost — should have been rejected by checkStockAvailability`);
    }
    if (qty > 0) {
      ctx.stockMovements.push({
        id: ctx.genId(),
        ingredientId,
        sourceType: 'standard_cost',
        quantityDelta: round2(-qty),
        movementType: 'sale_consumption',
        referenceType: 'order',
        referenceId: orderId,
        createdAt: ctx.now(),
      });
    }
    return { allocations: [], cost: round2(qty * standardCost) };
  }
  return commitFifoConsumption(ingredientId, ingredient?.trackingType ?? 'raw_by_weight', qty, ctx);
}

/** Net stock_movements quantityDelta for a given order's standard_cost consumption, per ingredient. */
function netStandardCostByIngredient(orderId: string, ctx: OrderEngineContext): Map<string, number> {
  const net = new Map<string, number>();
  for (const m of ctx.stockMovements) {
    if (m.referenceType === 'order' && m.referenceId === orderId && m.sourceType === 'standard_cost') {
      net.set(m.ingredientId, round2((net.get(m.ingredientId) ?? 0) + m.quantityDelta));
    }
  }
  return net;
}

function pushStandardCostMovement(
  ctx: OrderEngineContext,
  orderId: string,
  ingredientId: string,
  quantityDelta: number,
  movementType: StockMovement['movementType']
) {
  if (Math.abs(quantityDelta) <= 1e-9) return;
  ctx.stockMovements.push({
    id: ctx.genId(),
    ingredientId,
    sourceType: 'standard_cost',
    quantityDelta: round2(quantityDelta),
    movementType,
    referenceType: 'order',
    referenceId: orderId,
    createdAt: ctx.now(),
  });
}

/**
 * Reverses an order's current net standard_cost consumption by appending compensating movements
 * (append-only ledger — CALCULATION_ENGINE.md §22 — nothing is mutated or deleted). Returns the
 * pre-reversal net per ingredient so a failed edit can recommit exactly (see recommitStandardCostConsumption).
 */
function reverseStandardCostConsumption(orderId: string, ctx: OrderEngineContext): Map<string, number> {
  const net = netStandardCostByIngredient(orderId, ctx);
  for (const [ingredientId, qty] of net.entries()) {
    pushStandardCostMovement(ctx, orderId, ingredientId, -qty, 'reversal');
  }
  return net;
}

/** Re-applies a known-good pre-reversal net exactly (used only for edit-rollback). */
function recommitStandardCostConsumption(orderId: string, preReversalNet: Map<string, number>, ctx: OrderEngineContext) {
  for (const [ingredientId, qty] of preReversalNet.entries()) {
    pushStandardCostMovement(ctx, orderId, ingredientId, qty, 'sale_consumption');
  }
}

function restoreFifoConsumption(allocations: FifoAllocation[], ctx: OrderEngineContext) {
  for (const alloc of allocations) {
    if (alloc.sourceType === 'purchase_batch') {
      const batch = ctx.purchaseBatches.find((b) => b.id === alloc.sourceBatchId);
      if (!batch) continue;
      batch.remainingQuantity = round2(batch.remainingQuantity + alloc.quantityConsumed);
      if (batch.status === 'depleted' && batch.remainingQuantity > 0) batch.status = 'active';
    } else {
      const output = ctx.processingOutputs.find((o) => o.id === alloc.sourceBatchId);
      if (!output) continue;
      output.remainingQuantity = round2(output.remainingQuantity + alloc.quantityConsumed);
      if (output.status === 'void' && output.remainingQuantity > 0) output.status = 'active';
    }
  }
}

/** Builds order line items + FIFO allocations by consuming stock. Assumes the aggregate check already passed. */
function buildOrderItems(
  draft: OrderDraft,
  ctx: OrderEngineContext,
  menusById: Map<string, Menu>,
  addOnsById: Map<string, AddOn>,
  ingredientsById: Map<string, Ingredient>,
  orderId: string
): { items: OrderItemLine[]; fifoAllocations: FifoAllocation[] } {
  const items: OrderItemLine[] = [];
  const fifoAllocations: FifoAllocation[] = [];

  const pushAllocations = (ingredientId: string, allocs: LotAllocation[]) => {
    for (const a of allocs) {
      fifoAllocations.push({
        id: ctx.genId(),
        orderId,
        ingredientId,
        sourceType: a.sourceType,
        sourceBatchId: a.sourceBatchId,
        quantityConsumed: a.quantity,
        unitCost: a.unitCost,
        allocatedCost: round2(a.cost),
      });
    }
  };

  for (const line of draft.lines) {
    const menu = menusById.get(line.menuId);
    if (!menu) continue;

    let lineCogs = 0;
    for (const recipeItem of menu.recipe) {
      const qty = recipeItem.quantity * line.quantity;
      const { allocations, cost } = consumeIngredient(recipeItem.ingredientId, qty, ctx, ingredientsById, orderId);
      pushAllocations(recipeItem.ingredientId, allocations);
      lineCogs += cost;
    }
    const lineRevenue = round2(line.unitSellingPrice * line.quantity);

    const addOnLines: OrderItemAddOnLine[] = [];
    for (const addOnLine of line.addOns) {
      const addOn = addOnsById.get(addOnLine.addOnId);
      if (!addOn) continue;
      let addOnCogs = 0;
      for (const recipeItem of addOn.recipe) {
        const qty = recipeItem.quantity * addOnLine.quantity;
        const { allocations, cost } = consumeIngredient(recipeItem.ingredientId, qty, ctx, ingredientsById, orderId);
        pushAllocations(recipeItem.ingredientId, allocations);
        addOnCogs += cost;
      }
      const addOnRevenue = round2(addOn.sellingPrice * addOnLine.quantity);
      addOnLines.push({
        addOnId: addOn.id,
        quantity: addOnLine.quantity,
        unitSellingPrice: addOn.sellingPrice,
        revenue: addOnRevenue,
        cogs: round2(addOnCogs),
        lineProfit: round2(addOnRevenue - addOnCogs),
      });
    }

    const addOnRevenueTotal = addOnLines.reduce((s, a) => s + a.revenue, 0);
    const addOnCogsTotal = addOnLines.reduce((s, a) => s + a.cogs, 0);
    const totalLineRevenue = round2(lineRevenue + addOnRevenueTotal);
    const totalLineCogs = round2(lineCogs + addOnCogsTotal);

    items.push({
      id: ctx.genId(),
      menuId: menu.id,
      quantity: line.quantity,
      unitSellingPrice: line.unitSellingPrice,
      lineRevenue: totalLineRevenue,
      lineCogs: totalLineCogs,
      lineProfit: round2(totalLineRevenue - totalLineCogs),
      addOns: addOnLines,
    });
  }

  return { items, fifoAllocations };
}

export function createOrder(draft: OrderDraft, ctx: OrderEngineContext, sellingDate: string): OrderResult {
  const menusById = new Map(ctx.menus.map((m) => [m.id, m]));
  const addOnsById = new Map(ctx.addOns.map((a) => [a.id, a]));
  const ingredientsById = new Map(ctx.ingredients.map((i) => [i.id, i]));

  const required = aggregateRequiredQuantities(draft, menusById, addOnsById, ingredientsById);
  const check = checkStockAvailability(required, ingredientsById, ctx.purchaseBatches, ctx.processingOutputs, ctx.stockMovements);
  if (!check.ok) return { ok: false, shortages: check.shortages };

  const orderId = ctx.genId();
  const { items, fifoAllocations } = buildOrderItems(draft, ctx, menusById, addOnsById, ingredientsById, orderId);

  const totalRevenue = round2(items.reduce((s, i) => s + i.lineRevenue, 0));
  const totalCogs = round2(items.reduce((s, i) => s + i.lineCogs, 0));

  const order: Order = {
    id: orderId,
    orderNumber: nextOrderNumber(ctx.orders, sellingDate),
    sellingDate,
    soldAt: ctx.now(),
    items,
    totalRevenue,
    totalCogs,
    totalProfit: round2(totalRevenue - totalCogs),
    status: 'active',
    fifoAllocations,
  };

  ctx.orders.push(order);
  return { ok: true, order };
}

/**
 * Edits an order: reverses its previous allocations, re-allocates the new draft, and — if the
 * new allocation fails the hard-stock-block — rolls back atomically, leaving the original order
 * untouched (BUSINESS_RULES.md §16, CALCULATION_ENGINE.md §15). Edits never cascade to later orders.
 */
export function editOrder(orderId: string, draft: OrderDraft, ctx: OrderEngineContext): OrderResult {
  const existing = ctx.orders.find((o) => o.id === orderId);
  if (!existing || existing.status !== 'active') {
    return { ok: false, shortages: [] };
  }

  // Step 1: reverse the existing allocations (restores real stock) — FIFO and standard_cost.
  restoreFifoConsumption(existing.fifoAllocations, ctx);
  const standardCostNetBeforeEdit = reverseStandardCostConsumption(orderId, ctx);

  // Step 2: check the new draft against the now-restored pool.
  const menusById = new Map(ctx.menus.map((m) => [m.id, m]));
  const addOnsById = new Map(ctx.addOns.map((a) => [a.id, a]));
  const ingredientsById = new Map(ctx.ingredients.map((i) => [i.id, i]));
  const required = aggregateRequiredQuantities(draft, menusById, addOnsById, ingredientsById);
  const check = checkStockAvailability(required, ingredientsById, ctx.purchaseBatches, ctx.processingOutputs, ctx.stockMovements);

  if (!check.ok) {
    // Step 3 (failure path): atomic rollback — re-consume exactly the original allocations
    // so real stock returns to its pre-edit state, and the order object is untouched.
    recommitAllocations(existing.fifoAllocations, ctx);
    recommitStandardCostConsumption(orderId, standardCostNetBeforeEdit, ctx);
    return { ok: false, shortages: check.shortages };
  }

  // Step 4 (success path): build the new items/allocations against the restored pool.
  const { items, fifoAllocations } = buildOrderItems(draft, ctx, menusById, addOnsById, ingredientsById, orderId);
  const totalRevenue = round2(items.reduce((s, i) => s + i.lineRevenue, 0));
  const totalCogs = round2(items.reduce((s, i) => s + i.lineCogs, 0));

  existing.items = items;
  existing.fifoAllocations = fifoAllocations;
  existing.totalRevenue = totalRevenue;
  existing.totalCogs = totalCogs;
  existing.totalProfit = round2(totalRevenue - totalCogs);
  existing.editedAt = ctx.now();

  return { ok: true, order: existing };
}

/** Re-applies a known-good set of allocations exactly (used only for edit-rollback, where the pool is known sufficient). */
function recommitAllocations(allocations: FifoAllocation[], ctx: OrderEngineContext) {
  for (const alloc of allocations) {
    if (alloc.sourceType === 'purchase_batch') {
      const batch = ctx.purchaseBatches.find((b) => b.id === alloc.sourceBatchId)!;
      batch.remainingQuantity = round2(batch.remainingQuantity - alloc.quantityConsumed);
      if (batch.remainingQuantity <= 1e-9) batch.status = 'depleted';
    } else {
      const output = ctx.processingOutputs.find((o) => o.id === alloc.sourceBatchId)!;
      output.remainingQuantity = round2(output.remainingQuantity - alloc.quantityConsumed);
      if (output.remainingQuantity <= 1e-9) output.status = 'void';
    }
  }
}

/**
 * Voids an order (soft delete — BUSINESS_RULES.md §17): reverses stock, excludes the order
 * from Revenue/COGS/Profit/active-count aggregates going forward, but never removes the row.
 * The order remains visible in the Orders list and History with a `voided` status.
 */
export function voidOrder(orderId: string, ctx: OrderEngineContext): OrderResult {
  const order = ctx.orders.find((o) => o.id === orderId);
  if (!order || order.status !== 'active') return { ok: false, shortages: [] };

  restoreFifoConsumption(order.fifoAllocations, ctx);
  reverseStandardCostConsumption(orderId, ctx);
  order.status = 'voided';
  order.voidedAt = ctx.now();

  return { ok: true, order };
}
