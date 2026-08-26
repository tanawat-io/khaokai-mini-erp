import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/store';
import { computeIngredientStock } from '@/domain/aggregates';
import { getEligibleLots } from '@/domain/fifo';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatBaht, formatDateThai } from '@/lib/format';

export function Stock() {
  const { ingredients, purchaseBatches, processingOutputs, stockMovements } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(
    () => ingredients.map((i) => computeIngredientStock(i, purchaseBatches, processingOutputs, stockMovements)),
    [ingredients, purchaseBatches, processingOutputs, stockMovements]
  );

  const selected = selectedId ? ingredients.find((i) => i.id === selectedId) : null;
  const selectedLots = selected ? getEligibleLots(selected.id, selected.trackingType, purchaseBatches, processingOutputs) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-warmgray-900">Stock</h1>
        <p className="text-sm text-warmgray-500">สต๊อกคงเหลือ ล็อตซื้อ ล็อตแปรรูป และลำดับ FIFO</p>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <Card
            key={r.ingredient.id}
            className={`cursor-pointer ${r.isLowStock ? 'border-warning-500/40' : ''} ${selectedId === r.ingredient.id ? 'ring-2 ring-orange-300' : ''}`}
            onClick={() => setSelectedId(r.ingredient.id)}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-warmgray-900">{r.ingredient.name}</div>
              {r.isLowStock && <Badge tone="warning">สต๊อกต่ำ</Badge>}
              {r.ingredient.trackingType === 'standard_cost' && <Badge tone="neutral">Standard cost</Badge>}
            </div>
            {r.ingredient.trackingType === 'standard_cost' ? (
              <div className="mt-1 flex justify-between text-sm text-warmgray-500">
                <span>
                  คงเหลือ {r.availableQuantity} {r.ingredient.baseUnit} (ไม่ติดตามล็อต — ต้นทุนคงที่ ฿{formatBaht(r.ingredient.standardCost ?? 0)}/{r.ingredient.baseUnit})
                </span>
                <span>มูลค่า ฿{formatBaht(r.stockValue)}</span>
              </div>
            ) : (
              <div className="mt-1 flex justify-between text-sm text-warmgray-500">
                <span>
                  คงเหลือ {r.availableQuantity} {r.ingredient.baseUnit} · {r.batchCount} ล็อต
                </span>
                <span>มูลค่า ฿{formatBaht(r.stockValue)}</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <table className="w-full text-sm">
          <thead className="bg-warmgray-50 text-left text-xs uppercase tracking-wide text-warmgray-500">
            <tr>
              <th className="px-4 py-3 font-medium">วัตถุดิบ</th>
              <th className="px-4 py-3 font-medium">ประเภท</th>
              <th className="px-4 py-3 font-medium text-right">คงเหลือ</th>
              <th className="px-4 py-3 font-medium text-right">มูลค่าสต๊อก</th>
              <th className="px-4 py-3 font-medium text-right">ต้นทุนโดยประมาณ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmgray-100">
            {rows.map((r) => (
              <tr
                key={r.ingredient.id}
                className={`cursor-pointer hover:bg-warmgray-50 ${selectedId === r.ingredient.id ? 'bg-orange-50/50' : ''}`}
                onClick={() => setSelectedId(r.ingredient.id)}
              >
                <td className="px-4 py-3 font-medium text-warmgray-900">{r.ingredient.name}</td>
                <td className="px-4 py-3 text-warmgray-500">{r.ingredient.trackingType}</td>
                <td className="px-4 py-3 text-right text-warmgray-700">
                  {r.availableQuantity} {r.ingredient.baseUnit}
                </td>
                <td className="px-4 py-3 text-right text-warmgray-700">฿{formatBaht(r.stockValue)}</td>
                <td className="px-4 py-3 text-right text-warmgray-700">
                  ฿{formatBaht(r.ingredient.trackingType === 'standard_cost' ? r.ingredient.standardCost ?? 0 : r.estimatedCost)}
                </td>
                <td className="px-4 py-3">
                  {r.isLowStock ? <Badge tone="warning">สต๊อกต่ำ</Badge> : <Badge tone="success">ปกติ</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-warmgray-900">ล็อตของ {selected.name} (เรียงลำดับ FIFO)</div>
            <button className="text-sm text-warmgray-400" onClick={() => setSelectedId(null)}>
              ปิด
            </button>
          </div>
          {selected.trackingType === 'standard_cost' ? (
            <p className="text-sm text-warmgray-500">
              วัตถุดิบนี้ตั้งค่าเป็น <strong>standard cost</strong> — ไม่ติดตามสต๊อกแบบล็อต/FIFO ต้นทุนคำนวณจากราคาคงที่ที่ตั้งไว้เท่านั้น
              จำนวนคงเหลือคำนวณจากประวัติการเคลื่อนไหวสต๊อก (ซื้อ/ขาย/ของเสีย) ไม่ใช่จากล็อตซื้อ
            </p>
          ) : selectedLots.length === 0 ? (
            <p className="text-sm text-warmgray-500">ไม่มีล็อตที่พร้อมใช้งาน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-warmgray-500">
                  <tr>
                    <th className="py-1">ลำดับ</th>
                    <th className="py-1">แหล่งที่มา</th>
                    <th className="py-1">วันที่</th>
                    <th className="py-1 text-right">คงเหลือ</th>
                    <th className="py-1 text-right">ต้นทุน/หน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warmgray-100">
                  {selectedLots.map((lot, i) => (
                    <tr key={lot.sourceBatchId} className="text-warmgray-700">
                      <td className="py-1.5">{i === 0 ? 'ตัดก่อน (oldest)' : i + 1}</td>
                      <td className="py-1.5">
                        {lot.sourceType === 'purchase_batch' ? 'ล็อตซื้อ' : 'ล็อตแปรรูป'} · {lot.sourceBatchId}
                      </td>
                      <td className="py-1.5">{formatDateThai(lot.date)}</td>
                      <td className="py-1.5 text-right">
                        {lot.remainingQuantity} {selected.baseUnit}
                      </td>
                      <td className="py-1.5 text-right">฿{formatBaht(lot.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
