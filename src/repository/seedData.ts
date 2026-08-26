// Static seed data: ingredients, purchase batches, pork processing, menus, add-ons.
// Orders are NOT seeded here — they're created via the real order engine in mockRepository.ts
// so every seeded order's FIFO allocation / COGS number is guaranteed consistent with the
// same logic the live app uses (no hand-computed numbers that could drift from the engine).

import type { AddOn, Ingredient, Menu, ProcessingBatch, ProcessingOutput, PurchaseBatch, Store, StockMovement, WasteRecord } from '@/domain/types';
import { allocateProcessingCost, round2 } from '@/domain/costing';

export const store: Store = {
  id: 'store-1',
  name: 'ร้านอาหารตัวอย่าง',
  currency: 'บาท (THB)',
  setupComplete: true, // mock is a fully-seeded demo — never show the first-run wizard for it
};

export const ingredients: Ingredient[] = [
  { id: 'ing-pork', name: 'หมู', category: 'เนื้อสัตว์', baseUnit: 'g', trackingType: 'processed_batch', lowStockThreshold: 500, active: true },
  { id: 'ing-chicken', name: 'ไก่', category: 'เนื้อสัตว์', baseUnit: 'g', trackingType: 'raw_by_weight', lowStockThreshold: 1000, active: true },
  { id: 'ing-egg', name: 'ไข่ไก่', category: 'ไข่', baseUnit: 'piece', trackingType: 'whole_piece', lowStockThreshold: 10, active: true },
  { id: 'ing-currypaste', name: 'พริกแกง', category: 'เครื่องปรุง', baseUnit: 'g', trackingType: 'standard_cost', standardCost: 0.6, active: true },
  { id: 'ing-coconutmilk', name: 'กะทิ', category: 'เครื่องปรุง', baseUnit: 'ml', trackingType: 'raw_by_weight', lowStockThreshold: 500, active: true },
  { id: 'ing-basil', name: 'ใบโหระพา', category: 'ผัก', baseUnit: 'g', trackingType: 'standard_cost', standardCost: 0.3, active: true },
  { id: 'ing-chili', name: 'พริก', category: 'ผัก', baseUnit: 'g', trackingType: 'standard_cost', standardCost: 0.2, active: true },
  { id: 'ing-eggplant', name: 'มะเขือ', category: 'ผัก', baseUnit: 'g', trackingType: 'raw_by_weight', lowStockThreshold: 300, active: true },
  { id: 'ing-fishsauce', name: 'น้ำปลา', category: 'เครื่องปรุง', baseUnit: 'ml', trackingType: 'raw_by_weight', lowStockThreshold: 200, active: true },
  { id: 'ing-oil', name: 'น้ำมัน', category: 'เครื่องปรุง', baseUnit: 'ml', trackingType: 'raw_by_weight', lowStockThreshold: 500, active: true },
];

// --- Purchase batches ---------------------------------------------------

