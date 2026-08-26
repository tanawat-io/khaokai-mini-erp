import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { getEligibleLots } from '@/domain/fifo';
import { getStandardCostAvailableQuantity } from '@/domain/stockCheck';
import { validateWasteInput, type WasteInput } from '@/domain/inventory';
import { round2 } from '@/domain/costing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatBaht, formatDateTimeThai } from '@/lib/format';

const sourceTypeLabel: Record<string, string> = {
  purchase_batch: 'ล็อตซื้อ',
  processing_output: 'ล็อตแปรรูป',
  standard_cost: 'Standard cost',
};

function emptyForm(ingredientId: string, isStandardCost: boolean): WasteInput {
  return { ingredientId, sourceType: isStandardCost ? 'standard_cost' : 'purchase_batch', sourceBatchId: '', quantity: 0, reason: '' };
}

export function Waste() {
  const { ingredients, purchaseBatches, processingOutputs, wasteRecords, stockMovements, submitRecordWaste } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<WasteInput>(emptyForm('', false));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ingredientById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const wastableIngredients = useMemo(() => ingredients.filter((i) => i.active), [ingredients]);

  const selectedIngredient = ingredientById.get(form.ingredientId);
  const isStandardCost = selectedIngredient?.trackingType === 'standard_cost';

  const lotsForForm = useMemo(() => {
    const ing = ingredientById.get(form.ingredientId);
    if (!ing || ing.trackingType === 'standard_cost') return [];
    return getEligibleLots(ing.id, ing.trackingType, purchaseBatches, processingOutputs);
  }, [form.ingredientId, ingredientById, purchaseBatches, processingOutputs]);

  const selectedLot = lotsForForm.find((l) => l.sourceType === form.sourceType && l.sourceBatchId === form.sourceBatchId);

  const standardCostAvailable = useMemo(
    () => (isStandardCost ? getStandardCostAvailableQuantity(form.ingredientId, stockMovements) : 0),
    [isStandardCost, form.ingredientId, stockMovements]
  );

  const sorted = useMemo(() => [...wasteRecords].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [wasteRecords]);

  function openCreate() {
    const firstIngredient = wastableIngredients[0]?.id ?? '';
    const firstIsStandardCost = ingredientById.get(firstIngredient)?.trackingType === 'standard_cost';
    const lots = firstIngredient && !firstIsStandardCost ? getEligibleLots(firstIngredient, ingredientById.get(firstIngredient)!.trackingType, purchaseBatches, processingOutputs) : [];
    const first = lots[0];
    setForm({
      ingredientId: firstIngredient,
      sourceType: firstIsStandardCost ? 'standard_cost' : first?.sourceType ?? 'purchase_batch',
      sourceBatchId: first?.sourceBatchId ?? '',
      quantity: 0,
      reason: '',
    });
    setErrors([]);
    setCreating(true);
  }

  function closeForm() {
    setCreating(false);
    setErrors([]);
  }

  function handleIngredientChange(id: string) {
    const ing = ingredientById.get(id);
    const isSc = ing?.trackingType === 'standard_cost';
    const lots = ing && !isSc ? getEligibleLots(id, ing.trackingType, purchaseBatches, processingOutputs) : [];
    const first = lots[0];
    setForm({ ingredientId: id, sourceType: isSc ? 'standard_cost' : first?.sourceType ?? 'purchase_batch', sourceBatchId: first?.sourceBatchId ?? '', quantity: 0, reason: '' });
  }

  function handleLotChange(key: string) {
    const [sourceType, sourceBatchId] = key.split('::') as [WasteInput['sourceType'], string];
    setForm((f) => ({ ...f, sourceType, sourceBatchId }));
  }

  async function handleSave() {
    if (saving) return;
    const check = validateWasteInput(form, selectedLot, standardCostAvailable);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      const result = await submitRecordWaste(form);
      if (!result.ok) {
        setErrors(result.errors ?? ['บันทึกไม่สำเร็จ']);
        return;
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  const wasteValuePreview = isStandardCost
    ? round2(form.quantity * (selectedIngredient?.standardCost ?? 0))
    : selectedLot && form.quantity > 0
      ? round2(form.quantity * selectedLot.unitCost)
      : 0;

  const canSave = isStandardCost || lotsForForm.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warmgray-900">ของเสีย</h1>
          <p className="text-sm text-warmgray-500">บันทึกของเสียจากล็อตซื้อหรือล็อตแปรรูปที่มีอยู่ — สต๊อกและมูลค่าจะถูกตัดออกทันที</p>
        </div>
        <Button onClick={openCreate} disabled={wastableIngredients.length === 0}>
          + บันทึกของเสีย
        </Button>
      </div>

      {wastableIngredients.length === 0 ? (
        <Card className="py-10 text-center text-warmgray-500">ยังไม่มีวัตถุดิบที่ใช้งานอยู่</Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {sorted.map((w) => (
              <Card key={w.id}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-warmgray-900">{ingredientById.get(w.ingredientId)?.name ?? w.ingredientId}</div>
                  <Badge tone="danger">฿{formatBaht(w.wasteValue)}</Badge>
                </div>
                <div className="mt-1 text-sm text-warmgray-500">
                  {formatDateTimeThai(w.createdAt)} · {sourceTypeLabel[w.sourceType]} · {w.quantity} {ingredientById.get(w.ingredientId)?.baseUnit ?? ''}
                </div>
                <div className="mt-1 text-sm text-warmgray-500">เหตุผล: {w.reason}</div>
              </Card>
            ))}
            {sorted.length === 0 && <Card className="py-10 text-center text-warmgray-500">ยังไม่มีของเสีย</Card>}
          </div>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-warmgray-50 text-left text-xs uppercase tracking-wide text-warmgray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">วันที่</th>
                  <th className="px-4 py-3 font-medium">วัตถุดิบ</th>
                  <th className="px-4 py-3 font-medium">แหล่งที่มา</th>
                  <th className="px-4 py-3 font-medium text-right">จำนวน</th>
                  <th className="px-4 py-3 font-medium text-right">ต้นทุน/หน่วย</th>
                  <th className="px-4 py-3 font-medium text-right">มูลค่าของเสีย</th>
                  <th className="px-4 py-3 font-medium">เหตุผล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {sorted.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3 text-warmgray-600">{formatDateTimeThai(w.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-warmgray-900">{ingredientById.get(w.ingredientId)?.name ?? w.ingredientId}</td>
                    <td className="px-4 py-3 text-warmgray-500">
                      {sourceTypeLabel[w.sourceType]}
                      {w.sourceBatchId ? ` · ${w.sourceBatchId}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-warmgray-700">
                      {w.quantity} {ingredientById.get(w.ingredientId)?.baseUnit ?? ''}
                    </td>
                    <td className="px-4 py-3 text-right text-warmgray-700">฿{formatBaht(w.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-danger-700">฿{formatBaht(w.wasteValue)}</td>
                    <td className="px-4 py-3 text-warmgray-500">{w.reason}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-warmgray-400">
                      ยังไม่มีของเสีย
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {creating && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-warmgray-900">บันทึกของเสียใหม่</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">วัตถุดิบ</label>
              <select
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.ingredientId}
                onChange={(e) => handleIngredientChange(e.target.value)}
              >
                {wastableIngredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            {isStandardCost ? (
              <div className="rounded-md border border-warmgray-200 bg-warmgray-50 px-3 py-2 text-sm text-warmgray-600">
                วัตถุดิบแบบ standard cost ไม่มีล็อต — มีอยู่ {standardCostAvailable} {selectedIngredient?.baseUnit ?? ''} (คำนวณจากประวัติการเคลื่อนไหวสต๊อก)
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">ล็อตที่มีของเสีย</label>
                {lotsForForm.length === 0 ? (
                  <div className="rounded-md border border-warning-500/40 bg-warning-50/40 px-3 py-2 text-sm text-warning-700">
                    วัตถุดิบนี้ไม่มีล็อตที่พร้อมใช้งาน
                  </div>
                ) : (
                  <select
                    className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                    value={`${form.sourceType}::${form.sourceBatchId}`}
                    onChange={(e) => handleLotChange(e.target.value)}
                  >
                    {lotsForForm.map((l) => (
                      <option key={`${l.sourceType}::${l.sourceBatchId}`} value={`${l.sourceType}::${l.sourceBatchId}`}>
                        {sourceTypeLabel[l.sourceType]} · {l.sourceBatchId} · เหลือ {l.remainingQuantity} @ ฿{formatBaht(l.unitCost)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm text-warmgray-500">
                จำนวนของเสีย {isStandardCost ? `— มีอยู่ ${standardCostAvailable}` : selectedLot ? `— มีอยู่ ${selectedLot.remainingQuantity}` : ''}
              </label>
              <input
                type="number"
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.quantity}
                min={0}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-warmgray-500">เหตุผล</label>
              <input
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="เช่น หมดอายุ, ตกพื้น, เสียระหว่างจัดเก็บ"
              />
            </div>

            <div className="flex justify-between border-t border-warmgray-100 pt-3 text-sm">
              <span className="text-warmgray-500">มูลค่าของเสีย (คำนวณอัตโนมัติ)</span>
              <span className="font-semibold text-danger-700">฿{formatBaht(wasteValuePreview)}</span>
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
              <Button variant="danger" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกของเสีย'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
