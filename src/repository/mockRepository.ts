// In-memory "database". Owns the mutable arrays and seeds a realistic order history by
// running the real order engine (createOrder/voidOrder) — not hand-computed numbers — so
// every seeded FIFO allocation and COGS figure is guaranteed consistent with live behavior.
//
// This module is the ONLY place that should be swapped out for a real database later; the
// domain layer and UI never import seedData or the engine's mutation details directly.

import {
  addOns,
  ingredients,
  menus,
  processingBatches,
  processingOutputs,
  purchaseBatches,
  stockMovements,
  store,
  wasteRecords,
} from './seedData';
import type { AddOn, Ingredient, Menu, Order, ProcessingBatch, ProcessingOutput, PurchaseBatch, Store, WasteRecord } from '@/domain/types';
import { createOrder, editOrder, voidOrder, type OrderEngineContext } from '@/domain/orderEngine';
import type { OrderDraft } from '@/domain/stockCheck';
import { getStandardCostAvailableQuantity } from '@/domain/stockCheck';
import {
  validateCatalogItemInput,
  validateIngredientInput,
  type CatalogItemInput,
  type IngredientInput,
} from '@/domain/catalog';
import {
  validatePurchaseInput,
  validateProcessingInput,
  validateWasteInput,
  type PurchaseInput,
  type ProcessingInput,
  type WasteInput,
} from '@/domain/inventory';
import { allocateProcessingCost, round2 } from '@/domain/costing';
import { getEligibleLots, type StockLot } from '@/domain/fifo';

let idCounter = 0;
const genId = () => `id-${++idCounter}`;

const orders: Order[] = [];

function makeCtx(nowIso: string): OrderEngineContext {
  return {
    menus,
    addOns,
    ingredients,
    purchaseBatches,
    processingOutputs,
    stockMovements,
    orders,
    genId,
    now: () => nowIso,
  };
}

function seedOrder(sellingDate: string, nowIso: string, draft: OrderDraft): Order {
  const result = createOrder(draft, makeCtx(nowIso), sellingDate);
  if (!result.ok) {
    throw new Error(`Seed order failed stock check on ${sellingDate}: ${JSON.stringify(result.shortages)}`);
  }
  return result.order;
}

// --- Scripted order history -------------------------------------------------

// Catering order: 30 x ไก่ทอดกระเทียม (400g chicken each) = 12,000g — crosses the two
// chicken purchase batches exactly as specified: 10,000g from Batch A (฿120/kg) + 2,000g
// from Batch B (฿140/kg).
// NOTE: this menu's selling price (45) is genuinely below its FIFO ingredient cost at this
// order size — that is preserved deliberately, not a data bug. Selling price is always a
// manual, user-entered value (BUSINESS_RULES.md §3); the system must never adjust it to make
// a demo look profitable. A real operator could easily underprice a dish, and this order
// exercises the negative-profit visual state (red, per PRODUCT_SPEC.md Dashboard KPIs) that
// no other seeded order currently covers.
seedOrder('2026-08-16', '2026-08-16T11:00:00+07:00', {
  lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 30, unitSellingPrice: 45, addOns: [] }],
});

seedOrder('2026-08-23', '2026-08-23T11:30:00+07:00', {
  lines: [
    {
      menuId: 'menu-padkrapao-moo',
      quantity: 2,
      unitSellingPrice: 50,
      addOns: [{ addOnId: 'addon-friedegg', quantity: 2 }],
    },
  ],
});

seedOrder('2026-08-23', '2026-08-23T12:15:00+07:00', {
  lines: [{ menuId: 'menu-greencurry-chicken', quantity: 1, unitSellingPrice: 60, addOns: [] }],
});

// Order to be voided below — demonstrates the void flow with a real prior order.
const orderToVoid = seedOrder('2026-08-24', '2026-08-24T12:00:00+07:00', {
  lines: [{ menuId: 'menu-greencurry-pork', quantity: 1, unitSellingPrice: 55, addOns: [] }],
});

