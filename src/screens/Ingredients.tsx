import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { TRACKING_TYPES, validateIngredientInput, type IngredientInput } from '@/domain/catalog';
import type { TrackingType } from '@/domain/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const trackingTypeLabel: Record<TrackingType, string> = {
  raw_by_weight: 'วัตถุดิบดิบ (ตามน้ำหนัก)',
  processed_batch: 'ต้องผ่านการแปรรูปก่อน',
  whole_piece: 'นับเป็นชิ้น',
  standard_cost: 'ต้นทุนคงที่ (ไม่ติดตามล็อต)',
};

const emptyInput: IngredientInput = { name: '', category: '', baseUnit: '', trackingType: 'raw_by_weight' };

export function Ingredients() {
  const { ingredients, submitCreateIngredient, submitUpdateIngredient, submitToggleIngredientActive } = useAppStore();
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientInput>(emptyInput);
  const [errors, setErrors] = useState<string[]>([]);

  const sorted = useMemo(() => [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'th')), [ingredients]);

  function openCreate() {
    setForm(emptyInput);
    setErrors([]);
    setEditingId(null);
    setMode('create');
  }

  function openEdit(id: string) {
    const ing = ingredients.find((i) => i.id === id);
    if (!ing) return;
    setForm({
      name: ing.name,
      category: ing.category,
      baseUnit: ing.baseUnit,
      trackingType: ing.trackingType,
      standardCost: ing.standardCost,
      lowStockThreshold: ing.lowStockThreshold,
    });
    setErrors([]);
    setEditingId(id);
    setMode('edit');
  }

  function closeForm() {
    setMode('closed');
    setEditingId(null);
    setErrors([]);
  }

  async function handleSave() {
    const check = validateIngredientInput(form);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    const result = editingId ? await submitUpdateIngredient(editingId, form) : await submitCreateIngredient(form);
    if (!result.ok) {
      setErrors(result.errors ?? ['บันทึกไม่สำเร็จ']);
      return;
    }
    closeForm();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warmgray-900">วัตถุดิบ</h1>
          <p className="text-sm text-warmgray-500">ตั้งค่าวัตถุดิบ หน่วยฐาน และวิธีติดตามสต๊อก</p>
        </div>
        <Button onClick={openCreate}>+ เพิ่มวัตถุดิบ</Button>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {sorted.map((i) => (
          <Card key={i.id} className={`cursor-pointer ${!i.active ? 'opacity-60' : ''}`} onClick={() => openEdit(i.id)}>
            <div className="flex items-center justify-between">
              <div className="font-medium text-warmgray-900">{i.name}</div>
              {!i.active && <Badge tone="neutral">ปิดใช้งาน</Badge>}
            </div>
            <div className="mt-1 text-sm text-warmgray-500">
              {i.category} · หน่วย {i.baseUnit} · {trackingTypeLabel[i.trackingType]}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <table className="w-full text-sm">
          <thead className="bg-warmgray-50 text-left text-xs uppercase tracking-wide text-warmgray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ชื่อ</th>
              <th className="px-4 py-3 font-medium">หมวดหมู่</th>
              <th className="px-4 py-3 font-medium">หน่วยฐาน</th>
              <th className="px-4 py-3 font-medium">วิธีติดตาม</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmgray-100">
            {sorted.map((i) => (
              <tr key={i.id} className={`cursor-pointer hover:bg-warmgray-50 ${!i.active ? 'opacity-60' : ''}`} onClick={() => openEdit(i.id)}>
                <td className="px-4 py-3 font-medium text-warmgray-900">{i.name}</td>
                <td className="px-4 py-3 text-warmgray-600">{i.category}</td>
                <td className="px-4 py-3 text-warmgray-600">{i.baseUnit}</td>
                <td className="px-4 py-3 text-warmgray-600">{trackingTypeLabel[i.trackingType]}</td>
                <td className="px-4 py-3">
                  {i.active ? <Badge tone="success">ใช้งานอยู่</Badge> : <Badge tone="neutral">ปิดใช้งาน</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {mode !== 'closed' && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-warmgray-900">
            {mode === 'create' ? 'เพิ่มวัตถุดิบใหม่' : 'แก้ไขวัตถุดิบ'}
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">ชื่อวัตถุดิบ</label>
              <input
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">หมวดหมู่</label>
                <input
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">หน่วยฐาน (เช่น g, ml, piece)</label>
                <input
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.baseUnit}
                  onChange={(e) => setForm((f) => ({ ...f, baseUnit: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">วิธีติดตามสต๊อก</label>
              <select
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.trackingType}
                onChange={(e) => setForm((f) => ({ ...f, trackingType: e.target.value as TrackingType }))}
              >
                {TRACKING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {trackingTypeLabel[t]}
                  </option>
                ))}
              </select>
            </div>
            {form.trackingType === 'standard_cost' && (
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">ต้นทุนคงที่ (ต่อหน่วยฐาน)</label>
                <input
                  type="number"
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={form.standardCost ?? ''}
                  min={0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm((f) => ({ ...f, standardCost: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">เกณฑ์แจ้งเตือนสต๊อกต่ำ (เว้นว่างได้)</label>
              <input
                type="number"
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.lowStockThreshold ?? ''}
                min={0}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value === '' ? undefined : Number(e.target.value) }))}
              />
            </div>

            {errors.length > 0 && (
              <div className="rounded-md border border-danger-500/40 bg-danger-50/40 p-3 text-sm text-danger-700">
                {errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div>
                {mode === 'edit' && editingId && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const ing = ingredients.find((i) => i.id === editingId);
                      if (ing) submitToggleIngredientActive(editingId, !ing.active);
                      closeForm();
                    }}
                  >
                    {ingredients.find((i) => i.id === editingId)?.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeForm}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSave}>บันทึก</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
