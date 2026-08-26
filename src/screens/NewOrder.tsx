import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/state/store';
import { previewOrder } from '@/domain/preview';
import type { OrderDraft, OrderDraftLine } from '@/domain/stockCheck';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Stepper } from '@/components/ui/Stepper';
import { ShortageTable } from '@/components/ui/ShortageTable';
import { formatBaht } from '@/lib/format';

export function NewOrder() {
  const { menus, addOns, ingredients, purchaseBatches, processingOutputs, stockMovements, submitNewOrder } = useAppStore();
  const navigate = useNavigate();
  // Only active menus/add-ons are orderable — deactivating one (Phase 2A) must actually hide
  // it from New Order, not just from the management screen.
  const activeMenus = useMemo(() => menus.filter((m) => m.active), [menus]);
  const activeAddOns = useMemo(() => addOns.filter((a) => a.active), [addOns]);
  const [lines, setLines] = useState<OrderDraftLine[]>([]);
  const [pickerMenuId, setPickerMenuId] = useState(activeMenus[0]?.id ?? '');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ingredientNameById = useMemo(() => new Map(ingredients.map((i) => [i.id, i.name])), [ingredients]);
  const menuById = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const addOnById = useMemo(() => new Map(addOns.map((a) => [a.id, a])), [addOns]);

  const draft: OrderDraft = { lines };
  const preview = useMemo(
    () => previewOrder(draft, menus, addOns, ingredients, purchaseBatches, processingOutputs, stockMovements),
    [lines, menus, addOns, ingredients, purchaseBatches, processingOutputs, stockMovements]
  );

  function addLine() {
    const menu = menuById.get(pickerMenuId);
    if (!menu) return;
    setLines((prev) => {
      // Adding a menu already present as a line merges into it (increments quantity) instead
      // of creating a duplicate line, so add-ons stay correctly attached to one line per menu.
      const existingIndex = prev.findIndex((l) => l.menuId === menu.id);
      if (existingIndex !== -1) {
        return prev.map((l, i) => (i === existingIndex ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { menuId: menu.id, quantity: 1, unitSellingPrice: menu.sellingPrice, addOns: [] }];
    });
    setConfirmError(null);
  }

  function updateLine(index: number, patch: Partial<OrderDraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setConfirmError(null);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function setAddOnQty(lineIndex: number, addOnId: string, qty: number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== lineIndex) return l;
        const others = l.addOns.filter((a) => a.addOnId !== addOnId);
        return { ...l, addOns: qty > 0 ? [...others, { addOnId, quantity: qty }] : others };
      })
    );
    setConfirmError(null);
  }

  async function handleConfirm() {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    setConfirmError(null);
    try {
      const result = await submitNewOrder(draft);
      if (!result.ok) {
        setConfirmError('สต๊อกไม่พอ ไม่สามารถยืนยันออเดอร์ได้');
        return;
      }
      navigate(`/orders/${result.orderId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-semibold text-warmgray-900">New Order</h1>
        <p className="text-sm text-warmgray-500">เลือกเมนู ใส่จำนวน และเพิ่ม add-on ตามต้องการ</p>
      </div>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="min-h-touch flex-1 rounded-md border border-warmgray-300 px-3 text-[15px]"
            value={pickerMenuId}
            onChange={(e) => setPickerMenuId(e.target.value)}
          >
            {activeMenus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — ฿{formatBaht(m.sellingPrice)}
              </option>
            ))}
          </select>
          <Button onClick={addLine} className="sm:w-auto">
            + เพิ่มเมนู
          </Button>
        </div>
      </Card>

      {lines.length === 0 && <Card className="py-10 text-center text-warmgray-500">ยังไม่มีรายการ — เลือกเมนูด้านบนเพื่อเริ่ม</Card>}

      <div className="space-y-3">
        {lines.map((line, index) => {
          const menu = menuById.get(line.menuId)!;
          const linePreview = preview.lines[index];
          return (
            <Card key={index}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-warmgray-900">{menu.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-warmgray-500">
                    <span>จำนวน</span>
                    <Stepper value={line.quantity} min={1} onChange={(v) => updateLine(index, { quantity: v })} />
                  </div>
                </div>
                <button
                  className="flex min-h-touch items-center px-2 text-sm text-danger-600"
                  onClick={() => removeLine(index)}
                >
                  ลบ
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <label className="text-sm text-warmgray-500">ราคาขาย/หน่วย</label>
                <input
                  type="number"
                  className="min-h-touch w-24 rounded-md border border-warmgray-300 px-2 text-[15px]"
                  value={line.unitSellingPrice}
                  min={0}
                  onChange={(e) => updateLine(index, { unitSellingPrice: Number(e.target.value) })}
                />
              </div>

              {activeAddOns.length > 0 && (
                <div className="mt-3 border-t border-warmgray-100 pt-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-warmgray-500">Add-ons</div>
                  <div className="space-y-2">
                    {activeAddOns.map((addOn) => {
                      const current = line.addOns.find((a) => a.addOnId === addOn.id)?.quantity ?? 0;
                      return (
                        <div key={addOn.id} className="flex items-center justify-between">
                          <span className="text-sm text-warmgray-700">
                            {addOn.name} <span className="text-warmgray-400">(+฿{formatBaht(addOn.sellingPrice)})</span>
                          </span>
                          <Stepper value={current} onChange={(v) => setAddOnQty(index, addOn.id, v)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {linePreview && (
                <div className="mt-3 flex justify-between border-t border-warmgray-100 pt-3 text-sm">
                  <span className="text-warmgray-500">ต้นทุนโดยประมาณ (FIFO)</span>
                  <span className="font-medium text-warmgray-700">
                    ฿{formatBaht(linePreview.menuCogs + linePreview.addOnResults.reduce((s, a) => s + a.cogs, 0))}
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <ShortageTable shortages={preview.shortages} ingredientNameById={ingredientNameById} />

      {/* Sticky order-total / confirm bar — UI_SPEC §15 sticky action bar for important forms */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-warmgray-200 bg-white/95 px-4 py-3 backdrop-blur md:sticky md:bottom-0 md:mx-0 md:rounded-lg md:border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <div className="text-xs text-warmgray-500">
              ยอดรวม ฿{formatBaht(preview.totalRevenue)} · ต้นทุนโดยประมาณ ฿{formatBaht(preview.totalCogs)}
            </div>
            <div className={`text-lg font-semibold ${preview.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              กำไรโดยประมาณ ฿{formatBaht(preview.totalProfit)}
            </div>
          </div>
          <Button onClick={handleConfirm} disabled={lines.length === 0 || !preview.ok || submitting} size="md">
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันออเดอร์'}
          </Button>
        </div>
        {!preview.ok && lines.length > 0 && (
          <div className="mx-auto mt-1 max-w-5xl text-xs text-danger-600">สต๊อกไม่พอ — แก้ไขจำนวนหรือรายการก่อนยืนยัน</div>
        )}
        {confirmError && <div className="mx-auto mt-1 max-w-5xl text-xs text-danger-600">{confirmError}</div>}
      </div>
      {lines.length > 0 && <Badge tone="neutral">ราคาขายกำหนดโดยผู้ใช้เสมอ — ระบบไม่แนะนำราคาอัตโนมัติ</Badge>}
    </div>
  );
}
