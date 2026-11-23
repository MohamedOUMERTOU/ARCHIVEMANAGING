import type { CustomCellRendererProps } from 'ag-grid-react';
import { CircleMinus, Lock, LockOpen, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate, formatDateTime } from '@/utils/format';
import { lifecycleApi, type FinalAction, type HoldDetail, type HoldSummary } from '../api/lifecycle.api';
import { HoldPickerDialog, ReasonDialog } from '../components/LifecycleDialogs';
import { useHold, useHolds, useLifecycleMutation } from '../hooks/useLifecycle';
import { FINAL_ACTION } from '../utils/labels';

type HoldDoc = HoldDetail['documents'][number];
type Cell = CustomCellRendererProps<HoldDoc>;

export default function HoldsPage() {
  const [params, setParams] = useSearchParams();
  const holds = useHolds();
  const user = useAuthStore((s) => s.user);
  const canEdit = hasPermission(user, 'lifecycle.manage') || hasPermission(user, 'lifecycle.approve');
  const [creating, setCreating] = useState(false);
  const selectedId =
    params.get('gel') ?? holds.data?.find((h) => !h.releasedAt)?.id ?? holds.data?.[0]?.id ?? null;

  if (holds.isPending) return <LoadingState />;
  if (holds.isError) return <ErrorState error={holds.error} onRetry={() => void holds.refetch()} />;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex w-full max-w-sm flex-[1_1_300px] flex-col gap-3 p-0">
        <div className="flex items-center gap-2 px-5 pt-4">
          <CardTitle className="flex-1">Gels juridiques</CardTitle>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" /> Nouveau gel
            </Button>
          )}
        </div>
        {holds.data.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              title="Aucun gel juridique."
              hint="Un gel suspend l'élimination et le versement des documents concernés par un litige, un contrôle ou une enquête."
            />
          </div>
        ) : (
          <ul className="flex flex-col pb-2">
            {holds.data.map((h) => (
              <HoldRow
                key={h.id}
                hold={h}
                selected={h.id === selectedId}
                onSelect={() => {
                  setParams({ gel: h.id }, { replace: true });
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {selectedId ? <HoldPanel id={selectedId} canEdit={canEdit} /> : null}
      </div>

      {creating && (
        <HoldPickerDialog
          documentIds={[]}
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function HoldRow({
  hold: h,
  selected,
  onSelect,
}: {
  hold: HoldSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
        className={cn(
          'hover:bg-bg flex w-full flex-col gap-0.5 border-l-[3px] px-5 py-2.5 text-left',
          selected ? 'border-primary bg-primary-soft/50' : 'border-transparent',
        )}
      >
        <span className="flex items-center gap-2 font-semibold">
          {h.releasedAt ? (
            <LockOpen aria-hidden="true" className="text-muted size-4" />
          ) : (
            <Lock aria-hidden="true" className="text-danger size-4" />
          )}
          {h.name}
        </span>
        <span className="text-muted text-xs">
          {h.caseReference && <span className="font-mono">{h.caseReference} · </span>}
          {h.documentCount} document(s) ·{' '}
          {h.releasedAt ? `levé le ${formatDate(h.releasedAt.slice(0, 10))}` : 'actif'}
        </span>
      </button>
    </li>
  );
}

function HoldPanel({ id, canEdit }: { id: string; canEdit: boolean }) {
  const query = useHold(id);
  const [releasing, setReleasing] = useState(false);
  const [removing, setRemoving] = useState<HoldDoc | null>(null);
  const release = useLifecycleMutation((reason: string) => lifecycleApi.releaseHold(id, reason), 'Gel levé');
  const remove = useLifecycleMutation(
    ({ docId, reason }: { docId: string; reason: string }) => lifecycleApi.removeFromHold(id, docId, reason),
    'Document retiré du gel',
  );
  const active = !!query.data && !query.data.hold.releasedAt;
  const columns = useMemo(() => holdColumns(canEdit && active ? setRemoving : null), [canEdit, active]);

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { hold: h, documents } = query.data;

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {h.name}
              {h.releasedAt ? <Badge>Levé</Badge> : <Badge tone="danger">Actif</Badge>}
            </CardTitle>
            {h.caseReference && <p className="text-muted font-mono text-[13px]">{h.caseReference}</p>}
          </div>
          {canEdit && !h.releasedAt && (
            <Button
              variant="secondary"
              onClick={() => {
                setReleasing(true);
              }}
            >
              <LockOpen aria-hidden="true" /> Lever le gel
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Motif</dt>
          <dd>{h.reason}</dd>
          <dt className="text-muted">Posé par</dt>
          <dd>
            {h.createdBy} · {formatDateTime(h.createdAt)}
          </dd>
          {h.releasedAt && (
            <>
              <dt className="text-muted">Levé par</dt>
              <dd>
                {h.releasedBy} · {formatDateTime(h.releasedAt)}
              </dd>
              <dt className="text-muted">Motif de levée</dt>
              <dd>{h.releaseReason}</dd>
            </>
          )}
        </dl>
        {!h.releasedAt && (
          <p className="text-muted text-xs">
            Pour ajouter des documents : cochez-les dans l'échéancier, ou utilisez « Placer sous gel » depuis
            leur fiche.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Documents ({documents.length})</CardTitle>
        <DataGrid
          rows={documents}
          columns={columns}
          label={`Documents du gel ${h.name}`}
          getRowId={(d) => d.id}
          searchable={documents.length > 10}
          exportable
          pageSize={50}
          emptyMessage="Aucun document dans ce gel."
        />
      </Card>

      <ReasonDialog
        open={releasing}
        title={`Lever le gel « ${h.name} »`}
        description="Les documents reprennent leur cycle de vie, sauf s'ils figurent dans un autre gel actif. Les documents échus réapparaissent dans l'échéancier."
        label="Motif de la levée"
        confirmLabel="Lever le gel"
        pending={release.isPending}
        onCancel={() => {
          setReleasing(false);
        }}
        onConfirm={(reason) => {
          release.mutate(reason, {
            onSuccess: () => {
              setReleasing(false);
            },
            onError: notifyError,
          });
        }}
      />
      <ReasonDialog
        open={!!removing}
        title={`Retirer ${removing?.reference ?? 'le document'} du gel`}
        description="À réserver aux erreurs de périmètre : le retrait est inscrit dans l'historique du document."
        label="Motif du retrait"
        confirmLabel="Retirer"
        danger
        pending={remove.isPending}
        onCancel={() => {
          setRemoving(null);
        }}
        onConfirm={(reason) => {
          if (removing)
            remove.mutate(
              { docId: removing.id, reason },
              {
                onSuccess: () => {
                  setRemoving(null);
                },
                onError: notifyError,
              },
            );
        }}
      />
    </>
  );
}

function holdColumns(onRemove: ((d: HoldDoc) => void) | null): ColDef<HoldDoc>[] {
  const cols: ColDef<HoldDoc>[] = [
    {
      field: 'reference',
      headerName: 'Cote',
      minWidth: 170,
      cellRenderer: ({ data }: Cell) =>
        data ? (
          <Link to={`/documents/${data.id}`} className="text-ink font-mono text-[12.5px] no-underline">
            {data.reference ?? '—'}
          </Link>
        ) : null,
    },
    { field: 'title', headerName: 'Titre', flex: 2, minWidth: 220 },
    {
      field: 'retentionUntil',
      headerName: 'Échéance',
      maxWidth: 140,
      filter: false,
      valueFormatter: ({ value }: { value: string | null }) => formatDate(value),
    },
    {
      field: 'finalAction',
      headerName: 'Sort final',
      maxWidth: 140,
      valueFormatter: ({ value }: { value: FinalAction | null }) => (value ? FINAL_ACTION[value].label : '—'),
    },
    {
      field: 'addedBy',
      headerName: 'Ajouté par',
      minWidth: 170,
      valueFormatter: ({ data }) =>
        data ? `${data.addedBy} · ${formatDate(data.addedAt.slice(0, 10))}` : '',
    },
  ];
  if (onRemove) {
    cols.push({
      colId: 'remove',
      headerName: '',
      maxWidth: 70,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: ({ data }: Cell) =>
        data ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Retirer ${data.reference ?? data.title} du gel`}
            onClick={() => {
              onRemove(data);
            }}
          >
            <CircleMinus aria-hidden="true" />
          </Button>
        ) : null,
    });
  }
  return cols;
}
