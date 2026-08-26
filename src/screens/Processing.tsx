import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { validateProcessingInput, type ProcessingInput } from '@/domain/inventory';
import { allocateProcessingCost, round2 } from '@/domain/costing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatBaht, formatDateTimeThai } from '@/lib/format';

interface OutputGroupForm {
  portionSize: number;
  portionCount: number;
}

function emptyForm(sourceBatchId: string): ProcessingInput {
  return { sourceBatchId, inputQuantity: 0, outputs: [{ portionSize: 0, portionCount: 0 }], wasteQuantity: 0, wasteReason: '' };
}

export function Processing() {
  const { ingredients, purchaseBatches, processingBatches, processingOutputs, wasteRecords, submitCreateProcessing } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [ingredientId, setIngredientId] = useState('');
  const [form, setForm] = useState<ProcessingInput>(emptyForm(''));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ingredientById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  // standard_cost ingredients bypass FIFO entirely at order time (orderEngine.ts consumeIngredient),
  // so processing outputs created from them would never be consumable by any order — excluded here.
  const eligibleIngredients = useMemo(() => ingredients.filter((i) => i.active && i.trackingType !== 'standard_cost'), [ingredients]);

  const sourceBatchOptions = useMemo(
    () => purchaseBatches.filter((b) => b.ingredientId === ingredientId && b.status === 'active' && b.remainingQuantity > 0).sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate)),
    [purchaseBatches, ingredientId]
  );

  const sortedBatches = useMemo(() => [...processingBatches].sort((a, b) => (a.processedAt < b.processedAt ? 1 : -1)), [processingBatches]);

  function openCreate() {
    const firstIngredient = eligibleIngredients[0]?.id ?? '';
    setIngredientId(firstIngredient);
    const firstBatch = purchaseBatches.find((b) => b.ingredientId === firstIngredient && b.status === 'active' && b.remainingQuantity > 0);
    setForm(emptyForm(firstBatch?.id ?? ''));
    setErrors([]);
    setCreating(true);
  }

  function closeForm() {
    setCreating(false);
    setErrors([]);
  }

  function handleIngredientChange(id: string) {
    setIngredientId(id);
    const firstBatch = purchaseBatches.find((b) => b.ingredientId === id && b.status === 'active' && b.remainingQuantity > 0);
    setForm(emptyForm(firstBatch?.id ?? ''));
  }

  function updateOutput(index: number, patch: Partial<OutputGroupForm>) {
    setForm((f) => ({ ...f, outputs: f.outputs.map((o, i) => (i === index ? { ...o, ...patch } : o)) }));
  }

  function addOutputRow() {
    setForm((f) => ({ ...f, outputs: [...f.outputs, { portionSize: 0, portionCount: 0 }] }));
  }

  function removeOutputRow(index: number) {
    setForm((f) => ({ ...f, outputs: f.outputs.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (saving) return;
    const sourceBatch = purchaseBatches.find((b) => b.id === form.sourceBatchId);
    const check = validateProcessingInput(form, sourceBatch);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      const result = await submitCreateProcessing(form);
      if (!result.ok) {
        setErrors(result.errors ?? ['บันทึกไม่สำเร็จ']);
        return;
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  const sourceBatch = purchaseBatches.find((b) => b.id === form.sourceBatchId);
  // Processing isn't gram-only by data model (DATABASE.md §5 doesn't restrict processed_batch
  // to weight-tracked ingredients) — read the real unit instead of assuming grams.
  const selectedUnit = ingredientById.get(ingredientId)?.baseUnit ?? '';
  const inputCostPreview = sourceBatch ? round2(form.inputQuantity * sourceBatch.unitCost) : 0;
  const allocationPreview =
    sourceBatch && form.inputQuantity > 0 ? allocateProcessingCost(form.inputQuantity, inputCostPreview, form.outputs, form.wasteQuantity) : null;
  const accounted = form.outputs.reduce((s, o) => s + o.portionSize * o.portionCount, 0) + form.wasteQuantity;
  const remainder = round2(form.inputQuantity - accounted);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warmgray-900">การแปรรูป</h1>
          <p className="text-sm text-warmgray-500">แปรรูปวัตถุดิบต้นทางเป็นผลผลิตแบบพอร์ชั่น — ต้นทุนคิดตามกรัมนำเข้า</p>
        </div>
        <Button onClick={openCreate} disabled={eligibleIngredients.length === 0}>
          + แปรรูปใหม่
        </Button>
      </div>

      {eligibleIngredients.length === 0 ? (
        <Card className="py-10 text-center text-warmgray-500">ยังไม่มีวัตถุดิบที่แปรรูปได้ — เพิ่มวัตถุดิบและบันทึกการซื้อก่อน</Card>
      ) : sortedBatches.length === 0 ? (
        <Card className="py-10 text-center text-warmgray-500">ยังไม่มีการแปรรูป</Card>
      ) : (
        <div className="space-y-3">
          {sortedBatches.map((pb) => {
            const outputs = processingOutputs.filter((o) => o.processingBatchId === pb.id);
            const waste = wasteRecords.find((w) => w.processingBatchId === pb.id);
            const ingredient = ingredientById.get(pb.ingredientId);
            return (
              <Card key={pb.id}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-warmgray-900">{ingredient?.name ?? pb.ingredientId}</div>
                  <span className="text-xs text-warmgray-400">{formatDateTimeThai(pb.processedAt)}</span>
                </div>
                <div className="mt-1 text-sm text-warmgray-500">
                  นำเข้า {pb.inputQuantity} {ingredient?.baseUnit ?? ''} · ต้นทุนนำเข้า ฿{formatBaht(pb.inputCost)} · จากล็อตซื้อ {pb.sourceBatchId}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-warmgray-500">
                      <tr>
                        <th className="py-1">ผลผลิต</th>
                        <th className="py-1 text-right">คงเหลือ</th>
                        <th className="py-1 text-right">ต้นทุน/หน่วย</th>
                        <th className="py-1 text-right">มูลค่าเริ่มต้น</th>
                        <th className="py-1">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warmgray-100">
                      {outputs.map((o) => (
                        <tr key={o.id} className="text-warmgray-700">
                          <td className="py-1.5">
                            {o.portionSize ?? o.quantity} {ingredient?.baseUnit ?? ''} × {o.portionCount ?? 1} ส่วน
                          </td>
                          <td className="py-1.5 text-right">
                            {o.remainingQuantity} {ingredient?.baseUnit ?? ''}
                          </td>
                          <td className="py-1.5 text-right">฿{formatBaht(o.unitCost)}</td>
                          <td className="py-1.5 text-right">฿{formatBaht(o.allocatedCost)}</td>
                          <td className="py-1.5">
                            {/* `status` is repurposed as "depleted" for outputs (orderEngine.ts) — label from remainingQuantity, not status */}
                            {o.remainingQuantity > 0 ? <Badge tone="success">พร้อมใช้งาน</Badge> : <Badge tone="neutral">ใช้หมดแล้ว</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {waste && (
                  <div className="mt-2 rounded-md bg-warning-50/60 px-3 py-2 text-sm text-warning-700">
                    ของเสียจากการแปรรูป: {waste.quantity} {ingredient?.baseUnit ?? ''} · ฿{formatBaht(waste.wasteValue)} — {waste.reason}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-warmgray-900">บันทึกการแปรรูปใหม่</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">วัตถุดิบต้นทาง</label>
              <select
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={ingredientId}
                onChange={(e) => handleIngredientChange(e.target.value)}
              >
                {eligibleIngredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-warmgray-500">ล็อตต้นทาง</label>
              {sourceBatchOptions.length === 0 ? (
                <div className="rounded-md border border-warning-500/40 bg-warning-50/40 px-3 py-2 text-sm text-warning-700">
                  วัตถุดิบนี้ไม่มีล็อตซื้อที่พร้อมนำไปแปรรูป — บันทึกการซื้อก่อน
                </div>
              ) : (
                <select
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.sourceBatchId}
                  onChange={(e) => setForm((f) => ({ ...f, sourceBatchId: e.target.value }))}
                >
                  {sourceBatchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference ?? b.id} · {formatDateTimeThai(b.purchaseDate)} · เหลือ {b.remainingQuantity} {b.unit} @ ฿{formatBaht(b.unitCost)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-warmgray-500">
                ปริมาณที่นำเข้าแปรรูป ({selectedUnit}) {sourceBatch ? `— มีอยู่ ${sourceBatch.remainingQuantity} ${selectedUnit}` : ''}
              </label>
              <input
                type="number"
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.inputQuantity}
                min={0}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm((f) => ({ ...f, inputQuantity: Number(e.target.value) }))}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm text-warmgray-500">ผลผลิต (ขนาดต่อส่วน × จำนวนส่วน)</label>
              </div>
              <div className="space-y-2">
                {form.outputs.map((o, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder={`ขนาด (${selectedUnit})`}
                      className="min-h-touch w-28 rounded-md border border-warmgray-300 px-2 text-[15px]"
                      value={o.portionSize}
                      min={0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateOutput(index, { portionSize: Number(e.target.value) })}
                    />
                    <span className="text-warmgray-400">×</span>
                    <input
                      type="number"
                      placeholder="จำนวนส่วน"
                      className="min-h-touch w-24 rounded-md border border-warmgray-300 px-2 text-[15px]"
                      value={o.portionCount}
                      min={0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateOutput(index, { portionCount: Number(e.target.value) })}
                    />
                    <span className="flex-1 text-sm text-warmgray-500">
                      = {o.portionSize * o.portionCount} {selectedUnit}
                      {allocationPreview && ` · ฿${formatBaht(allocationPreview.outputs[index]?.allocatedCost ?? 0)}`}
                    </span>
                    <button type="button" className="flex min-h-touch items-center px-2 text-sm text-danger-600" onClick={() => removeOutputRow(index)}>
                      ลบ
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={addOutputRow}>
                  + เพิ่มขนาดผลผลิต
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">ของเสีย ({selectedUnit})</label>
                <input
                  type="number"
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.wasteQuantity}
                  min={0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm((f) => ({ ...f, wasteQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">เหตุผลของเสีย</label>
                <input
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.wasteReason}
                  onChange={(e) => setForm((f) => ({ ...f, wasteReason: e.target.value }))}
                  disabled={form.wasteQuantity <= 0}
                  placeholder={form.wasteQuantity > 0 ? 'เช่น เศษ/มัน/หนัง' : '-'}
                />
              </div>
            </div>

            <div className="space-y-1 border-t border-warmgray-100 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-warmgray-500">ต้นทุนนำเข้า</span>
                <span className="font-medium text-warmgray-700">฿{formatBaht(inputCostPreview)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warmgray-500">ต้นทุน/กรัม (input-gram basis)</span>
                <span className="font-medium text-warmgray-700">฿{formatBaht(allocationPreview?.unitCost ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warmgray-500">มูลค่าของเสีย</span>
                <span className="font-medium text-warmgray-700">฿{formatBaht(allocationPreview?.wasteCost ?? 0)}</span>
              </div>
              <div className={`flex justify-between ${remainder === 0 ? 'text-success-700' : 'text-danger-700'}`}>
                <span>ผลผลิต + ของเสีย เทียบกับปริมาณนำเข้า</span>
                <span className="font-semibold">{remainder === 0 ? 'ครบพอดี' : `ต่างกัน ${remainder} ${selectedUnit}`}</span>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-md border border-danger-500/40 bg-danger-50/40 p-3 text-sm text-danger-700">
                {errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={closeForm} disabled={saving}>
                ยกเลิก
              </Button>
              <Button onClick={handleSave} disabled={sourceBatchOptions.length === 0 || saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
