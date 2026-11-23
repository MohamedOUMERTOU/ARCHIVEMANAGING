import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { MODULES, type ModuleKey } from '@/components/layout/modules';
import { cn } from '@/lib/cn';

/** Carte de chiffre clé aux couleurs d'un module : pastille d'icône, chiffre coloré, liseré en haut. */
export function StatCard({
  module,
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  module: ModuleKey;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
}) {
  const m = MODULES[module];
  const body = (
    <div
      className={cn(
        'bg-surface flex h-full flex-col gap-2 rounded-xl px-[18px] py-4 shadow-sm',
        m.topLine,
        to && 'hover:bg-bg/60 transition-colors',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex size-7 items-center justify-center rounded-lg', m.soft, m.text)}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="text-ink-soft text-[13px] font-medium">{label}</span>
      </div>
      <span className={cn('font-display text-3xl font-semibold tabular-nums', m.text)}>{value}</span>
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </div>
  );
  return to ? (
    <Link to={to} className="text-ink no-underline">
      {body}
    </Link>
  ) : (
    body
  );
}
