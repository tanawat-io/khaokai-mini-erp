import { describe, it, expect } from 'vitest';
import type { ProcessingBatch, ProcessingOutput, PurchaseBatch, WasteRecord } from '../types';
import { voidProcessing, type ProcessingEngineContext } from '../processingEngine';

function baseSourceBatch(overrides?: Partial<PurchaseBatch>): PurchaseBatch {
  return {
    id: 'pb-1',
    ingredientId: 'ing-pork',
    purchaseDate: '2026-01-01',
    quantity: 1000,
    unit: 'g',
    totalCost: 100,
    unitCost: 0.1,
    remainingQuantity: 0, // fully consumed by the processing batch below
    status: 'depleted',
    ...overrides,
  };
}

function baseProcessingBatch(overrides?: Partial<ProcessingBatch>): ProcessingBatch {
  return {
    id: 'proc-1',
    sourceBatchId: 'pb-1',
    ingredientId: 'ing-pork',
    processedAt: '2026-01-02T10:00:00Z',
    inputQuantity: 1000,
    inputCost: 100,
    status: 'active',
    ...overrides,
  };
}

function baseOutputs(overrides?: (Partial<ProcessingOutput> | undefined)[]): ProcessingOutput[] {
  const defaults: ProcessingOutput[] = [
    { id: 'out-1', processingBatchId: 'proc-1', ingredientId: 'ing-pork', quantity: 640, remainingQuantity: 640, unitCost: 0.1, allocatedCost: 64, portionSize: 80, portionCount: 8, outputType: 'portion', createdAt: '2026-01-02T10:00:00Z', status: 'active' },
    { id: 'out-2', processingBatchId: 'proc-1', ingredientId: 'ing-pork', quantity: 200, remainingQuantity: 200, unitCost: 0.1, allocatedCost: 20, portionSize: 50, portionCount: 4, outputType: 'portion', createdAt: '2026-01-02T10:00:00Z', status: 'active' },
  ];
  if (!overrides) return defaults;
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}

function makeCtx(overrides?: Partial<ProcessingEngineContext>): ProcessingEngineContext {
  return {
    processingBatches: [baseProcessingBatch()],
    processingOutputs: baseOutputs(),
    purchaseBatches: [baseSourceBatch()],
    wasteRecords: [],
    ...overrides,
  };
}

describe('processingEngine — voidProcessing', () => {
  it('voids an untouched batch: restores source stock, voids outputs, keeps rows for audit', () => {
    const ctx = makeCtx();
    const result = voidProcessing('proc-1', ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.batch.status).toBe('void');
    expect(ctx.purchaseBatches[0].remainingQuantity).toBe(1000); // fully restored
    expect(ctx.purchaseBatches[0].status).toBe('active'); // depleted -> active since it has stock again
    for (const output of ctx.processingOutputs) {
      expect(output.status).toBe('void');
      expect(output.remainingQuantity).toBe(0);
    }
    // Original output.quantity is untouched — the audit trail (what was produced) is preserved.
    expect(ctx.processingOutputs[0].quantity).toBe(640);
  });

  it('removes the processing-time waste record on void, since that waste never happened', () => {
    const waste: WasteRecord = {
      id: 'w-1',
      ingredientId: 'ing-pork',
      sourceType: 'purchase_batch',
      sourceBatchId: 'pb-1',
      processingBatchId: 'proc-1',
      quantity: 160,
      unitCost: 0.1,
      wasteValue: 16,
      reason: 'เศษ/มัน/หนัง',
      createdAt: '2026-01-02T10:00:00Z',
    };
    const ctx = makeCtx({ wasteRecords: [waste] });
    const result = voidProcessing('proc-1', ctx);
    expect(result.ok).toBe(true);
    expect(ctx.wasteRecords).toHaveLength(0);
  });

  it('blocks voiding once any output has been partially consumed', () => {
    const ctx = makeCtx({ processingOutputs: baseOutputs([{ remainingQuantity: 500 }, undefined]) });
    const result = voidProcessing('proc-1', ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('ถูกใช้ไปแล้ว');
    // No mutation happened on the blocked path.
    expect(ctx.purchaseBatches[0].remainingQuantity).toBe(0);
    expect(ctx.processingBatches[0].status).toBe('active');
  });

  it('blocks voiding once an output has been fully depleted (status flipped to void by consumption)', () => {
    const ctx = makeCtx({ processingOutputs: baseOutputs([{ remainingQuantity: 0, status: 'void' }, undefined]) });
    const result = voidProcessing('proc-1', ctx);
    expect(result.ok).toBe(false);
  });

  it('blocks voiding a batch that is already void', () => {
    const ctx = makeCtx({ processingBatches: [baseProcessingBatch({ status: 'void' })] });
    const result = voidProcessing('proc-1', ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('ถูกยกเลิกไปแล้ว');
  });

  it('errors clearly when the batch id does not exist', () => {
    const ctx = makeCtx();
    const result = voidProcessing('does-not-exist', ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('ไม่พบ');
  });

  it('flips the source batch back to active from depleted only when it truly has stock again', () => {
    // Source batch already partially reduced by a different processing batch before this one —
    // restoring THIS batch's inputQuantity should still land on a sane remainingQuantity/status.
    const ctx = makeCtx({ purchaseBatches: [baseSourceBatch({ remainingQuantity: 0, status: 'depleted' })] });
    const result = voidProcessing('proc-1', ctx);
    expect(result.ok).toBe(true);
    expect(ctx.purchaseBatches[0].remainingQuantity).toBe(1000);
    expect(ctx.purchaseBatches[0].status).toBe('active');
  });
});
