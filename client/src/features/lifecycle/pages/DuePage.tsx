import type { CustomCellRendererProps } from 'ag-grid-react';
import { Archive, CalendarClock, Flame, Landmark, Lock, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate, formatSize } from '@/utils/format';
import {
  lifecycleApi,
  type DueItem,
  type FinalAction,
  type ListKind,
  type Summary,
} from '../api/lifecycle.api';
import { CreateListDialog, HoldPickerDialog } from '../components/LifecycleDialogs';
import { useDue, useLifecycleMutation, useLifecycleSummary } from '../hooks/useLifecycle';
import { daysUntil, dueLabel, FINAL_ACTION, selectionBlocker } from '../utils/labels';

const HORIZONS = [
  { value: '0', label: 'Échus' },
  { value: '90', label: '3 prochains mois' },
  { value: '365', label: '12 prochains mois' },
  { value: 'attente', label: "En attente d'un événement" },
] as const;

const ACTIONS: Array<{ value: '' | FinalAction; label: string }> = [
  { value: '', label: 'Tous les sorts' },
  { value: 'DETRUIRE', label: 'Détruire' },
  { value: 'VERSER', label: 'Verser' },
  { value: 'CONSERVER', label: 'Conserver' },
];

type Cell = CustomCellRendererProps<DueItem>;