seedOrder('2026-08-24', '2026-08-24T18:20:00+07:00', {
  lines: [
    {
      menuId: 'menu-padkrapao-moo',
      quantity: 1,
      unitSellingPrice: 50,
      addOns: [
        { addOnId: 'addon-extrapork', quantity: 1 },
        { addOnId: 'addon-friedegg', quantity: 1 },
      ],
    },
  ],
});

seedOrder('2026-08-25', '2026-08-25T10:05:00+07:00', {
  lines: [
    {
      menuId: 'menu-greencurry-chicken',
      quantity: 1,
      unitSellingPrice: 60,
      addOns: [{ addOnId: 'addon-omelette', quantity: 1 }],
    },
  ],
});

seedOrder('2026-08-25', '2026-08-25T12:40:00+07:00', {
  lines: [{ menuId: 'menu-padkrapao-moo', quantity: 3, unitSellingPrice: 50, addOns: [] }],
});

// Void one historical order — restores its stock, excludes it from aggregates, but it stays
// in the Orders list / History with status "voided" (BUSINESS_RULES.md §17).
const voidResult = voidOrder(orderToVoid.id, makeCtx('2026-08-24T15:00:00+07:00'));
if (!voidResult.ok) throw new Error('Seed void failed unexpectedly');

// --- Repository surface -----------------------------------------------------

export interface RepositorySnapshot {
  ingredients: typeof ingredients;
  purchaseBatches: typeof purchaseBatches;
  processingBatches: typeof processingBatches;
  processingOutputs: typeof processingOutputs;
  wasteRecords: typeof wasteRecords;
  menus: typeof menus;
  addOns: typeof addOns;
  orders: Order[];
  stockMovements: typeof stockMovements;
  store: Store;
}

/** Returns a fresh top-level snapshot (new array references) for consumers that need to detect changes. */
export function getSnapshot(): RepositorySnapshot {
  return {
    ingredients: [...ingredients],
    purchaseBatches: [...purchaseBatches],
    processingBatches: [...processingBatches],
    processingOutputs: [...processingOutputs],
    wasteRecords: [...wasteRecords],
    menus: [...menus],
    addOns: [...addOns],
    orders: [...orders],
    stockMovements: [...stockMovements],
    store: { ...store },
  };
}

export function repoCreateOrder(sellingDate: string, draft: OrderDraft) {
  return createOrder(draft, makeCtx(new Date().toISOString()), sellingDate);
}

export function repoEditOrder(orderId: string, draft: OrderDraft) {
  return editOrder(orderId, draft, makeCtx(new Date().toISOString()));
}

export function repoVoidOrder(orderId: string) {
  return voidOrder(orderId, makeCtx(new Date().toISOString()));
}

// --- Catalog management (Ingredients, Menus, Add-ons) ------------------------
// Create/update/toggle-active only — no hard delete. Orders store their own frozen
// menuId/addOnId/ingredientId and resolved costs at creation time (never re-read live
// recipes), so editing is safe, but deleting a referenced row would orphan historical
// orders (DATABASE.md §19 Referential Integrity). `active` exists on all three entities
// for exactly this purpose.

export type CatalogResult<T> = { ok: true; item: T } | { ok: false; errors: string[] };

export function repoCreateIngredient(input: IngredientInput): CatalogResult<Ingredient> {
  const check = validateIngredientInput(input);
  if (!check.ok) return { ok: false, errors: check.errors };
  const ingredient: Ingredient = {
    id: genId(),
    name: input.name.trim(),
    category: input.category.trim(),
    baseUnit: input.baseUnit.trim(),
    trackingType: input.trackingType,
    standardCost: input.trackingType === 'standard_cost' ? input.standardCost : undefined,
    lowStockThreshold: input.lowStockThreshold,
    active: true,
  };
  ingredients.push(ingredient);
  return { ok: true, item: ingredient };
}

