import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/state/store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatBaht, formatDateTimeThai } from '@/lib/format';
import { useMemo } from 'react';

export function OrdersList() {
  const { orders, menus } = useAppStore();
  const navigate = useNavigate();
  const menuNameById = useMemo(() => new Map(menus.map((m) => [m.id, m.name])), [menus]);

  const sorted = [...orders].sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-warmgray-900">Orders</h1>
          <p className="text-sm text-warmgray-500">ประวัติออเดอร์ทั้งหมด รวมรายการที่ถูกยกเลิก (voided)</p>
        </div>
        <Link to="/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </div>

      {sorted.length === 0 ? (
        <Card className="py-10 text-center text-warmgray-500">ยังไม่มีออเดอร์</Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {sorted.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="block">
                <Card className={o.status === 'voided' ? 'opacity-70' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-warmgray-900">
                        #{o.orderNumber} · {o.sellingDate}
                      </div>
                      <div className="text-sm text-warmgray-500">
                        {o.items.map((i) => menuNameById.get(i.menuId) ?? i.menuId).join(', ')}
                      </div>
                    </div>
                    {o.status === 'voided' ? <Badge tone="danger">ยกเลิก</Badge> : <Badge tone="success">สำเร็จ</Badge>}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="text-warmgray-500">รายรับ ฿{formatBaht(o.totalRevenue)}</span>
                    <span className={o.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}>
                      กำไร ฿{formatBaht(o.totalProfit)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-warmgray-50 text-left text-xs uppercase tracking-wide text-warmgray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order #</th>
                  <th className="px-4 py-3 font-medium">วันที่/เวลา</th>
                  <th className="px-4 py-3 font-medium">รายการ</th>
                  <th className="px-4 py-3 font-medium text-right">รายรับ</th>
                  <th className="px-4 py-3 font-medium text-right">COGS</th>
                  <th className="px-4 py-3 font-medium text-right">กำไร</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {sorted.map((o) => (
                  <tr
                    key={o.id}
                    className={`cursor-pointer hover:bg-warmgray-50 ${o.status === 'voided' ? 'opacity-60' : ''}`}
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-warmgray-900">#{o.orderNumber}</td>
                    <td className="px-4 py-3 text-warmgray-600">{formatDateTimeThai(o.soldAt)}</td>
                    <td className="px-4 py-3 text-warmgray-600">
                      {o.items.map((i) => menuNameById.get(i.menuId) ?? i.menuId).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right text-warmgray-900">฿{formatBaht(o.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-warmgray-600">฿{formatBaht(o.totalCogs)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${o.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      ฿{formatBaht(o.totalProfit)}
                    </td>
                    <td className="px-4 py-3">
                      {o.status === 'voided' ? <Badge tone="danger">ยกเลิก</Badge> : <Badge tone="success">สำเร็จ</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
