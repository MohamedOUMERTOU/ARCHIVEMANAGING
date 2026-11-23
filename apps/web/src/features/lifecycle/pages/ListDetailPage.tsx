import type { CustomCellRendererProps } from 'ag-grid-react';
import {
  Ban,
  Check,
  CircleMinus,
  FileSpreadsheet,
  Package,
  Play,
  Printer,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate, formatDateTime, formatSize } from '@/utils/format';
import { lifecycleApi, type ListDetail, type ListItem, type ListStatus } from '../api/lifecycle.api';
import { ExecuteDialog, ReasonDialog } from '../components/LifecycleDialogs';
import { useLifecycleMutation, useList } from '../hooks/useLifecycle';
import { LIST_KIND, LIST_STATUS } from '../utils/labels';

type Cell = CustomCellRendererProps<ListItem>;
type DialogKind = 'approve' | 'reject' | 'cancel' | 'execute' | null;

const STEPS: Array<{ status: ListStatus; label: string }> = [
  { status: 'BROUILLON', label: 'Préparé' },
  { status: 'SOUMIS', label: 'Soumis au visa' },
  { status: 'APPROUVE', label: 'Visé' },
  { status: 'EXECUTE', label: 'Exécuté' },
];

export default function ListDetailPage() {
  const { id = '' } = useParams();
  const query = useList(id);
  const user = useAuthStore((s) => s.user);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [exporting, setExporting] = useState(false);

  const submit = useLifecycleMutation(() => lifecycleApi.submit(id), 'Bordereau soumis au visa');
  const approve = useLifecycleMutation((c: string) => lifecycleApi.approve(id, c || null), 'Bordereau visé');
  const reject = useLifecycleMutation((c: string) => lifecycleApi.reject(id, c), 'Bordereau refusé');
  const cancel = useLifecycleMutation((r: string) => lifecycleApi.cancel(id, r), 'Bordereau annulé');
  const { mutate: removeDoc } = useLifecycleMutation(
    (docId: string) => lifecycleApi.removeFromList(id, docId),
    'Document retiré',
  );

  const detail = query.data;
  const status = detail?.list.status;
  const canManage = hasPermission(user, 'lifecycle.manage');
  const editable = status === 'BROUILLON' && canManage;
  const columns = useMemo(
    () =>
      itemColumns(
        editable
          ? (docId) => {
              removeDoc(docId, { onError: notifyError });
            }
          : null,
      ),
    [editable, removeDoc],
  );

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  const l = d.list;
  const canApprove = hasPermission(user, 'lifecycle.approve');
  const isAuthor = user?.id === l.createdById;
  const elimination = l.kind === 'ELIMINATION';

  const download = (fn: () => Promise<void>) => {
    setExporting(true);
    fn()
      .catch(notifyError)
      .finally(() => {
        setExporting(false);
      });
  };

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <p className="text-muted text-[13px] print:hidden">
        <Link to="/cycle-de-vie/bordereaux" className="text-muted">
          Bordereaux
        </Link>{' '}
        › {l.number}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-2xl font-semibold">
              {elimination ? "Bordereau d'élimination" : 'Bordereau de versement'}{' '}
              <span className="font-mono">{l.number}</span>
            </h2>
            <Badge tone={LIST_STATUS[l.status].tone}>{LIST_STATUS[l.status].label}</Badge>
          </div>
          <p className="text-ink-soft">{l.title}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => {
              download(() => lifecycleApi.exportCsv(l.id, l.number));
            }}
          >
            <FileSpreadsheet aria-hidden="true" /> Exporter (CSV)
          </Button>
          {!elimination && (l.status === 'APPROUVE' || l.status === 'EXECUTE') && (
            <Button
              variant="secondary"
              size="sm"
              disabled={exporting}
              onClick={() => {
                download(() => lifecycleApi.exportPackage(l.id, l.number));
              }}
            >
              <Package aria-hidden="true" /> Paquet de versement (ZIP)
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.print();
            }}
          >
            <Printer aria-hidden="true" /> {l.status === 'EXECUTE' ? 'Imprimer le procès-verbal' : 'Imprimer'}
          </Button>
        </div>
      </div>

      <Stepper status={l.status} />

      {d.blockers.length > 0 && (
        <div
          role="alert"
          className="border-danger/30 bg-danger-soft text-danger flex gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <strong>Le bordereau ne peut pas avancer :</strong>
            <ul className="mt-1 list-disc pl-5">
              {d.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {l.status === 'BROUILLON' && (
              <p className="mt-1">Retirez ces documents du bordereau pour continuer.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <CardTitle>Informations</CardTitle>
          <dl className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <Info label="Type">{LIST_KIND[l.kind]}</Info>
            {l.destination && <Info label="Destinataire">{l.destination}</Info>}
            <Info label="Documents">
              {l.documentCount} · {formatSize(l.bytes)}
            </Info>
            <Info label="Préparé par">
              {l.createdBy} · {formatDateTime(l.createdAt)}
            </Info>
            {d.submittedBy && l.submittedAt && (
              <Info label="Soumis par">
                {d.submittedBy} · {formatDateTime(l.submittedAt)}
              </Info>
            )}
            {l.decidedBy && l.decidedAt && (
              <Info label={l.status === 'REFUSE' ? 'Refusé par' : 'Visé par'}>
                {l.decidedBy} · {formatDateTime(l.decidedAt)}
              </Info>
            )}
            {d.decisionComment && (
              <Info label={l.status === 'ANNULE' ? "Motif d'annulation" : 'Observation du visa'}>
                {d.decisionComment}
              </Info>
            )}
            {d.executedBy && l.executedAt && (
              <Info label="Exécuté par">
                {d.executedBy} · {formatDateTime(l.executedAt)}
              </Info>
            )}
            {d.notes && <Info label="Observations">{d.notes}</Info>}
          </dl>
        </Card>

        <Actions
          detail={d}
          canManage={canManage}
          canApprove={canApprove}
          isAuthor={isAuthor}
          pending={submit.isPending}
          onSubmit={() => {
            submit.mutate(undefined, { onError: notifyError });
          }}
          onOpen={setDialog}
        />
      </div>

      <Card className="flex flex-col gap-3">
        <CardTitle>Documents ({d.items.length})</CardTitle>
        <DataGrid
          rows={d.items}
          columns={columns}
          label={`Documents du bordereau ${l.number}`}
          getRowId={(i) => i.documentId}
          searchable={d.items.length > 10}
          pageSize={50}
          getRowClass={(i) => (i.legalHold ? 'bg-danger-soft/40' : undefined)}
        />
      </Card>

      <ReasonDialog
        open={dialog === 'approve'}
        title={`Viser le bordereau ${l.number}`}
        description={
          elimination
            ? "Votre visa autorise la destruction définitive des documents listés. Vérifiez qu'aucun n'est concerné par un contentieux, un contrôle ou une demande en cours."
            : 'Votre visa autorise le versement des documents listés au service destinataire.'
        }
        label="Observation (facultatif)"
        required={false}
        confirmLabel="Viser"
        pending={approve.isPending}
        onCancel={() => {
          setDialog(null);
        }}
        onConfirm={(c) => {
          approve.mutate(c, {
            onSuccess: () => {
              setDialog(null);
            },
            onError: notifyError,
          });
        }}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        title={`Refuser le bordereau ${l.number}`}
        description="Les documents reprennent leur statut et réapparaissent dans l'échéancier."
        label="Motif du refus"
        confirmLabel="Refuser"
        danger
        pending={reject.isPending}
        onCancel={() => {
          setDialog(null);
        }}
        onConfirm={(c) => {
          reject.mutate(c, {
            onSuccess: () => {
              setDialog(null);
            },
            onError: notifyError,
          });
        }}
      />
      <ReasonDialog
        open={dialog === 'cancel'}
        title={`Annuler le bordereau ${l.number}`}
        description="Le bordereau reste consultable ; ses documents reprennent leur statut."
        label="Motif de l'annulation"
        confirmLabel="Annuler le bordereau"
        danger
        pending={cancel.isPending}
        onCancel={() => {
          setDialog(null);
        }}
        onConfirm={(r) => {
          cancel.mutate(r, {
            onSuccess: () => {
              setDialog(null);
            },
            onError: notifyError,
          });
        }}
      />
      {dialog === 'execute' && (
        <ExecuteDialog
          detail={d}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function Actions({
  detail,
  canManage,
  canApprove,
  isAuthor,
  pending,
  onSubmit,
  onOpen,
}: {
  detail: ListDetail;
  canManage: boolean;
  canApprove: boolean;
  isAuthor: boolean;
  pending: boolean;
  onSubmit: () => void;
  onOpen: (d: DialogKind) => void;
}) {
  const { list: l, blockers, items } = detail;
  const blocked = blockers.length > 0;
  const buttons: ReactNode[] = [];

  if (l.status === 'BROUILLON' && canManage) {
    buttons.push(
      <Button key="submit" disabled={pending || blocked || items.length === 0} onClick={onSubmit}>
        <Send aria-hidden="true" /> Soumettre au visa
      </Button>,
    );
  }
  if (l.status === 'SOUMIS' && canApprove && !isAuthor) {
    buttons.push(
      <Button
        key="approve"
        disabled={blocked}
        onClick={() => {
          onOpen('approve');
        }}
      >
        <Check aria-hidden="true" /> Viser
      </Button>,
      <Button
        key="reject"
        variant="danger"
        onClick={() => {
          onOpen('reject');
        }}
      >
        <X aria-hidden="true" /> Refuser
      </Button>,
    );
  }
  if (l.status === 'APPROUVE' && canManage) {
    buttons.push(
      <Button
        key="execute"
        variant={l.kind === 'ELIMINATION' ? 'danger' : 'primary'}
        disabled={blocked}
        onClick={() => {
          onOpen('execute');
        }}
      >
        <Play aria-hidden="true" />{' '}
        {l.kind === 'ELIMINATION' ? "Exécuter l'élimination" : 'Exécuter le versement'}
      </Button>,
    );
  }
  if (['BROUILLON', 'SOUMIS', 'APPROUVE'].includes(l.status) && canManage) {
    buttons.push(
      <Button
        key="cancel"
        variant="ghost"
        onClick={() => {
          onOpen('cancel');
        }}
      >
        <Ban aria-hidden="true" /> Annuler le bordereau
      </Button>,
    );
  }

  const hint =
    l.status === 'SOUMIS' && isAuthor
      ? 'Vous avez préparé ce bordereau : le visa doit venir d’une autre personne.'
      : l.status === 'SOUMIS' && !canApprove
        ? 'En attente du visa d’une personne habilitée (juriste, administrateur…).'
        : l.status === 'BROUILLON'
          ? 'Ajoutez des documents depuis l’échéancier, puis soumettez le bordereau au visa.'
          : l.status === 'APPROUVE' && l.kind === 'VERSEMENT'
            ? 'Téléchargez le paquet de versement et remettez-le au service destinataire avant d’exécuter.'
            : null;

  if (buttons.length === 0 && !hint) return null;
  return (
    <Card className="flex w-full max-w-md flex-[1_1_300px] flex-col gap-3 print:hidden">
      <CardTitle>Étape suivante</CardTitle>
      {hint && <p className="text-muted text-[13px]">{hint}</p>}
      {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons}</div>}
    </Card>
  );
}

function Stepper({ status }: { status: ListStatus }) {
  if (status === 'REFUSE' || status === 'ANNULE') return null;
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[13px]" aria-label="Avancement du bordereau">
      {STEPS.map((s, i) => (
        <li key={s.status} className="flex items-center gap-2">
          <span
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1',
              i < current && 'bg-success-soft text-success',
              i === current && 'bg-primary text-white',
              i > current && 'bg-bg text-muted',
            )}
          >
            {i < current && <Check aria-hidden="true" className="size-3.5" />}
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden="true" className="bg-line h-px w-6" />}
        </li>
      ))}
    </ol>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function itemColumns(onRemove: ((documentId: string) => void) | null): ColDef<ListItem>[] {
  const cols: ColDef<ListItem>[] = [
    {
      field: 'reference',
      headerName: 'Cote',
      minWidth: 170,
      cellRenderer: ({ data }: Cell) =>
        data ? (
          <Link
            to={`/documents/${data.documentId}`}
            className="text-ink font-mono text-[12.5px] no-underline"
          >
            {data.reference ?? '—'}
          </Link>
        ) : null,
    },
    { field: 'title', headerName: 'Titre', flex: 2, minWidth: 220, wrapText: true, autoHeight: true },
    { field: 'typeName', headerName: 'Type', minWidth: 120 },
    {
      field: 'documentDate',
      headerName: 'Date',
      maxWidth: 130,
      filter: false,
      valueFormatter: ({ value }: { value: string | null }) => formatDate(value),
    },
    {
      field: 'retentionUntil',
      headerName: 'Échéance',
      maxWidth: 140,
      filter: false,
      valueFormatter: ({ value }: { value: string | null }) => formatDate(value),
    },
    { field: 'ruleName', headerName: 'Règle', minWidth: 150 },
    {
      field: 'bytes',
      headerName: 'Volume',
      maxWidth: 130,
      filter: false,
      valueFormatter: ({ data }) =>
        data ? `${String(data.versionCount)} v. · ${formatSize(data.bytes)}` : '',
    },
    {
      field: 'paperLocation',
      headerName: 'Original papier',
      minWidth: 200,
      wrapText: true,
      autoHeight: true,
      cellRenderer: ({ data }: Cell) =>
        data ? (
          <span className="flex flex-wrap items-center gap-1 py-2 text-[13px] leading-snug">
            {data.originalOnLoan && <Badge tone="warning">Prêté</Badge>}
            {data.paperLocation ?? <span className="text-muted">—</span>}
          </span>
        ) : null,
    },
    {
      field: 'currentStatus',
      headerName: 'Statut',
      maxWidth: 150,
      cellRenderer: ({ data }: Cell) =>
        data ? (
          data.legalHold ? (
            <Badge tone="danger">Gel juridique</Badge>
          ) : (
            <span className="text-[13px]">{statusLabel(data.currentStatus)}</span>
          )
        ) : null,
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
            aria-label={`Retirer ${data.reference ?? data.title} du bordereau`}
            onClick={() => {
              onRemove(data.documentId);
            }}
          >
            <CircleMinus aria-hidden="true" />
          </Button>
        ) : null,
    });
  }
  return cols;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  INTERMEDIAIRE: 'Intermédiaire',
  A_ELIMINER: 'À éliminer',
  ELIMINE: 'Éliminé',
  VERSE: 'Versé',
  DEFINITIF: 'Définitif',
};
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;
