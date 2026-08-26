// Real backend repository (Phase 3B). Implements RepositoryContract against SQLite via Prisma,
// reusing src/domain/* completely unchanged — this file contains NO FIFO/costing/validation
// logic of its own; it only hydrates domain-shaped objects from the DB, calls the same pure
// functions mockRepository.ts calls, and persists exactly what changed.
//
// Order mutations (createOrder/editOrder/voidOrder) use a specific, narrow persistence recipe
// per operation rather than a generic diff — derived from actually reading orderEngine.ts:
//   - purchaseBatches/processingOutputs are mutated in place (remainingQuantity/status only) —
//     touched rows are known exactly from the fifoAllocations involved (old + new for edits).
//   - stockMovements is an append-only ledger (orderEngine.ts's own header comment) — new rows
//     are exactly the tail appended to ctx.stockMovements during the call.
//   - orders/order_items/order_item_add_ons/fifo_allocations: insert on create; on edit, the
//     domain layer replaces `order.items`/`order.fifoAllocations` wholesale (new array
//     references), so the old rows for that order are deleted and the new ones inserted,
//     mirroring that in-memory reassignment exactly; on void, these are untouched (the domain
//     layer never reassigns them for void).
// Every write path is wrapped in one Prisma transaction. Concurrent order mutations are
// serialized by `orderMutex` (see mutex.ts) — see that file for why this, not DB isolation, is
// what actually prevents a stock race in this single-process backend.

import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma/client';
import { orderMutex } from './mutex';
import {
  toIngredient,
  toPurchaseBatch,
  toProcessingBatch,
  toProcessingOutput,
  toWasteRecord,
  toMenu,
  toAddOn,
  toOrder,
  toStockMovement,
  toStore,
  orderInclude,
} from './mappers';

import type { RepositoryContract } from '../../src/repository/contract';
import type { RepositorySnapshot, CatalogResult } from '../../src/repository/mockRepository';
import type { Ingredient, Menu, AddOn, Order, ProcessingBatch, PurchaseBatch, Store, WasteRecord, StockMovement } from '../../src/domain/types';
import { createOrder, editOrder, voidOrder, type OrderEngineContext, type OrderResult } from '../../src/domain/orderEngine';
import type { OrderDraft } from '../../src/domain/stockCheck';
import { getStandardCostAvailableQuantity } from '../../src/domain/stockCheck';
import {
  validateCatalogItemInput,
  validateIngredientInput,
  type CatalogItemInput,
  type IngredientInput,
} from '../../src/domain/catalog';
import {
  validatePurchaseInput,
  validateProcessingInput,
  validateWasteInput,
  type PurchaseInput,
  type ProcessingInput,
  type WasteInput,
} from '../../src/domain/inventory';
import { allocateProcessingCost, round2 } from '../../src/domain/costing';
import { getEligibleLots } from '../../src/domain/fifo';

const genId = () => randomUUID();

// --- Snapshot ----------------------------------------------------------------------------------

export async function getSnapshot(): Promise<RepositorySnapshot> {
  const [ingredients, purchaseBatches, processingBatches, processingOutputs, wasteRecords, menus, addOns, orders, stockMovements, store] =
    await Promise.all([
      prisma.ingredient.findMany(),
      prisma.purchaseBatch.findMany(),
      prisma.processingBatch.findMany(),
      prisma.processingOutput.findMany(),
      prisma.wasteRecord.findMany(),
      prisma.menu.findMany({ include: { recipe: true } }),
      prisma.addOn.findMany({ include: { recipe: true } }),
      prisma.order.findMany({ include: orderInclude }),
      prisma.stockMovement.findMany(),
      prisma.store.findFirstOrThrow(),
    ]);

  return {
    ingredients: ingredients.map(toIngredient),
    purchaseBatches: purchaseBatches.map(toPurchaseBatch),
    processingBatches: processingBatches.map(toProcessingBatch),
    processingOutputs: processingOutputs.map(toProcessingOutput),
    wasteRecords: wasteRecords.map(toWasteRecord),
    menus: menus.map(toMenu),
    addOns: addOns.map(toAddOn),
    orders: orders.map(toOrder),
    stockMovements: stockMovements.map(toStockMovement),
    store: toStore(store),
  };
}

