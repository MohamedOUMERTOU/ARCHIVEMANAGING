import { Download, ExternalLink, FileQuestion, Maximize2, ScanText } from 'lucide-react';
import { lazy, Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { formatSize } from '@/utils/format';
import { useDownload, useViewLink } from '../hooks/useDocuments';
import type { VersionDto } from '../types';
import { ImageViewer } from './viewer/ImageViewer';
import { ToolButton, Toolbar } from './viewer/toolbar';

// pdf.js (~1 Mo) n'est téléchargé qu'à l'ouverture d'un PDF
const PdfViewer = lazy(() => import('./viewer/PdfViewer'));

interface DocumentViewerProps {
  documentId: string;
  title: string;
  versions: VersionDto[];
  /** Version affichée ; la plus récente si absente */
  versionNo?: number | undefined;
  onVersionChange?: (versionNo: number) => void;
  /** Hauteur de la zone d'aperçu (classes Tailwind) */
  heightClass?: string;
  /** Page ouverte au chargement d'un PDF (résultat de recherche) */
  initialPage?: number | undefined;
  /** Mot surligné au chargement d'un PDF */
  initialQuery?: string | undefined;
}

/** Libellé court du format : extension du fichier, sinon sous-type MIME. */
function formatLabel(v: VersionDto) {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(v.filename)?.[1];
  return (ext ?? v.mimeType.split('/')[1] ?? '?').toUpperCase();
}

/**
 * Aperçu d'un document dans la page.
 * PDF : visionneuse pdf.js (vignettes, zoom, rotation, recherche). Images : zoom et rotation.
 * Autres formats : rien n'est interprété par le navigateur, on propose le téléchargement.
 */
export function DocumentViewer({
  documentId,
  title,
  versions,
  versionNo,
  onVersionChange,
  heightClass = 'h-[calc(100vh-15rem)] min-h-[520px]',
  initialPage,
  initialQuery,
}: DocumentViewerProps) {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const download = useDownload();
  const version = versions.find((v) => v.versionNo === versionNo) ?? versions[0];
  const link = useViewLink(documentId, version?.versionNo);

  if (!version) return null;
  // Un scan dont le texte a été reconnu s'affiche par sa copie PDF : le type vient du lien d'aperçu
  const isImage = (link.data?.mimeType ?? version.mimeType).startsWith('image/');
  const textLayer = link.data?.textLayer === true;
  const label = t('viewer.frameTitle', { title, version: version.versionNo });
  const url = link.data?.previewable ? link.data.url : null;

  const trailing = (
    <>
      {url && (
        <ToolButton
          label={t('viewer.fullscreen')}
          onClick={() => {
            void sectionRef.current?.requestFullscreen().catch(() => undefined);
          }}
        >
          <Maximize2 aria-hidden="true" />
        </ToolButton>
      )}
      <ToolButton
        label={t('doc.download')}
        disabled={download.isPending}
        onClick={() => {
          download.mutate({ id: documentId, versionNo: version.versionNo, filename: version.filename });
        }}
      >
        <Download aria-hidden="true" />
      </ToolButton>
    </>
  );

  let body;
  if (link.isPending) {
    body = (
      <div className="mx-auto w-full max-w-md p-8">
        <LoadingState rows={4} />
      </div>
    );
  } else if (link.isError) {
    body = (
      <div className="p-6">
        <ErrorState error={link.error} onRetry={() => void link.refetch()} />
      </div>
    );
  } else if (!url) {
    body = (
      <div className="flex size-full flex-col">
        <Toolbar label={t('viewer.toolbar')}>
          <span className="flex-1" />
          {trailing}
        </Toolbar>
        <div className="text-muted flex flex-1 flex-col items-center justify-center gap-2 bg-[#E9EDF1] p-6 text-center">
          <FileQuestion aria-hidden="true" className="size-9" />
          <p className="text-ink font-medium">{t('viewer.notPreviewable')}</p>
          <p className="max-w-sm text-[13px]">{t('viewer.notPreviewableHint', { type: version.mimeType })}</p>
        </div>
      </div>
    );
  } else if (isImage) {
    body = <ImageViewer url={url} label={label} trailing={trailing} />;
  } else {
    body = (
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md p-8">
            <LoadingState rows={4} />
          </div>
        }
      >
        <PdfViewer
          key={url}
          url={url}
          label={label}
          trailing={trailing}
          initialPage={initialPage}
          initialQuery={initialQuery}
        />
      </Suspense>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label={t('viewer.title')}
      className="border-line bg-surface @container flex min-w-0 flex-col overflow-hidden rounded-xl border"
    >
      <div
        className={cn(
          'flex min-h-0 flex-col',
          heightClass,
          'in-[:fullscreen]:h-auto in-[:fullscreen]:flex-1',
        )}
      >
        {body}
      </div>
      <div className="border-line text-muted flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs">
        <span className="bg-bg text-ink-soft rounded-md px-2 py-0.5 font-semibold">
          {formatLabel(version)}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {version.filename} · {formatSize(version.sizeBytes)}
        </span>
        {textLayer && (
          <span
            title={t('viewer.textLayerHint')}
            className="text-success inline-flex items-center gap-1 font-semibold"
          >
            <ScanText aria-hidden="true" className="size-3.5" />
            {t('viewer.textLayer')}
            <span className="sr-only"> : {t('viewer.textLayerHint')}</span>
          </span>
        )}
        {url && (
          // Visionneuse du navigateur : utile pour imprimer
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft hover:text-ink inline-flex items-center gap-1 no-underline"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            {t('viewer.newTab')}
          </a>
        )}
        {versions.length > 1 && onVersionChange && (
          <label className="flex items-center gap-2">
            <span>{t('viewer.version')}</span>
            <Select
              className="h-8 w-auto text-[13px]"
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
      </div>
    </section>
  );
}
