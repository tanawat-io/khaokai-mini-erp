// Derived, read-only event timeline for the History screen (DATABASE.md §18, UI_SPEC.md §12).
// History is not a separately-persisted table — it is built from the existing repository
// arrays (purchases, processing, waste, orders), matching the event-log framing already used
// for orders (CALCULATION_ENGINE.md §22 Determinism). No new mutable state is introduced.

import type { Ingredient, Menu, Order, ProcessingBatch, ProcessingOutput, PurchaseBatch, StockMovement, WasteRecord } from './types';

export type HistoryEventType = 'purchase' | 'processing' | 'waste' | 'order' | 'order_edit' | 'order_void';

export interface HistoryEvent {
  id: string;
  date: string; // ISO datetime, used for sorting
  type: HistoryEventType;
  ingredientId?: string; // single-ingredient events only (purchase/processing/waste) — kept for those call sites
  ingredientIds: string[]; // every ingredient this event touched — the only field the ingredient filter should use, since an order/edit/void can span many ingredients across its FIFO allocations
  menuId?: string;
  reference: string; // short id/order-number label
  quantityLabel: string;
  amount: number; // baht value associated with the event (cost, waste value, or revenue)
  detail: string; // human-readable Thai description
}

export interface HistorySourceData {
  purchaseBatches: PurchaseBatch[];
  processingBatches: ProcessingBatch[];
  processingOutputs: ProcessingOutput[];
  wasteRecords: WasteRecord[];
  orders: Order[];
  ingredients: Ingredient[];
  menus: Menu[];
  stockMovements: StockMovement[];
}

export function buildHistoryEvents(data: HistorySourceData): HistoryEvent[] {
  const ingredientNameById = new Map(data.ingredients.map((i) => [i.id, i.name]));
  const menuNameById = new Map(data.menus.map((m) => [m.id, m.name]));
  const events: HistoryEvent[] = [];

  for (const b of data.purchaseBatches) {
    events.push({
      id: `purchase-${b.id}`,
      date: b.purchaseDate,
      type: 'purchase',
      ingredientId: b.ingredientId,
      ingredientIds: [b.ingredientId],
      reference: b.reference ?? b.id,
      quantityLabel: `${b.quantity} ${b.unit}`,
      amount: b.totalCost,
      detail: `ซื้อ ${ingredientNameById.get(b.ingredientId) ?? b.ingredientId} ${b.quantity} ${b.unit}`,
    });
  }

  for (const p of data.processingBatches) {
    const outputs = data.processingOutputs.filter((o) => o.processingBatchId === p.id);
    const outputLabel = outputs.map((o) => `${o.portionSize ?? o.quantity}${o.portionCount ? ` × ${o.portionCount}` : ''}`).join(', ');
    events.push({
      id: `processing-${p.id}`,
      date: p.processedAt,
      type: 'processing',
      ingredientId: p.ingredientId,
      ingredientIds: [p.ingredientId],
      reference: p.id,
      quantityLabel: `นำเข้า ${p.inputQuantity} g`,
      amount: p.inputCost,
      detail: `แปรรูป ${ingredientNameById.get(p.ingredientId) ?? p.ingredientId} — ผลผลิต ${outputLabel || '-'}`,
    });
  }

  for (const w of data.wasteRecords) {
    events.push({
      id: `waste-${w.id}`,
      date: w.createdAt,
      type: 'waste',
      ingredientId: w.ingredientId,
      ingredientIds: [w.ingredientId],
      reference: w.sourceBatchId ?? w.id,
      quantityLabel: `${w.quantity}`,
      amount: w.wasteValue,
      detail: `ของเสีย ${ingredientNameById.get(w.ingredientId) ?? w.ingredientId} — ${w.reason}`,
    });
  }

  for (const o of data.orders) {
    const menuLabel = o.items.map((i) => menuNameById.get(i.menuId) ?? i.menuId).join(', ');
    // An order can span many ingredients across all its menu-item AND add-on lines (not just
    // the first item) — derive the full set from fifoAllocations (FIFO-tracked ingredients) AND
    // stock_movements (standard_cost ingredients, which leave no FifoAllocation row — see
    // orderEngine.ts consumeIngredient / BUSINESS_RULES.md §8a) so the ingredient filter can
    // match a multi-line, mixed-tracking-type order fully.
    const standardCostIngredientIds = data.stockMovements
      .filter((m) => m.referenceType === 'order' && m.referenceId === o.id && m.sourceType === 'standard_cost')
      .map((m) => m.ingredientId);
    const orderIngredientIds = [...new Set([...o.fifoAllocations.map((a) => a.ingredientId), ...standardCostIngredientIds])];
    events.push({
      id: `order-${o.id}`,
      date: o.soldAt,
      type: 'order',
      menuId: o.items[0]?.menuId,
      ingredientIds: orderIngredientIds,
      reference: `#${o.orderNumber}`,
      quantityLabel: `${o.items.length} รายการ`,
      amount: o.totalRevenue,
      detail: `ออเดอร์ #${o.orderNumber} — ${menuLabel}`,
    });
    if (o.editedAt) {
      events.push({
        id: `order-edit-${o.id}`,
        date: o.editedAt,
        type: 'order_edit',
        ingredientIds: orderIngredientIds,
        reference: `#${o.orderNumber}`,
        quantityLabel: '-',
        amount: o.totalRevenue,
        detail: `แก้ไขออเดอร์ #${o.orderNumber}`,
      });
    }
    if (o.voidedAt) {
      events.push({
        id: `order-void-${o.id}`,
        date: o.voidedAt,
        type: 'order_void',
        ingredientIds: orderIngredientIds,
        reference: `#${o.orderNumber}`,
        quantityLabel: '-',
        amount: o.totalRevenue,
        detail: `ยกเลิกออเดอร์ #${o.orderNumber} (voided — สต๊อกคืนกลับ, ไม่นับใน Revenue/COGS/Profit)`,
      });
    }
  }

  return events.sort((a, b) => (a.date < b.date ? 1 : -1));
}