// --- Ingredients ---------------------------------------------------------------------------------

export async function createIngredient(input: IngredientInput): Promise<CatalogResult<Ingredient>> {
  const check = validateIngredientInput(input);
  if (!check.ok) return { ok: false, errors: check.errors };
  const row = await prisma.ingredient.create({
    data: {
      id: genId(),
      name: input.name.trim(),
      category: input.category.trim(),
      baseUnit: input.baseUnit.trim(),
      trackingType: input.trackingType,
      standardCost: input.trackingType === 'standard_cost' ? input.standardCost : null,
      lowStockThreshold: input.lowStockThreshold ?? null,
      active: true,
    },
  });
  return { ok: true, item: toIngredient(row) };
}

export async function updateIngredient(id: string, input: IngredientInput): Promise<CatalogResult<Ingredient>> {
  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) return { ok: false, errors: ['ไม่พบวัตถุดิบนี้'] };
  const check = validateIngredientInput(input);
  if (!check.ok) return { ok: false, errors: check.errors };
  const row = await prisma.ingredient.update({
    where: { id },
    data: {
      name: input.name.trim(),
      category: input.category.trim(),
      baseUnit: input.baseUnit.trim(),
      trackingType: input.trackingType,
      standardCost: input.trackingType === 'standard_cost' ? input.standardCost : null,
      lowStockThreshold: input.lowStockThreshold ?? null,
    },
  });
  return { ok: true, item: toIngredient(row) };
}

export async function setIngredientActive(id: string, active: boolean): Promise<CatalogResult<Ingredient>> {
  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) return { ok: false, errors: ['ไม่พบวัตถุดิบนี้'] };
  const row = await prisma.ingredient.update({ where: { id }, data: { active } });
  return { ok: true, item: toIngredient(row) };
}

async function ingredientsMap(): Promise<Map<string, Ingredient>> {
  const rows = await prisma.ingredient.findMany();
  return new Map(rows.map((r) => [r.id, toIngredient(r)]));
}

// --- Menus / Add-ons -------------------------------------------------------------------------

export async function createMenu(input: CatalogItemInput): Promise<CatalogResult<Menu>> {
  const check = validateCatalogItemInput(input, await ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const row = await prisma.menu.create({
    data: {
      id: genId(),
      name: input.name.trim(),
      sellingPrice: input.sellingPrice,
      active: true,
      recipe: { create: input.recipe.map((r) => ({ id: genId(), ingredientId: r.ingredientId, quantity: r.quantity })) },
    },
    include: { recipe: true },
  });
  return { ok: true, item: toMenu(row) };
}

export async function updateMenu(id: string, input: CatalogItemInput): Promise<CatalogResult<Menu>> {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) return { ok: false, errors: ['ไม่พบเมนูนี้'] };
  const check = validateCatalogItemInput(input, await ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const row = await prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { menuId: id } });
    return tx.menu.update({
      where: { id },
      data: {
        name: input.name.trim(),
        sellingPrice: input.sellingPrice,
        recipe: { create: input.recipe.map((r) => ({ id: genId(), ingredientId: r.ingredientId, quantity: r.quantity })) },
      },
      include: { recipe: true },
    });
  });
  return { ok: true, item: toMenu(row) };
}

export async function setMenuActive(id: string, active: boolean): Promise<CatalogResult<Menu>> {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) return { ok: false, errors: ['ไม่พบเมนูนี้'] };
  const row = await prisma.menu.update({ where: { id }, data: { active }, include: { recipe: true } });
  return { ok: true, item: toMenu(row) };
}

