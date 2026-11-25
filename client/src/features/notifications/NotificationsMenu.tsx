import { useQuery } from '@tanstack/react-query';
import { Bell, ClipboardCheck, Clock, Inbox, PackageOpen, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { MODULES, type ModuleKey } from '@/components/layout/modules';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDocumentSearch } from '@/features/documents';
import { lifecycleApi, lifecycleKeys } from '@/features/lifecycle';
import { physicalApi, physicalKeys } from '@/features/physical';
import { cn } from '@/lib/cn';
import { hasPermission, useAuthStore } from '@/stores/auth.store';

interface Notice {
  key: string;
  count: number;
  label: string;
  to: string;
  icon: LucideIcon;
  module: ModuleKey;
}

const INBOX = { status: 'A_CLASSER', size: 1 } as const;
const REFRESH = 60_000;

/**
 * Ce qui attend une action de l'utilisateur, d'après ses droits : documents à classer,
 * bordereaux à viser, documents échus, prêts en retard. Recalculé chaque minute.
 */
function useNotices(): Notice[] {
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user, 'documents.write');
  const canApprove = hasPermission(user, 'lifecycle.approve');
  const canManage = hasPermission(user, 'lifecycle.manage');
  const canPhysical = hasPermission(user, 'physical.manage');

  const inbox = useDocumentSearch(INBOX);
  const summary = useQuery({
    queryKey: lifecycleKeys.summary,
    queryFn: lifecycleApi.summary,
    enabled: canApprove || canManage,
    refetchInterval: REFRESH,
  });
  const overdue = useQuery({
    queryKey: physicalKeys.loans('overdue'),
    queryFn: () => physicalApi.loans('overdue'),
    enabled: canPhysical,
    refetchInterval: REFRESH,
  });

  const notices: Notice[] = [];
  const toFile = inbox.data?.totalElements ?? 0;
  if (canWrite && toFile > 0) {
    notices.push({
      key: 'inbox',
      count: toFile,
      label: `${String(toFile)} document(s) à classer`,
      to: '/a-classer',
      icon: Inbox,
      module: 'inbox',
    });
  }
  const visa = summary.data?.awaitingVisa ?? 0;
  if (canApprove && visa > 0) {
    notices.push({
      key: 'visa',
      count: visa,
      label: `${String(visa)} bordereau(x) en attente de visa`,
      to: '/cycle-de-vie/bordereaux',
      icon: ClipboardCheck,
      module: 'lifecycle',
    });
  }
  const due = (summary.data?.byAction ?? [])
    .filter((a) => a.finalAction !== 'CONSERVER')
    .reduce((n, a) => n + a.due, 0);
  if (canManage && due > 0) {
    notices.push({
      key: 'due',
      count: due,
      label: `${String(due)} document(s) échu(s) à éliminer ou verser`,
      to: '/cycle-de-vie/echeancier',
      icon: Clock,
      module: 'lifecycle',
    });
  }
  const late = overdue.data?.length ?? 0;
  if (canPhysical && late > 0) {
    notices.push({
      key: 'loans',
      count: late,
      label: `${String(late)} prêt(s) en retard`,
      to: '/archives-physiques/prets',
      icon: PackageOpen,
      module: 'physical',
    });
  }
  return notices;
}

export function NotificationsMenu() {
  const notices = useNotices();
  const [open, setOpen] = useState(false);
  const total = notices.reduce((n, x) => n + x.count, 0);
  const label = total === 0 ? 'Notifications, rien en attente' : `Notifications, ${String(total)} en attente`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className="border-line bg-surface hover:bg-bg relative flex size-10 items-center justify-center rounded-lg border"
      >
        <Bell aria-hidden="true" className="text-ink-soft size-[18px]" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className="bg-mod-lifecycle absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white tabular-nums"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent aria-label="Notifications">
        <p className="text-muted px-2 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase">À traiter</p>
        {notices.length === 0 ? (
          <p className="text-muted px-2 pb-2 text-[13px]">Rien n'attend votre action pour le moment.</p>
        ) : (
          <ul className="flex flex-col">
            {notices.map((n) => {
              const m = MODULES[n.module];
              return (
                <li key={n.key}>
                  <Link
                    to={n.to}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="text-ink hover:bg-bg flex items-center gap-3 rounded-lg px-2 py-2 no-underline"
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        m.soft,
                        m.text,
                      )}
                    >
                      <n.icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="text-[13px] font-medium">{n.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
