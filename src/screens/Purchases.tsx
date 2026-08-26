import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { validatePurchaseInput, type PurchaseInput } from '@/domain/inventory';
import { today } from '@/repository';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatBaht, formatDateThai } from '@/lib/format';

const statusLabel: Record<string, string> = { active: 'ใช้งานอยู่', depleted: 'หมดแล้ว', void: 'ยกเลิก' };
const statusTone: Record<string, 'success' | 'neutral' | 'danger'> = { active: 'success', depleted: 'neutral', void: 'danger' };

function emptyInput(ingredientId: string, unit: string): PurchaseInput {
  return { ingredientId, quantity: 0, unit, totalCost: 0, purchaseDate: today(), reference: '' };
}

export function Purchases() {
  const { purchaseBatches, ingredients, submitCreatePurchase } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PurchaseInput>(() => emptyInput(ingredients[0]?.id ?? '', ingredients[0]?.baseUnit ?? ''));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ingredientNameById = useMemo(() => new Map(ingredients.map((i) => [i.id, i.name])), [ingredients]);
  const ingredientsById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const sorted = useMemo(() => [...purchaseBatches].sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)), [purchaseBatches]);

  function openCreate() {
    setForm(emptyInput(ingredients[0]?.id ?? '', ingredients[0]?.baseUnit ?? ''));
    setErrors([]);
    setCreating(true);
  }

  function closeForm() {
    setCreating(false);
    setErrors([]);
  }

  function handleIngredientChange(ingredientId: string) {
    const ing = ingredientsById.get(ingredientId);
    setForm((f) => ({ ...f, ingredientId, unit: ing?.baseUnit ?? f.unit }));
  }

  async function handleSave() {
    if (saving) return;
    const check = validatePurchaseInput(form, ingredientsById);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      const result = await submitCreatePurchase(form);
      if (!result.ok) {
        setErrors(result.errors ?? ['บันทึกไม่สำเร็จ']);
        return;
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  const unitCostPreview = form.quantity > 0 ? form.totalCost / form.quantity : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warmgray-900">การซื้อวัตถุดิบ</h1>
          <p className="text-sm text-warmgray-500">บันทึกล็อตการซื้อ — จะพร้อมใช้งานใน FIFO ทันที</p>
        </div>
        <Button onClick={openCreate}>+ บันทึกการซื้อ</Button>
      </div>

      {ingredients.length === 0 ? (
        <Card className="py-10 text-center text-warmgray-500">ยังไม่มีวัตถุดิบ — เพิ่มวัตถุดิบก่อนบันทึกการซื้อ</Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {sorted.map((b) => (
              <Card key={b.id}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-warmgray-900">{ingredientNameById.get(b.ingredientId) ?? b.ingredientId}</div>
                  <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge>
                </div>
                <div className="mt-1 flex justify-between text-sm text-warmgray-500">
                  <span>
                    {formatDateThai(b.purchaseDate)} · {b.quantity} {b.unit}
                  </span>
                  <span>฿{formatBaht(b.totalCost)}</span>
                </div>
                <div className="mt-1 text-sm text-warmgray-500">
                  คงเหลือ {b.remainingQuantity} {b.unit} · ฿{formatBaht(b.unitCost)}/{b.unit}
                </div>
              </Card>
            ))}
            {sorted.length === 0 && <Card className="py-10 text-center text-warmgray-500">ยังไม่มีการซื้อ</Card>}
          </div>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-warmgray-50 text-left text-xs uppercase tracking-wide text-warmgray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">วันที่</th>
                  <th className="px-4 py-3 font-medium">วัตถุดิบ</th>
                  <th className="px-4 py-3 font-medium text-right">จำนวน</th>
                  <th className="px-4 py-3 font-medium text-right">ราคารวม</th>
                  <th className="px-4 py-3 font-medium text-right">ต้นทุน/หน่วย</th>
                  <th className="px-4 py-3 font-medium text-right">คงเหลือ</th>
                  <th className="px-4 py-3 font-medium">อ้างอิง</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {sorted.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 text-warmgray-600">{formatDateThai(b.purchaseDate)}</td>
                    <td className="px-4 py-3 font-medium text-warmgray-900">{ingredientNameById.get(b.ingredientId) ?? b.ingredientId}</td>
                    <td className="px-4 py-3 text-right text-warmgray-700">
                      {b.quantity} {b.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-warmgray-700">฿{formatBaht(b.totalCost)}</td>
                    <td className="px-4 py-3 text-right text-warmgray-700">฿{formatBaht(b.unitCost)}</td>
                    <td className="px-4 py-3 text-right text-warmgray-700">
                      {b.remainingQuantity} {b.unit}
                    </td>
                    <td className="px-4 py-3 text-warmgray-500">{b.reference ?? '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-warmgray-400">
                      ยังไม่มีการซื้อ
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
          <div className="mb-3 text-sm font-semibold text-warmgray-900">บันทึกการซื้อใหม่</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">วัตถุดิบ</label>
              <select
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.ingredientId}
                onChange={(e) => handleIngredientChange(e.target.value)}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">จำนวน</label>
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
                <label className="mb-1 block text-sm text-warmgray-500">หน่วย (หน่วยฐานของวัตถุดิบ)</label>
                <div className="flex min-h-touch w-full items-center rounded-md border border-warmgray-200 bg-warmgray-50 px-3 text-[15px] text-warmgray-600">
                  {form.unit || '-'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">ราคารวม (บาท)</label>
                <input
                  type="number"
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.totalCost}
                  min={0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm((f) => ({ ...f, totalCost: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">วันที่ซื้อ</label>
                <input
                  type="date"
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.purchaseDate}
                  onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">อ้างอิง (เว้นว่างได้)</label>
              <input
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.reference ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>

            <div className="flex justify-between border-t border-warmgray-100 pt-3 text-sm">
              <span className="text-warmgray-500">ต้นทุน/หน่วย (คำนวณอัตโนมัติ)</span>
              <span className="font-medium text-warmgray-700">
                ฿{formatBaht(unitCostPreview)}/{form.unit || '-'}
              </span>
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
              <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
