import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { buildHistoryEvents, type HistoryEventType } from '@/domain/history';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatBaht, formatDateTimeThai } from '@/lib/format';

const typeLabel: Record<HistoryEventType, string> = {
  purchase: 'ซื้อ',
  processing: 'แปรรูป',
  waste: 'ของเสีย',
  order: 'ออเดอร์',
  order_edit: 'แก้ไขออเดอร์',
  order_void: 'ยกเลิกออเดอร์',
};

const typeTone: Record<HistoryEventType, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'> = {
  purchase: 'info',
  processing: 'primary',
  waste: 'danger',
  order: 'success',
  order_edit: 'warning',
  order_void: 'danger',
};

const ALL = 'all';

export function History() {
  const { purchaseBatches, processingBatches, processingOutputs, wasteRecords, orders, ingredients, menus, stockMovements } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [ingredientFilter, setIngredientFilter] = useState<string>(ALL);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const ingredientById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const voidedOrderIds = useMemo(() => new Set(orders.filter((o) => o.status === 'voided').map((o) => o.id)), [orders]);

  const events = useMemo(
    () => buildHistoryEvents({ purchaseBatches, processingBatches, processingOutputs, wasteRecords, orders, ingredients, menus, stockMovements }),
    [purchaseBatches, processingBatches, processingOutputs, wasteRecords, orders, ingredients, menus, stockMovements]
  );

  const filtered = events.filter((e) => {
    if (typeFilter !== ALL && e.type !== typeFilter) return false;
    if (ingredientFilter !== ALL && !e.ingredientIds.includes(ingredientFilter)) return false;
    const eventDate = e.date.slice(0, 10);
    if (fromDate && eventDate < fromDate) return false;
    if (toDate && eventDate > toDate) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-warmgray-900">ประวัติ</h1>
        <p className="text-sm text-warmgray-500">
          รายการซื้อ แปรรูป ของเสีย และออเดอร์ทั้งหมด — ออเดอร์ที่ถูกยกเลิกจะยังคงแสดงอยู่ที่นี่เสมอ
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ประเภท</label>
            <select
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value={ALL}>ทั้งหมด</option>
              {(Object.keys(typeLabel) as HistoryEventType[]).map((t) => (
                <option key={t} value={t}>
                  {typeLabel[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">วัตถุดิบ</label>
            <SearchableSelect
              value={ingredientFilter}
              onChange={setIngredientFilter}
              options={[{ value: ALL, label: 'ทั้งหมด' }, ...ingredients.map((i) => ({ value: i.id, label: i.name }))]}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ตั้งแต่วันที่</label>
            <input
              type="date"
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ถึงวันที่</label>
            <input
              type="date"
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="py-10 text-center text-warmgray-500">ไม่พบรายการตามเงื่อนไขที่เลือก</Card>
      ) : (
        <Card className="divide-y divide-warmgray-100 p-0">
          {filtered.map((e) => {
            const isVoidedOrderRow = e.type === 'order' && voidedOrderIds.has(e.id.replace('order-', ''));
            return (
              <div key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={typeTone[e.type]}>{typeLabel[e.type]}</Badge>
                    {isVoidedOrderRow && <Badge tone="danger">ยกเลิกแล้ว</Badge>}
                    <span className="text-xs text-warmgray-400">{formatDateTimeThai(e.date)}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-warmgray-900">{e.detail}</div>
                  {e.ingredientIds.length > 0 && (
                    <div className="text-xs text-warmgray-400">
                      วัตถุดิบ: {e.ingredientIds.map((id) => ingredientById.get(id)?.name ?? id).join(', ')}
                    </div>
                  )}
                  {/* Order rows already surface their reference (order number) inline in `detail` — only show it separately for the other event types, where it isn't shown anywhere else (UI_SPEC.md §12 "Reference"). */}
                  {e.type !== 'order' && e.type !== 'order_edit' && e.type !== 'order_void' && (
                    <div className="text-xs text-warmgray-400">อ้างอิง: {e.reference}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm sm:text-right">
                  <span className="text-warmgray-500">{e.quantityLabel}</span>
                  <span className={`font-semibold ${isVoidedOrderRow ? 'text-warmgray-400 line-through' : 'text-warmgray-900'}`}>
                    ฿{formatBaht(e.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
