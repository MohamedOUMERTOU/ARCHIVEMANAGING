import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { useLifecycleSummary } from '../hooks/useLifecycle';

export default function LifecycleLayout() {
  const summary = useLifecycleSummary().data;
  const tabs = [
    { to: 'echeancier', label: 'Échéancier', badge: null },
    { to: 'bordereaux', label: 'Bordereaux', badge: summary?.awaitingVisa ? summary.awaitingVisa : null },
    { to: 'gels', label: 'Gels juridiques', badge: summary?.activeHolds ? summary.activeHolds : null },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-semibold">Cycle de vie</h1>
        <p className="text-muted">
          Échéances de conservation, éliminations et versements visés, gels juridiques : chaque étape est
          tracée.
        </p>
      </div>
      <nav aria-label="Sections du cycle de vie" className="border-line flex flex-wrap gap-1 border-b pb-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                'text-ink-soft hover:bg-bg inline-flex h-9 items-center gap-2 rounded-lg px-3 font-medium whitespace-nowrap no-underline',
                isActive && 'bg-ink hover:bg-ink text-white',
              )
            }
          >
            {t.label}
            {t.badge !== null && (
              <span className="bg-warning-soft text-warning rounded-full px-1.5 text-xs font-semibold tabular-nums">
                {t.badge}
                <span className="sr-only">{t.to === 'bordereaux' ? ' en attente de visa' : ' actif(s)'}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