export default function DuePage() {
  const [params, setParams] = useSearchParams();
  const horizon = HORIZONS.find((h) => h.value === params.get('horizon'))?.value ?? '0';
  const action = ACTIONS.find((a) => a.value === params.get('sort'))?.value ?? '';
  const awaiting = horizon === 'attente';
  const query = useMemo(
    () => ({
      horizonDays: awaiting ? 0 : Number(horizon),
      finalAction: action || undefined,
      awaiting: awaiting || undefined,
    }),
    [horizon, action, awaiting],
  );
  const summary = useLifecycleSummary();
  const due = useDue(query);
  const user = useAuthStore((s) => s.user);
  const canManage = hasPermission(user, 'lifecycle.manage');
  const canHold = canManage || hasPermission(user, 'lifecycle.approve');

  const [selected, setSelected] = useState<DueItem[]>([]);
  const [selectionKey, setSelectionKey] = useState(0);
  const [dialog, setDialog] = useState<
    | { kind: 'list'; listKind: ListKind }
    | { kind: 'hold' }
    | { kind: 'definitive' }
    | { kind: 'recalc' }
    | null
  >(null);
  const keep = useLifecycleMutation(
    (ids: string[]) => lifecycleApi.keepDefinitively(ids),
    'Documents passés en conservation définitive',
  );
  const recalc = useLifecycleMutation(() => lifecycleApi.recalculate());

  const today = summary.data?.today ?? new Date().toISOString().slice(0, 10);
  const columns = useMemo(() => dueColumns(today), [today]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setSelected([]);
  };
  const done = () => {
    setDialog(null);
    setSelected([]);
    setSelectionKey((k) => k + 1);
  };

  const ids = selected.map((s) => s.id);
  const blocked = selected.filter((s) => selectionBlocker(s, today) !== null).length;
  const sameAction = (a: FinalAction) =>
    selected.length > 0 && blocked === 0 && selected.every((s) => s.finalAction === a);

  return (
    <div className="flex flex-col gap-5">
      {summary.data && (
        <SummaryTiles
          summary={summary.data}
          onPick={(h, a) => {
            const next = new URLSearchParams();
            if (h !== '0') next.set('horizon', h);
            if (a) next.set('sort', a);
            setParams(next, { replace: true });
          }}
        />
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Échéance"
            className="border-line-strong inline-flex overflow-hidden rounded-lg border"
          >
            {HORIZONS.map((h) => (
              <button
                key={h.value}
                type="button"
                aria-pressed={horizon === h.value}
                onClick={() => {
                  set('horizon', h.value === '0' ? '' : h.value);
                }}
                className={cn(
                  'h-9 px-3 text-[13px]',
                  horizon === h.value
                    ? 'bg-primary-soft text-primary-strong font-semibold'
                    : 'bg-surface text-ink-soft',
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="due-action">
            Sort final
          </label>
          <select
            id="due-action"
            className="border-line-strong bg-surface h-9 rounded-lg border px-2 text-[13px]"
            value={action}
            onChange={(e) => {
              set('sort', e.target.value);
            }}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setDialog({ kind: 'recalc' });
              }}
            >
              <RefreshCw aria-hidden="true" /> Recalculer les échéances
            </Button>
          )}
        </div>

        {awaiting && (
          <p className="text-muted text-[13px]">
            Documents dont la durée de conservation n'a pas encore commencé : le dossier n'est pas clos, ou la
            date du document manque. Clôturez le dossier dans le plan de classement pour fixer leur échéance.
          </p>
        )}

        {(canManage || canHold) && selected.length > 0 && (
          <div
            role="region"
            aria-label="Actions sur la sélection"
            className="bg-primary-soft/60 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
          >
            <span className="text-primary-strong text-[13px] font-semibold">
              {selected.length} sélectionné(s)
              {blocked > 0 && (
                <span className="text-muted font-normal"> · {blocked} non éligible(s) à un bordereau</span>
              )}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {canManage && (
                <>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!sameAction('DETRUIRE')}
                    title={
                      sameAction('DETRUIRE')
                        ? undefined
                        : 'Sélection de documents échus « à détruire » uniquement'
                    }
                    onClick={() => {
                      setDialog({ kind: 'list', listKind: 'ELIMINATION' });
                    }}
                  >
                    <Flame aria-hidden="true" /> Bordereau d'élimination
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!sameAction('VERSER')}
                    title={
                      sameAction('VERSER')
                        ? undefined
                        : 'Sélection de documents échus « à verser » uniquement'
                    }
                    onClick={() => {
                      setDialog({ kind: 'list', listKind: 'VERSEMENT' });
                    }}
                  >
                    <Archive aria-hidden="true" /> Bordereau de versement
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!sameAction('CONSERVER')}
                    title={
                      sameAction('CONSERVER')
                        ? undefined
                        : 'Sélection de documents échus « à conserver » uniquement'
                    }
                    onClick={() => {
                      setDialog({ kind: 'definitive' });
                    }}
                  >
                    <Landmark aria-hidden="true" /> Conservation définitive
                  </Button>
                </>
              )}
              {canHold && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDialog({ kind: 'hold' });
                  }}
                >
                  <Lock aria-hidden="true" /> Placer sous gel
                </Button>
              )}
            </div>
          </div>
        )}

        {due.isPending ? (
          <LoadingState />
        ) : due.isError ? (
          <ErrorState error={due.error} onRetry={() => void due.refetch()} />
        ) : (
          <DataGrid
            rows={due.data}
            columns={columns}
            label="Échéancier de conservation"
            getRowId={(d) => d.id}
            searchable
            exportable
            pageSize={50}
            emptyMessage={awaiting ? 'Aucun document en attente.' : 'Aucun document à cette échéance.'}
            getRowClass={(d) => (d.legalHold ? 'bg-danger-soft/30' : undefined)}
            selection={canManage || canHold ? { onChange: setSelected } : undefined}
            selectionKey={selectionKey}
          />
        )}
      </Card>

      {dialog?.kind === 'list' && (
        <CreateListDialog kind={dialog.listKind} documentIds={ids} onClose={done} />
      )}
      {dialog?.kind === 'hold' && <HoldPickerDialog documentIds={ids} onClose={done} />}
      <ConfirmDialog
        open={dialog?.kind === 'definitive'}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
        title={`Conservation définitive de ${String(ids.length)} document(s) ?`}
        message="Leur sort final est « conserver » : ils sortent de l'échéancier et restent consultables sans limite de durée."
        confirmLabel="Confirmer"
        pending={keep.isPending}
        onConfirm={() => {
          keep.mutate(ids, { onSuccess: done, onError: notifyError });
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'recalc'}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
        title="Recalculer toutes les échéances ?"
        message="Les échéances sont recalculées d'après les règles actuelles du plan de classement et des types. Chaque changement est inscrit dans l'historique du document. Les documents déjà inscrits sur un bordereau soumis ne bougent pas."
        confirmLabel="Recalculer"
        pending={recalc.isPending}
        onConfirm={() => {
          recalc.mutate(undefined, {
            onSuccess: (r) => {
              setDialog(null);
              notifyInfo(r.changed, r.examined);
            },
            onError: notifyError,
          });
        }}
      />
    </div>
  );
}

function notifyInfo(changed: number, examined: number) {
  toast.success(
    changed === 0
      ? `${String(examined)} document(s) vérifiés : aucune échéance ne change`
      : `${String(changed)} échéance(s) modifiée(s) sur ${String(examined)} document(s)`,
  );
}

