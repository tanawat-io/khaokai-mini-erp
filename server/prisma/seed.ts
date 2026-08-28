// Reproduces src/repository/seedData.ts + mockRepository.ts's scripted order sequence against
// the real database — catalog/inventory rows are inserted directly (mirroring how seedData.ts's
// static arrays are used as-is by the mock), and orders are created via the real, tested
// create/void path (createOrderForSeed/voidOrderForSeed) so every seeded FIFO allocation and COGS
// figure is guaranteed consistent with live behavior, exactly like the mock's own seed script.

// .env is loaded via `--env-file=.env` on this script's invocation (see prisma.config.ts's
// migrations.seed command) — not here, since ESM import hoisting would run ./client's own
// top-level DATABASE_URL check before a call placed here.

import { prisma } from './client';
import { hashPassword } from '../auth/password';
import { createOrderForSeed, voidOrderForSeed } from '../repository/prismaRepository';
import {
  store,
  ingredients,
  purchaseBatches,
  stockMovements,
  processingBatches,
  processingOutputs,
  wasteRecords,
  menus,
  addOns,
} from '../../src/repository/seedData';
import type { OrderDraft } from '../../src/domain/stockCheck';

async function main() {
  console.log('Seeding...');

  await prisma.store.create({
    data: { id: store.id, name: store.name, currency: store.currency, setupComplete: store.setupComplete },
  });

  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme123';
  await prisma.user.create({
    data: { id: 'user-admin', username: adminUsername, passwordHash: await hashPassword(adminPassword), storeId: store.id },
  });

  await prisma.ingredient.createMany({
    data: ingredients.map((i) => ({
      id: i.id,
      storeId: store.id,
      name: i.name,
      category: i.category,
      baseUnit: i.baseUnit,
      trackingType: i.trackingType,
      standardCost: i.standardCost ?? null,
      lowStockThreshold: i.lowStockThreshold ?? null,
      active: i.active,
    })),
  });

  await prisma.purchaseBatch.createMany({
    data: purchaseBatches.map((b) => ({
      id: b.id,
      storeId: store.id,
      ingredientId: b.ingredientId,
      purchaseDate: b.purchaseDate,
      quantity: b.quantity,
      unit: b.unit,
      totalCost: b.totalCost,
      unitCost: b.unitCost,
      remainingQuantity: b.remainingQuantity,
      status: b.status,
      reference: b.reference ?? null,
    })),
  });

  await prisma.stockMovement.createMany({
    data: stockMovements.map((m) => ({
      id: m.id,
      storeId: store.id,
      ingredientId: m.ingredientId,
      sourceType: m.sourceType,
      batchReference: m.batchReference ?? null,
      quantityDelta: m.quantityDelta,
      movementType: m.movementType,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      createdAt: m.createdAt,
    })),
  });

  await prisma.processingBatch.createMany({
    data: processingBatches.map((p) => ({
      id: p.id,
      storeId: store.id,
      sourceBatchId: p.sourceBatchId,
      ingredientId: p.ingredientId,
      processedAt: p.processedAt,
      inputQuantity: p.inputQuantity,
      inputCost: p.inputCost,
      status: p.status,
    })),
  });

  await prisma.processingOutput.createMany({
    data: processingOutputs.map((o) => ({
      id: o.id,
      storeId: store.id,
      processingBatchId: o.processingBatchId,
      ingredientId: o.ingredientId,
      quantity: o.quantity,
      remainingQuantity: o.remainingQuantity,
      unitCost: o.unitCost,
      allocatedCost: o.allocatedCost,
      portionSize: o.portionSize ?? null,
      portionCount: o.portionCount ?? null,
      outputType: o.outputType,
      status: o.status,
      createdAt: o.createdAt,
    })),
  });

  await prisma.wasteRecord.createMany({
    data: wasteRecords.map((w) => ({
      id: w.id,
      storeId: store.id,
      ingredientId: w.ingredientId,
      sourceType: w.sourceType,
      sourceBatchId: w.sourceBatchId ?? null,
      processingBatchId: w.processingBatchId ?? null,
      quantity: w.quantity,
      unitCost: w.unitCost,
      wasteValue: w.wasteValue,
      reason: w.reason,
      createdAt: w.createdAt,
    })),
  });

  for (const menu of menus) {
    await prisma.menu.create({
      data: {
        id: menu.id,
        storeId: store.id,
        name: menu.name,
        sellingPrice: menu.sellingPrice,
        active: menu.active,
        recipe: {
          create: menu.recipe.map((r: { ingredientId: string; quantity: number }, idx: number) => ({
            id: `${menu.id}-line-${idx}`,
            ingredientId: r.ingredientId,
            quantity: r.quantity,
          })),
        },
      },
    });
  }

  for (const addOn of addOns) {
    await prisma.addOn.create({
      data: {
        id: addOn.id,
        storeId: store.id,
        name: addOn.name,
        sellingPrice: addOn.sellingPrice,
        active: addOn.active,
        recipe: {
          create: addOn.recipe.map((r: { ingredientId: string; quantity: number }, idx: number) => ({
            id: `${addOn.id}-line-${idx}`,
            ingredientId: r.ingredientId,
            quantity: r.quantity,
          })),
        },
      },
    });
  }

  // --- Scripted order history (mirrors src/repository/mockRepository.ts exactly) --------------

  const seedOrder = async (sellingDate: string, nowIso: string, draft: OrderDraft) => {
    const result = await createOrderForSeed(store.id, sellingDate, nowIso, draft);
    if (!result.ok) throw new Error(`Seed order failed stock check on ${sellingDate}: ${JSON.stringify(result.shortages)}`);
    return result.order;
  };

  await seedOrder('2026-08-16', '2026-08-16T11:00:00+07:00', {
    lines: [{ menuId: 'menu-friedchicken-garlic', quantity: 30, unitSellingPrice: 45, addOns: [] }],
  });

  await seedOrder('2026-08-23', '2026-08-23T11:30:00+07:00', {
    lines: [
      { menuId: 'menu-padkrapao-moo', quantity: 2, unitSellingPrice: 50, addOns: [{ addOnId: 'addon-friedegg', quantity: 2 }] },
    ],
  });

  await seedOrder('2026-08-23', '2026-08-23T12:15:00+07:00', {
    lines: [{ menuId: 'menu-greencurry-chicken', quantity: 1, unitSellingPrice: 60, addOns: [] }],
  });

  const orderToVoid = await seedOrder('2026-08-24', '2026-08-24T12:00:00+07:00', {
    lines: [{ menuId: 'menu-greencurry-pork', quantity: 1, unitSellingPrice: 55, addOns: [] }],
  });

  await seedOrder('2026-08-24', '2026-08-24T18:20:00+07:00', {
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

  await seedOrder('2026-08-25', '2026-08-25T10:05:00+07:00', {
    lines: [
      { menuId: 'menu-greencurry-chicken', quantity: 1, unitSellingPrice: 60, addOns: [{ addOnId: 'addon-omelette', quantity: 1 }] },
    ],
  });

  await seedOrder('2026-08-25', '2026-08-25T12:40:00+07:00', {
    lines: [{ menuId: 'menu-padkrapao-moo', quantity: 3, unitSellingPrice: 50, addOns: [] }],
  });

  const voidResult = await voidOrderForSeed(store.id, orderToVoid.id, '2026-08-24T15:00:00+07:00');
  if (!voidResult.ok) throw new Error('Seed void failed unexpectedly');

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
