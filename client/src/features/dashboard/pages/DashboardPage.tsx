import { useQuery } from '@tanstack/react-query';
import { Clock, FolderTree, Inbox, PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/shared/StatCard';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { CardTitle } from '@/components/ui/card';
import { DocumentTable, useDocumentSearch } from '@/features/documents';
import { lifecycleApi, lifecycleKeys } from '@/features/lifecycle';
import { physicalApi, physicalKeys } from '@/features/physical';
import { hasPermission, useAuthStore } from '@/stores/auth.store';

const RECENT = { sort: 'created', size: 8 } as const;
const INBOX = { status: 'A_CLASSER', size: 1 } as const;

export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canLifecycle = hasPermission(user, 'lifecycle.manage') || hasPermission(user, 'lifecycle.approve');
  const recent = useDocumentSearch(RECENT);
  const inbox = useDocumentSearch(INBOX);
  const summary = useQuery({
    queryKey: lifecycleKeys.summary,
    queryFn: lifecycleApi.summary,
    enabled: canLifecycle,
  });
  const loans = useQuery({ queryKey: physicalKeys.loans('open'), queryFn: () => physicalApi.loans('open') });

  const due = summary.data?.byAction.filter((a) => a.finalAction !== 'CONSERVER') ?? [];
  const dueTotal = due.reduce((n, a) => n + a.due, 0);
  const destroy = due.find((a) => a.finalAction === 'DETRUIRE')?.due ?? 0;
  const transfer = due.find((a) => a.finalAction === 'VERSER')?.due ?? 0;
  const late = loans.data?.filter((l) => l.overdue).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-semibold">
          {t('dashboard.greeting', { name: user?.fullName ?? '' })}
        </h1>
        <p className="text-muted">{t('dashboard.intro', { organization: user?.organization.name ?? '' })}</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <StatCard
          module="explorer"
          icon={FolderTree}
          label={t('dashboard.archived')}
          value={recent.data?.totalElements ?? '…'}
          to="/explorateur"
        />
        <StatCard
          module="inbox"
          icon={Inbox}
          label={t('dashboard.toFile')}
          value={inbox.data?.totalElements ?? '…'}
          to="/a-classer"
        />
        {canLifecycle && (
          <StatCard
            module="lifecycle"
            icon={Clock}
            label="Échus à traiter"
            value={summary.data ? dueTotal : '…'}
            hint={summary.data ? `${String(destroy)} à détruire · ${String(transfer)} à verser` : undefined}
            to="/cycle-de-vie/echeancier"
          />
        )}
        <StatCard
          module="physical"
          icon={PackageOpen}
          label="Prêts en cours"
          value={loans.data?.length ?? '…'}
          hint={late > 0 ? `dont ${String(late)} en retard` : loans.data ? 'aucun retard' : undefined}
          to="/archives-physiques/prets"
        />
      </div>

      <section className="flex flex-col gap-3">
        <CardTitle>{t('dashboard.recent')}</CardTitle>
        {recent.isPending ? (
          <LoadingState />
        ) : recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
        ) : (
          <DocumentTable data={recent.data.content} caption={t('dashboard.recent')} />
        )}
      </section>
    </div>
  );
}
