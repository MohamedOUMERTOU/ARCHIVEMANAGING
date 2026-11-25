import { useMutation, useQuery } from '@tanstack/react-query';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { CheckCircle2, Database, ExternalLink, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { notifyError } from '@/lib/forms';
import { formatDateTime, formatSize } from '@/utils/format';
import { settingsApi, settingsKeys, type StorageCheck, type StorageStatus } from '../api/settings.api';

const MIME_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'Image PNG',
  'image/jpeg': 'Image JPEG',
  'image/tiff': 'Image TIFF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'text/plain': 'Texte',
  'application/octet-stream': 'Autre',
};

export default function StorageSettings() {
  const status = useQuery({ queryKey: settingsKeys.storage, queryFn: settingsApi.storage });
  const check = useMutation({ mutationFn: settingsApi.checkStorage, meta: { silent: true } });

  if (status.isPending) return <LoadingState />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  const s = status.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-5">
        <ConnectionCard
          status={s}
          refreshing={status.isFetching}
          onRefresh={() => {
            void status.refetch();
          }}
        />
        <UsageCard usage={s.usage} />
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="text-primary size-5" /> Contrôle d'intégrité
            </CardTitle>
            <p className="text-muted max-w-2xl text-[13px]">
              Compare chaque version de document enregistrée en base avec le fichier présent dans le stockage
              : fichiers manquants, tailles différentes, et fichiers sans document (orphelins). Le contrôle
              est inscrit au journal d'audit. Aucun fichier n'est modifié ni supprimé.
            </p>
          </div>
          <Button
            disabled={check.isPending || !s.reachable}
            onClick={() => {
              check.mutate(undefined, { onError: notifyError });
            }}
          >
            <RefreshCw aria-hidden="true" className={cn(check.isPending && 'animate-spin')} />
            {check.isPending ? 'Contrôle en cours…' : 'Lancer le contrôle'}
          </Button>
        </div>
        {check.data && <CheckReport result={check.data} />}
      </Card>
    </div>
  );
}

