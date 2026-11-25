import 'pdfjs-dist/web/pdf_viewer.css';
import { getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import {
  EventBus,
  LinkTarget,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from 'pdfjs-dist/web/pdf_viewer.mjs';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileX,
  MoveHorizontal,
  PanelLeft,
  RectangleVertical,
  RotateCw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@/components/shared/states';
import { cn } from '@/lib/cn';
import { PDF_RESOURCES } from './pdfjs';
import { ToolButton, Toolbar, ToolSeparator } from './toolbar';
import { percent } from './zoom';

/*
 * Visionneuse PDF (pdf.js) : pages en défilement continu, vignettes, zoom, rotation, recherche surlignée.
 * Chargée à la demande (~1 Mo) : seuls les écrans qui affichent un PDF la téléchargent.
 * Le parent la remonte (key) à chaque changement de fichier : tout l'état repart de zéro.
 */

interface Matches {
  current: number;
  total: number;
}
type Fit = 'page-width' | 'page-fit';

interface Tools {
  viewer: PDFViewer;
  bus: EventBus;
}

export interface PdfViewerProps {
  url: string;
  /** Nom accessible de la zone de lecture */
  label: string;
  /** Boutons ajoutés en fin de barre (plein écran, téléchargement…) */
  trailing?: ReactNode;
  /** Page affichée à l'ouverture (depuis un résultat de recherche) */
  initialPage?: number | undefined;
  /** Mot cherché et surligné à l'ouverture */
  initialQuery?: string | undefined;
}

export default function PdfViewer({ url, label, trailing, initialPage, initialQuery }: PdfViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tools = useRef<Tools | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState<Fit | null>('page-width');
  const [thumbs, setThumbs] = useState(true);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Matches | null>(null);
  // Lus une seule fois, à l'ouverture du fichier
  const initial = useRef({ page: initialPage, query: initialQuery?.trim() ?? '' });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bus = new EventBus();
    // Liens du PDF : nouvel onglet, sans transmettre l'adresse de la GED
    const linkService = new PDFLinkService({
      eventBus: bus,
      externalLinkTarget: LinkTarget.BLANK,
      externalLinkRel: 'noopener noreferrer nofollow',
    });
    const findController = new PDFFindController({ eventBus: bus, linkService });
    const viewer = new PDFViewer({ container, eventBus: bus, linkService, findController });
    linkService.setViewer(viewer);
    tools.current = { viewer, bus };

    bus.on('pagesinit', () => {
      viewer.currentScaleValue = 'page-width';
      const { page: start, query: q } = initial.current;
      if (start && start > 1) viewer.currentPageNumber = Math.min(start, viewer.pagesCount);
      if (q) {
        setQuery(q);
        // La recherche part de la page affichée : le premier résultat est celui de la page trouvée
        bus.dispatch('find', {
          source: null,
          type: '',
          query: q,
          caseSensitive: false,
          entireWord: false,
          highlightAll: true,
          findPrevious: false,
          matchDiacritics: false,
        });
      }
    });
    bus.on('pagechanging', (e: { pageNumber: number }) => {
      setPage(e.pageNumber);
    });
    bus.on('scalechanging', (e: { scale: number; presetValue?: string }) => {
      setScale(e.scale);
      setFit(e.presetValue === 'page-width' || e.presetValue === 'page-fit' ? e.presetValue : null);
    });
    const onMatches = (e: { matchesCount: Matches }) => {
      setMatches(e.matchesCount);
    };
    bus.on('updatefindmatchescount', onMatches);
    bus.on('updatefindcontrolstate', onMatches);

    // Largeur ou page entière : recalculées quand la zone change de taille (fiche masquée, plein écran…)
    const resize = new ResizeObserver(() => {
      const preset = viewer.currentScaleValue;
      if (preset === 'page-width' || preset === 'page-fit') viewer.currentScaleValue = preset;
    });
    resize.observe(container);

    let alive = true;
    const task = getDocument({ url, ...PDF_RESOURCES });
    task.promise.then(
      (doc) => {
        if (!alive) return;
        viewer.setDocument(doc);
        linkService.setDocument(doc);
        setPdf(doc);
      },
      () => {
        if (alive) setFailed(true);
      },
    );

    return () => {
      alive = false;
      resize.disconnect();
      viewer.setDocument(null);
      linkService.setDocument(null);
      tools.current = null;
      void task.destroy();
    };
  }, [url]);

  const viewer = () => tools.current?.viewer;
  const pages = pdf?.numPages ?? 0;

  const goTo = (n: number) => {
    const v = viewer();
    if (v && pages) v.currentPageNumber = Math.min(Math.max(1, Math.round(n)), pages);
  };
  const setPreset = (value: Fit) => {
    const v = viewer();
    if (v) v.currentScaleValue = value;
  };

  const find = (q: string, type: '' | 'again', previous = false) => {
    tools.current?.bus.dispatch('find', {
      source: null,
      type,
      query: q,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: previous,
      matchDiacritics: false,
    });
  };
  const onQuery = (q: string) => {
    setQuery(q);
    if (q.trim()) {
      find(q, '');
    } else {
      tools.current?.bus.dispatch('findbarclose', { source: null });
      setMatches(null);
    }
  };

  // Ctrl+F dans l'aperçu : la recherche du document plutôt que celle de la page web
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  };

  const ready = pdf !== null;

  return (
    <div className="flex size-full flex-col" onKeyDown={onKeyDown}>
      <Toolbar label={t('viewer.toolbar')}>
        <ToolButton
          label={t('viewer.thumbnails')}
          pressed={thumbs}
          disabled={!ready}
          className="max-sm:hidden"
          onClick={() => {
            setThumbs((v) => !v);
          }}
        >
          <PanelLeft aria-hidden="true" />
          <span className="@max-4xl:hidden">{t('viewer.thumbnails')}</span>
        </ToolButton>
        <ToolSeparator />
        <ToolButton
          label={t('viewer.prevPage')}
          disabled={!ready || page <= 1}
          onClick={() => {
            goTo(page - 1);
          }}
        >
          <ChevronLeft aria-hidden="true" />
        </ToolButton>
        <span className="flex items-center gap-1.5 text-[13px]">
          <input
            aria-label={t('viewer.pageInput')}
            inputMode="numeric"
            disabled={!ready}
            value={pageDraft ?? String(page)}
            onChange={(e) => {
              setPageDraft(e.target.value.replace(/\D/g, ''));
            }}
            onFocus={(e) => {
              e.target.select();
            }}
            onBlur={() => {
              if (pageDraft) goTo(Number(pageDraft));
              setPageDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="border-line-strong focus-visible:border-primary h-8 w-11 rounded-lg border text-center tabular-nums focus-visible:outline-none"
          />
          <span className="text-muted tabular-nums">{t('viewer.pageOf', { total: pages || '…' })}</span>
        </span>
        <ToolButton
          label={t('viewer.nextPage')}
          disabled={!ready || page >= pages}
          onClick={() => {
            goTo(page + 1);
          }}
        >
          <ChevronRight aria-hidden="true" />
        </ToolButton>
        <ToolSeparator />
        <ToolButton label={t('viewer.zoomOut')} disabled={!ready} onClick={() => viewer()?.decreaseScale()}>
          <ZoomOut aria-hidden="true" />
        </ToolButton>
        <span className="w-12 text-center text-[13px] tabular-nums">{ready ? percent(scale) : '—'}</span>
        <ToolButton label={t('viewer.zoomIn')} disabled={!ready} onClick={() => viewer()?.increaseScale()}>
          <ZoomIn aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('viewer.fitWidthLabel')}
          pressed={fit === 'page-width'}
          disabled={!ready}
          onClick={() => {
            setPreset('page-width');
          }}
        >
          <MoveHorizontal aria-hidden="true" />
          <span className="@max-4xl:hidden">{t('viewer.fitWidth')}</span>
        </ToolButton>
        <ToolButton
          label={t('viewer.fitPage')}
          pressed={fit === 'page-fit'}
          disabled={!ready}
          onClick={() => {
            setPreset('page-fit');
          }}
        >
          <RectangleVertical aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('viewer.rotate')}
          disabled={!ready}
          onClick={() => {
            const v = viewer();
            if (v) v.pagesRotation = (v.pagesRotation + 90) % 360;
          }}
        >
          <RotateCw aria-hidden="true" />
        </ToolButton>
        <ToolSeparator />

        {/* Champ de largeur fixe : compteur et flèches sont dans le champ, la barre ne bouge pas */}
        <div role="search" className="relative ml-auto flex w-56 shrink-0 items-center @max-4xl:w-44">
          <label className="contents">
            <span className="sr-only">{t('viewer.search')}</span>
            <Search aria-hidden="true" className="text-muted pointer-events-none absolute left-2.5 size-4" />
            <input
              ref={searchRef}
              type="search"
              disabled={!ready}
              value={query}
              placeholder={t('viewer.searchPlaceholder')}
              onChange={(e) => {
                onQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  e.preventDefault();
                  find(query, 'again', e.shiftKey);
                }
              }}
              className={cn(
                'border-line-strong focus-visible:border-primary h-8 w-full min-w-0 rounded-lg border pl-8 text-[13px] focus-visible:outline-none',
                '[&::-webkit-search-cancel-button]:hidden',
                query.trim() && matches ? 'pr-[5.5rem]' : 'pr-2',
              )}
            />
          </label>
          {query.trim() && matches && (
            <div className="absolute right-1 flex items-center gap-0.5">
              {/* Compteur court à l'écran, phrase complète pour les lecteurs d'écran */}
              <span aria-hidden="true" className="text-muted px-1 text-xs tabular-nums">
                {matches.total ? `${String(matches.current)}/${String(matches.total)}` : '0'}
              </span>
              <span aria-live="polite" className="sr-only">
                {t('viewer.matches', { count: matches.total, current: matches.current })}
              </span>
              <MatchButton
                label={t('viewer.prevMatch')}
                disabled={matches.total === 0}
                onClick={() => {
                  find(query, 'again', true);
                }}
              >
                <ChevronUp aria-hidden="true" />
              </MatchButton>
              <MatchButton
                label={t('viewer.nextMatch')}
                disabled={matches.total === 0}
                onClick={() => {
                  find(query, 'again');
                }}
              >
                <ChevronDown aria-hidden="true" />
              </MatchButton>
            </div>
          )}
        </div>
        {trailing}
      </Toolbar>

      <div className="flex min-h-0 flex-1 bg-[#E9EDF1]">
        {thumbs && pdf && <Thumbnails pdf={pdf} current={page} onSelect={goTo} />}
        <div className="relative min-w-0 flex-1">
          {/* pdf.js impose un conteneur en position absolue */}
          <div
            ref={containerRef}
            role="document"
            aria-label={label}
            tabIndex={0}
            className="absolute inset-0 overflow-auto focus-visible:outline-none"
          >
            <div className="pdfViewer" />
          </div>
          {!ready && !failed && (
            <div className="absolute inset-0 flex items-start justify-center p-8">
              <div className="w-full max-w-md">
                <LoadingState rows={4} />
              </div>
            </div>
          )}
          {failed && (
            <div className="text-muted absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <FileX aria-hidden="true" className="size-9" />
              <p className="text-ink font-medium">{t('viewer.loadError')}</p>
              <p className="max-w-sm text-[13px]">{t('viewer.loadErrorHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Petit bouton placé dans le champ de recherche. */
function MatchButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-ink-soft hover:bg-bg hover:text-ink flex size-6 items-center justify-center rounded-md disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

const THUMB_WIDTH = 64;

function Thumbnails({
  pdf,
  current,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  current: number;
  onSelect: (n: number) => void;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);

  // La vignette de la page lue reste visible
  useEffect(() => {
    listRef.current?.querySelector(`[data-page="${String(current)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  return (
    <ol
      ref={listRef}
      aria-label={t('viewer.thumbnails')}
      className="border-line flex w-24 shrink-0 flex-col items-center gap-3 overflow-y-auto border-r bg-[#F8FAFC] py-3 max-sm:hidden"
    >
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <Thumbnail key={i + 1} pdf={pdf} n={i + 1} active={i + 1 === current} onSelect={onSelect} />
      ))}
    </ol>
  );
}

function Thumbnail({
  pdf,
  n,
  active,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  n: number;
  active: boolean;
  onSelect: (n: number) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  // Rendu seulement à l'approche de la vignette : un document de 300 pages reste léger
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let task: RenderTask | undefined;
    void pdf.getPage(n).then((p) => {
      const canvas = canvasRef.current;
      if (!alive || !canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: (THUMB_WIDTH * ratio) / p.getViewport({ scale: 1 }).width });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = p.render({ canvas, viewport });
      task.promise.catch(() => undefined);
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [visible, pdf, n]);

  return (
    <li>
      <button
        type="button"
        data-page={n}
        aria-label={t('viewer.thumbnail', { n })}
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          onSelect(n);
        }}
        className="group flex flex-col items-center gap-1"
      >
        <canvas
          ref={canvasRef}
          width={THUMB_WIDTH}
          height={90}
          className={cn(
            'block h-auto w-16 rounded-sm bg-white',
            active
              ? 'outline-primary outline-2 outline-offset-2'
              : 'border-line-strong group-hover:border-primary border',
          )}
        />
        <span
          className={cn('text-[11px] tabular-nums', active ? 'text-primary-strong font-bold' : 'text-muted')}
        >
          {n}
        </span>
      </button>
    </li>
  );
}
