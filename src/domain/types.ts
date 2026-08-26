// Domain types — mirror DATABASE.md (post spec-resolution-pass). Pure data, no UI concerns.

export type TrackingType = 'raw_by_weight' | 'processed_batch' | 'whole_piece' | 'standard_cost';

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  baseUnit: string; // 'g' | 'ml' | 'piece' etc — the unit all consumption/FIFO math happens in
  trackingType: TrackingType;
  standardCost?: number; // only meaningful when trackingType === 'standard_cost'
  lowStockThreshold?: number; // in baseUnit; alert fires when active remaining < threshold; feature off when undefined
  active: boolean;
}

export type BatchStatus = 'active' | 'depleted' | 'void';

export interface PurchaseBatch {
  id: string;
  ingredientId: string;
  purchaseDate: string; // ISO date
  quantity: number;
  unit: string;
  totalCost: number;
  unitCost: number; // totalCost / quantity, in baseUnit terms
  remainingQuantity: number;
  status: BatchStatus;
  reference?: string;
}

export interface ProcessingBatch {
  id: string;
  sourceBatchId: string; // PurchaseBatch id it was processed from
  ingredientId: string;
  processedAt: string;
  inputQuantity: number; // grams (base unit)
  inputCost: number;
  status: 'active' | 'void';
}

export interface ProcessingOutput {
  id: string;
  processingBatchId: string;
  ingredientId: string;
  quantity: number; // base unit (grams) — the real FIFO-consumable amount
  remainingQuantity: number;
  unitCost: number; // input-gram-basis cost per base unit
  allocatedCost: number; // quantity * unitCost
  portionSize?: number; // display only, e.g. 80 (grams per portion)
  portionCount?: number; // display only, e.g. 8
  outputType: 'portion' | 'piece' | 'usable_stock'; // display category only
  createdAt: string;
  status: 'active' | 'void';
}

export interface WasteRecord {
  id: string;
  ingredientId: string;
  sourceType: 'purchase_batch' | 'processing_output' | 'standard_cost';
  sourceBatchId?: string; // not applicable when sourceType === 'standard_cost' (BUSINESS_RULES.md §8a — no lot to reference)
  processingBatchId?: string;
  quantity: number;
  unitCost: number;
  wasteValue: number;
  reason: string;
  createdAt: string;
}

export interface MenuItemRecipe {
  ingredientId: string;
  quantity: number; // base unit
}

export interface Menu {
  id: string;
  name: string;
  sellingPrice: number;
  recipe: MenuItemRecipe[];
  active: boolean;
}

export interface AddOnItemRecipe {
  ingredientId: string;
  quantity: number; // base unit
}

export interface AddOn {
  id: string;
  name: string;
  sellingPrice: number;
  recipe: AddOnItemRecipe[]; // add_on_items — required for real FIFO-based COGS
  active: boolean;
}

export type OrderStatus = 'active' | 'voided';

export interface OrderItemAddOnLine {
  addOnId: string;
  quantity: number;
  unitSellingPrice: number;
  revenue: number;
  cogs: number;
  lineProfit: number;
}

export interface OrderItemLine {
  id: string;
  menuId: string;
  quantity: number;
  unitSellingPrice: number;
  lineRevenue: number;
  lineCogs: number;
  lineProfit: number;
  addOns: OrderItemAddOnLine[];
}

/** One resolved FIFO consumption record — traceability for COGS (DATABASE.md §17). */
export interface FifoAllocation {
  id: string;
  orderId: string;
  ingredientId: string;
  sourceType: 'purchase_batch' | 'processing_output';
  sourceBatchId: string;
  quantityConsumed: number;
  unitCost: number;
  allocatedCost: number;
}

export interface Order {
  id: string;
  orderNumber: number; // sequential per sellingDate
  sellingDate: string; // ISO date
  soldAt: string; // ISO datetime
  items: OrderItemLine[];
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  status: OrderStatus;
  fifoAllocations: FifoAllocation[]; // all allocations for this order (menu + add-on lines combined)
  editedAt?: string;
  voidedAt?: string;
}

export interface Store {
  id: string;
  name: string;
  currency: string; // read-only display (UI_SPEC.md §11b) — no multi-currency in V1
  setupComplete: boolean; // Phase 3B §14 — first-run Setup Wizard gate
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  sourceType: 'purchase_batch' | 'processing_output' | 'standard_cost';
  batchReference?: string; // not applicable when sourceType === 'standard_cost' — the ingredient reference alone identifies it (DATABASE.md §16)
  quantityDelta: number; // negative = consumption, positive = restock/reversal
  movementType: 'purchase' | 'processing_input' | 'processing_output' | 'sale_consumption' | 'waste' | 'adjustment' | 'reversal';
  referenceType: 'order' | 'purchase' | 'processing' | 'waste';
  referenceId: string;
  createdAt: string;
}
