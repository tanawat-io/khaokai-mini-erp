// Standard Cost completion tests — Phase 3A Part A.12. Each test asserts an explicit
// expected-vs-actual value per BUSINESS_RULES.md §8a / CALCULATION_ENGINE.md §15-17.
// Uses a small self-contained fixture (not seedData.ts) so expected numbers are exact and
// isolated from the seeded module's own side effects.

import { describe, it, expect } from 'vitest';
import type { AddOn, Ingredient, Menu, PurchaseBatch, StockMovement } from '../types';
import { validateIngredientInput, estimateRecipeCost } from '../catalog';
import { createOrder, editOrder, voidOrder, type OrderEngineContext } from '../orderEngine';
import { getStandardCostAvailableQuantity } from '../stockCheck';
import type { OrderDraft } from '../stockCheck';

function baseIngredients(): Ingredient[] {
  return [
    { id: 'ing-sc', name: 'Curry Paste', category: 'sauce', baseUnit: 'g', trackingType: 'standard_cost', standardCost: 2, active: true },
    { id: 'ing-fifo', name: 'Chicken', category: 'meat', baseUnit: 'g', trackingType: 'raw_by_weight', active: true },
  ];
}

function baseMenus(): Menu[] {
  return [
    { id: 'menu-sc', name: 'SC Dish', sellingPrice: 100, active: true, recipe: [{ ingredientId: 'ing-sc', quantity: 10 }] },
    { id: 'menu-fifo', name: 'FIFO Dish', sellingPrice: 50, active: true, recipe: [{ ingredientId: 'ing-fifo', quantity: 10 }] },
    {
      id: 'menu-mix',
      name: 'Mix Dish',
      sellingPrice: 80,
      active: true,
      recipe: [
        { ingredientId: 'ing-fifo', quantity: 10 },
        { ingredientId: 'ing-sc', quantity: 5 },
      ],
    },
  ];
}

function baseAddOns(): AddOn[] {
  return [{ id: 'addon-sc', name: 'Extra Curry', sellingPrice: 20, active: true, recipe: [{ ingredientId: 'ing-sc', quantity: 3 }] }];
}

function basePurchaseBatches(): PurchaseBatch[] {
  return [
    { id: 'pb-fifo-1', ingredientId: 'ing-fifo', purchaseDate: '2026-01-01', quantity: 100, unit: 'g', totalCost: 100, unitCost: 1, remainingQuantity: 100, status: 'active' },
    // Deliberately unitCost=10 (weighted average would be 500/50=10) while standardCost=2 —
    // proves estimateRecipeCost/orderEngine use standardCost, not weighted average (tests C/D/E).
    { id: 'pb-sc-1', ingredientId: 'ing-sc', purchaseDate: '2026-01-01', quantity: 50, unit: 'g', totalCost: 500, unitCost: 10, remainingQuantity: 50, status: 'active' },
  ];
}

function baseStockMovements(): StockMovement[] {
  return [
    { id: 'sm-1', ingredientId: 'ing-sc', sourceType: 'standard_cost', quantityDelta: 50, movementType: 'purchase', referenceType: 'purchase', referenceId: 'pb-sc-1', createdAt: '2026-01-01T00:00:00Z' },
  ];
}

function makeCtx(overrides?: Partial<OrderEngineContext>): OrderEngineContext {
  let counter = 0;
  return {
    menus: baseMenus(),
    addOns: baseAddOns(),
    ingredients: baseIngredients(),
    purchaseBatches: basePurchaseBatches(),
    processingOutputs: [],
    stockMovements: baseStockMovements(),
    orders: [],
    genId: () => `test-id-${++counter}`,
    now: () => '2026-01-02T10:00:00Z',
    ...overrides,
  };
}

describe('Standard Cost — A: ingredient creation', () => {
  it('accepts a standard_cost ingredient with a valid positive cost', () => {
    const result = validateIngredientInput({ name: 'Curry', category: 'sauce', baseUnit: 'g', trackingType: 'standard_cost', standardCost: 2 });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('Standard Cost — B: reject invalid/missing standardCost', () => {
  const cases: Array<[string, number | undefined]> = [
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -5],
    ['NaN', NaN],
  ];
  for (const [label, value] of cases) {
    it(`rejects standard_cost ingredient with standardCost = ${label}`, () => {
      const result = validateIngredientInput({ name: 'Curry', category: 'sauce', baseUnit: 'g', trackingType: 'standard_cost', standardCost: value });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('วัตถุดิบแบบ standard cost ต้องระบุต้นทุนคงที่มากกว่า 0');
    });
  }
});

describe('Standard Cost — C/D: menu and add-on cost estimate use standardCost directly', () => {
  it('C: menu recipe estimate uses standardCost, not weighted average', () => {
    const ingredientsById = new Map(baseIngredients().map((i) => [i.id, i]));
    const menu = baseMenus().find((m) => m.id === 'menu-sc')!;
    const cost = estimateRecipeCost(menu.recipe, ingredientsById, basePurchaseBatches());
    expect(cost).toBe(20); // 10g * standardCost(2) — weighted average (10) would give 100
  });

  it('D: add-on recipe estimate uses standardCost, not weighted average', () => {
    const ingredientsById = new Map(baseIngredients().map((i) => [i.id, i]));
    const addOn = baseAddOns()[0];
    const cost = estimateRecipeCost(addOn.recipe, ingredientsById, basePurchaseBatches());
    expect(cost).toBe(6); // 3g * standardCost(2) — weighted average (10) would give 30
  });
});

describe('Standard Cost — E/F: actual order COGS and no FIFO allocation', () => {
  it('E: order COGS for a standard_cost line equals quantity * standardCost exactly', () => {
    const ctx = makeCtx();
    const draft: OrderDraft = { lines: [{ menuId: 'menu-sc', quantity: 1, unitSellingPrice: 100, addOns: [] }] };
    const result = createOrder(draft, ctx, '2026-01-02');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.totalCogs).toBe(20); // 10g * 2
    expect(result.order.totalRevenue).toBe(100);
    expect(result.order.totalProfit).toBe(80);
  });

  it('F: standard_cost consumption creates zero FifoAllocation rows and exactly one stock movement', () => {
    const ctx = makeCtx();
    const draft: OrderDraft = { lines: [{ menuId: 'menu-sc', quantity: 1, unitSellingPrice: 100, addOns: [] }] };
    const result = createOrder(draft, ctx, '2026-01-02');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.fifoAllocations).toHaveLength(0);
    const movements = ctx.stockMovements.filter((m) => m.referenceType === 'order' && m.referenceId === result.order.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ ingredientId: 'ing-sc', sourceType: 'standard_cost', quantityDelta: -10, movementType: 'sale_consumption' });
  });
});

