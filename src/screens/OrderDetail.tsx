import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '@/state/store';
import { previewOrder } from '@/domain/preview';
import type { OrderDraft, OrderDraftLine } from '@/domain/stockCheck';
import { round2 } from '@/domain/costing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Stepper } from '@/components/ui/Stepper';
import { ShortageTable } from '@/components/ui/ShortageTable';
import { Modal } from '@/components/ui/Modal';
import { formatBaht, formatDateTimeThai } from '@/lib/format';

function draftFromOrder(order: NonNullable<ReturnType<typeof useOrder>>): OrderDraft {
  return {
    lines: order.items.map((item): OrderDraftLine => ({
      menuId: item.menuId,
      quantity: item.quantity,
      unitSellingPrice: item.unitSellingPrice,
      addOns: item.addOns.map((a) => ({ addOnId: a.addOnId, quantity: a.quantity })),
    })),
  };
}

function useOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { orders } = useAppStore();
  return orders.find((o) => o.id === orderId) ?? null;
}

export function OrderDetail() {
  const order = useOrder();
  const navigate = useNavigate();
  const { menus, addOns, ingredients, purchaseBatches, processingOutputs, stockMovements, submitEditOrder, submitVoidOrder } = useAppStore();

  const menuById = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  const addOnById = useMemo(() => new Map(addOns.map((a) => [a.id, a])), [addOns]);
  const ingredientById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const activeAddOns = useMemo(() => addOns.filter((a) => a.active), [addOns]);

  const [editing, setEditing] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [draftLines, setDraftLines] = useState<OrderDraftLine[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [voiding, setVoiding] = useState(false);

  if (!order) {
    return <Card className="py-10 text-center text-warmgray-500">ไม่พบออเดอร์นี้</Card>;
  }

  // Standard_cost analog of order.fifoAllocations — the net quantity to add back per ingredient
  // before checking availability, so the preview doesn't report this order's own already-consumed
  // standard_cost stock as unavailable to itself (mirrors reverseFirst for FIFO ingredients).
  const reverseFirstStandardCost = useMemo(() => {
    const net = new Map<string, number>();
    for (const m of stockMovements) {
      if (m.referenceType === 'order' && m.referenceId === order.id && m.sourceType === 'standard_cost') {
        net.set(m.ingredientId, round2((net.get(m.ingredientId) ?? 0) - m.quantityDelta));
      }
    }
    return net;
  }, [stockMovements, order.id]);

  const preview = editing
    ? previewOrder(
        { lines: draftLines },
        menus,
        addOns,
        ingredients,
        purchaseBatches,
        processingOutputs,
        stockMovements,
        order.fifoAllocations,
        reverseFirstStandardCost
      )
    : null;

  function startEdit() {
    setDraftLines(draftFromOrder(order!).lines);
    setEditError(null);
    setEditing(true);
  }

  function updateLine(index: number, patch: Partial<OrderDraftLine>) {
    setDraftLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function setAddOnQty(lineIndex: number, addOnId: string, qty: number) {
    setDraftLines((prev) =>
      prev.map((l, i) => {
        if (i !== lineIndex) return l;
        const others = l.addOns.filter((a) => a.addOnId !== addOnId);
        return { ...l, addOns: qty > 0 ? [...others, { addOnId, quantity: qty }] : others };
      })
    );
  }

  async function saveEdit() {
    if (savingEdit) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const result = await submitEditOrder(order!.id, { lines: draftLines });
      if (!result.ok) {
        // BUSINESS_RULES.md §16 step 6 / CALCULATION_ENGINE.md §15: failed re-allocation rolls
        // back atomically — the order shown below is unchanged because the store only updates
        // on success.
        setEditError('สต๊อกไม่พอสำหรับการแก้ไขนี้ ออเดอร์เดิมยังคงอยู่โดยไม่เปลี่ยนแปลง');
        return;
      }
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmVoid() {
    if (voiding) return;
    setVoiding(true);
    try {
      await submitVoidOrder(order!.id);
      setVoidConfirmOpen(false);
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-warmgray-900">Order #{order.orderNumber}</h1>
            {order.status === 'voided' ? <Badge tone="danger">ยกเลิก (Voided)</Badge> : <Badge tone="success">สำเร็จ</Badge>}
          </div>
          <p className="text-sm text-warmgray-500">{formatDateTimeThai(order.soldAt)}</p>
        </div>
        {order.status === 'active' && !editing && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={startEdit}>
              แก้ไข
            </Button>
            <Button variant="danger" onClick={() => setVoidConfirmOpen(true)}>
              ยกเลิกออเดอร์
            </Button>
          </div>
        )}
      </div>

      {order.status === 'voided' && (
        <Card className="border-danger-500/30 bg-danger-50/40 text-sm text-danger-700">
          ออเดอร์นี้ถูกยกเลิกเมื่อ {order.voidedAt ? formatDateTimeThai(order.voidedAt) : '-'} สต๊อกที่ใช้ไปถูกคืนกลับแล้ว
          และออเดอร์นี้ไม่ถูกนับใน Revenue/COGS/Profit
        </Card>
      )}

      {!editing ? (
        <>
          <Card>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs uppercase text-warmgray-500">Revenue</div>
                <div className="mt-1 text-lg font-semibold text-warmgray-900">฿{formatBaht(order.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-warmgray-500">COGS</div>
                <div className="mt-1 text-lg font-semibold text-warmgray-600">฿{formatBaht(order.totalCogs)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-warmgray-500">Profit</div>
                <div className={`mt-1 text-lg font-semibold ${order.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  ฿{formatBaht(order.totalProfit)}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {order.items.map((item) => {
              const menu = menuById.get(item.menuId);
              return (
                <Card key={item.id}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-warmgray-900">
                      {menu?.name ?? item.menuId} × {item.quantity}
                    </div>
                    <div className="text-sm text-warmgray-500">฿{formatBaht(item.lineRevenue)}</div>
                  </div>
                  {item.addOns.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-warmgray-600">
                      {item.addOns.map((a, i) => (
                        <li key={i} className="flex justify-between">
                          <span>
                            + {addOnById.get(a.addOnId)?.name ?? a.addOnId} × {a.quantity}
                          </span>
                          <span>฿{formatBaht(a.revenue)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex justify-between border-t border-warmgray-100 pt-2 text-sm">
                    <span className="text-warmgray-500">COGS รายการนี้</span>
                    <span className="font-medium text-warmgray-700">฿{formatBaht(item.lineCogs)}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <div className="mb-2 text-sm font-semibold text-warmgray-900">การจัดสรรสต๊อกแบบ FIFO</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-warmgray-500">
                  <tr>
                    <th className="py-1">วัตถุดิบ</th>
                    <th className="py-1">แหล่งที่มา</th>
                    <th className="py-1 text-right">จำนวนที่ใช้</th>
                    <th className="py-1 text-right">ต้นทุน/หน่วย</th>
                    <th className="py-1 text-right">ต้นทุนรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warmgray-100">
                  {order.fifoAllocations.map((a) => (
                    <tr key={a.id} className="text-warmgray-700">
                      <td className="py-1.5">{ingredientById.get(a.ingredientId)?.name ?? a.ingredientId}</td>
                      <td className="py-1.5 text-warmgray-400">
                        {a.sourceType === 'purchase_batch' ? 'ล็อตซื้อ' : 'ล็อตแปรรูป'} · {a.sourceBatchId}
                      </td>
                      <td className="py-1.5 text-right">{a.quantityConsumed}</td>
                      <td className="py-1.5 text-right">฿{formatBaht(a.unitCost)}</td>
                      <td className="py-1.5 text-right">฿{formatBaht(a.allocatedCost)}</td>
                    </tr>
                  ))}
                  {order.fifoAllocations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-2 text-center text-warmgray-400">
                        ไม่มีการตัดสต๊อก (ใช้วัตถุดิบแบบ standard cost ทั้งหมด)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="space-y-3">
          <Card className="border-orange-300 bg-orange-50/40 text-sm text-orange-800">
            กำลังแก้ไขออเดอร์ — หากสต๊อกไม่พอหลังแก้ไข ระบบจะยกเลิกการแก้ไขทั้งหมดและคงออเดอร์เดิมไว้
          </Card>
          {draftLines.map((line, index) => {
            const menu = menuById.get(line.menuId);
            if (!menu) return null;
            return (
              <Card key={index}>
                <div className="font-medium text-warmgray-900">{menu.name}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-warmgray-500">
                  <span>จำนวน</span>
                  <Stepper value={line.quantity} min={1} onChange={(v) => updateLine(index, { quantity: v })} />
                </div>
                <div className="mt-3 space-y-2 border-t border-warmgray-100 pt-3">
                  {/* Offer active add-ons for new selection, plus any already on this line even
                      if since deactivated (so it stays visible/removable during edit). */}
                  {[...activeAddOns, ...addOns.filter((a) => !a.active && line.addOns.some((la) => la.addOnId === a.id))].map((addOn) => {
                    const current = line.addOns.find((a) => a.addOnId === addOn.id)?.quantity ?? 0;
                    return (
                      <div key={addOn.id} className="flex items-center justify-between">
                        <span className="text-sm text-warmgray-700">{addOn.name}</span>
                        <Stepper value={current} onChange={(v) => setAddOnQty(index, addOn.id, v)} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {preview && <ShortageTable shortages={preview.shortages} ingredientNameById={new Map(ingredients.map((i) => [i.id, i.name]))} />}
          {editError && <Card className="border-danger-500/40 bg-danger-50/40 text-sm text-danger-700">{editError}</Card>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={savingEdit}>
              ยกเลิก
            </Button>
            <Button onClick={saveEdit} disabled={!preview?.ok || savingEdit}>
              {savingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={voidConfirmOpen}
        onClose={() => setVoidConfirmOpen(false)}
        title="ยืนยันการยกเลิกออเดอร์"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidConfirmOpen(false)} disabled={voiding}>
              ไม่ยกเลิก
            </Button>
            <Button variant="danger" onClick={confirmVoid} disabled={voiding}>
              {voiding ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกออเดอร์'}
            </Button>
          </>
        }
      >
        ออเดอร์นี้จะถูกทำเครื่องหมายว่า <strong>ยกเลิก (voided)</strong> ไม่ใช่การลบถาวร — สต๊อกที่ใช้ไปทั้งหมดจะถูกคืนกลับ
        และออเดอร์นี้จะไม่ถูกนับใน Revenue/COGS/Profit อีกต่อไป แต่จะยังคงปรากฏในรายการ Orders และ History
        เพื่อการตรวจสอบย้อนหลัง
      </Modal>
    </div>
  );
}
