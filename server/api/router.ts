// REST routes (Phase 3B §5). One route per RepositoryContract method — matches API_CONTRACT.md's
// actual implemented shape (see that file's Phase 3B update for why the per-entity GET rows
// collapsed into a single GET /api/snapshot: RepositoryContract itself only ever exposed one
// read method, getSnapshot(), so a real per-entity GET would be an endpoint nothing calls).
//
// Every handler here calls prismaRepository — never Prisma directly for business logic, and
// never re-implements validation/COGS/stock-check itself (Phase 3B §16: backend validation is
// the source of truth, and it already lives in src/domain/*, reused unchanged by the repository).

import { Router } from 'express';
import { prisma } from '../prisma/client';
import * as repo from '../repository/prismaRepository';
import { sendError } from './errors';
import '../auth/session'; // side-effect import: augments Express.Request with userId/storeId
import type { OrderDraft } from '../../src/domain/stockCheck';
import type { IngredientInput, CatalogItemInput } from '../../src/domain/catalog';
import type { PurchaseInput, ProcessingInput, WasteInput } from '../../src/domain/inventory';

export const router = Router();

router.get('/snapshot', async (req, res) => {
  res.json(await repo.getSnapshot(req.storeId!));
});

// --- Ingredients -------------------------------------------------------------------------------

router.post('/ingredients', async (req, res) => {
  const result = await repo.createIngredient(req.storeId!, req.body as IngredientInput);
  if (!result.ok) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join(', '), { errors: result.errors });
  res.status(201).json(result.item);
});

router.put('/ingredients/:id', async (req, res) => {
  const result = await repo.updateIngredient(req.storeId!, req.params.id, req.body as IngredientInput);
  if (!result.ok) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join(', '), { errors: result.errors });
  res.json(result.item);
});

router.patch('/ingredients/:id/active', async (req, res) => {
  const result = await repo.setIngredientActive(req.storeId!, req.params.id, Boolean(req.body?.active));
  if (!result.ok) return sendError(res, 404, 'NOT_FOUND', result.errors.join(', '));
  res.json(result.item);
});

// --- Menus ---------------------------------------------------------------------------------------

router.post('/menus', async (req, res) => {
  const result = await repo.createMenu(req.storeId!, req.body as CatalogItemInput);
  if (!result.ok) return sendError(res, 400, 'INVALID_RECIPE', result.errors.join(', '), { errors: result.errors });
  res.status(201).json(result.item);
});

router.put('/menus/:id', async (req, res) => {
  const result = await repo.updateMenu(req.storeId!, req.params.id, req.body as CatalogItemInput);
  if (!result.ok) return sendError(res, 400, 'INVALID_RECIPE', result.errors.join(', '), { errors: result.errors });
  res.json(result.item);
});

router.patch('/menus/:id/active', async (req, res) => {
  const result = await repo.setMenuActive(req.storeId!, req.params.id, Boolean(req.body?.active));
  if (!result.ok) return sendError(res, 404, 'NOT_FOUND', result.errors.join(', '));
  res.json(result.item);
});

// --- Add-ons -------------------------------------------------------------------------------------

router.post('/add-ons', async (req, res) => {
  const result = await repo.createAddOn(req.storeId!, req.body as CatalogItemInput);
  if (!result.ok) return sendError(res, 400, 'INVALID_RECIPE', result.errors.join(', '), { errors: result.errors });
  res.status(201).json(result.item);
});

router.put('/add-ons/:id', async (req, res) => {
  const result = await repo.updateAddOn(req.storeId!, req.params.id, req.body as CatalogItemInput);
  if (!result.ok) return sendError(res, 400, 'INVALID_RECIPE', result.errors.join(', '), { errors: result.errors });
  res.json(result.item);
});

router.patch('/add-ons/:id/active', async (req, res) => {
  const result = await repo.setAddOnActive(req.storeId!, req.params.id, Boolean(req.body?.active));
  if (!result.ok) return sendError(res, 404, 'NOT_FOUND', result.errors.join(', '));
  res.json(result.item);
});

