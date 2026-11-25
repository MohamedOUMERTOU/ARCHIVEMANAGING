import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { SETTINGS_TABS } from '../utils/tabs';

export default function SettingsLayout() {
  const user = useAuthStore((s) => s.user);
  const tabs = SETTINGS_TABS.filter((t) => hasPermission(user, t.permission));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] font-semibold">Paramétrage</h1>
      <nav aria-label="Sections du paramétrage" className="border-line flex flex-wrap gap-1 border-b pb-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                'text-ink-soft hover:bg-bg inline-flex h-9 items-center rounded-lg px-3 font-medium whitespace-nowrap no-underline',
                isActive && 'bg-ink hover:bg-ink text-white',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
