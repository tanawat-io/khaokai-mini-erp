// Validation + display-cost helpers for the catalog entities (Ingredients, Menus, Add-ons).
// Pure functions only — no repository mutation here, matching fifo.ts/costing.ts. Reuses
// weightedAverageCost exactly as already scoped (display/estimate only — CALCULATION_ENGINE.md
// §4) for the Menu/Add-on list's "current estimated cost" (UI_SPEC.md §6).

import type { AddOnItemRecipe, Ingredient, MenuItemRecipe, PurchaseBatch, TrackingType } from './types';
import { round2, weightedAverageCost } from './costing';

export const TRACKING_TYPES: TrackingType[] = ['raw_by_weight', 'processed_batch', 'whole_piece', 'standard_cost'];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface IngredientInput {
  name: string;
  category: string;
  baseUnit: string;
  trackingType: TrackingType;
  standardCost?: number;
  lowStockThreshold?: number;
}

/** BUSINESS_RULES.md §4/§3-adjacent: no hard-coded quantities/costs — every field here is user-entered. */
export function validateIngredientInput(input: IngredientInput): ValidationResult {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('กรุณาระบุชื่อวัตถุดิบ');
  if (!input.category.trim()) errors.push('กรุณาระบุหมวดหมู่');
  if (!input.baseUnit.trim()) errors.push('กรุณาระบุหน่วยฐาน');
  if (input.trackingType === 'standard_cost') {
    if (input.standardCost == null || !Number.isFinite(input.standardCost) || input.standardCost <= 0) {
      errors.push('วัตถุดิบแบบ standard cost ต้องระบุต้นทุนคงที่มากกว่า 0');
    }
  }
  if (input.lowStockThreshold != null && input.lowStockThreshold < 0) {
    errors.push('เกณฑ์สต๊อกต่ำต้องไม่ติดลบ');
  }
  return { ok: errors.length === 0, errors };
}

export interface RecipeLineInput {
  ingredientId: string;
  quantity: number;
}

export interface CatalogItemInput {
  name: string;
  sellingPrice: number;
  recipe: RecipeLineInput[];
}

/**
 * Shared validation for Menus and Add-ons — both are "name + manual selling price + recipe"
 * (DATABASE.md §10-11, §12-12a). Selling price is always manual (BUSINESS_RULES.md §3) — this
 * only checks it's a positive number, it never suggests or computes one.
 */
export function validateCatalogItemInput(input: CatalogItemInput, ingredientsById: Map<string, Ingredient>): ValidationResult {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('กรุณาระบุชื่อ');
  if (!(input.sellingPrice > 0)) errors.push('ราคาขายต้องมากกว่า 0');
  if (input.recipe.length === 0) errors.push('ต้องมีส่วนประกอบอย่างน้อย 1 รายการ');
  for (const line of input.recipe) {
    const ingredient = ingredientsById.get(line.ingredientId);
    if (!ingredient) {
      errors.push('พบวัตถุดิบที่ไม่ถูกต้องในสูตร');
      continue;
    }
    if (!(line.quantity > 0)) errors.push(`ปริมาณของ ${ingredient.name} ต้องมากกว่า 0`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Display-only estimated cost of a recipe (Menu or Add-on), summing each line's ingredient
 * cost at weighted-average (or standard_cost where configured). NEVER used for actual order
 * COGS — that is always FIFO via orderEngine.ts. Matches the existing Stock screen's use of
 * weightedAverageCost for its "estimated cost" column.
 */
export function estimateRecipeCost(
  recipe: MenuItemRecipe[] | AddOnItemRecipe[],
  ingredientsById: Map<string, Ingredient>,
  purchaseBatches: PurchaseBatch[]
): number {
  let total = 0;
  for (const line of recipe) {
    const ingredient = ingredientsById.get(line.ingredientId);
    if (!ingredient) continue;
    const unitCost = ingredient.trackingType === 'standard_cost' ? ingredient.standardCost ?? 0 : weightedAverageCost(ingredient.id, purchaseBatches);
    total += line.quantity * unitCost;
  }
  return round2(total);
}
