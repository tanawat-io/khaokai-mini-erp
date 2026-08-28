// Application state — the only thing UI components read from and dispatch actions to.
// Async since Phase 3B (RepositoryContract now returns Promises — see contract.ts): every
// action awaits the repository call, then awaits a fresh getSnapshot() to refresh state. A
// snapshot fetch that fails after an otherwise-successful mutation surfaces via `error`/
// `refreshError` below rather than as an unhandled rejection — the mutation itself already
// succeeded (the result returned to the caller reflects that); only the subsequent read failed.

import { create } from 'zustand';
import type { RepositorySnapshot } from '@/repository/mockRepository';
import { repository, today } from '@/repository';
import type { OrderDraft } from '@/domain/stockCheck';
import type { StockShortage } from '@/domain/stockCheck';
import type { CatalogItemInput, IngredientInput } from '@/domain/catalog';
import type { PurchaseInput, ProcessingInput, WasteInput } from '@/domain/inventory';

export interface ActionResult {
  ok: boolean;
  shortages?: StockShortage[];
  orderId?: string;
}

export interface CatalogActionResult {
  ok: boolean;
  errors?: string[];
  id?: string;
}

interface AppState extends RepositorySnapshot {
  loading: boolean;
  refreshError: string | null;

  submitNewOrder: (draft: OrderDraft) => Promise<ActionResult>;
  submitEditOrder: (orderId: string, draft: OrderDraft) => Promise<ActionResult>;
  submitVoidOrder: (orderId: string) => Promise<ActionResult>;
  refresh: () => Promise<void>;

  submitCreateIngredient: (input: IngredientInput) => Promise<CatalogActionResult>;
  submitUpdateIngredient: (id: string, input: IngredientInput) => Promise<CatalogActionResult>;
  submitToggleIngredientActive: (id: string, active: boolean) => Promise<CatalogActionResult>;

  submitCreateMenu: (input: CatalogItemInput) => Promise<CatalogActionResult>;
  submitUpdateMenu: (id: string, input: CatalogItemInput) => Promise<CatalogActionResult>;
  submitToggleMenuActive: (id: string, active: boolean) => Promise<CatalogActionResult>;

  submitCreateAddOn: (input: CatalogItemInput) => Promise<CatalogActionResult>;
  submitUpdateAddOn: (id: string, input: CatalogItemInput) => Promise<CatalogActionResult>;
  submitToggleAddOnActive: (id: string, active: boolean) => Promise<CatalogActionResult>;

  submitCreatePurchase: (input: PurchaseInput) => Promise<CatalogActionResult>;
  submitCreateProcessing: (input: ProcessingInput) => Promise<CatalogActionResult>;
  submitVoidProcessing: (batchId: string) => Promise<CatalogActionResult>;
  submitRecordWaste: (input: WasteInput) => Promise<CatalogActionResult>;
  submitUpdateStoreName: (name: string) => Promise<CatalogActionResult>;
}

const emptySnapshot: RepositorySnapshot = {
  ingredients: [],
  purchaseBatches: [],
  processingBatches: [],
  processingOutputs: [],
  wasteRecords: [],
  menus: [],
  addOns: [],
  orders: [],
  stockMovements: [],
  store: { id: '', name: '', currency: '', setupComplete: false },
};

async function refreshSnapshot(set: (partial: Partial<AppState>) => void) {
  try {
    const snapshot = await repository.getSnapshot();
    set({ ...snapshot, refreshError: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 401 must drive auth transition, not a generic banner — apiRepository's unauth handler
    // already flips authStore, but keep fallback for non-apiRepository paths and avoid noise.
    if (msg === 'UNAUTHENTICATED' || msg.includes('401')) {
      try {
        const { useAuthStore } = await import('@/state/authStore');
        useAuthStore.setState({ status: 'unauthenticated', username: null });
      } catch {
        // ignore dynamic-import failure — App.tsx gate will still see 401 via handler
      }
      return;
    }
    set({ refreshError: msg || 'ไม่สามารถโหลดข้อมูลล่าสุดได้' });
  }
}

export const useAppStore = create<AppState>((set) => ({
  ...emptySnapshot,
  loading: true,
  refreshError: null,

  refresh: () => refreshSnapshot(set),

  submitNewOrder: async (draft) => {
    const result = await repository.createOrder(today(), draft);
    if (!result.ok) return { ok: false, shortages: result.shortages };
    await refreshSnapshot(set);
    return { ok: true, orderId: result.order.id };
  },

  submitEditOrder: async (orderId, draft) => {
    const result = await repository.editOrder(orderId, draft);
    if (!result.ok) return { ok: false, shortages: result.shortages };
    await refreshSnapshot(set);
    return { ok: true, orderId: result.order.id };
  },

  submitVoidOrder: async (orderId) => {
    const result = await repository.voidOrder(orderId);
    if (!result.ok) return { ok: false };
    await refreshSnapshot(set);
    return { ok: true, orderId: result.order.id };
  },

  submitCreateIngredient: async (input) => {
    const result = await repository.createIngredient(input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitUpdateIngredient: async (id, input) => {
    const result = await repository.updateIngredient(id, input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitToggleIngredientActive: async (id, active) => {
    const result = await repository.setIngredientActive(id, active);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },

  submitCreateMenu: async (input) => {
    const result = await repository.createMenu(input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitUpdateMenu: async (id, input) => {
    const result = await repository.updateMenu(id, input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitToggleMenuActive: async (id, active) => {
    const result = await repository.setMenuActive(id, active);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },

  submitCreateAddOn: async (input) => {
    const result = await repository.createAddOn(input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitUpdateAddOn: async (id, input) => {
    const result = await repository.updateAddOn(id, input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitToggleAddOnActive: async (id, active) => {
    const result = await repository.setAddOnActive(id, active);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },

  submitCreatePurchase: async (input) => {
    const result = await repository.createPurchase(input);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitCreateProcessing: async (input) => {
    const result = await repository.createProcessing(input, new Date().toISOString());
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitVoidProcessing: async (batchId) => {
    const result = await repository.voidProcessing(batchId);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitRecordWaste: async (input) => {
    const result = await repository.recordWaste(input, new Date().toISOString());
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
  submitUpdateStoreName: async (name) => {
    const result = await repository.updateStoreName(name);
    if (!result.ok) return { ok: false, errors: result.errors };
    await refreshSnapshot(set);
    return { ok: true, id: result.item.id };
  },
}));

/**
 * First data load — deliberately NOT run automatically at module import time. The real backend
 * requires an authenticated session first (GET /api/snapshot is 401 before login), so App.tsx's
 * auth gate calls this once a session is confirmed (or immediately for the mock, which has no
 * auth concept). Screens render a loading state via `loading` until this resolves — see
 * AppShell/App.tsx.
 */
export async function loadInitialSnapshot() {
  await refreshSnapshot(useAppStore.setState);
  useAppStore.setState({ loading: false });
}
