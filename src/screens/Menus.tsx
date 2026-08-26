import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { estimateRecipeCost, validateCatalogItemInput, type CatalogItemInput, type RecipeLineInput } from '@/domain/catalog';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RecipeEditor } from '@/components/ui/RecipeEditor';
import { formatBaht } from '@/lib/format';

const emptyInput: CatalogItemInput = { name: '', sellingPrice: 0, recipe: [] };

export function Menus() {
  const { menus, ingredients, purchaseBatches, submitCreateMenu, submitUpdateMenu, submitToggleMenuActive } = useAppStore();
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CatalogItemInput>(emptyInput);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ingredientsById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const activeIngredients = useMemo(() => ingredients.filter((i) => i.active), [ingredients]);
  const sorted = useMemo(() => [...menus].sort((a, b) => a.name.localeCompare(b.name, 'th')), [menus]);

  const formEstimatedCost = estimateRecipeCost(form.recipe, ingredientsById, purchaseBatches);
  const formEstimatedProfit = form.sellingPrice - formEstimatedCost;

  function openCreate() {
    setForm(emptyInput);
    setErrors([]);
    setEditingId(null);
    setMode('create');
  }

  function openEdit(id: string) {
    const menu = menus.find((m) => m.id === id);
    if (!menu) return;
    setForm({ name: menu.name, sellingPrice: menu.sellingPrice, recipe: menu.recipe.map((r) => ({ ...r })) });
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
    if (saving) return;
    const check = validateCatalogItemInput(form, ingredientsById);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      const result = editingId ? await submitUpdateMenu(editingId, form) : await submitCreateMenu(form);
      if (!result.ok) {
        setErrors(result.errors ?? ['บันทึกไม่สำเร็จ']);
        return;
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-warmgray-900">เมนู</h1>
          <p className="text-sm text-warmgray-500">ตั้งค่าเมนู ราคาขาย และสูตรส่วนประกอบ</p>
        </div>
        <Button onClick={openCreate}>+ เพิ่มเมนู</Button>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {sorted.map((m) => {
          const cost = estimateRecipeCost(m.recipe, ingredientsById, purchaseBatches);
          return (
            <Card key={m.id} className={`cursor-pointer ${!m.active ? 'opacity-60' : ''}`} onClick={() => openEdit(m.id)}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-warmgray-900">{m.name}</div>
                {!m.active && <Badge tone="neutral">ปิดใช้งาน</Badge>}
              </div>
              <div className="mt-1 flex justify-between text-sm text-warmgray-500">
                <span>ราคาขาย ฿{formatBaht(m.sellingPrice)}</span>
                <span>ต้นทุนโดยประมาณ ฿{formatBaht(cost)}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop: table */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <table className="w-full text-sm">
          <thead className="bg-warmgray-50 text-left text-xs uppercase tracking-wide text-warmgray-500">
            <tr>
              <th className="px-4 py-3 font-medium">เมนู</th>
              <th className="px-4 py-3 font-medium text-right">ราคาขาย</th>
              <th className="px-4 py-3 font-medium text-right">ต้นทุนโดยประมาณ</th>
              <th className="px-4 py-3 font-medium text-right">กำไรโดยประมาณ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmgray-100">
            {sorted.map((m) => {
              const cost = estimateRecipeCost(m.recipe, ingredientsById, purchaseBatches);
              const profit = m.sellingPrice - cost;
              return (
                <tr key={m.id} className={`cursor-pointer hover:bg-warmgray-50 ${!m.active ? 'opacity-60' : ''}`} onClick={() => openEdit(m.id)}>
                  <td className="px-4 py-3 font-medium text-warmgray-900">{m.name}</td>
                  <td className="px-4 py-3 text-right text-warmgray-700">฿{formatBaht(m.sellingPrice)}</td>
                  <td className="px-4 py-3 text-right text-warmgray-600">฿{formatBaht(cost)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    ฿{formatBaht(profit)}
                  </td>
                  <td className="px-4 py-3">{m.active ? <Badge tone="success">ใช้งานอยู่</Badge> : <Badge tone="neutral">ปิดใช้งาน</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {mode !== 'closed' && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-warmgray-900">{mode === 'create' ? 'เพิ่มเมนูใหม่' : 'แก้ไขเมนู'}</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">ชื่อเมนู</label>
              <input
                className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-warmgray-500">ราคาขาย (กำหนดเอง)</label>
              <input
                type="number"
                className="min-h-touch w-32 rounded-md border border-warmgray-300 px-3 text-[15px]"
                value={form.sellingPrice}
                min={0}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm((f) => ({ ...f, sellingPrice: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-warmgray-500">สูตร (วัตถุดิบ + ปริมาณ)</label>
              <RecipeEditor
                recipe={form.recipe as RecipeLineInput[]}
                ingredients={activeIngredients}
                onChange={(recipe) => setForm((f) => ({ ...f, recipe }))}
              />
            </div>

            <div className="flex justify-between border-t border-warmgray-100 pt-3 text-sm">
              <span className="text-warmgray-500">ต้นทุนโดยประมาณ (weighted-average, ไม่ใช่ต้นทุนจริงของออเดอร์)</span>
              <span className="font-medium text-warmgray-700">฿{formatBaht(formEstimatedCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-warmgray-500">กำไรโดยประมาณ</span>
              <span className={`font-medium ${formEstimatedProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                ฿{formatBaht(formEstimatedProfit)}
              </span>
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
                      const menu = menus.find((m) => m.id === editingId);
                      if (menu) submitToggleMenuActive(editingId, !menu.active);
                      closeForm();
                    }}
                  >
                    {menus.find((m) => m.id === editingId)?.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeForm} disabled={saving}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
