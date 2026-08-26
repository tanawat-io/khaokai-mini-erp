// Real backend implementation of RepositoryContract (Phase 3B §7). Talks to the Express API
// over fetch() (proxied through Vite's dev server at /api — see vite.config.ts — so this stays
// same-origin and cookies are sent automatically). Contains NO business logic of its own: it
// only serializes requests and maps the server's { error: { code, message, details } } envelope
// back into the same CatalogResult/OrderResult shapes the domain layer already defines, so
// screens and state/store.ts don't need new result-handling logic for the real backend.

import type { AddOn, Ingredient, Menu, Order, ProcessingBatch, PurchaseBatch, Store, WasteRecord } from '@/domain/types';
import type { OrderDraft } from '@/domain/stockCheck';
import type { CatalogItemInput, IngredientInput } from '@/domain/catalog';
import type { PurchaseInput, ProcessingInput, WasteInput } from '@/domain/inventory';
import type { RepositorySnapshot, CatalogResult } from './mockRepository';
import type { OrderResult } from '@/domain/orderEngine';
import type { RepositoryContract } from './contract';

async function catalogCall<T>(path: string, init?: RequestInit): Promise<CatalogResult<T>> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors: string[] = body?.error?.details?.errors ?? [body?.error?.message ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'];
    return { ok: false, errors };
  }
  return { ok: true, item: body as T };
}

async function orderCall(path: string, init?: RequestInit): Promise<OrderResult> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, shortages: body?.error?.details?.shortages ?? [] };
  }
  return { ok: true, order: body as Order };
}

async function getSnapshot(): Promise<RepositorySnapshot> {
  const res = await fetch('/api/snapshot');
  if (!res.ok) throw new Error(`GET /api/snapshot failed: ${res.status}`);
  return res.json();
}

export const apiRepository: RepositoryContract = {
  getSnapshot,

  createOrder: (sellingDate, draft) => orderCall('/api/orders', { method: 'POST', body: JSON.stringify(draft) }),
  editOrder: (orderId, draft) => orderCall(`/api/orders/${orderId}`, { method: 'PUT', body: JSON.stringify(draft) }),
  voidOrder: (orderId) => orderCall(`/api/orders/${orderId}/void`, { method: 'POST' }),

  createIngredient: (input) => catalogCall<Ingredient>('/api/ingredients', { method: 'POST', body: JSON.stringify(input) }),
  updateIngredient: (id, input) => catalogCall<Ingredient>(`/api/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setIngredientActive: (id, active) =>
    catalogCall<Ingredient>(`/api/ingredients/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  createMenu: (input) => catalogCall<Menu>('/api/menus', { method: 'POST', body: JSON.stringify(input) }),
  updateMenu: (id, input) => catalogCall<Menu>(`/api/menus/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setMenuActive: (id, active) => catalogCall<Menu>(`/api/menus/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  createAddOn: (input) => catalogCall<AddOn>('/api/add-ons', { method: 'POST', body: JSON.stringify(input) }),
  updateAddOn: (id, input) => catalogCall<AddOn>(`/api/add-ons/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setAddOnActive: (id, active) => catalogCall<AddOn>(`/api/add-ons/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  createPurchase: (input) => catalogCall<PurchaseBatch>('/api/purchases', { method: 'POST', body: JSON.stringify(input) }),
  createProcessing: (input) => catalogCall<ProcessingBatch>('/api/processing', { method: 'POST', body: JSON.stringify(input) }),
  recordWaste: (input) => catalogCall<WasteRecord>('/api/waste', { method: 'POST', body: JSON.stringify(input) }),

  updateStoreName: (name) => catalogCall<Store>('/api/settings/store-name', { method: 'PUT', body: JSON.stringify({ name }) }),
};
