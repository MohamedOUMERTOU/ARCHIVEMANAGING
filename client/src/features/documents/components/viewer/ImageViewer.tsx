import { MoveHorizontal, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolButton, Toolbar, ToolSeparator } from './toolbar';
import { percent } from './zoom';

const MIN = 0.1;
const MAX = 8;
const STEP = 1.25;

/** Image : ajustée à la zone par défaut, zoom et rotation par quarts de tour. */
export function ImageViewer({ url, label, trailing }: { url: string; label: string; trailing?: ReactNode }) {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement>(null);
  // null : ajustée à la zone
  const [zoom, setZoom] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [natural, setNatural] = useState(0);

  // Échelle réellement affichée (utile pour partir de l'ajustement)
  const shown = () => {
    const img = imgRef.current;
    return img?.naturalWidth ? img.clientWidth / img.naturalWidth : 1;
  };
  const zoomBy = (factor: number) => {
    setZoom((z) => Math.min(MAX, Math.max(MIN, (z ?? shown()) * factor)));
  };

  return (
    <div className="flex size-full flex-col">
      <Toolbar label={t('viewer.toolbar')}>
        <ToolButton
          label={t('viewer.zoomOut')}
          onClick={() => {
            zoomBy(1 / STEP);
          }}
        >
          <ZoomOut aria-hidden="true" />
        </ToolButton>
        <span className="w-12 text-center text-[13px] tabular-nums">
          {zoom === null ? '—' : percent(zoom)}
        </span>
        <ToolButton
          label={t('viewer.zoomIn')}
          onClick={() => {
            zoomBy(STEP);
          }}
        >
          <ZoomIn aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('viewer.fitPage')}
          pressed={zoom === null}
          onClick={() => {
            setZoom(null);
          }}
        >
          <MoveHorizontal aria-hidden="true" />
          <span className="@max-3xl:hidden">{t('viewer.fitPage')}</span>
        </ToolButton>
        <ToolButton
          label={t('viewer.rotate')}
          onClick={() => {
            setRotation((r) => (r + 90) % 360);
          }}
        >
          <RotateCw aria-hidden="true" />
        </ToolButton>
        <ToolSeparator />
        <span className="flex-1" />
        {trailing}
      </Toolbar>
      <div className="flex min-h-0 flex-1 overflow-auto bg-[#E9EDF1] p-4">
        <img
          ref={imgRef}
          src={url}
          alt={label}
          onLoad={(e) => {
            setNatural(e.currentTarget.naturalWidth);
          }}
          style={{
            transform: rotation ? `rotate(${String(rotation)}deg)` : undefined,
            width: zoom !== null && natural ? `${String(natural * zoom)}px` : undefined,
          }}
          className={
            zoom === null
              ? 'm-auto max-h-full max-w-full object-contain transition-transform'
              : 'm-auto max-w-none transition-transform'
          }
        />
      </div>
    </div>
  );
}
