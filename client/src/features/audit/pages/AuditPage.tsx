import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/utils/format';
import { auditApi, type AuditEntry } from '../api/audit.api';

/** Résumé lisible des détails d'une entrée (chemin avant/après, cote, version…). */
function summarize(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => `${k} : ${String(v as string | number | boolean)}`)
    .join(' · ');
}

type Cell = CustomCellRendererProps<AuditEntry>;

const columns: ColDef<AuditEntry>[] = [
  {
    field: 'at',
    headerName: 'Date',
    sort: 'desc',
    minWidth: 160,
    maxWidth: 180,
    filter: false,
    cellClass: 'tabular-nums',
    valueFormatter: ({ value }: { value: string | null | undefined }) => formatDateTime(value),
  },
  {
    field: 'userName',
    headerName: 'Utilisateur',
    minWidth: 150,
    valueFormatter: ({ value }: { value: string | null | undefined }) => value ?? '—',
  },
  {
    field: 'action',
    headerName: 'Action',
    minWidth: 170,
    cellRenderer: ({ value }: Cell) => {
      const action = String(value);
      return <Badge tone={action.includes('REFUSE') ? 'danger' : 'neutral'}>{action}</Badge>;
    },
  },
  { field: 'entity', headerName: 'Objet', minWidth: 120, cellClass: 'font-mono text-xs' },
  {
    colId: 'details',
    headerName: 'Détails',
    flex: 3,
    minWidth: 280,
    wrapText: true,
    autoHeight: true,
    sortable: false,
    valueGetter: ({ data }) => (data ? summarize(data.details) : ''),
    cellRenderer: ({ data }: Cell) => {
      if (!data) return null;
      const d = data.details;
      const from = d.from ?? (d.before as Record<string, unknown> | undefined)?.path;
      const to = d.to ?? (d.after as Record<string, unknown> | undefined)?.path;
      return (
        <div className="flex flex-col gap-1 py-2 leading-snug">
          <span className="text-ink-soft">{summarize(d)}</span>
          {typeof from === 'string' && typeof to === 'string' && (
            <>
              <span className="bg-danger-soft text-danger rounded px-1.5 text-xs">− {from}</span>
              <span className="bg-success-soft text-success rounded px-1.5 text-xs">+ {to}</span>
            </>
          )}
        </div>
      );
    },
  },
  {
    field: 'ip',
    headerName: 'Adresse IP',
    minWidth: 120,
    cellClass: 'font-mono text-xs',
    valueFormatter: ({ value }: { value: string | null | undefined }) => value ?? '—',
  },
];

export default function AuditPage() {
  const { t } = useTranslation();
  const verify = useQuery({ queryKey: ['audit', 'verify'], queryFn: auditApi.verify });
  const log = useInfiniteQuery({
    queryKey: ['audit', 'list'],
    queryFn: ({ pageParam }) => auditApi.list(pageParam),
    initialPageParam: undefined as number | undefined,
    // Page suivante : les entrées plus anciennes que la dernière reçue
    getNextPageParam: (last) => (last.length < 50 ? undefined : last.at(-1)?.id),
  });
  const rows = useMemo(() => log.data?.pages.flat() ?? [], [log.data]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] font-semibold">{t('audit.title')}</h1>
          <p className="text-muted">{t('audit.intro')}</p>
        </div>
        {verify.data &&
          (verify.data.valid ? (
            <Badge tone="success" className="px-3 py-1.5 text-[13px]">
              <ShieldCheck aria-hidden="true" className="size-4" />{' '}
              {t('audit.verified', { count: verify.data.entries })}
            </Badge>
          ) : (
            <Badge tone="danger" className="px-3 py-1.5 text-[13px]">
              <ShieldAlert aria-hidden="true" className="size-4" />{' '}
              {t('audit.broken', { id: verify.data.brokenAt ?? '?' })}
            </Badge>
          ))}
      </div>

      {log.isPending ? (
        <LoadingState />
      ) : log.isError ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          label={t('audit.title')}
          getRowId={(e) => String(e.id)}
          searchable
          exportable
        />
      )}
      {log.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            disabled={log.isFetchingNextPage}
            onClick={() => void log.fetchNextPage()}
          >
            {t('audit.more')}
          </Button>
        </div>
      )}
    </div>
  );
}
