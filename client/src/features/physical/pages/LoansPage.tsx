import { Plus, Undo2 } from 'lucide-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate, formatDateTime } from '@/utils/format';
import { physicalApi, type Loan, type LoanFilter } from '../api/physical.api';
import { LoanDialog } from '../components/LoanDialog';
import { useLoans, usePhysicalMutation } from '../hooks/usePhysical';

const FILTERS: Array<[LoanFilter, string]> = [
  ['open', 'En cours'],
  ['overdue', 'En retard'],
  ['returned', 'Rendus'],
  ['all', 'Tous'],
];

export default function LoansPage() {
  const [filter, setFilter] = useState<LoanFilter>('open');
  const [creating, setCreating] = useState(false);
  const loans = useLoans(filter);
  const canManage = hasPermission(
    useAuthStore((s) => s.user),
    'physical.manage',
  );
  const giveBack = usePhysicalMutation(
    (id: string) => physicalApi.returnLoan(id),
    'Retour enregistré : retirez la fiche fantôme',
  );
  const { mutate: returnLoan, isPending: returning } = giveBack;
  const columns = useMemo(
    () =>
      loanColumns(canManage, returning, (id) => {
        returnLoan(id, { onError: notifyError });
      }),
    [canManage, returning, returnLoan],
  );

  return (
    <Card className="flex flex-col gap-3 p-0">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
        <CardTitle className="flex-1">Prêts et consultations</CardTitle>
        <div
          role="group"
          aria-label="Filtrer les prêts"
          className="border-line-strong inline-flex overflow-hidden rounded-lg border"
        >
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
              }}
              className={cn(
                'h-9 px-3 text-[13px]',
                filter === value
                  ? 'bg-primary-soft text-primary-strong font-semibold'
                  : 'bg-surface text-ink-soft',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden="true" /> Nouveau prêt
          </Button>
        )}
      </div>

      {loans.isPending ? (
        <div className="p-5">
          <LoadingState />
        </div>
      ) : loans.isError ? (
        <div className="p-5">
          <ErrorState error={loans.error} onRetry={() => void loans.refetch()} />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <DataGrid
            rows={loans.data}
            columns={columns}
            label="Prêts"
            getRowId={(l) => l.id}
            searchable
            exportable
            pageSize={25}
            emptyMessage="Aucun prêt dans cette liste."
            getRowClass={(l) => (l.overdue && !l.returnedAt ? 'bg-danger-soft/40' : undefined)}
          />
        </div>
      )}
      {creating && (
        <LoanDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </Card>
  );
}

type Cell = CustomCellRendererProps<Loan>;

function loanColumns(canManage: boolean, pending: boolean, onReturn: (id: string) => void): ColDef<Loan>[] {
  return [
    {
      colId: 'object',
      headerName: 'Objet prêté',
      flex: 2,
      minWidth: 240,
      autoHeight: true,
      valueGetter: ({ data }) => (data ? (data.locationLabel ?? data.documentTitle ?? '') : ''),
      cellRenderer: ({ data: loan }: Cell) =>
        !loan ? null : loan.locationId ? (
          <div className="py-2 leading-snug">
            <Link
              to={`/archives-physiques/emplacements?loc=${loan.locationId}`}
              className="text-ink font-semibold no-underline"
            >
              {loan.locationLabel}
            </Link>
            <div className="text-muted text-xs">
              {loan.locationPath} · {loan.documentCount} document(s)
            </div>
          </div>
        ) : (
          <div className="py-2 leading-snug">
            <Link to={`/documents/${loan.documentId ?? ''}`} className="text-ink font-semibold no-underline">
              {loan.documentTitle}
            </Link>
            <div className="text-muted font-mono text-xs">{loan.documentReference}</div>
          </div>
        ),
    },
    {
      field: 'borrower',
      headerName: 'Emprunteur',
      minWidth: 170,
      autoHeight: true,
      cellRenderer: ({ data: loan }: Cell) =>
        loan ? (
          <div className="py-2 leading-snug">
            {loan.borrower}
            {loan.kind === 'CONSULTATION' && <div className="text-muted text-xs">Consultation sur place</div>}
          </div>
        ) : null,
    },
    {
      field: 'reason',
      headerName: 'Motif',
      minWidth: 150,
      wrapText: true,
      autoHeight: true,
      cellClass: 'text-ink-soft',
      valueFormatter: ({ value }: { value: string | null | undefined }) => value ?? '—',
    },
    {
      field: 'outAt',
      headerName: 'Sorti le',
      minWidth: 150,
      filter: false,
      cellClass: 'tabular-nums',
      valueFormatter: ({ value }: { value: string }) => formatDateTime(value),
    },
    {
      field: 'dueAt',
      headerName: 'Retour prévu',
      minWidth: 190,
      filter: false,
      valueFormatter: ({ value }: { value: string }) => formatDate(value),
      cellRenderer: ({ data: loan }: Cell) =>
        !loan ? null : loan.returnedAt ? (
          <Badge tone="success">Rendu le {formatDate(loan.returnedAt.slice(0, 10))}</Badge>
        ) : loan.overdue ? (
          <Badge tone="danger">{formatDate(loan.dueAt)} · en retard</Badge>
        ) : (
          formatDate(loan.dueAt)
        ),
    },
    {
      colId: 'actions',
      headerName: '',
      minWidth: 210,
      maxWidth: 230,
      sortable: false,
      filter: false,
      resizable: false,
      cellClass: 'flex items-center justify-end',
      cellRenderer: ({ data: loan }: Cell) =>
        loan && canManage && !loan.returnedAt ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => {
              onReturn(loan.id);
            }}
          >
            <Undo2 aria-hidden="true" /> Enregistrer le retour
          </Button>
        ) : null,
    },
  ];
}
