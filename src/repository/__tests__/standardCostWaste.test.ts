// Standard Cost waste — Phase 3A Part A.12 item I. Repository-layer (not pure domain) because
// the waste mutation lives in mockRepository.ts. Runs against the real seeded module state
// (ing-currypaste) and asserts the BEFORE/AFTER delta rather than a hardcoded absolute baseline,
// since the exact seeded available quantity depends on the seeded order script.

import { describe, it, expect } from 'vitest';
import { repoRecordWaste, getSnapshot } from '../mockRepository';
import { getStandardCostAvailableQuantity } from '@/domain/stockCheck';

describe('Standard Cost — I: waste against a standard_cost ingredient', () => {
  it('computes wasteValue = qty * standardCost, decrements available quantity, and records a standard_cost movement', () => {
    const ingredientId = 'ing-currypaste';
    const before = getSnapshot();
    const ingredient = before.ingredients.find((i) => i.id === ingredientId)!;
    expect(ingredient.trackingType).toBe('standard_cost');
    const availableBefore = getStandardCostAvailableQuantity(ingredientId, before.stockMovements);

    const result = repoRecordWaste({ ingredientId, sourceType: 'standard_cost', quantity: 5, reason: 'ทดสอบ' }, '2026-08-26T00:00:00+07:00');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.sourceType).toBe('standard_cost');
    expect(result.item.sourceBatchId).toBeUndefined();
    expect(result.item.wasteValue).toBe(5 * (ingredient.standardCost ?? 0));

    const after = getSnapshot();
    const availableAfter = getStandardCostAvailableQuantity(ingredientId, after.stockMovements);
    expect(availableAfter).toBe(availableBefore - 5);

    const movement = after.stockMovements.find((m) => m.referenceId === result.item.id);
    expect(movement).toBeDefined();
    expect(movement?.sourceType).toBe('standard_cost');
    expect(movement?.movementType).toBe('waste');
    expect(movement?.quantityDelta).toBe(-5);
  });

  it('rejects waste quantity exceeding the standard_cost ingredient available quantity', () => {
    const ingredientId = 'ing-basil';
    const before = getSnapshot();
    const availableBefore = getStandardCostAvailableQuantity(ingredientId, before.stockMovements);

    const result = repoRecordWaste({ ingredientId, sourceType: 'standard_cost', quantity: availableBefore + 1000, reason: 'ทดสอบเกิน' }, '2026-08-26T00:00:00+07:00');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
