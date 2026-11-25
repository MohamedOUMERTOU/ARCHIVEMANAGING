import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';

const TABS = [
  { to: 'emplacements', label: 'Emplacements' },
  { to: 'prets', label: 'Prêts & consultations' },
  { to: 'niveaux', label: 'Niveaux' },
] as const;

export default function PhysicalLayout() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] font-semibold">Archives physiques</h1>
      <nav
        aria-label="Sections des archives physiques"
        className="border-line flex flex-wrap gap-1 border-b pb-3"
      >
        {TABS.map((t) => (
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
