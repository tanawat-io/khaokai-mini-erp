// Repository contract (Phase 3A Part C, converted to async in Phase 3B §6). Formalizes the
// operation surface both mockRepository.ts and the real apiRepository.ts implement, so
// `src/repository/index.ts`'s binding is the only place that switches between them; domain/ and
// screens/ never import either implementation directly.
//
// Async since Phase 3B: a real network-backed implementation is inherently asynchronous.
// mockRepository.ts's functions are still synchronous internally — they're wrapped in
// Promise.resolve(...) at the point they're bound to this contract (see mockRepository.ts's
// bottom-of-file export), so its actual behavior/timing is unchanged; only the call sites
// (state/store.ts, screens) now need to await.

import type { AddOn, Ingredient, Menu, Order, ProcessingBatch, PurchaseBatch, Store, WasteRecord } from '@/domain/types';
import type { OrderDraft } from '@/domain/stockCheck';
import type { CatalogItemInput, IngredientInput } from '@/domain/catalog';
import type { PurchaseInput, ProcessingInput, WasteInput } from '@/domain/inventory';
import type { RepositorySnapshot, CatalogResult } from './mockRepository';
import type { OrderResult } from '@/domain/orderEngine';

export interface RepositoryContract {
  getSnapshot(): Promise<RepositorySnapshot>;

  // Orders
  createOrder(sellingDate: string, draft: OrderDraft): Promise<OrderResult>;
  editOrder(orderId: string, draft: OrderDraft): Promise<OrderResult>;
  voidOrder(orderId: string): Promise<OrderResult>;

  // Catalog — create/update/toggle-active only, no hard delete (DATABASE.md §19)
  createIngredient(input: IngredientInput): Promise<CatalogResult<Ingredient>>;
  updateIngredient(id: string, input: IngredientInput): Promise<CatalogResult<Ingredient>>;
  setIngredientActive(id: string, active: boolean): Promise<CatalogResult<Ingredient>>;

  createMenu(input: CatalogItemInput): Promise<CatalogResult<Menu>>;
  updateMenu(id: string, input: CatalogItemInput): Promise<CatalogResult<Menu>>;
  setMenuActive(id: string, active: boolean): Promise<CatalogResult<Menu>>;

  createAddOn(input: CatalogItemInput): Promise<CatalogResult<AddOn>>;
  updateAddOn(id: string, input: CatalogItemInput): Promise<CatalogResult<AddOn>>;
  setAddOnActive(id: string, active: boolean): Promise<CatalogResult<AddOn>>;

  // Inventory — create-only for Purchases/Waste, immutable ledger entries (BUSINESS_RULES.md §5).
  // Processing additionally supports void (correct a mistake by canceling + re-entering) —
  // guarded to only when nothing it produced has been consumed yet (domain/processingEngine.ts).
  createPurchase(input: PurchaseInput): Promise<CatalogResult<PurchaseBatch>>;
  createProcessing(input: ProcessingInput, nowIso: string): Promise<CatalogResult<ProcessingBatch>>;
  voidProcessing(batchId: string): Promise<CatalogResult<ProcessingBatch>>;
  recordWaste(input: WasteInput, nowIso: string): Promise<CatalogResult<WasteRecord>>;

  // Settings
  updateStoreName(name: string): Promise<CatalogResult<Store>>;
}
