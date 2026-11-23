import {
  Archive,
  ArrowRightLeft,
  CalendarClock,
  ClipboardList,
  Flame,
  Landmark,
  LockOpen,
  Undo2,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FolderInput,
  Lock,
  PackageOpen,
  Pencil,
  Repeat2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { cn } from '@/lib/cn';
import { formatDate, formatDay } from '@/utils/format';
import { useDocumentEvents } from '../hooks/useDocuments';
import type { DocumentEvent, DocumentEventType } from '../types';

const ICONS: Partial<Record<DocumentEventType, { icon: LucideIcon; tone: string }>> = {
  CREE: { icon: FilePlus2, tone: 'bg-primary text-white' },
  CLASSE: { icon: FolderInput, tone: 'bg-success-soft text-success' },
  CONSULTE: { icon: Eye, tone: 'bg-bg text-ink-soft' },
  TELECHARGE: { icon: Download, tone: 'bg-bg text-ink-soft' },
  COPIE_DEMANDEE: { icon: Copy, tone: 'bg-primary-soft text-primary-strong' },
  COPIE_REMISE: { icon: Copy, tone: 'bg-primary-soft text-primary-strong' },
  ORIGINAL_DEMANDE: { icon: PackageOpen, tone: 'bg-warning-soft text-warning' },
  ORIGINAL_SORTI: { icon: PackageOpen, tone: 'bg-warning-soft text-warning' },
  RECLASSE: { icon: ArrowRightLeft, tone: 'bg-[#EDE7F6] text-[#4C2A85]' },
  VERSION_REMPLACEE: { icon: Repeat2, tone: 'bg-danger-soft text-danger' },
  METADONNEES_MODIFIEES: { icon: Pencil, tone: 'bg-bg text-ink-soft' },
  GEL_POSE: { icon: Lock, tone: 'bg-danger-soft text-danger' },
  GEL_LEVE: { icon: LockOpen, tone: 'bg-success-soft text-success' },
  ECHEANCE_RECALCULEE: { icon: CalendarClock, tone: 'bg-primary-soft text-primary-strong' },
  SORT_PROPOSE: { icon: ClipboardList, tone: 'bg-warning-soft text-warning' },
  SORT_ABANDONNE: { icon: Undo2, tone: 'bg-bg text-ink-soft' },
  CONSERVATION_DEFINITIVE: { icon: Landmark, tone: 'bg-primary-soft text-primary-strong' },
  VERSE: { icon: Archive, tone: 'bg-primary text-white' },
  ELIMINE: { icon: Flame, tone: 'bg-danger text-white' },
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dateOr = (v: unknown) => (typeof v === 'string' ? formatDate(v) : 'aucune');
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

/** Lignes « avant / après » lisibles pour les événements qui changent quelque chose. */
function diffLines(e: DocumentEvent): { before: string; after: string } | null {
  if (e.type === 'RECLASSE' && e.before && e.after) {
    return {
      before: `${str(e.before.path)} · ${str(e.before.reference)}`,
      after: `${str(e.after.path)} · ${str(e.after.reference)}`,
    };
  }
  if (e.type === 'ECHEANCE_RECALCULEE' && e.before && e.after) {
    return {
      before: `Échéance ${dateOr(e.before.retentionUntil)}`,
      after: `Échéance ${dateOr(e.after.retentionUntil)}${e.after.rule ? ` · ${str(e.after.rule)}` : ''}`,
    };
  }
  if (e.type === 'VERSION_REMPLACEE' && e.before && e.after) {
    return {
      before: `v${str(e.before.version)} · ${str(e.before.filename)}`,
      after: `v${str(e.after.version)} · ${str(e.after.filename)}`,
    };
  }
  return null;
}

function detailLine(e: DocumentEvent): string | null {
  if (e.type === 'CLASSE' && e.after) return `${str(e.after.path)} · ${str(e.after.reference)}`;
  if (e.type === 'CREE' && e.after) return str(e.after.filename);
  if (e.type === 'TELECHARGE' && e.after) return `Version ${str(e.after.version)}`;
  const lifecycle = e.after ?? e.before;
  if (lifecycle && typeof lifecycle.bordereau === 'string') {
    return [
      `Bordereau ${lifecycle.bordereau}`,
      typeof lifecycle.destination === 'string' ? `vers ${lifecycle.destination}` : null,
      typeof lifecycle.originalPapier === 'string' ? `original papier : ${lifecycle.originalPapier}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (lifecycle && typeof lifecycle.gel === 'string') {
    return `${lifecycle.gel}${typeof lifecycle.affaire === 'string' ? ` · ${lifecycle.affaire}` : ''}`;
  }
  return null;
}

export function HistoryTimeline({ documentId }: { documentId: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch } = useDocumentEvents(documentId);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState title={t('history.empty')} />;

  return (
    <ol className="flex flex-col">
      {data.map((e, i) => {
        const day = formatDay(e.at.slice(0, 10));
        const previous = data[i - 1];
        const showDay = !previous || formatDay(previous.at.slice(0, 10)) !== day;
        const { icon: Icon, tone } = ICONS[e.type] ?? { icon: Eye, tone: 'bg-bg text-ink-soft' };
        const diff = diffLines(e);
        const detail = detailLine(e);
        const kind = e.after?.kind;
        return (
          <li key={e.id} className="flex flex-col">
            {showDay && (
              <span className="text-muted pt-2 pb-1 pl-[52px] text-[11px] font-semibold tracking-wide uppercase">
                {day}
              </span>
            )}
            <div className="relative flex gap-3.5 pb-3.5">
              {i < data.length - 1 && (
                <span aria-hidden="true" className="bg-line absolute top-10 bottom-0 left-[17px] w-0.5" />
              )}
              <span
                className={cn('z-10 flex size-9 shrink-0 items-center justify-center rounded-full', tone)}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <div className="border-line bg-surface flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[15px]">{t(`history.events.${e.type}`)}</strong>
                  {typeof kind === 'string' && (
                    <span className="bg-bg text-ink-soft rounded px-1.5 py-0.5 font-mono text-xs">
                      {kind}
                    </span>
                  )}
                  <time dateTime={e.at} className="text-muted ml-auto text-xs tabular-nums">
                    {time(e.at)}
                  </time>
                </div>
                <p className="text-ink-soft text-[13px]">
                  <b className="text-ink font-semibold">{e.actor ?? '—'}</b>
                  {e.onBehalfOf && <> · {t('history.onBehalf', { name: e.onBehalfOf })}</>}
                  {e.reason && <> · {e.reason}</>}
                </p>
                {detail && <p className="text-muted text-[13px]">{detail}</p>}
                {diff && (
                  <div className="flex flex-col gap-1 text-[13px]">
                    <span className="bg-danger-soft text-danger rounded px-2 py-1">
                      <span className="sr-only">{t('history.before')} : </span>− {diff.before}
                    </span>
                    <span className="bg-success-soft text-success rounded px-2 py-1">
                      <span className="sr-only">{t('history.after')} : </span>+ {diff.after}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