export function repoUpdateIngredient(id: string, input: IngredientInput): CatalogResult<Ingredient> {
  const existing = ingredients.find((i) => i.id === id);
  if (!existing) return { ok: false, errors: ['ไม่พบวัตถุดิบนี้'] };
  const check = validateIngredientInput(input);
  if (!check.ok) return { ok: false, errors: check.errors };
  existing.name = input.name.trim();
  existing.category = input.category.trim();
  existing.baseUnit = input.baseUnit.trim();
  existing.trackingType = input.trackingType;
  existing.standardCost = input.trackingType === 'standard_cost' ? input.standardCost : undefined;
  existing.lowStockThreshold = input.lowStockThreshold;
  return { ok: true, item: existing };
}

export function repoSetIngredientActive(id: string, active: boolean): CatalogResult<Ingredient> {
  const existing = ingredients.find((i) => i.id === id);
  if (!existing) return { ok: false, errors: ['ไม่พบวัตถุดิบนี้'] };
  existing.active = active;
  return { ok: true, item: existing };
}

function ingredientsMap(): Map<string, Ingredient> {
  return new Map(ingredients.map((i) => [i.id, i]));
}

export function repoCreateMenu(input: CatalogItemInput): CatalogResult<Menu> {
  const check = validateCatalogItemInput(input, ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const menu: Menu = { id: genId(), name: input.name.trim(), sellingPrice: input.sellingPrice, recipe: input.recipe, active: true };
  menus.push(menu);
  return { ok: true, item: menu };
}

export function repoUpdateMenu(id: string, input: CatalogItemInput): CatalogResult<Menu> {
  const existing = menus.find((m) => m.id === id);
  if (!existing) return { ok: false, errors: ['ไม่พบเมนูนี้'] };
  const check = validateCatalogItemInput(input, ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  existing.name = input.name.trim();
  existing.sellingPrice = input.sellingPrice;
  existing.recipe = input.recipe;
  return { ok: true, item: existing };
}

export function repoSetMenuActive(id: string, active: boolean): CatalogResult<Menu> {
  const existing = menus.find((m) => m.id === id);
  if (!existing) return { ok: false, errors: ['ไม่พบเมนูนี้'] };
  existing.active = active;
  return { ok: true, item: existing };
}

export function repoCreateAddOn(input: CatalogItemInput): CatalogResult<AddOn> {
  const check = validateCatalogItemInput(input, ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const addOn: AddOn = { id: genId(), name: input.name.trim(), sellingPrice: input.sellingPrice, recipe: input.recipe, active: true };
  addOns.push(addOn);
  return { ok: true, item: addOn };
}

export function repoUpdateAddOn(id: string, input: CatalogItemInput): CatalogResult<AddOn> {
  const existing = addOns.find((a) => a.id === id);
  if (!existing) return { ok: false, errors: ['ไม่พบ Add-on นี้'] };
  const check = validateCatalogItemInput(input, ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  existing.name = input.name.trim();
  existing.sellingPrice = input.sellingPrice;
  existing.recipe = input.recipe;
  return { ok: true, item: existing };
}

export function repoSetAddOnActive(id: string, active: boolean): CatalogResult<AddOn> {
  const existing = addOns.find((a) => a.id === id);
  if (!existing) return { ok: false, errors: ['ไม่พบ Add-on นี้'] };
  existing.active = active;
  return { ok: true, item: existing };
}

// --- Inventory (Purchases, Processing, Waste) --------------------------------
// No edit/void here — purchase price history must be retained (BUSINESS_RULES.md §5) and
// these are immutable ledger entries, matching the void-not-edit philosophy already used
// for orders rather than allowing free-form correction of stock-affecting records.

export function repoCreatePurchase(input: PurchaseInput): CatalogResult<PurchaseBatch> {
  const check = validatePurchaseInput(input, ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const unitCost = input.quantity > 0 ? round2(input.totalCost / input.quantity) : 0;
  const batch: PurchaseBatch = {
    id: genId(),
    ingredientId: input.ingredientId,
    purchaseDate: input.purchaseDate,
    quantity: input.quantity,
    unit: input.unit.trim(),
    totalCost: input.totalCost,
    unitCost,
    remainingQuantity: input.quantity,
    status: 'active',
    reference: input.reference?.trim() || undefined,
  };
  purchaseBatches.push(batch);

  // standard_cost ingredients: the batch above is retained for price history only (BUSINESS_RULES.md
  // §8a/§6) — the actual available-quantity increase is recorded as a movement.
  const ingredient = ingredients.find((i) => i.id === input.ingredientId);
  if (ingredient?.trackingType === 'standard_cost') {
    stockMovements.push({
      id: genId(),
      ingredientId: input.ingredientId,
      sourceType: 'standard_cost',
      quantityDelta: input.quantity,
      movementType: 'purchase',
      referenceType: 'purchase',
      referenceId: batch.id,
      createdAt: new Date().toISOString(),
    });
  }

  return { ok: true, item: batch };
}

export function repoCreateProcessing(input: ProcessingInput, nowIso: string): CatalogResult<ProcessingBatch> {
  const sourceBatch = purchaseBatches.find((b) => b.id === input.sourceBatchId);
  const check = validateProcessingInput(input, sourceBatch);
  if (!check.ok) return { ok: false, errors: check.errors };

  const inputCost = round2(input.inputQuantity * sourceBatch!.unitCost);
  const allocation = allocateProcessingCost(input.inputQuantity, inputCost, input.outputs, input.wasteQuantity);

  // Consume the source purchase batch (BUSINESS_RULES.md §6/§7: processing converts raw stock
  // into consumable output — the raw batch itself is never directly orderable, see fifo.ts).
  sourceBatch!.remainingQuantity = round2(sourceBatch!.remainingQuantity - input.inputQuantity);
  if (sourceBatch!.remainingQuantity <= 1e-9) sourceBatch!.status = 'depleted';

  const processingBatch: ProcessingBatch = {
    id: genId(),
    sourceBatchId: sourceBatch!.id,
    ingredientId: sourceBatch!.ingredientId,
    processedAt: nowIso,
    inputQuantity: input.inputQuantity,
    inputCost,
    status: 'active',
  };
  processingBatches.push(processingBatch);

  for (const o of allocation.outputs) {
    const output: ProcessingOutput = {
      id: genId(),
      processingBatchId: processingBatch.id,
      ingredientId: sourceBatch!.ingredientId,
      quantity: o.quantity,
      remainingQuantity: o.quantity,
      unitCost: allocation.unitCost,
      allocatedCost: o.allocatedCost,
      portionSize: o.portionSize,
      portionCount: o.portionCount,
      outputType: 'portion',
      createdAt: nowIso,
      status: 'active',
    };
    processingOutputs.push(output);
  }

  if (input.wasteQuantity > 0) {
    const waste: WasteRecord = {
      id: genId(),
      ingredientId: sourceBatch!.ingredientId,
      sourceType: 'purchase_batch',
      sourceBatchId: sourceBatch!.id,
      processingBatchId: processingBatch.id,
      quantity: input.wasteQuantity,
      unitCost: allocation.unitCost,
      wasteValue: allocation.wasteCost,
      reason: input.wasteReason.trim(),
      createdAt: nowIso,
    };
    wasteRecords.push(waste);
  }

  return { ok: true, item: processingBatch };
}

export function repoRecordWaste(input: WasteInput, nowIso: string): CatalogResult<WasteRecord> {
  const ingredient = ingredients.find((i) => i.id === input.ingredientId);
  if (!ingredient) return { ok: false, errors: ['ไม่พบวัตถุดิบนี้'] };

  if (ingredient.trackingType === 'standard_cost') {
    const available = getStandardCostAvailableQuantity(input.ingredientId, stockMovements);
    const check = validateWasteInput(input, undefined, available);
    if (!check.ok) return { ok: false, errors: check.errors };

    const unitCost = ingredient.standardCost ?? 0;
    const waste: WasteRecord = {
      id: genId(),
      ingredientId: input.ingredientId,
      sourceType: 'standard_cost',
      quantity: input.quantity,
      unitCost,
      wasteValue: round2(input.quantity * unitCost),
      reason: input.reason.trim(),
      createdAt: nowIso,
    };
    wasteRecords.push(waste);
    stockMovements.push({
      id: genId(),
      ingredientId: input.ingredientId,
      sourceType: 'standard_cost',
      quantityDelta: round2(-input.quantity),
      movementType: 'waste',
      referenceType: 'waste',
      referenceId: waste.id,
      createdAt: nowIso,
    });
    return { ok: true, item: waste };
  }

  const lot = getEligibleLots(input.ingredientId, ingredient.trackingType, purchaseBatches, processingOutputs).find(
    (l: StockLot) => l.sourceType === input.sourceType && l.sourceBatchId === input.sourceBatchId
  );
  const check = validateWasteInput(input, lot);
  if (!check.ok) return { ok: false, errors: check.errors };

  if (input.sourceType === 'purchase_batch') {
    const batch = purchaseBatches.find((b) => b.id === input.sourceBatchId)!;
    batch.remainingQuantity = round2(batch.remainingQuantity - input.quantity);
    if (batch.remainingQuantity <= 1e-9) batch.status = 'depleted';
  } else {
    const output = processingOutputs.find((o) => o.id === input.sourceBatchId)!;
    output.remainingQuantity = round2(output.remainingQuantity - input.quantity);
    if (output.remainingQuantity <= 1e-9) output.status = 'void';
  }

  const waste: WasteRecord = {
    id: genId(),
    ingredientId: input.ingredientId,
    sourceType: input.sourceType,
    sourceBatchId: input.sourceBatchId,
    quantity: input.quantity,
    unitCost: lot!.unitCost,
    wasteValue: round2(input.quantity * lot!.unitCost),
    reason: input.reason.trim(),
    createdAt: nowIso,
  };
  wasteRecords.push(waste);
  return { ok: true, item: waste };
}

// --- Settings (Store) ---------------------------------------------------------

export function repoUpdateStoreName(name: string): CatalogResult<Store> {
  if (!name.trim()) return { ok: false, errors: ['กรุณาระบุชื่อร้าน'] };
  store.name = name.trim();
  return { ok: true, item: store };
}

// --- Repository contract binding (Phase 3A Part C) ---------------------------
// Implements RepositoryContract exactly against the functions above — TypeScript enforces
// this object matches the contract, which is what "proves" the contract is real without
// building a second backend. See contract.ts and repository/index.ts.

import type { RepositoryContract } from './contract';

// Async wrapper (Phase 3B §6/§19): mockRepository's internal logic stays fully synchronous
// in-memory (unchanged) — only the contract-facing surface returns Promises, so it keeps
// satisfying RepositoryContract without duplicating or altering any of the functions above.
// This is what keeps the mock usable as a dev/test fallback alongside the real apiRepository.
function toAsync<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => Promise<R> {
  return (...args: Args) => Promise.resolve(fn(...args));
}

export const mockRepository: RepositoryContract = {
  getSnapshot: toAsync(getSnapshot),
  createOrder: toAsync(repoCreateOrder),
  editOrder: toAsync(repoEditOrder),
  voidOrder: toAsync(repoVoidOrder),
  createIngredient: toAsync(repoCreateIngredient),
  updateIngredient: toAsync(repoUpdateIngredient),
  setIngredientActive: toAsync(repoSetIngredientActive),
  createMenu: toAsync(repoCreateMenu),
  updateMenu: toAsync(repoUpdateMenu),
  setMenuActive: toAsync(repoSetMenuActive),
  createAddOn: toAsync(repoCreateAddOn),
  updateAddOn: toAsync(repoUpdateAddOn),
  setAddOnActive: toAsync(repoSetAddOnActive),
  createPurchase: toAsync(repoCreatePurchase),
  createProcessing: toAsync(repoCreateProcessing),
  recordWaste: toAsync(repoRecordWaste),
  updateStoreName: toAsync(repoUpdateStoreName),
};
