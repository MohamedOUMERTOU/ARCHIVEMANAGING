import type { CustomCellRendererProps } from 'ag-grid-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatDateTime, formatSize } from '@/utils/format';
import type { ListKind, ListStatus, ListSummary } from '../api/lifecycle.api';
import { useLists } from '../hooks/useLifecycle';
import { LIST_KIND, LIST_STATUS } from '../utils/labels';

const FILTERS = [
  { value: 'open', label: 'En cours' },
  { value: 'closed', label: 'Clos' },
  { value: 'all', label: 'Tous' },
] as const;

type Cell = CustomCellRendererProps<ListSummary>;

const COLUMNS: ColDef<ListSummary>[] = [
  {
    field: 'number',
    headerName: 'Numéro',
    minWidth: 150,
    cellRenderer: ({ data }: Cell) =>
      data ? (
        <Link
          to={`/cycle-de-vie/bordereaux/${data.id}`}
          className="text-ink font-mono font-semibold no-underline"
        >
          {data.number}
        </Link>
      ) : null,
  },
  {
    field: 'kind',
    headerName: 'Type',
    maxWidth: 140,
    valueFormatter: ({ value }: { value: ListKind }) => LIST_KIND[value],
  },
  { field: 'title', headerName: 'Intitulé', flex: 2, minWidth: 240 },
  {
    field: 'status',
    headerName: 'Statut',
    minWidth: 170,
    valueFormatter: ({ value }: { value: ListStatus }) => LIST_STATUS[value].label,
    cellRenderer: ({ value }: Cell) => {
      const s = value as ListStatus;
      return <Badge tone={LIST_STATUS[s].tone}>{LIST_STATUS[s].label}</Badge>;
    },
  },
  { field: 'documentCount', headerName: 'Documents', maxWidth: 130, filter: 'agNumberColumnFilter' },
  {
    field: 'bytes',
    headerName: 'Volume',
    maxWidth: 120,
    filter: false,
    valueFormatter: ({ value }: { value: number }) => formatSize(value),
  },
  { field: 'createdBy', headerName: 'Préparé par', minWidth: 150 },
  {
    field: 'createdAt',
    headerName: 'Créé le',
    minWidth: 150,
    filter: false,
    sort: 'desc',
    valueFormatter: ({ value }: { value: string }) => formatDateTime(value),
  },
  {
    field: 'decidedBy',
    headerName: 'Visa',
    minWidth: 150,
    valueFormatter: ({ value }: { value: string | null }) => value ?? '—',
  },
];

export default function ListsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('open');
  const lists = useLists(filter === 'all' ? undefined : filter);
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <CardTitle>Bordereaux d'élimination et de versement</CardTitle>
          <p className="text-muted text-[13px]">
            Préparés depuis l'échéancier, visés par une autre personne que leur auteur, puis exécutés. Un
            bordereau exécuté tient lieu de procès-verbal.
          </p>
        </div>
        <div
          role="group"
          aria-label="Filtrer les bordereaux"
          className="border-line-strong inline-flex overflow-hidden rounded-lg border"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value);
              }}
              className={cn(
                'h-9 px-3 text-[13px]',
                filter === f.value
                  ? 'bg-primary-soft text-primary-strong font-semibold'
                  : 'bg-surface text-ink-soft',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {lists.isPending ? (
        <LoadingState />
      ) : lists.isError ? (
        <ErrorState error={lists.error} onRetry={() => void lists.refetch()} />
      ) : (
        <DataGrid
          rows={lists.data}
          columns={COLUMNS}
          label="Bordereaux"
          getRowId={(l) => l.id}
          searchable={lists.data.length > 8}
          exportable
          pageSize={25}
          emptyMessage="Aucun bordereau. Sélectionnez des documents échus dans l'échéancier pour en préparer un."
          onRowClicked={(l) => {
            void navigate(`/cycle-de-vie/bordereaux/${l.id}`);
          }}
          getRowClass={() => 'cursor-pointer'}
        />
      )}
    </Card>
  );
}
