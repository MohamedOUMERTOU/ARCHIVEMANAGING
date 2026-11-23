import { Download, ExternalLink, FileQuestion, Maximize2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { formatSize } from '@/utils/format';
import { useDownload, useViewLink } from '../hooks/useDocuments';
import type { VersionDto } from '../types';

interface DocumentViewerProps {
  documentId: string;
  title: string;
  versions: VersionDto[];
  /** Version affichée ; la plus récente si absente */
  versionNo?: number | undefined;
  onVersionChange?: (versionNo: number) => void;
  /** Hauteur de la zone d'aperçu (classe Tailwind) */
  heightClass?: string;
}

/**
 * Aperçu d'un document dans la page.
 * PDF : visionneuse native du navigateur (zoom, recherche, pages). Images : affichées telles quelles.
 * Autres formats : rien n'est interprété par le navigateur, on propose le téléchargement.
 */
export function DocumentViewer({
  documentId,
  title,
  versions,
  versionNo,
  onVersionChange,
  heightClass = 'h-[75vh]',
}: DocumentViewerProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const download = useDownload();
  const version = versions.find((v) => v.versionNo === versionNo) ?? versions[0];
  const link = useViewLink(documentId, version?.versionNo);

  if (!version) return null;
  const isImage = version.mimeType.startsWith('image/');
  const label = t('viewer.frameTitle', { title, version: version.versionNo });

  const fullscreen = () => {
    void frameRef.current?.requestFullscreen().catch(() => undefined);
  };

  return (
    <section aria-label={t('viewer.title')} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {versions.length > 1 && onVersionChange && (
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">{t('viewer.version')}</span>
            <Select
              className="h-9 w-auto"
              value={version.versionNo}
              onChange={(e) => {
                onVersionChange(Number(e.target.value));
              }}
            >
              {versions.map((v, i) => (
                <option key={v.versionNo} value={v.versionNo}>
                  v{v.versionNo}
                  {i === 0 ? ` · ${t('doc.current')}` : ''}
                </option>
              ))}
            </Select>
          </label>
        )}
        <span className="text-muted min-w-0 flex-1 truncate text-[13px]">
          {version.filename} · {formatSize(version.sizeBytes)}
        </span>
        {link.data?.previewable && link.data.url && (
          <>
            <Button variant="ghost" size="sm" onClick={fullscreen}>
              <Maximize2 aria-hidden="true" /> {t('viewer.fullscreen')}
            </Button>
            <a
              href={link.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-soft hover:bg-bg inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium no-underline"
            >
              <ExternalLink aria-hidden="true" className="size-4" /> {t('viewer.newTab')}
            </a>
          </>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={download.isPending}
          onClick={() => {
            download.mutate({ id: documentId, versionNo: version.versionNo, filename: version.filename });
          }}
        >
          <Download aria-hidden="true" /> {t('doc.download')}
        </Button>
      </div>

      <div
        ref={frameRef}
        className={cn(
          'border-line flex items-center justify-center overflow-hidden rounded-xl border bg-[#E9EDF1]',
          heightClass,
        )}
      >
        {link.isPending ? (
          <div className="w-full max-w-md p-6">
            <LoadingState rows={4} />
          </div>
        ) : link.isError ? (
          <div className="p-6">
            <ErrorState error={link.error} onRetry={() => void link.refetch()} />
          </div>
        ) : !link.data.previewable || !link.data.url ? (
          <div className="text-muted flex max-w-sm flex-col items-center gap-2 p-6 text-center">
            <FileQuestion aria-hidden="true" className="size-9" />
            <p className="text-ink font-medium">{t('viewer.notPreviewable')}</p>
            <p className="text-[13px]">{t('viewer.notPreviewableHint', { type: version.mimeType })}</p>
          </div>
        ) : isImage ? (
          <img src={link.data.url} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <iframe key={link.data.url} src={link.data.url} title={label} className="size-full bg-white" />
        )}
      </div>
    </section>
  );
}
