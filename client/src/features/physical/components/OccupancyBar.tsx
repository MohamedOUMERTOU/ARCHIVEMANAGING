import { cn } from '@/lib/cn';
import { occupancy } from '../utils/occupancy';

/** Remplissage d'une boîte : barre + texte, la couleur signale une boîte presque pleine. */
export function OccupancyBar({
  count,
  capacity,
  compact = false,
}: {
  count: number;
  capacity: number | null;
  compact?: boolean;
}) {
  const o = occupancy(count, capacity);
  const label =
    capacity === null ? `${String(count)} documents` : `${String(count)} sur ${String(capacity)} documents`;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2', !compact && 'w-full')} title={label}>
      <span
        role="meter"
        aria-label="Occupation"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={capacity ?? count}
        aria-valuetext={label}
        className={cn('bg-line block h-1.5 overflow-hidden rounded-full', compact ? 'w-14' : 'flex-1')}
      >
        <span
          className={cn(
            'block h-full rounded-full',
            o.level === 'full' ? 'bg-danger' : o.level === 'high' ? 'bg-[#B54708]' : 'bg-primary',
          )}
          style={{ width: `${String(o.percent)}%` }}
        />
      </span>
      {!compact && <span className="text-muted text-xs tabular-nums">{label}</span>}
    </span>
  );
}
