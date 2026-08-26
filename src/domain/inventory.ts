// Validation for the inventory-input screens (Purchases, Processing, Waste). Pure functions
// only — mutation happens in the repository, matching catalog.ts's pattern. No FIFO/costing
// rule is redefined here; this only validates inputs before orderEngine.ts-adjacent mutation
// functions in mockRepository.ts apply them.

import type { Ingredient, PurchaseBatch } from './types';
import type { StockLot } from './fifo';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface PurchaseInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  totalCost: number;
  purchaseDate: string; // ISO date
  reference?: string;
}

export function validatePurchaseInput(input: PurchaseInput, ingredientsById: Map<string, Ingredient>): ValidationResult {
  const errors: string[] = [];
  if (!ingredientsById.get(input.ingredientId)) errors.push('กรุณาเลือกวัตถุดิบ');
  if (!(input.quantity > 0)) errors.push('จำนวนต้องมากกว่า 0');
  if (!input.unit.trim()) errors.push('กรุณาระบุหน่วย');
  if (!(input.totalCost >= 0)) errors.push('ราคารวมต้องไม่ติดลบ');
  if (!input.purchaseDate) errors.push('กรุณาระบุวันที่ซื้อ');
  return { ok: errors.length === 0, errors };
}

export interface ProcessingOutputGroupInput {
  portionSize: number;
  portionCount: number;
}

export interface ProcessingInput {
  sourceBatchId: string;
  inputQuantity: number;
  outputs: ProcessingOutputGroupInput[];
  wasteQuantity: number;
  wasteReason: string;
}

/**
 * CALCULATION_ENGINE.md §6: outputs + waste must account for the input quantity exactly
 * (the worked example's check: 83.20 + 26.00 + 20.80 = 130.00, matching input cost exactly).
 * A mismatch here would silently create or lose stock, so it is a hard validation error.
 */
export function validateProcessingInput(input: ProcessingInput, sourceBatch: PurchaseBatch | undefined): ValidationResult {
  const errors: string[] = [];
  if (!sourceBatch || sourceBatch.status !== 'active' || sourceBatch.remainingQuantity <= 0) {
    errors.push('กรุณาเลือกล็อตวัตถุดิบต้นทางที่ยังมีสต๊อก');
    return { ok: false, errors };
  }
  if (!(input.inputQuantity > 0)) {
    errors.push('ปริมาณที่นำเข้าแปรรูปต้องมากกว่า 0');
  } else if (input.inputQuantity > sourceBatch.remainingQuantity + 1e-9) {
    errors.push(`ปริมาณที่นำเข้าแปรรูป (${input.inputQuantity}) เกินกว่าที่มีในล็อต (${sourceBatch.remainingQuantity})`);
  }
  if (input.outputs.length === 0) errors.push('ต้องมีผลผลิตอย่างน้อย 1 รายการ');
  for (const o of input.outputs) {
    if (!(o.portionSize > 0)) errors.push('ขนาดต่อส่วนต้องมากกว่า 0');
    if (!(o.portionCount > 0)) errors.push('จำนวนส่วนต้องมากกว่า 0');
  }
  if (input.wasteQuantity < 0) errors.push('ปริมาณของเสียต้องไม่ติดลบ');
  if (input.wasteQuantity > 0 && !input.wasteReason.trim()) errors.push('กรุณาระบุเหตุผลของเสีย');

  if (errors.length === 0) {
    const outputTotal = input.outputs.reduce((s, o) => s + o.portionSize * o.portionCount, 0);
    const accounted = outputTotal + input.wasteQuantity;
    if (Math.abs(accounted - input.inputQuantity) > 0.01) {
      errors.push(`ผลผลิต + ของเสีย (${accounted}) ต้องรวมเท่ากับปริมาณนำเข้า (${input.inputQuantity}) พอดี`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface WasteInput {
  ingredientId: string;
  sourceType: 'purchase_batch' | 'processing_output' | 'standard_cost';
  sourceBatchId?: string; // not applicable when sourceType === 'standard_cost' (BUSINESS_RULES.md §8a — no lot)
  quantity: number;
  reason: string;
}

/**
 * `standard_cost` ingredients have no lot to select — validate quantity against the
 * ingredient's movement-derived available quantity instead (BUSINESS_RULES.md §8a).
 * `standardCostAvailableQuantity` is required (and only meaningful) when sourceType is standard_cost.
 */
export function validateWasteInput(input: WasteInput, lot: StockLot | undefined, standardCostAvailableQuantity?: number): ValidationResult {
  const errors: string[] = [];

  if (input.sourceType === 'standard_cost') {
    const available = standardCostAvailableQuantity ?? 0;
    if (!(input.quantity > 0)) errors.push('ปริมาณของเสียต้องมากกว่า 0');
    else if (input.quantity > available + 1e-9) {
      errors.push(`ปริมาณของเสีย (${input.quantity}) เกินกว่าที่มีอยู่ (${available})`);
    }
    if (!input.reason.trim()) errors.push('กรุณาระบุเหตุผล');
    return { ok: errors.length === 0, errors };
  }

  if (!lot) {
    errors.push('กรุณาเลือกล็อตที่มีสต๊อกพร้อมใช้งาน');
    return { ok: false, errors };
  }
  if (!(input.quantity > 0)) errors.push('ปริมาณของเสียต้องมากกว่า 0');
  else if (input.quantity > lot.remainingQuantity + 1e-9) {
    errors.push(`ปริมาณของเสีย (${input.quantity}) เกินกว่าที่เหลือในล็อต (${lot.remainingQuantity})`);
  }
  if (!input.reason.trim()) errors.push('กรุณาระบุเหตุผล');
  return { ok: errors.length === 0, errors };
}
