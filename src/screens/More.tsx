import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/state/authStore';

const catalogLinks = [
  { to: '/menus', label: 'เมนู' },
  { to: '/ingredients', label: 'วัตถุดิบ' },
  { to: '/addons', label: 'Add-ons' },
];

const inventoryLinks = [
  { to: '/purchases', label: 'การซื้อวัตถุดิบ' },
  { to: '/processing', label: 'การแปรรูป' },
  { to: '/waste', label: 'ของเสีย' },
];

const otherLinks = [
  { to: '/history', label: 'ประวัติ' },
  { to: '/settings', label: 'ตั้งค่า' },
];

function LinkList({ items }: { items: { to: string; label: string }[] }) {
  return (
    <Card className="divide-y divide-warmgray-100 p-0">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex min-h-touch items-center justify-between px-4 py-3 text-sm font-medium text-warmgray-900 hover:bg-warmgray-50"
        >
          {item.label}
          <span aria-hidden className="text-warmgray-300">
            ›
          </span>
        </Link>
      ))}
    </Card>
  );
}

export function More() {
  const logout = useAuthStore((s) => s.logout);
  const isMock = import.meta.env.VITE_REPOSITORY === 'mock';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-warmgray-900">เพิ่มเติม</h1>
        <p className="text-sm text-warmgray-500">เมนู วัตถุดิบ การซื้อ การแปรรูป ของเสีย ประวัติ และตั้งค่าร้าน</p>
      </div>
      <LinkList items={catalogLinks} />
      <LinkList items={inventoryLinks} />
      <LinkList items={otherLinks} />
      {!isMock && (
        <Button variant="secondary" className="w-full" onClick={() => logout()}>
          ออกจากระบบ
        </Button>
      )}
    </div>
  );
}
