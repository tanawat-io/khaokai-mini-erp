import { describe, it, expect } from 'vitest';
import { prisma } from '../prisma/client';

describe('infra — PostgreSQL FK enforcement (Supabase)', () => {
  it('has foreign key constraints on relational tables', async () => {
    // Verify that Postgres actually created FK constraints (migration succeeded).
    const rows = (await (prisma as unknown as { $queryRawUnsafe: (s: string) => Promise<unknown[]> }).$queryRawUnsafe(
      `SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_name IN ('Session','PurchaseBatch','ProcessingBatch','ProcessingOutput','WasteRecord','MenuItem','AddOnItem','OrderItem','OrderItemAddOn','StockMovement','FifoAllocation')`
    )) as Array<{ constraint_name: string }>;
    const count = Array.isArray(rows) ? rows.length : 0;
    // At least PurchaseBatch→Ingredient, Session→User etc. should exist.
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('rejects a row that violates a foreign key', async () => {
    // Postgres must reject a PurchaseBatch referencing a non-existent ingredient.
    await expect(
      prisma.purchaseBatch.create({
        data: {
          id: 'infra-fk-test-2',
          storeId: 'store-1',
          ingredientId: 'non-existent-ing-2',
          purchaseDate: '2026-01-01',
          quantity: 1,
          unit: 'g',
          totalCost: 1,
          unitCost: 1,
          remainingQuantity: 1,
          status: 'active',
        },
      })
    ).rejects.toThrow();
  });
});
