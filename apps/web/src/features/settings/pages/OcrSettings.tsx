import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { Pause, Play, RefreshCw, ScanText, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { notifyError } from '@/lib/forms';
import { formatDateTime } from '@/utils/format';
import {
  settingsApi,
  settingsKeys,
  type OcrJobStatus,
  type OcrOverview,
  type OcrSettings as Settings,
  type OcrSettingsInput,
} from '../api/settings.api';

const LANGUAGE_LABEL: Record<string, string> = { fra: 'Français', ara: 'Arabe', eng: 'Anglais' };

const STATUS: Record<
  OcrJobStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }
> = {
  EN_ATTENTE: { label: 'En attente', tone: 'neutral' },
  EN_COURS: { label: 'En cours', tone: 'info' },
  TERMINE: { label: 'Terminé', tone: 'success' },
  PEU_LISIBLE: { label: 'Peu lisible', tone: 'warning' },
  ECHEC: { label: 'Échec', tone: 'danger' },
};

/** Paramétrage › Reconnaissance de texte : réglages de la société et suivi des traitements. */
export default function OcrSettings() {
  const settings = useQuery({ queryKey: settingsKeys.ocr, queryFn: settingsApi.ocr });
  const overview = useQuery({
    queryKey: settingsKeys.ocrOverview,
    queryFn: settingsApi.ocrOverview,
    // Suivi en direct tant que des documents attendent ou sont en cours de lecture
    refetchInterval: (q) => {
      const p = q.state.data?.progress;
      return p && !p.paused && p.pending + p.running > 0 ? 4000 : false;
    },
  });

  if (settings.isPending || overview.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;

  return (
    <div className="flex flex-col gap-5">
      {!settings.data.engineAvailable && (
        <p
          role="alert"
          className="bg-warning-soft text-warning flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          Le moteur de reconnaissance (Tesseract) ne répond pas sur le serveur : le texte des PDF est lu, mais
          les scans et les images ne peuvent pas l'être.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-5">
        {/* key : le formulaire repart des valeurs enregistrées après chaque enregistrement */}
        <SettingsCard key={JSON.stringify(settings.data)} settings={settings.data} />
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <ProgressCard overview={overview.data} />
          <RecentCard overview={overview.data} />
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OcrSettingsInput>({
    autoOnUpload: settings.autoOnUpload,
    languages: settings.languages,
    detectOrientation: settings.detectOrientation,
    searchablePdfDownload: settings.searchablePdfDownload,
  });
  const save = useMutation({
    mutationFn: settingsApi.updateOcr,
    onSuccess: (data) => {
      qc.setQueryData(settingsKeys.ocr, data);
      toast.success('Réglages enregistrés');
    },
    meta: { silent: true },
  });
  const set = (patch: Partial<OcrSettingsInput>) => {
    setForm((f) => ({ ...f, ...patch }));
  };
  const noLanguage = form.languages.length === 0;

  return (
    <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 xl:max-w-[420px]">
      <CardTitle className="flex items-center gap-2">
        <ScanText aria-hidden="true" className="text-primary size-5" /> Réglages
      </CardTitle>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!noLanguage) save.mutate(form, { onError: notifyError });
        }}
      >
        <Check
          checked={form.autoOnUpload}
          onChange={(v) => {
            set({ autoOnUpload: v });
          }}
          label="Lire le texte à chaque dépôt"
          hint="PDF, scans et images sont traités en arrière-plan, sans faire attendre la personne qui dépose."
        />
        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={noLanguage ? 'ocr-lang-error' : undefined}
        >
          <legend className="mb-1 text-sm font-semibold">Langues des documents</legend>
          {settings.availableLanguages.map((code) => (
            <Check
              key={code}
              checked={form.languages.includes(code)}
              onChange={(v) => {
                set({
                  languages: v
                    ? settings.availableLanguages.filter((c) => c === code || form.languages.includes(c))
                    : form.languages.filter((c) => c !== code),
                });
              }}
              label={LANGUAGE_LABEL[code] ?? code}
            />
          ))}
          <p className="text-muted text-xs">
            Ne cochez que les langues utiles : chaque langue ajoutée ralentit la lecture.
          </p>
          {noLanguage && (
            <p id="ocr-lang-error" role="alert" className="text-danger text-xs">
              Choisissez au moins une langue.
            </p>
          )}
        </fieldset>
        <Check
          checked={form.detectOrientation}
          onChange={(v) => {
            set({ detectOrientation: v });
          }}
          label="Détecter les pages tournées"
          hint="Lit correctement une page numérisée à l'envers ou de côté."
        />
        <Check
          checked={form.searchablePdfDownload}
          onChange={(v) => {
            set({ searchablePdfDownload: v });
          }}
          label="Proposer le PDF avec texte au téléchargement"
          hint="Une copie du scan qui porte le texte reconnu. Le fichier déposé n'est jamais modifié ; l'aperçu utilise cette copie dans tous les cas."
        />
        <div>
          <Button type="submit" disabled={save.isPending || noLanguage}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        className="accent-primary mt-0.5 size-4 shrink-0"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-muted text-xs">{hint}</span>}
      </span>
    </label>
  );
}

function useOverviewAction<T>(fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.ocr });
    },
    meta: { silent: true },
  });
}

