// Processing lifecycle: void only (no in-place edit — see file header rationale below).
// Mirrors orderEngine.ts's void semantics: never hard-delete, restore what was consumed,
// hard-block rather than cascade when downstream state has already moved.
//
// A processing batch may be voided only while every output it created is still fully
// untouched (remainingQuantity === quantity — nothing consumed by an order, no waste
// recorded against it since). Once any output has been touched, reversing would require
// unwinding whatever consumed it (an order's FIFO allocation, cascading further) — this
// system deliberately never does that (same philosophy as editOrder's hard-block-not-cascade
// on insufficient stock, orderEngine.ts §274-277). The user's fix in that case is to correct
// stock going forward (a new purchase/processing/waste entry), not rewrite history.
//
// There is no "edit" here on purpose: voiding an untouched batch and creating a new one with
// the corrected numbers achieves the exact same outcome — same guard, same reversal — without
// a second code path. The Processing screen presents this as one "ยกเลิก" action per card.

import type { ProcessingBatch, ProcessingOutput, PurchaseBatch, WasteRecord } from './types';
import { round2 } from './costing';

export interface ProcessingEngineContext {
  processingBatches: ProcessingBatch[]; // mutated in place on commit
  processingOutputs: ProcessingOutput[]; // mutated in place on commit
  purchaseBatches: PurchaseBatch[]; // mutated in place on commit
  wasteRecords: WasteRecord[]; // the processing-time waste row (if any) is removed on void
}

export type ProcessingVoidResult = { ok: true; batch: ProcessingBatch } | { ok: false; errors: string[] };

const EPSILON = 1e-9;

/** True once any output from this batch has moved away from its original quantity. */
function hasConsumedOutput(batchId: string, ctx: ProcessingEngineContext): boolean {
  return ctx.processingOutputs
    .filter((o) => o.processingBatchId === batchId)
    .some((o) => Math.abs(o.remainingQuantity - o.quantity) > EPSILON);
}

export function voidProcessing(batchId: string, ctx: ProcessingEngineContext): ProcessingVoidResult {
  const batch = ctx.processingBatches.find((b) => b.id === batchId);
  if (!batch) return { ok: false, errors: ['ไม่พบรายการแปรรูปนี้'] };
  if (batch.status !== 'active') return { ok: false, errors: ['รายการนี้ถูกยกเลิกไปแล้ว'] };
  if (hasConsumedOutput(batchId, ctx)) {
    return { ok: false, errors: ['ผลผลิตจากการแปรรูปนี้ถูกใช้ไปแล้ว (ในออเดอร์หรือของเสีย) — ไม่สามารถยกเลิกได้'] };
  }

  // Restore the source purchase batch's stock — the full inputQuantity was deducted from it
  // at creation time regardless of how much became output vs. waste.
  const sourceBatch = ctx.purchaseBatches.find((b) => b.id === batch.sourceBatchId);
  if (sourceBatch) {
    sourceBatch.remainingQuantity = round2(sourceBatch.remainingQuantity + batch.inputQuantity);
    if (sourceBatch.status === 'depleted' && sourceBatch.remainingQuantity > 0) sourceBatch.status = 'active';
  }

  // Void the (untouched) outputs — kept for audit trail, not deleted.
  for (const output of ctx.processingOutputs) {
    if (output.processingBatchId === batchId) {
      output.remainingQuantity = 0;
      output.status = 'void';
    }
  }

  // The waste record this processing created at input time (if any) never happened once the
  // batch is voided. WasteRecord has no status/void field, so this is the one hard-delete this
  // system performs — everything else here is soft-void, matching contract.ts's convention.
  const wasteIndex = ctx.wasteRecords.findIndex((w) => w.processingBatchId === batchId);
  if (wasteIndex !== -1) ctx.wasteRecords.splice(wasteIndex, 1);

  batch.status = 'void';

  return { ok: true, batch };
}