export async function createAddOn(input: CatalogItemInput): Promise<CatalogResult<AddOn>> {
  const check = validateCatalogItemInput(input, await ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const row = await prisma.addOn.create({
    data: {
      id: genId(),
      name: input.name.trim(),
      sellingPrice: input.sellingPrice,
      active: true,
      recipe: { create: input.recipe.map((r) => ({ id: genId(), ingredientId: r.ingredientId, quantity: r.quantity })) },
    },
    include: { recipe: true },
  });
  return { ok: true, item: toAddOn(row) };
}

export async function updateAddOn(id: string, input: CatalogItemInput): Promise<CatalogResult<AddOn>> {
  const existing = await prisma.addOn.findUnique({ where: { id } });
  if (!existing) return { ok: false, errors: ['ไม่พบ Add-on นี้'] };
  const check = validateCatalogItemInput(input, await ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const row = await prisma.$transaction(async (tx) => {
    await tx.addOnItem.deleteMany({ where: { addOnId: id } });
    return tx.addOn.update({
      where: { id },
      data: {
        name: input.name.trim(),
        sellingPrice: input.sellingPrice,
        recipe: { create: input.recipe.map((r) => ({ id: genId(), ingredientId: r.ingredientId, quantity: r.quantity })) },
      },
      include: { recipe: true },
    });
  });
  return { ok: true, item: toAddOn(row) };
}

export async function setAddOnActive(id: string, active: boolean): Promise<CatalogResult<AddOn>> {
  const existing = await prisma.addOn.findUnique({ where: { id } });
  if (!existing) return { ok: false, errors: ['ไม่พบ Add-on นี้'] };
  const row = await prisma.addOn.update({ where: { id }, data: { active }, include: { recipe: true } });
  return { ok: true, item: toAddOn(row) };
}

// --- Purchases / Processing / Waste -----------------------------------------------------------

export async function createPurchase(input: PurchaseInput): Promise<CatalogResult<PurchaseBatch>> {
  const check = validatePurchaseInput(input, await ingredientsMap());
  if (!check.ok) return { ok: false, errors: check.errors };
  const ingredient = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
  const unitCost = input.quantity > 0 ? round2(input.totalCost / input.quantity) : 0;
  const batchId = genId();

  await prisma.$transaction(async (tx) => {
    await tx.purchaseBatch.create({
      data: {
        id: batchId,
        ingredientId: input.ingredientId,
        purchaseDate: input.purchaseDate,
        quantity: input.quantity,
        unit: input.unit.trim(),
        totalCost: input.totalCost,
        unitCost,
        remainingQuantity: input.quantity,
        status: 'active',
        reference: input.reference?.trim() || null,
      },
    });
    if (ingredient?.trackingType === 'standard_cost') {
      await tx.stockMovement.create({
        data: {
          id: genId(),
          ingredientId: input.ingredientId,
          sourceType: 'standard_cost',
          quantityDelta: input.quantity,
          movementType: 'purchase',
          referenceType: 'purchase',
          referenceId: batchId,
          createdAt: new Date().toISOString(),
        },
      });
    }
  });

  const row = await prisma.purchaseBatch.findUniqueOrThrow({ where: { id: batchId } });
  return { ok: true, item: toPurchaseBatch(row) };
}

export async function createProcessing(input: ProcessingInput, nowIso: string): Promise<CatalogResult<ProcessingBatch>> {
  const sourceBatchRow = await prisma.purchaseBatch.findUnique({ where: { id: input.sourceBatchId } });
  const sourceBatch = sourceBatchRow ? toPurchaseBatch(sourceBatchRow) : undefined;
  const check = validateProcessingInput(input, sourceBatch);
  if (!check.ok) return { ok: false, errors: check.errors };

  const inputCost = round2(input.inputQuantity * sourceBatch!.unitCost);
  const allocation = allocateProcessingCost(input.inputQuantity, inputCost, input.outputs, input.wasteQuantity);
  const processingBatchId = genId();

  await prisma.$transaction(async (tx) => {
    const newRemaining = round2(sourceBatch!.remainingQuantity - input.inputQuantity);
    await tx.purchaseBatch.update({
      where: { id: sourceBatch!.id },
      data: { remainingQuantity: newRemaining, status: newRemaining <= 1e-9 ? 'depleted' : sourceBatch!.status },
    });

    await tx.processingBatch.create({
      data: {
        id: processingBatchId,
        sourceBatchId: sourceBatch!.id,
        ingredientId: sourceBatch!.ingredientId,
        processedAt: nowIso,
        inputQuantity: input.inputQuantity,
        inputCost,
        status: 'active',
      },
    });

    for (const o of allocation.outputs) {
      await tx.processingOutput.create({
        data: {
          id: genId(),
          processingBatchId,
          ingredientId: sourceBatch!.ingredientId,
          quantity: o.quantity,
          remainingQuantity: o.quantity,
          unitCost: allocation.unitCost,
          allocatedCost: o.allocatedCost,
          portionSize: o.portionSize,
          portionCount: o.portionCount,
          outputType: 'portion',
          status: 'active',
          createdAt: nowIso,
        },
      });
    }

    if (input.wasteQuantity > 0) {
      await tx.wasteRecord.create({
        data: {
          id: genId(),
          ingredientId: sourceBatch!.ingredientId,
          sourceType: 'purchase_batch',
          sourceBatchId: sourceBatch!.id,
          processingBatchId,
          quantity: input.wasteQuantity,
          unitCost: allocation.unitCost,
          wasteValue: allocation.wasteCost,
          reason: input.wasteReason.trim(),
          createdAt: nowIso,
        },
      });
    }
  });

  const row = await prisma.processingBatch.findUniqueOrThrow({ where: { id: processingBatchId } });
  return { ok: true, item: toProcessingBatch(row) };
}

export async function recordWaste(input: WasteInput, nowIso: string): Promise<CatalogResult<WasteRecord>> {
  const ingredientRow = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
  if (!ingredientRow) return { ok: false, errors: ['ไม่พบวัตถุดิบนี้'] };
  const ingredient = toIngredient(ingredientRow);

  if (ingredient.trackingType === 'standard_cost') {
    const movements = (await prisma.stockMovement.findMany({ where: { ingredientId: input.ingredientId } })).map(toStockMovement);
    const available = getStandardCostAvailableQuantity(input.ingredientId, movements);
    const check = validateWasteInput(input, undefined, available);
    if (!check.ok) return { ok: false, errors: check.errors };

    const unitCost = ingredient.standardCost ?? 0;
    const wasteId = genId();
    await prisma.$transaction(async (tx) => {
      await tx.wasteRecord.create({
        data: {
          id: wasteId,
          ingredientId: input.ingredientId,
          sourceType: 'standard_cost',
          quantity: input.quantity,
          unitCost,
          wasteValue: round2(input.quantity * unitCost),
          reason: input.reason.trim(),
          createdAt: nowIso,
        },
      });
      await tx.stockMovement.create({
        data: {
          id: genId(),
          ingredientId: input.ingredientId,
          sourceType: 'standard_cost',
          quantityDelta: round2(-input.quantity),
          movementType: 'waste',
          referenceType: 'waste',
          referenceId: wasteId,
          createdAt: nowIso,
        },
      });
    });
    const row = await prisma.wasteRecord.findUniqueOrThrow({ where: { id: wasteId } });
    return { ok: true, item: toWasteRecord(row) };
  }

  const [purchaseBatches, processingOutputs] = await Promise.all([
    prisma.purchaseBatch.findMany({ where: { ingredientId: input.ingredientId } }),
    prisma.processingOutput.findMany({ where: { ingredientId: input.ingredientId } }),
  ]);
  const lot = getEligibleLots(
    input.ingredientId,
    ingredient.trackingType,
    purchaseBatches.map(toPurchaseBatch),
    processingOutputs.map(toProcessingOutput)
  ).find((l) => l.sourceType === input.sourceType && l.sourceBatchId === input.sourceBatchId);
  const check = validateWasteInput(input, lot);
  if (!check.ok) return { ok: false, errors: check.errors };

  const wasteId = genId();
  await prisma.$transaction(async (tx) => {
    if (input.sourceType === 'purchase_batch') {
      const batch = purchaseBatches.find((b) => b.id === input.sourceBatchId)!;
      const newRemaining = round2(batch.remainingQuantity - input.quantity);
      await tx.purchaseBatch.update({
        where: { id: batch.id },
        data: { remainingQuantity: newRemaining, status: newRemaining <= 1e-9 ? 'depleted' : batch.status },
      });
    } else {
      const output = processingOutputs.find((o) => o.id === input.sourceBatchId)!;
      const newRemaining = round2(output.remainingQuantity - input.quantity);
      await tx.processingOutput.update({
        where: { id: output.id },
        data: { remainingQuantity: newRemaining, status: newRemaining <= 1e-9 ? 'void' : output.status },
      });
    }
    await tx.wasteRecord.create({
      data: {
        id: wasteId,
        ingredientId: input.ingredientId,
        sourceType: input.sourceType,
        sourceBatchId: input.sourceBatchId,
        quantity: input.quantity,
        unitCost: lot!.unitCost,
        wasteValue: round2(input.quantity * lot!.unitCost),
        reason: input.reason.trim(),
        createdAt: nowIso,
      },
    });
  });
  const row = await prisma.wasteRecord.findUniqueOrThrow({ where: { id: wasteId } });
  return { ok: true, item: toWasteRecord(row) };
}

// --- Settings ------------------------------------------------------------------------------------

export async function updateStoreName(name: string): Promise<CatalogResult<Store>> {
  if (!name.trim()) return { ok: false, errors: ['กรุณาระบุชื่อร้าน'] };
  const store = await prisma.store.findFirstOrThrow();
  const row = await prisma.store.update({ where: { id: store.id }, data: { name: name.trim() } });
  return { ok: true, item: toStore(row) };
}

// --- Orders (create/edit/void) ------------------------------------------------------------------
// See file header for the persistence recipe. `sellingDate` is always server-derived (Phase 3B
// design decision — see plan) rather than trusting the caller's `sellingDate` argument, since it
// drives order-number sequencing and Dashboard "today" aggregates.

async function hydrateOrderContext(nowIso: string): Promise<OrderEngineContext> {
  const [menus, addOns, ingredients, purchaseBatches, processingOutputs, stockMovements, orders] = await Promise.all([
    prisma.menu.findMany({ include: { recipe: true } }),
    prisma.addOn.findMany({ include: { recipe: true } }),
    prisma.ingredient.findMany(),
    prisma.purchaseBatch.findMany(),
    prisma.processingOutput.findMany(),
    prisma.stockMovement.findMany(),
    prisma.order.findMany({ include: orderInclude }),
  ]);

  return {
    menus: menus.map(toMenu),
    addOns: addOns.map(toAddOn),
    ingredients: ingredients.map(toIngredient),
    purchaseBatches: purchaseBatches.map(toPurchaseBatch),
    processingOutputs: processingOutputs.map(toProcessingOutput),
    stockMovements: stockMovements.map(toStockMovement),
    orders: orders.map(toOrder),
    genId,
    now: () => nowIso,
  };
}

// Takes the same `tx` handle the caller's transaction callback uses — this MUST run inside the
// same transaction as the order/movement writes below, not a separate one, or a crash between
// the two would leave stock quantities inconsistent with the order that consumed them.
async function persistTouchedBatches(
  tx: any,
  ctx: OrderEngineContext,
  allocations: { sourceType: string; sourceBatchId: string }[]
) {
  const purchaseBatchIds = new Set(allocations.filter((a) => a.sourceType === 'purchase_batch').map((a) => a.sourceBatchId));
  const processingOutputIds = new Set(allocations.filter((a) => a.sourceType === 'processing_output').map((a) => a.sourceBatchId));

  for (const id of purchaseBatchIds) {
    const b = ctx.purchaseBatches.find((x) => x.id === id)!;
    await tx.purchaseBatch.update({ where: { id }, data: { remainingQuantity: b.remainingQuantity, status: b.status } });
  }
  for (const id of processingOutputIds) {
    const o = ctx.processingOutputs.find((x) => x.id === id)!;
    await tx.processingOutput.update({ where: { id }, data: { remainingQuantity: o.remainingQuantity, status: o.status } });
  }
}

function newStockMovements(ctx: OrderEngineContext, beforeCount: number): StockMovement[] {
  return ctx.stockMovements.slice(beforeCount);
}

// Internal — takes an explicit sellingDate/nowIso so the seed script (server/prisma/seed.ts) can
// reproduce mockRepository.ts's historical scripted order dates through this same trusted,
// tested persistence path. `createOrderReal` below is the ONLY caller reachable from the HTTP
// API, and it hardcodes the server's real current date — this function itself does not decide
// that policy, so it staying flexible does not weaken the "server is authoritative" guarantee.
async function createOrderInternal(sellingDate: string, nowIso: string, draft: OrderDraft): Promise<OrderResult> {
  return orderMutex.runExclusive(async () => {
    const ctx = await hydrateOrderContext(nowIso);
    const movementsBefore = ctx.stockMovements.length;

    const result = createOrder(draft, ctx, sellingDate);
    if (!result.ok) return result;

    const touchedAllocations = result.order.fifoAllocations;
    const movements = newStockMovements(ctx, movementsBefore);

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          sellingDate: result.order.sellingDate,
          soldAt: result.order.soldAt,
          totalRevenue: result.order.totalRevenue,
          totalCogs: result.order.totalCogs,
          totalProfit: result.order.totalProfit,
          status: result.order.status,
          items: {
            create: result.order.items.map((it) => ({
              id: it.id,
              menuId: it.menuId,
              quantity: it.quantity,
              unitSellingPrice: it.unitSellingPrice,
              lineRevenue: it.lineRevenue,
              lineCogs: it.lineCogs,
              lineProfit: it.lineProfit,
              addOns: {
                create: it.addOns.map((a) => ({
                  id: genId(),
                  addOnId: a.addOnId,
                  quantity: a.quantity,
                  unitSellingPrice: a.unitSellingPrice,
                  revenue: a.revenue,
                  cogs: a.cogs,
                  lineProfit: a.lineProfit,
                })),
              },
            })),
          },
          fifoAllocations: {
            create: touchedAllocations.map((a) => ({
              id: a.id,
              ingredientId: a.ingredientId,
              sourceType: a.sourceType,
              sourceBatchId: a.sourceBatchId,
              quantityConsumed: a.quantityConsumed,
              unitCost: a.unitCost,
              allocatedCost: a.allocatedCost,
            })),
          },
        },
      });
      if (movements.length > 0) {
        await tx.stockMovement.createMany({
          data: movements.map((m) => ({ ...m, orderId: result.order.id })),
        });
      }
      await persistTouchedBatches(tx, ctx, touchedAllocations);
    });

    return result;
  });
}