// --- Purchases / Processing / Waste --------------------------------------------------------------

router.post('/purchases', async (req, res) => {
  const result = await repo.createPurchase(req.storeId!, req.body as PurchaseInput);
  if (!result.ok) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join(', '), { errors: result.errors });
  res.status(201).json(result.item);
});

router.post('/processing', async (req, res) => {
  const result = await repo.createProcessing(req.storeId!, req.body as ProcessingInput, new Date().toISOString());
  if (!result.ok) return sendError(res, 400, 'INVALID_QUANTITY', result.errors.join(', '), { errors: result.errors });
  res.status(201).json(result.item);
});

router.post('/waste', async (req, res) => {
  const result = await repo.recordWaste(req.storeId!, req.body as WasteInput, new Date().toISOString());
  if (!result.ok) {
    const code = (req.body as WasteInput)?.sourceType === 'standard_cost' ? 'STANDARD_COST_UNAVAILABLE' : 'VALIDATION_ERROR';
    return sendError(res, 400, code, result.errors.join(', '), { errors: result.errors });
  }
  res.status(201).json(result.item);
});

// --- Orders --------------------------------------------------------------------------------------
// createOrder/editOrder/voidOrder's domain-layer failure ({ok:false, shortages:[]}) doesn't
// distinguish "not found" from "already voided" — both are checked here first so the API can
// return the specific codes Phase 3B §15 requires, without changing orderEngine.ts's result shape.
// The existence checks below also double as the store-ownership check: findFirst is scoped by
// storeId, so an order id belonging to another store looks identical to a nonexistent one.

router.post('/orders', async (req, res) => {
  const storeId = req.storeId!;
  const draft = req.body as OrderDraft;
  const result = await repo.createOrderReal(storeId, '', draft); // sellingDate is server-derived — see prismaRepository.ts
  if (!result.ok) return sendError(res, 409, 'INSUFFICIENT_STOCK', 'สต๊อกไม่เพียงพอ', { shortages: result.shortages });
  res.status(201).json(result.order);
});

router.put('/orders/:id', async (req, res) => {
  const storeId = req.storeId!;
  const existing = await prisma.order.findFirst({ where: { id: req.params.id, storeId } });
  if (!existing) return sendError(res, 404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์นี้');
  if (existing.status !== 'active') return sendError(res, 409, 'ORDER_ALREADY_VOIDED', 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');

  const result = await repo.editOrderReal(storeId, req.params.id, req.body as OrderDraft);
  if (!result.ok) return sendError(res, 409, 'INSUFFICIENT_STOCK', 'สต๊อกไม่เพียงพอ', { shortages: result.shortages });
  res.json(result.order);
});

router.post('/orders/:id/void', async (req, res) => {
  const storeId = req.storeId!;
  const existing = await prisma.order.findFirst({ where: { id: req.params.id, storeId } });
  if (!existing) return sendError(res, 404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์นี้');
  if (existing.status !== 'active') return sendError(res, 409, 'ORDER_ALREADY_VOIDED', 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');

  const result = await repo.voidOrderReal(storeId, req.params.id);
  if (!result.ok) return sendError(res, 409, 'INVALID_STATUS', 'ไม่สามารถยกเลิกออเดอร์นี้ได้');
  res.json(result.order);
});

// --- Settings / Setup ------------------------------------------------------------------------------

router.put('/settings/store-name', async (req, res) => {
  const result = await repo.updateStoreName(req.storeId!, String(req.body?.name ?? ''));
  if (!result.ok) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join(', '));
  res.json(result.item);
});

router.post('/setup/complete', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return sendError(res, 400, 'VALIDATION_ERROR', 'กรุณาระบุชื่อร้าน');
  const storeId = req.storeId!;
  const updated = await prisma.store.update({ where: { id: storeId }, data: { name, setupComplete: true } });
  res.json({ id: updated.id, name: updated.name, currency: updated.currency, setupComplete: updated.setupComplete });
});