function ProgressCard({ overview }: { overview: OcrOverview }) {
  const p = overview.progress;
  const backfill = useOverviewAction(settingsApi.ocrBackfill);
  const pause = useOverviewAction(settingsApi.pauseOcr);
  const pct = p.eligible > 0 ? Math.round((p.done / p.eligible) * 100) : 100;
  const busy = p.pending + p.running > 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
          <CardTitle>Documents archivés</CardTitle>
          <p className="text-muted text-[13px]">
            Texte lu pour <strong className="text-ink">{p.done}</strong> document(s) sur {p.eligible} dont le
            format peut être lu
            {p.paused && (
              <>
                {' '}
                · <strong className="text-warning">traitement suspendu</strong>
              </>
            )}
          </p>
        </div>
        {(busy || p.paused) && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pause.isPending}
            onClick={() => {
              pause.mutate(!p.paused, { onError: notifyError });
            }}
          >
            {p.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {p.paused ? 'Reprendre' : 'Mettre en pause'}
          </Button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Documents dont le texte est lu"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-bg h-2 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]" aria-live="polite">
        <span>En cours : {p.running}</span>
        <span>En attente : {p.pending}</span>
        <span className={p.lowQuality ? 'text-warning' : undefined}>Peu lisibles : {p.lowQuality}</span>
        <span className={p.failed ? 'text-danger' : undefined}>Échecs : {p.failed}</span>
        <span className="text-muted">Jamais lus : {p.notRequested}</span>
      </div>
      {p.notRequested > 0 && (
        <div className="bg-bg flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-[13px]">
          <span className="flex-[1_1_260px]">
            {p.notRequested} document(s) déposé(s) avant l'activation de la lecture, ou pendant qu'elle était
            désactivée, ne sont pas trouvés par la recherche dans le contenu.
          </span>
          <Button
            size="sm"
            disabled={backfill.isPending}
            onClick={() => {
              backfill.mutate(undefined, { onError: notifyError });
            }}
          >
            Lire ces {p.notRequested} document(s)
          </Button>
        </div>
      )}
    </Card>
  );
}

type Row = OcrOverview['recent'][number];

const COLUMNS: ColDef<Row>[] = [
  {
    field: 'title',
    headerName: 'Document',
    flex: 2,
    minWidth: 220,
    cellRenderer: ({ data }: CustomCellRendererProps<Row>) =>
      data ? (
        <Link to={`/documents/${data.documentId}`} className="text-ink font-medium no-underline">
          {data.title}
          {data.versionNo > 1 && <span className="text-muted font-normal"> · v{data.versionNo}</span>}
        </Link>
      ) : null,
  },
  { field: 'reference', headerName: 'Cote', cellClass: 'font-mono text-[12.5px]', flex: 1, minWidth: 150 },
  {
    field: 'pagesTotal',
    headerName: 'Pages',
    width: 100,
    valueGetter: ({ data }) =>
      !data
        ? ''
        : data.status === 'EN_COURS' && data.pagesTotal
          ? `${String(data.pagesDone)} / ${String(data.pagesTotal)}`
          : (data.pagesTotal ?? '—'),
  },
  {
    field: 'confidence',
    headerName: 'Lisibilité',
    width: 120,
    valueFormatter: ({ value }: { value: number | null }) =>
      value === null ? '—' : `${String(Math.round(value))} %`,
  },
  {
    field: 'status',
    headerName: 'État',
    width: 140,
    // En cas d'échec, la raison est au survol, et lue par les lecteurs d'écran
    cellRenderer: ({ data }: CustomCellRendererProps<Row>) =>
      data ? (
        <span title={data.error ?? undefined}>
          <Badge tone={STATUS[data.status].tone}>{STATUS[data.status].label}</Badge>
          {data.error && <span className="sr-only"> : {data.error}</span>}
        </span>
      ) : null,
  },
  {
    field: 'finishedAt',
    headerName: 'Lu le',
    width: 170,
    valueFormatter: ({ value }: { value: string | null }) => formatDateTime(value),
  },
];

function RecentCard({ overview }: { overview: OcrOverview }) {
  const retry = useOverviewAction(settingsApi.ocrRetryFailed);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <CardTitle className="flex-1">Derniers traitements</CardTitle>
        {overview.progress.failed > 0 && (
          <Button
            variant="secondary"
            size="sm"
            disabled={retry.isPending}
            onClick={() => {
              retry.mutate(undefined, { onError: notifyError });
            }}
          >
            <RefreshCw aria-hidden="true" /> Relancer les échecs ({overview.progress.failed})
          </Button>
        )}
      </div>
      <DataGrid
        rows={overview.recent}
        columns={COLUMNS}
        label="Derniers traitements de reconnaissance"
        getRowId={(r) => `${r.documentId}-${String(r.versionNo)}`}
        emptyMessage="Aucun document lu pour l'instant."
      />
    </Card>
  );
}