export const purchaseBatches: PurchaseBatch[] = [
  // Pork — fully consumed into processing below (see processingBatches/processingOutputs).
  { id: 'pb-pork-1', ingredientId: 'ing-pork', purchaseDate: '2026-08-10', quantity: 1000, unit: 'g', totalCost: 130, unitCost: 0.13, remainingQuantity: 1000, status: 'active', reference: 'INV-2608-001' },

  // Chicken — classic two-batch FIFO demo (Batch A ฿120/kg, Batch B ฿140/kg).
  { id: 'pb-chicken-1', ingredientId: 'ing-chicken', purchaseDate: '2026-08-05', quantity: 10000, unit: 'g', totalCost: 1200, unitCost: 0.12, remainingQuantity: 10000, status: 'active', reference: 'INV-2608-A' },
  { id: 'pb-chicken-2', ingredientId: 'ing-chicken', purchaseDate: '2026-08-15', quantity: 10000, unit: 'g', totalCost: 1400, unitCost: 0.14, remainingQuantity: 10000, status: 'active', reference: 'INV-2608-B' },

  // Eggs — replicates BUSINESS_RULES.md §10 exactly (10 eggs / ฿40 → ฿4/egg), plus a second
  // batch at a different price so egg FIFO can also be observed once batch 1 depletes.
  { id: 'pb-egg-1', ingredientId: 'ing-egg', purchaseDate: '2026-08-12', quantity: 10, unit: 'piece', totalCost: 40, unitCost: 4, remainingQuantity: 10, status: 'active', reference: 'INV-2608-E1' },
  { id: 'pb-egg-2', ingredientId: 'ing-egg', purchaseDate: '2026-08-19', quantity: 30, unit: 'piece', totalCost: 135, unitCost: 4.5, remainingQuantity: 30, status: 'active', reference: 'INV-2608-E2' },

  // Curry paste — standard_cost ingredient: purchase history is still retained (BUSINESS_RULES §5),
  // but this batch is never FIFO-consumed — see ingredient.standardCost.
  { id: 'pb-currypaste-1', ingredientId: 'ing-currypaste', purchaseDate: '2026-08-07', quantity: 1000, unit: 'g', totalCost: 600, unitCost: 0.6, remainingQuantity: 1000, status: 'active', reference: 'INV-2608-C1' },

  { id: 'pb-coconutmilk-1', ingredientId: 'ing-coconutmilk', purchaseDate: '2026-08-08', quantity: 2000, unit: 'ml', totalCost: 140, unitCost: 0.07, remainingQuantity: 2000, status: 'active', reference: 'INV-2608-K1' },
  { id: 'pb-basil-1', ingredientId: 'ing-basil', purchaseDate: '2026-08-08', quantity: 500, unit: 'g', totalCost: 150, unitCost: 0.3, remainingQuantity: 500, status: 'active', reference: 'INV-2608-B1' },
  { id: 'pb-chili-1', ingredientId: 'ing-chili', purchaseDate: '2026-08-08', quantity: 1000, unit: 'g', totalCost: 200, unitCost: 0.2, remainingQuantity: 1000, status: 'active', reference: 'INV-2608-P1' },

  // Eggplant — deliberately low remaining stock (after seeded orders below) to make the
  // insufficient-stock hard block trivially reachable in the New Order screen demo.
  { id: 'pb-eggplant-1', ingredientId: 'ing-eggplant', purchaseDate: '2026-08-09', quantity: 300, unit: 'g', totalCost: 15, unitCost: 0.05, remainingQuantity: 300, status: 'active', reference: 'INV-2608-M1' },

  { id: 'pb-fishsauce-1', ingredientId: 'ing-fishsauce', purchaseDate: '2026-08-08', quantity: 1500, unit: 'ml', totalCost: 105, unitCost: 0.07, remainingQuantity: 1500, status: 'active', reference: 'INV-2608-N1' },
  { id: 'pb-oil-1', ingredientId: 'ing-oil', purchaseDate: '2026-08-08', quantity: 5000, unit: 'ml', totalCost: 350, unitCost: 0.07, remainingQuantity: 5000, status: 'active', reference: 'INV-2608-O1' },
];

// --- Stock movements (standard_cost ledger — BUSINESS_RULES.md §8a) --------
// standard_cost ingredients' available quantity is derived from this ledger, never from
// purchase-batch remainingQuantity (their batches are price-history only, see fifo.ts). Seed
// one 'purchase' movement per standard_cost purchase batch above so the seeded orders below
// (which already consume curry paste / basil / chili) pass the hard stock-availability check.
export const stockMovements: StockMovement[] = [
  {
    id: 'sm-currypaste-1',
    ingredientId: 'ing-currypaste',
    sourceType: 'standard_cost',
    quantityDelta: 1000,
    movementType: 'purchase',
    referenceType: 'purchase',
    referenceId: 'pb-currypaste-1',
    createdAt: '2026-08-07T08:00:00+07:00',
  },
  {
    id: 'sm-basil-1',
    ingredientId: 'ing-basil',
    sourceType: 'standard_cost',
    quantityDelta: 500,
    movementType: 'purchase',
    referenceType: 'purchase',
    referenceId: 'pb-basil-1',
    createdAt: '2026-08-08T08:00:00+07:00',
  },
  {
    id: 'sm-chili-1',
    ingredientId: 'ing-chili',
    sourceType: 'standard_cost',
    quantityDelta: 1000,
    movementType: 'purchase',
    referenceType: 'purchase',
    referenceId: 'pb-chili-1',
    createdAt: '2026-08-08T08:00:00+07:00',
  },
];

// --- Pork processing (input-gram basis; matches CALCULATION_ENGINE.md §6 worked example) ---

const porkAllocation = allocateProcessingCost(
  1000,
  130,
  [
    { portionSize: 80, portionCount: 8 },
    { portionSize: 50, portionCount: 4 },
  ],
  160
);

export const processingBatches: ProcessingBatch[] = [
  { id: 'pbatch-pork-1', sourceBatchId: 'pb-pork-1', ingredientId: 'ing-pork', processedAt: '2026-08-11T09:00:00+07:00', inputQuantity: 1000, inputCost: 130, status: 'active' },
];

