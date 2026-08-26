import { Link } from 'react-router-dom';
import { useAppStore } from '@/state/store';
import { computeDashboardTotals, computeIngredientStock } from '@/domain/aggregates';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatBaht } from '@/lib/format';
import { today } from '@/repository';

export function Dashboard() {
  const { orders, ingredients, purchaseBatches, processingOutputs, stockMovements, menus } = useAppStore();
  const menuNameById = new Map(menus.map((m) => [m.id, m.name]));

  const allTimeTotals = computeDashboardTotals(orders);
  const todayOrders = orders.filter((o) => o.sellingDate === today());
  const todayTotals = computeDashboardTotals(todayOrders);

  const stockRows = ingredients.map((i) => computeIngredientStock(i, purchaseBatches, processingOutputs, stockMovements));
  const lowStock = stockRows.filter((r) => r.isLowStock);

  const recentOrders = [...orders].sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-warmgray-900">หน้าหลัก</h1>
        <p className="text-sm text-warmgray-500">สรุปยอดขาย ต้นทุน และกำไรวันนี้</p>
      </div>

      {/* Financial hierarchy: Revenue → COGS → Profit, per UI_SPEC §3/§19 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">ยอดขายวันนี้</div>
          <div className="mt-1 text-2xl font-semibold text-warmgray-900">฿{formatBaht(todayTotals.revenue)}</div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">ต้นทุนวันนี้ (COGS)</div>
          <div className="mt-1 text-2xl font-semibold text-warmgray-600">฿{formatBaht(todayTotals.cogs)}</div>
        </Card>
        <Card className={todayTotals.profit >= 0 ? 'border-success-500/30' : 'border-danger-500/30'}>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">กำไรวันนี้</div>
          <div className={`mt-1 text-2xl font-semibold ${todayTotals.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {todayTotals.profit >= 0 ? '+' : ''}
            ฿{formatBaht(todayTotals.profit)}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">จำนวน Orders วันนี้</div>
          <div className="mt-1 text-xl font-semibold text-warmgray-900">{todayOrders.filter((o) => o.status === 'active').length}</div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">Orders ทั้งหมด (active)</div>
          <div className="mt-1 text-xl font-semibold text-warmgray-900">{allTimeTotals.orderCount}</div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">กำไรสะสม</div>
          <div className={`mt-1 text-xl font-semibold ${allTimeTotals.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            ฿{formatBaht(allTimeTotals.profit)}
          </div>
        </Card>
        <Card className={lowStock.length > 0 ? 'border-warning-500/40' : ''}>
          <div className="text-xs font-medium uppercase tracking-wide text-warmgray-500">แจ้งเตือนสต๊อกต่ำ</div>
          <div className={`mt-1 text-xl font-semibold ${lowStock.length > 0 ? 'text-warning-700' : 'text-warmgray-900'}`}>
            {lowStock.length} รายการ
          </div>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-warning-500/40 bg-warning-50/40">
          <div className="mb-2 text-sm font-semibold text-warning-700">สต๊อกใกล้หมด</div>
          <ul className="space-y-1 text-sm text-warmgray-700">
            {lowStock.map((r) => (
              <li key={r.ingredient.id} className="flex items-center justify-between">
                <span>{r.ingredient.name}</span>
                <span className="font-medium text-warning-700">
                  เหลือ {r.availableQuantity} {r.ingredient.baseUnit} (ต่ำกว่า {r.ingredient.lowStockThreshold})
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <div className="mb-2 text-sm font-semibold text-warmgray-900">Quick actions</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link to="/orders/new">
            <Button className="w-full">+ New Order</Button>
          </Link>
          <Link to="/purchases">
            <Button variant="secondary" className="w-full">
              Purchase
            </Button>
          </Link>
          <Link to="/processing">
            <Button variant="secondary" className="w-full">
              Processing
            </Button>
          </Link>
          <Link to="/menus">
            <Button variant="secondary" className="w-full">
              Add Menu
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-warmgray-900">รายการล่าสุด</div>
          <Link to="/orders" className="text-sm font-medium text-orange-600">
            ดูทั้งหมด
          </Link>
        </div>
        <Card className="divide-y divide-warmgray-100 p-0">
          {recentOrders.map((o) => (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-warmgray-50"
            >
              <div>
                <div className="font-medium text-warmgray-900">
                  #{o.orderNumber} · {o.sellingDate}
                </div>
                <div className="text-warmgray-500">
                  {o.items.map((i) => menuNameById.get(i.menuId) ?? i.menuId).join(', ')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-warmgray-900">฿{formatBaht(o.totalRevenue)}</span>
                {o.status === 'voided' ? <Badge tone="danger">ยกเลิก</Badge> : <Badge tone="success">สำเร็จ</Badge>}
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
