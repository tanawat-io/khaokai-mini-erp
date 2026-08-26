import type { StockShortage } from '@/domain/stockCheck';
import { Card } from './Card';

export function ShortageTable({ shortages, ingredientNameById }: { shortages: StockShortage[]; ingredientNameById: Map<string, string> }) {
  if (shortages.length === 0) return null;
  return (
    <Card className="border-danger-500/40 bg-danger-50/40">
      <div className="mb-2 text-sm font-semibold text-danger-700">สต๊อกไม่เพียงพอ</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-warmgray-500">
            <tr>
              <th className="py-1">วัตถุดิบ</th>
              <th className="py-1 text-right">ต้องการ</th>
              <th className="py-1 text-right">มีในสต๊อก</th>
              <th className="py-1 text-right">ขาด</th>
            </tr>
          </thead>
          <tbody>
            {shortages.map((s) => (
              <tr key={s.ingredientId} className="text-warmgray-700">
                <td className="py-1">{ingredientNameById.get(s.ingredientId) ?? s.ingredientId}</td>
                <td className="py-1 text-right">{s.required}</td>
                <td className="py-1 text-right">{s.available}</td>
                <td className="py-1 text-right font-semibold text-danger-700">{s.shortage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
