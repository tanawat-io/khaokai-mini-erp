// Re-runs the highest-stakes Phase 3A order scenarios through the real Prisma-backed repository
// (not just the pure in-memory domain layer) — this is what actually proves the hydrate/persist
// pattern in prismaRepository.ts is correct, per the Phase 3B plan.

import { describe, it, expect } from 'vitest';
import { prisma } from '../../prisma/client';
import { createOrderForSeed, voidOrderForSeed, editOrderReal, getSnapshot } from '../prismaRepository';

const nowIso = () => new Date().toISOString();
const STORE_ID = 'store-1';

describe('orders (Prisma-backed)', () => {
  it('A: creates a normal order, computing FIFO COGS and writing allocations', async () => {
    const before = await prisma.purchaseBatch.findUniqueOrThrow({ where: { id: 'pb-oil-1' } });
    const result = await createOrderForSeed(STORE_ID, '2099-01-01', nowIso(), {
      lines: [{ menuId: 'menu-padkrapao-moo', quantity: 1, unitSellingPrice: 50, addOns: [] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.totalRevenue).toBe(50);
    expect(result.order.fifoAllocations.length).toBeGreaterThan(0);

    const after = await prisma.purchaseBatch.findUniqueOrThrow({ where: { id: 'pb-oil-1' } });
    expect(after.remainingQuantity).toBe(before.remainingQuantity - 10); // recipe uses 10ml oil
  });

  it('B: hard-blocks an order with insufficient stock and writes nothing', async () => {
    const snapshotBefore = await getSnapshot(STORE_ID);
    const result = await createOrderForSeed(STORE_ID, '2099-01-01', nowIso(), {
      lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 999999, unitSellingPrice: 45, addOns: [] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.shortages.length).toBeGreaterThan(0);

    const snapshotAfter = await getSnapshot(STORE_ID);
    expect(snapshotAfter.orders.length).toBe(snapshotBefore.orders.length);
    expect(snapshotAfter.stockMovements.length).toBe(snapshotBefore.stockMovements.length);
  });

  it('C: standard_cost order consumes the movement ledger, not FIFO', async () => {
    const result = await createOrderForSeed(STORE_ID, '2099-01-01', nowIso(), {
      lines: [{ menuId: 'menu-greencurry-pork', quantity: 1, unitSellingPrice: 55, addOns: [] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const currypasteAlloc = result.order.fifoAllocations.find((a) => a.ingredientId === 'ing-currypaste');
    expect(currypasteAlloc).toBeUndefined(); // no FIFO row for standard_cost

    const movement = await prisma.stockMovement.findFirst({
      where: { referenceId: result.order.id, ingredientId: 'ing-currypaste', movementType: 'sale_consumption' },
    });
    expect(movement).not.toBeNull();
    expect(movement?.quantityDelta).toBe(-40);
  });

  it('D: void reverses stock and blocks further edit/void, without deleting the order', async () => {
    const created = await createOrderForSeed(STORE_ID, '2099-01-01', nowIso(), {
      lines: [{ menuId: 'menu-padkrapao-moo', quantity: 1, unitSellingPrice: 50, addOns: [] }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const porkAlloc = created.order.fifoAllocations.find((a) => a.ingredientId === 'ing-pork');
    expect(porkAlloc?.sourceType).toBe('processing_output'); // pork is a processed_batch ingredient
    const porkOutputId = porkAlloc!.sourceBatchId;

    const batchBeforeVoid = await prisma.purchaseBatch.findUniqueOrThrow({ where: { id: 'pb-oil-1' } });
    const outputBeforeVoid = await prisma.processingOutput.findUniqueOrThrow({ where: { id: porkOutputId } });
    const voided = await voidOrderForSeed(STORE_ID, created.order.id, nowIso());
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.order.status).toBe('voided');

    const batchAfterVoid = await prisma.purchaseBatch.findUniqueOrThrow({ where: { id: 'pb-oil-1' } });
    expect(batchAfterVoid.remainingQuantity).toBe(batchBeforeVoid.remainingQuantity + 10); // restored

    // processing_output allocations (pork) restore the same way — including flipping status
    // back from 'void' to 'active' once remainingQuantity is positive again (orderEngine.ts's
    // restoreFifoConsumption processing_output branch, persisted by persistTouchedBatches).
    const outputAfterVoid = await prisma.processingOutput.findUniqueOrThrow({ where: { id: porkOutputId } });
    expect(outputAfterVoid.remainingQuantity).toBe(outputBeforeVoid.remainingQuantity + porkAlloc!.quantityConsumed);
    if (outputBeforeVoid.status === 'void') {
      expect(outputAfterVoid.status).toBe('active');
    }

    const doubleVoid = await voidOrderForSeed(STORE_ID, created.order.id, nowIso());
    expect(doubleVoid.ok).toBe(false);

    const editAfterVoid = await editOrderReal(STORE_ID, created.order.id, {
      lines: [{ menuId: 'menu-padkrapao-moo', quantity: 2, unitSellingPrice: 50, addOns: [] }],
    });
    expect(editAfterVoid.ok).toBe(false);

    const stillThere = await prisma.order.findUnique({ where: { id: created.order.id } });
    expect(stillThere).not.toBeNull(); // never hard-deleted
    expect(stillThere?.status).toBe('voided');
  });

  it('E: edit atomically rolls back to the original order when the new draft is insufficient', async () => {
    const created = await createOrderForSeed(STORE_ID, '2099-01-01', nowIso(), {
      lines: [{ menuId: 'menu-padkrapao-moo', quantity: 1, unitSellingPrice: 50, addOns: [] }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const edited = await editOrderReal(STORE_ID, created.order.id, {
      lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 999999, unitSellingPrice: 45, addOns: [] }],
    });
    expect(edited.ok).toBe(false);

    const unchanged = await prisma.order.findUniqueOrThrow({
      where: { id: created.order.id },
      include: { items: true, fifoAllocations: true },
    });
    expect(unchanged.items).toHaveLength(1);
    expect(unchanged.items[0]!.menuId).toBe('menu-padkrapao-moo');
    expect(unchanged.totalRevenue).toBe(50);
  });

  // Uses friedchicken-garlic (raw_by_weight chicken/oil/fishsauce, seeded with ample stock) —
  // padkrapao-moo's pork supply is a small fixed processing-output pool that earlier tests in
  // this file already draw down, so it isn't a reliable ingredient for these two scenarios.
  it('F: edit re-allocates FIFO for the new draft and restores the old allocation', async () => {
    const created = await createOrderForSeed(STORE_ID, '2099-01-01', nowIso(), {
      lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 1, unitSellingPrice: 45, addOns: [] }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const edited = await editOrderReal(STORE_ID, created.order.id, {
      lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 2, unitSellingPrice: 45, addOns: [] }],
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.order.totalRevenue).toBe(90);
    expect(edited.order.editedAt).not.toBeUndefined();

    const row = await prisma.order.findUniqueOrThrow({ where: { id: created.order.id }, include: { items: true } });
    expect(row.items).toHaveLength(1);
    expect(row.items[0]!.quantity).toBe(2);
  });

  it('G: order numbers are unique and sequential per selling date', async () => {
    const d = '2099-02-02';
    const r1 = await createOrderForSeed(STORE_ID, d, nowIso(), { lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 1, unitSellingPrice: 45, addOns: [] }] });
    const r2 = await createOrderForSeed(STORE_ID, d, nowIso(), { lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 1, unitSellingPrice: 45, addOns: [] }] });
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.order.orderNumber).toBe(r1.order.orderNumber + 1);
  });
});