/** HTTP-facing: sellingDate is always the server's real current date — never the caller's (Phase 3B §21). */
export async function createOrderReal(sellingDate: string, draft: OrderDraft): Promise<OrderResult> {
  void sellingDate; // kept in the contract signature for mock-compat; deliberately ignored here
  const nowIso = new Date().toISOString();
  return createOrderInternal(nowIso.slice(0, 10), nowIso, draft);
}

/** Seed-only: lets server/prisma/seed.ts reproduce mockRepository.ts's historical order dates. */
export async function createOrderForSeed(sellingDate: string, nowIso: string, draft: OrderDraft): Promise<OrderResult> {
  return createOrderInternal(sellingDate, nowIso, draft);
}

export async function editOrderReal(orderId: string, draft: OrderDraft): Promise<OrderResult> {
  return orderMutex.runExclusive(async () => {
    const nowIso = new Date().toISOString();
    const ctx = await hydrateOrderContext(nowIso);
    const preEdit = ctx.orders.find((o) => o.id === orderId);
    const preEditAllocations = preEdit ? [...preEdit.fifoAllocations] : [];
    const movementsBefore = ctx.stockMovements.length;

    const result = editOrder(orderId, draft, ctx);
    if (!result.ok) return result;

    const touchedAllocations = [...preEditAllocations, ...result.order.fifoAllocations];
    const movements = newStockMovements(ctx, movementsBefore);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.fifoAllocation.deleteMany({ where: { orderId } });
      await tx.order.update({
        where: { id: orderId },
        data: {
          totalRevenue: result.order.totalRevenue,
          totalCogs: result.order.totalCogs,
          totalProfit: result.order.totalProfit,
          editedAt: result.order.editedAt,
          items: {
            create: result.order.items.map((it) => ({
              id: it.id,
              menuId: it.menuId,
              quantity: it.quantity,
              unitSellingPrice: it.unitSellingPrice,
              lineRevenue: it.lineRevenue,
              lineCogs: it.lineCogs,
              lineProfit: it.lineProfit,
              addOns: {
                create: it.addOns.map((a) => ({
                  id: genId(),
                  addOnId: a.addOnId,
                  quantity: a.quantity,
                  unitSellingPrice: a.unitSellingPrice,
                  revenue: a.revenue,
                  cogs: a.cogs,
                  lineProfit: a.lineProfit,
                })),
              },
            })),
          },
          fifoAllocations: {
            create: result.order.fifoAllocations.map((a) => ({
              id: a.id,
              ingredientId: a.ingredientId,
              sourceType: a.sourceType,
              sourceBatchId: a.sourceBatchId,
              quantityConsumed: a.quantityConsumed,
              unitCost: a.unitCost,
              allocatedCost: a.allocatedCost,
            })),
          },
        },
      });
      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements.map((m) => ({ ...m, orderId })) });
      }
      await persistTouchedBatches(tx, ctx, touchedAllocations);
    });

    return result;
  });
}