function SummaryTiles({
  summary,
  onPick,
}: {
  summary: Summary;
  onPick: (horizon: string, action: string) => void;
}) {
  const tiles = (['DETRUIRE', 'VERSER', 'CONSERVER'] as const).map((a) => {
    const c = summary.byAction.find((x) => x.finalAction === a);
    return { action: a, due: c?.due ?? 0, upcoming: c?.upcoming ?? 0 };
  });
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <button
          key={t.action}
          type="button"
          onClick={() => {
            onPick('0', t.action);
          }}
          className="border-line bg-surface hover:border-primary flex flex-col gap-1 rounded-xl border px-4 py-3 text-left"
        >
          <span className="text-muted text-xs">À {FINAL_ACTION[t.action].label.toLowerCase()}</span>
          <span className="font-display text-2xl font-semibold tabular-nums">{t.due}</span>
          <span className="text-muted text-xs">échu(s) · {t.upcoming} dans l'année</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          onPick('attente', '');
        }}
        className="border-line bg-surface hover:border-primary flex flex-col gap-1 rounded-xl border px-4 py-3 text-left"
      >
        <span className="text-muted flex items-center gap-1 text-xs">
          <CalendarClock aria-hidden="true" className="size-3.5" /> Échéance en attente
        </span>
        <span className="font-display text-2xl font-semibold tabular-nums">{summary.awaitingStart}</span>
        <span className="text-muted text-xs">dossier non clos ou date manquante</span>
      </button>
      <Link
        to="/cycle-de-vie/gels"
        className="border-line bg-surface hover:border-primary flex flex-col gap-1 rounded-xl border px-4 py-3 text-left no-underline"
      >
        <span className="text-muted flex items-center gap-1 text-xs">
          <Lock aria-hidden="true" className="size-3.5" /> Sous gel juridique
        </span>
        <span className="font-display text-ink text-2xl font-semibold tabular-nums">{summary.onHold}</span>
        <span className="text-muted text-xs">{summary.activeHolds} gel(s) actif(s)</span>
      </Link>
    </div>
  );
}

function dueColumns(today: string): ColDef<DueItem>[] {
  return [
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
    { field: 'title', headerName: 'Titre', flex: 2, minWidth: 220, wrapText: true, autoHeight: true },
    { field: 'nodePath', headerName: 'Dossier', flex: 2, minWidth: 200, cellClass: 'text-muted text-[13px]' },
    {
      field: 'retentionUntil',
      headerName: 'Échéance',
      minWidth: 170,
      filter: false,
      sort: 'asc',
      cellRenderer: ({ data }: Cell) =>
        data?.retentionUntil ? (
          <span className="flex flex-col leading-tight">
            <span className="tabular-nums">{formatDate(data.retentionUntil)}</span>
            <span
              className={cn(
                'text-xs',
                daysUntil(data.retentionUntil, today) <= 0 ? 'text-danger' : 'text-muted',
              )}
            >
              {dueLabel(data.retentionUntil, today)}
            </span>
          </span>
        ) : (
          <span className="text-muted">en attente</span>
        ),
      autoHeight: true,
    },
    {
      field: 'finalAction',
      headerName: 'Sort final',
      maxWidth: 140,
      valueFormatter: ({ value }: { value: FinalAction | null }) => (value ? FINAL_ACTION[value].label : '—'),
      cellRenderer: ({ value }: Cell) => {
        const a = value as FinalAction | null;
        return a ? <Badge tone={FINAL_ACTION[a].tone}>{FINAL_ACTION[a].label}</Badge> : '—';
      },
    },
    { field: 'ruleName', headerName: 'Règle', minWidth: 160, cellClass: 'text-[13px]' },
    {
      colId: 'state',
      headerName: 'État',
      minWidth: 220,
      autoHeight: true,
      sortable: false,
      valueGetter: ({ data }) =>
        data
          ? [data.legalHold ? 'gel' : '', data.pendingListNumber ?? '', data.paperLocation ?? ''].join(' ')
          : '',
      cellRenderer: ({ data }: Cell) =>
        data ? (
          <div className="flex flex-wrap gap-1 py-2">
            {data.legalHold && <Badge tone="danger">Gel juridique</Badge>}
            {data.pendingListNumber && data.pendingListId && (
              <Link to={`/cycle-de-vie/bordereaux/${data.pendingListId}`} className="no-underline">
                <Badge tone="warning">{data.pendingListNumber}</Badge>
              </Link>
            )}
            {data.originalOnLoan && <Badge tone="warning">Original prêté</Badge>}
            {data.paperLocation && !data.originalOnLoan && (
              <span className="text-muted text-xs" title={data.paperLocation}>
                Papier : {data.paperLocation.split(' › ').slice(-1)[0]}
              </span>
            )}
          </div>
        ) : null,
    },
    {
      field: 'bytes',
      headerName: 'Volume',
      maxWidth: 120,
      filter: 'agNumberColumnFilter',
      cellClass: 'tabular-nums text-[13px]',
      valueFormatter: ({ value }: { value: number }) => formatSize(value),
    },
  ];
}