function ConnectionCard({
  status: s,
  refreshing,
  onRefresh,
}: {
  status: StorageStatus;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const rows: Array<[string, string | null]> =
    s.type === 's3'
      ? [
          ['Service', 'MinIO (compatible S3)'],
          ['Adresse', s.endpoint],
          ['Bucket', s.bucket],
        ]
      : [
          ['Service', 'Dossier local'],
          ['Emplacement', s.location],
        ];
  return (
    <Card className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
      <div className="flex items-center gap-2">
        <CardTitle className="flex flex-1 items-center gap-2">
          <Database aria-hidden="true" className="text-primary size-5" /> Stockage des fichiers
        </CardTitle>
        {s.reachable ? (
          <Badge tone="success">
            <CheckCircle2 aria-hidden="true" className="size-3.5" /> Connecté
          </Badge>
        ) : (
          <Badge tone="danger">
            <TriangleAlert aria-hidden="true" className="size-3.5" /> Injoignable
          </Badge>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono text-[13px] break-all">{v ?? '—'}</dd>
          </div>
        ))}
        {s.latencyMs !== null && (
          <>
            <dt className="text-muted">Temps de réponse</dt>
            <dd className="tabular-nums">{s.latencyMs} ms</dd>
          </>
        )}
      </dl>
      {s.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-[13px]">
          {s.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw aria-hidden="true" className={cn(refreshing && 'animate-spin')} /> Actualiser
        </Button>
        {s.consoleUrl && (
          <Button variant="secondary" size="sm" asChild>
            <a href={s.consoleUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" /> Console MinIO
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          </Button>
        )}
      </div>
      {s.type === 's3' && (
        <p className="text-muted text-xs">
          Comptes d'accès, quotas, réplication et cycle de vie des objets se gèrent dans la console MinIO. Le
          bucket est privé : les fichiers ne sont servis qu'à travers l'application, après contrôle des
          droits.
        </p>
      )}
    </Card>
  );
}

function UsageCard({ usage }: { usage: StorageStatus['usage'] }) {
  const entries = Object.entries(usage.bytesByType);
  return (
    <Card className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
      <CardTitle>Volume occupé par la société</CardTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Espace utilisé" value={formatSize(usage.bytes)} />
        <Stat label="Documents" value={usage.documents.toLocaleString('fr-FR')} />
        <Stat label="Versions" value={usage.versions.toLocaleString('fr-FR')} />
      </div>
      {entries.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Répartition par format">
          {entries.map(([mime, bytes]) => {
            const pct = usage.bytes > 0 ? (bytes / usage.bytes) * 100 : 0;
            return (
              <li key={mime} className="flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span>{MIME_LABEL[mime] ?? mime}</span>
                  <span className="text-muted tabular-nums">
                    {formatSize(bytes)} · {Math.round(pct)} %
                  </span>
                </div>
                <div className="bg-bg h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${String(Math.max(pct, 1))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'warning';
}) {
  return (
    <div
      className={cn(
        'border-line flex flex-col gap-0.5 rounded-lg border px-3 py-2',
        tone === 'success' && 'bg-success-soft border-transparent',
        tone === 'danger' && 'bg-danger-soft border-transparent',
        tone === 'warning' && 'bg-warning-soft border-transparent',
      )}
    >
      <span className="text-muted text-xs">{label}</span>
      <span className="font-display text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

interface Anomaly {
  key: string;
  kind: 'Manquant' | 'Taille différente';
  documentId: string;
  reference: string | null;
  title: string;
  versionNo: number;
  expectedBytes: number;
  actualBytes: number | null;
}

const ANOMALY_COLUMNS: ColDef<Anomaly>[] = [
  {
    field: 'kind',
    headerName: 'Anomalie',
    maxWidth: 170,
    cellRenderer: ({ value }: CustomCellRendererProps<Anomaly>) => (
      <Badge tone={value === 'Manquant' ? 'danger' : 'warning'}>{String(value)}</Badge>
    ),
  },
  {
    field: 'title',
    headerName: 'Document',
    flex: 2,
    minWidth: 220,
    cellRenderer: ({ data }: CustomCellRendererProps<Anomaly>) =>
      data ? (
        <Link to={`/documents/${data.documentId}`} className="text-ink font-medium no-underline">
          {data.title}
        </Link>
      ) : null,
  },
  { field: 'reference', headerName: 'Cote', cellClass: 'font-mono text-[12.5px]' },
  { field: 'versionNo', headerName: 'Version', maxWidth: 110 },
  {
    field: 'expectedBytes',
    headerName: 'Taille attendue',
    valueFormatter: ({ value }: { value: number }) => formatSize(value),
  },
  {
    field: 'actualBytes',
    headerName: 'Taille trouvée',
    valueFormatter: ({ value }: { value: number | null }) => (value === null ? 'absent' : formatSize(value)),
  },
  { field: 'key', headerName: 'Clé de stockage', flex: 2, minWidth: 240, cellClass: 'font-mono text-xs' },
];

function CheckReport({ result: r }: { result: StorageCheck }) {
  const anomalies: Anomaly[] = [
    ...r.missing.map((m) => ({ ...m, kind: 'Manquant' as const, actualBytes: null })),
    ...r.mismatches.map((m) => ({ ...m, kind: 'Taille différente' as const })),
  ];
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <p
        className={cn(
          'rounded-lg px-3 py-2 text-sm font-medium',
          r.healthy ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
        )}
      >
        {r.healthy
          ? `Stockage conforme : les ${String(r.expected)} fichiers attendus sont présents, avec la bonne taille.`
          : `${String(r.missingCount + r.mismatchCount)} anomalie(s) sur ${String(r.expected)} fichiers attendus.`}{' '}
        <span className="font-normal opacity-80">
          Contrôle du {formatDateTime(r.checkedAt)} · {r.durationMs} ms
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Conformes" value={String(r.ok)} tone="success" />
        <Stat label="Manquants" value={String(r.missingCount)} tone={r.missingCount ? 'danger' : undefined} />
        <Stat
          label="Taille différente"
          value={String(r.mismatchCount)}
          tone={r.mismatchCount ? 'danger' : undefined}
        />
        <Stat label="Orphelins" value={String(r.orphanCount)} tone={r.orphanCount ? 'warning' : undefined} />
      </div>
      {anomalies.length > 0 && (
        <DataGrid
          rows={anomalies}
          columns={ANOMALY_COLUMNS}
          label="Anomalies du stockage"
          getRowId={(a) => a.key}
          exportable
          pageSize={25}
        />
      )}
      {r.orphanCount > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-medium">
            {r.orphanCount} fichier(s) sans document en base
            {r.orphanCount > r.orphans.length && ` (les ${String(r.orphans.length)} premiers)`}
          </summary>
          <p className="text-muted mt-2">
            Souvent un dépôt interrompu. Ils n'apparaissent nulle part dans l'application ; à examiner dans la
            console avant toute suppression.
          </p>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
            {r.orphans.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
