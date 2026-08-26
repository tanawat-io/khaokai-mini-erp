import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '@/state/store';

const navItems = [
  { to: '/', label: 'หน้าหลัก', icon: '🏠', end: true },
  { to: '/orders', label: 'Orders', icon: '🧾', end: false },
  { to: '/stock', label: 'Stock', icon: '📦', end: false },
  { to: '/more', label: 'เพิ่มเติม', icon: '⋯', end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const storeName = useAppStore((s) => s.store.name);
  return (
    <div className="min-h-screen bg-warmgray-50 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-warmgray-200 bg-white md:flex md:flex-col">
        <div className="px-5 py-6">
          <div className="text-sm font-semibold text-warmgray-500">Food Cost &amp; Profit</div>
          <div className="text-lg font-semibold text-warmgray-900">{storeName}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-touch items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors ${
                  isActive ? 'bg-orange-50 text-orange-700' : 'text-warmgray-600 hover:bg-warmgray-50'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <NavLink
            to="/orders/new"
            className="flex min-h-touch w-full items-center justify-center rounded-md bg-orange-500 px-4 text-[15px] font-medium text-white hover:bg-orange-600"
          >
            + New Order
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-warmgray-200 bg-white/95 backdrop-blur md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-orange-600' : 'text-warmgray-500'
              }`
            }
          >
            <span className="text-lg leading-none" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
