import { Download, FileText, RefreshCw, ScanText } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { notifyError } from '@/lib/forms';
import { formatDateTime } from '@/utils/format';
import { useDocumentText, useDownloadSearchable, useRetryText, useTextPages } from '../hooks/useDocuments';
import type { TextState, TextStatus, VersionDto } from '../types';
import { readability } from '../utils/snippet';

const TONE: Record<TextState, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  AUCUN: 'neutral',
  EN_ATTENTE: 'neutral',
  EN_COURS: 'info',
  TERMINE: 'success',
  PEU_LISIBLE: 'warning',
  ECHEC: 'danger',
};

interface TextCardProps {
  documentId: string;
  /** Version affichée dans l'aperçu */
  version: VersionDto;
  canWrite: boolean;
}

/**
 * Texte du fichier : lu directement dans le PDF, ou reconnu sur l'image (OCR). Sert à la recherche dans
 * le contenu et, pour un scan, à la recherche dans l'aperçu. L'état se met à jour pendant la lecture.
 */
export function TextCard({ documentId, version, canWrite }: TextCardProps) {
  const { t } = useTranslation();
  const text = useDocumentText(documentId, version.versionNo);
  const retry = useRetryText(documentId);
  const downloadCopy = useDownloadSearchable();
  const [open, setOpen] = useState(false);

  if (text.isPending) return null;
  if (text.isError) return null;
  const s = text.data;
  if (!s.supported) return null;

  const running = s.status === 'EN_ATTENTE' || s.status === 'EN_COURS';
  const recognized = s.method === 'OCR' || s.method === 'MIXTE';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CardTitle className="flex flex-1 items-center gap-2">
          <ScanText aria-hidden="true" className="text-primary size-[18px]" />
          {t('text.title')}
        </CardTitle>
        <Badge tone={TONE[s.status]}>{t(`text.states.${s.status}`)}</Badge>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        <Body status={s} />
      </div>

      {s.status === 'PEU_LISIBLE' && <p className="text-warning text-[13px]">{t('text.lowHint')}</p>}

      {(s.hasText || (canWrite && !running) || s.copyDownloadable) && (
        <div className="flex flex-wrap gap-2">
          {s.hasText && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(true);
              }}
            >
              <FileText aria-hidden="true" /> {t('text.show')}
            </Button>
          )}
          {canWrite && !running && (
            <Button
              variant="secondary"
              size="sm"
              disabled={retry.isPending}
              onClick={() => {
                retry.mutate(version.versionNo, { onError: notifyError });
              }}
            >
              <RefreshCw aria-hidden="true" /> {s.status === 'AUCUN' ? t('text.start') : t('text.retry')}
            </Button>
          )}
          {s.copyDownloadable && (
            <Button
              variant="secondary"
              size="sm"
              disabled={downloadCopy.isPending}
              onClick={() => {
                downloadCopy.mutate(
                  { id: documentId, versionNo: version.versionNo, filename: pdfName(version.filename) },
                  { onError: notifyError },
                );
              }}
            >
              <Download aria-hidden="true" /> {t('text.downloadCopy')}
            </Button>
          )}
        </div>
      )}
      {recognized && s.searchableCopy && <p className="text-muted text-xs">{t('text.copyNote')}</p>}

      {open && (
        <TextDialog
          documentId={documentId}
          versionNo={version.versionNo}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </Card>
  );
}

function Body({ status: s }: { status: TextStatus }) {
  const { t } = useTranslation();
  switch (s.status) {
    case 'AUCUN':
      return <p className="text-muted text-[13px]">{t('text.none')}</p>;
    case 'EN_ATTENTE':
      return (
        <p className="text-muted text-[13px]">
          {s.queuePosition ? t('text.queued', { count: s.queuePosition }) : t('text.next')}
        </p>
      );
    case 'EN_COURS': {
      const total = s.pagesTotal ?? 0;
      const pct = total > 0 ? Math.round((s.pagesDone / total) * 100) : 0;
      return (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px]">
            {total > 0 ? t('text.progress', { done: s.pagesDone, total }) : t('text.starting')}
          </p>
          <div
            role="progressbar"
            aria-label={t('text.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="bg-bg h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${String(pct)}%` }}
            />
          </div>
        </div>
      );
    }
    case 'ECHEC':
      return <p className="text-danger text-[13px]">{s.error ?? t('text.failed')}</p>;
    default:
      return (
        <dl className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
          <Row label={t('text.processedAt')}>{formatDateTime(s.finishedAt)}</Row>
          <Row label={t('text.method')}>{s.method ? t(`text.methods.${s.method}`) : '—'}</Row>
          {s.languages.length > 0 && (
            <Row label={t('text.languages')}>
              {s.languages.map((l) => t(`text.langs.${l}`, l)).join(', ')}
            </Row>
          )}
          <Row label={t('text.pages')}>{s.pagesTotal ?? '—'}</Row>
          {s.confidence !== null && (
            <Row label={t('text.readability')}>
              {t(`text.levels.${readability(s.confidence)}`)}{' '}
              <span className="text-muted font-normal">({Math.round(s.confidence)} %)</span>
            </Row>
          )}
          {!s.hasText && <dd className="text-muted col-span-2 font-normal">{t('text.empty')}</dd>}
        </dl>
      );
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </>
  );
}

function TextDialog({
  documentId,
  versionNo,
  onClose,
}: {
  documentId: string;
  versionNo: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const pages = useTextPages(documentId, versionNo, true);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t('text.dialogTitle', { version: versionNo })}
      description={t('text.dialogHint')}
      className="max-w-3xl"
    >
      {pages.isPending ? (
        <LoadingState rows={6} />
      ) : pages.isError ? (
        <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />
      ) : (
        <ol className="flex flex-col gap-5">
          {pages.data.map((p) => (
            <li key={p.page} className="flex flex-col gap-1.5">
              <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
                {t('text.pageLabel', { n: p.page })}
              </h3>
              {p.content ? (
                <p
                  dir="auto"
                  className="bg-bg rounded-lg px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap"
                >
                  {p.content}
                </p>
              ) : (
                <p className="text-muted text-[13px]">{t('text.emptyPage')}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}

const pdfName = (filename: string) => `${filename.replace(/\.[^.]+$/, '')}.pdf`;