describe('Standard Cost — G: order edit reverses old movement and creates the new one', () => {
  it('net movement and available quantity reflect only the edited (final) consumption', () => {
    const ctx = makeCtx();
    const created = createOrder({ lines: [{ menuId: 'menu-sc', quantity: 1, unitSellingPrice: 100, addOns: [] }] }, ctx, '2026-01-02');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const orderId = created.order.id;

    const edited = editOrder(orderId, { lines: [{ menuId: 'menu-sc', quantity: 2, unitSellingPrice: 100, addOns: [] }] }, ctx);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.order.totalCogs).toBe(40); // 20g * 2

    const netAfter = ctx.stockMovements
      .filter((m) => m.referenceType === 'order' && m.referenceId === orderId && m.sourceType === 'standard_cost')
      .reduce((s, m) => s + m.quantityDelta, 0);
    expect(netAfter).toBe(-20); // net consumption is now 20g, not double-counted from the pre-edit 10g

    expect(getStandardCostAvailableQuantity('ing-sc', ctx.stockMovements)).toBe(30); // 50 - 20
  });
});

describe('Standard Cost — H: order void restores available quantity', () => {
  it('voiding fully restores the standard_cost available quantity, deterministically', () => {
    const ctx = makeCtx();
    const created = createOrder({ lines: [{ menuId: 'menu-sc', quantity: 1, unitSellingPrice: 100, addOns: [] }] }, ctx, '2026-01-02');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(getStandardCostAvailableQuantity('ing-sc', ctx.stockMovements)).toBe(40); // 50 - 10

    const voided = voidOrder(created.order.id, ctx);
    expect(voided.ok).toBe(true);
    if (voided.ok) expect(voided.order.status).toBe('voided');

    expect(getStandardCostAvailableQuantity('ing-sc', ctx.stockMovements)).toBe(50); // fully restored
  });
});

describe('Standard Cost — J: mixed FIFO + standard_cost order', () => {
  it('allocates FIFO for one line and a movement for the other, with correct combined COGS', () => {
    const ctx = makeCtx();
    const result = createOrder({ lines: [{ menuId: 'menu-mix', quantity: 1, unitSellingPrice: 80, addOns: [] }] }, ctx, '2026-01-02');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.order.fifoAllocations).toHaveLength(1);
    expect(result.order.fifoAllocations[0]).toMatchObject({ ingredientId: 'ing-fifo', quantityConsumed: 10, unitCost: 1, allocatedCost: 10 });

    const movements = ctx.stockMovements.filter((m) => m.referenceType === 'order' && m.referenceId === result.order.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ ingredientId: 'ing-sc', quantityDelta: -5, sourceType: 'standard_cost' });

    expect(result.order.totalCogs).toBe(20); // 10 (FIFO: 10g*1) + 10 (standard_cost: 5g*2)
  });
});

describe('Standard Cost — hard stock block (no ceiling exemption, Business Rules §8a/§18)', () => {
  it('rejects an order that requires more standard_cost quantity than is available', () => {
    const ctx = makeCtx();
    // Only 50g available; request 100 units of menu-sc (10g each = 1000g required).
    const result = createOrder({ lines: [{ menuId: 'menu-sc', quantity: 100, unitSellingPrice: 100, addOns: [] }] }, ctx, '2026-01-02');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.shortages).toHaveLength(1);
    expect(result.shortages[0]).toMatchObject({ ingredientId: 'ing-sc', required: 1000, available: 50 });
    // No partial mutation on hard-block failure.
    expect(ctx.stockMovements.filter((m) => m.referenceType === 'order')).toHaveLength(0);
  });

  it('rejects an order for a standard_cost ingredient with no valid configured cost, rather than silently costing it at 0', () => {
    const ctx = makeCtx({
      ingredients: [{ id: 'ing-sc', name: 'Curry Paste', category: 'sauce', baseUnit: 'g', trackingType: 'standard_cost', active: true }, baseIngredients()[1]],
    });
    const result = createOrder({ lines: [{ menuId: 'menu-sc', quantity: 1, unitSellingPrice: 100, addOns: [] }] }, ctx, '2026-01-02');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.shortages.some((s) => s.ingredientId === 'ing-sc')).toBe(true);
  });
});