// Source purchase batch is fully consumed by processing.
purchaseBatches.find((b) => b.id === 'pb-pork-1')!.remainingQuantity = 0;
purchaseBatches.find((b) => b.id === 'pb-pork-1')!.status = 'depleted';

export const processingOutputs: ProcessingOutput[] = porkAllocation.outputs.map((o) => ({
  id: `po-pork-${o.portionSize}`,
  processingBatchId: 'pbatch-pork-1',
  ingredientId: 'ing-pork',
  quantity: o.quantity,
  remainingQuantity: o.quantity,
  unitCost: porkAllocation.unitCost,
  allocatedCost: o.allocatedCost,
  portionSize: o.portionSize,
  portionCount: o.portionCount,
  outputType: 'portion',
  createdAt: '2026-08-11T09:00:00+07:00',
  status: 'active',
}));

export const wasteRecords: WasteRecord[] = [
  {
    id: 'waste-pork-1',
    ingredientId: 'ing-pork',
    sourceType: 'purchase_batch',
    sourceBatchId: 'pb-pork-1',
    processingBatchId: 'pbatch-pork-1',
    quantity: porkAllocation.wasteQuantity,
    unitCost: porkAllocation.unitCost,
    wasteValue: porkAllocation.wasteCost,
    reason: 'ตัดแต่งหมู (เศษ/มัน/หนัง) ระหว่างการแล่เป็นส่วน',
    createdAt: '2026-08-11T09:00:00+07:00',
  },
];

// --- Menus ---------------------------------------------------------------

export const menus: Menu[] = [
  {
    id: 'menu-padkrapao-moo',
    name: 'ผัดกะเพราหมู',
    sellingPrice: 50,
    active: true,
    recipe: [
      { ingredientId: 'ing-pork', quantity: 80 },
      { ingredientId: 'ing-chili', quantity: 15 },
      { ingredientId: 'ing-basil', quantity: 10 },
      { ingredientId: 'ing-fishsauce', quantity: 10 },
      { ingredientId: 'ing-oil', quantity: 10 },
    ],
  },
  {
    id: 'menu-greencurry-chicken',
    name: 'แกงเขียวหวานไก่',
    sellingPrice: 60,
    active: true,
    recipe: [
      { ingredientId: 'ing-chicken', quantity: 150 },
      { ingredientId: 'ing-currypaste', quantity: 40 },
      { ingredientId: 'ing-coconutmilk', quantity: 100 },
      { ingredientId: 'ing-eggplant', quantity: 50 },
      { ingredientId: 'ing-basil', quantity: 5 },
      { ingredientId: 'ing-fishsauce', quantity: 5 },
    ],
  },
  {
    id: 'menu-greencurry-pork',
    name: 'แกงเขียวหวานหมู',
    sellingPrice: 55,
    active: true,
    recipe: [
      { ingredientId: 'ing-pork', quantity: 80 },
      { ingredientId: 'ing-currypaste', quantity: 40 },
      { ingredientId: 'ing-coconutmilk', quantity: 100 },
      { ingredientId: 'ing-eggplant', quantity: 50 },
    ],
  },
  {
    id: 'menu-friedchicken-garlic',
    name: 'ไก่ทอดกระเทียม',
    sellingPrice: 45,
    active: true,
    recipe: [
      { ingredientId: 'ing-chicken', quantity: 400 },
      { ingredientId: 'ing-oil', quantity: 15 },
      { ingredientId: 'ing-fishsauce', quantity: 5 },
    ],
  },
];

// --- Add-ons — each has its own ingredient/quantity recipe (approved decision 5) ---

export const addOns: AddOn[] = [
  {
    id: 'addon-friedegg',
    name: 'ไข่ดาว',
    sellingPrice: 10,
    active: true,
    recipe: [{ ingredientId: 'ing-egg', quantity: 1 }],
  },
  {
    id: 'addon-omelette',
    name: 'ไข่เจียว',
    sellingPrice: 15,
    active: true,
    recipe: [
      { ingredientId: 'ing-egg', quantity: 2 },
      { ingredientId: 'ing-oil', quantity: 10 },
    ],
  },
  {
    id: 'addon-extrapork',
    name: 'เพิ่มหมู',
    sellingPrice: 15,
    active: true,
    recipe: [{ ingredientId: 'ing-pork', quantity: 40 }],
  },
];

export const round2Export = round2;
