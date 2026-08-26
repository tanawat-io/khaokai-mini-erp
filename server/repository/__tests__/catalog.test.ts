import { describe, it, expect } from 'vitest';
import { prisma } from '../../prisma/client';
import { createIngredient, createPurchase } from '../prismaRepository';

describe('catalog (Prisma-backed)', () => {
  it('rejects a standard_cost ingredient with no standardCost', async () => {
    const result = await createIngredient({
      name: 'ทดสอบ',
      category: 'ทดสอบ',
      baseUnit: 'g',
      trackingType: 'standard_cost',
    });
    expect(result.ok).toBe(false);
  });

  it('creates a valid ingredient and persists it', async () => {
    const result = await createIngredient({
      name: 'ทดสอบ2',
      category: 'ทดสอบ',
      baseUnit: 'g',
      trackingType: 'raw_by_weight',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = await prisma.ingredient.findUnique({ where: { id: result.item.id } });
    expect(row?.name).toBe('ทดสอบ2');
  });

  it('a standard_cost purchase writes a compensating stock movement', async () => {
    const before = await prisma.stockMovement.count({ where: { ingredientId: 'ing-basil' } });
    const result = await createPurchase({
      ingredientId: 'ing-basil',
      quantity: 100,
      unit: 'g',
      totalCost: 30,
      purchaseDate: '2099-01-01',
    });
    expect(result.ok).toBe(true);
    const after = await prisma.stockMovement.count({ where: { ingredientId: 'ing-basil' } });
    expect(after).toBe(before + 1);
  });
});