async function voidOrderInternal(orderId: string, nowIso: string): Promise<OrderResult> {
  return orderMutex.runExclusive(async () => {
    const ctx = await hydrateOrderContext(nowIso);
    const movementsBefore = ctx.stockMovements.length;

    const result = voidOrder(orderId, ctx);
    if (!result.ok) return result;

    const touchedAllocations = result.order.fifoAllocations;
    const movements = newStockMovements(ctx, movementsBefore);

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'voided', voidedAt: result.order.voidedAt } });
      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements.map((m) => ({ ...m, orderId })) });
      }
      await persistTouchedBatches(tx, ctx, touchedAllocations);
    });

    return result;
  });
}

export async function voidOrderReal(orderId: string): Promise<OrderResult> {
  return voidOrderInternal(orderId, new Date().toISOString());
}

/** Seed-only: lets server/prisma/seed.ts reproduce mockRepository.ts's historical void timestamp. */
export async function voidOrderForSeed(orderId: string, nowIso: string): Promise<OrderResult> {
  return voidOrderInternal(orderId, nowIso);
}

// --- Contract binding ----------------------------------------------------------------------------

export const prismaRepository: RepositoryContract = {
  getSnapshot,
  createOrder: createOrderReal,
  editOrder: editOrderReal,
  voidOrder: voidOrderReal,
  createIngredient,
  updateIngredient,
  setIngredientActive,
  createMenu,
  updateMenu,
  setMenuActive,
  createAddOn,
  updateAddOn,
  setAddOnActive,
  createPurchase,
  createProcessing,
  recordWaste,
  updateStoreName,
};
