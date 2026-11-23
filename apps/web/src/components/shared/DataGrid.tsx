import type { ColDef, GridApi } from 'ag-grid-community';
import { Download, Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { AgGridViewProps, GridSelection } from './AgGridView';

// AG Grid est chargé à la demande : il forme son propre fichier, téléchargé au premier affichage d'une grille
const AgGridView = lazy(() => import('./AgGridView')) as unknown as <T>(
  props: AgGridViewProps<T>,
) => ReactNode;

export type { ColDef };

interface DataGridProps<T> {
  rows: T[];
  columns: ColDef<T>[];
  /** Nom accessible de la grille, et nom du fichier exporté. */
  label: string;
  getRowId?: (row: T) => string;
  /** Champ de filtre rapide au-dessus de la grille. */
  searchable?: boolean;
  /** Bouton d'export CSV (les colonnes sans `field` sont ignorées). */
  exportable?: boolean;
  /** Pagination côté client au-delà de ce nombre de lignes. */
  pageSize?: number;
  getRowClass?: (row: T) => string | undefined;
  onRowClicked?: (row: T) => void;
  /** Boutons ajoutés à droite de la barre d'outils. */
  toolbar?: ReactNode;
  emptyMessage?: string;
  className?: string;
  /** Cases à cocher ; changer `selectionKey` vide la sélection (après une action groupée, par exemple) */
  selection?: GridSelection<T>;
  selectionKey?: number;
}

/**
 * Grille de données commune (AG Grid Community) : tri, redimensionnement, filtres par colonne,
 * filtre rapide, pagination et export CSV, avec le thème et la langue de l'application.
 */
export function DataGrid<T>({
  rows,
  columns,
  label,
  getRowId,
  searchable = false,
  exportable = false,
  pageSize,
  getRowClass,
  onRowClicked,
  toolbar,
  emptyMessage,
  className,
  selection,
  selectionKey,
}: DataGridProps<T>) {
  const { t } = useTranslation();
  const searchId = useId();
  const apiRef = useRef<GridApi<T> | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const hasToolbar = searchable || exportable || toolbar;
  useEffect(() => {
    apiRef.current?.deselectAll();
  }, [selectionKey]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative max-w-xs flex-1">
              <label htmlFor={searchId} className="sr-only">
                {t('grid.searchLabel')}
              </label>
              <Search
                aria-hidden="true"
                className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input
                id={searchId}
                type="search"
                className="h-9 pl-8"
                placeholder={t('grid.search')}
                value={quickFilter}
                onChange={(e) => {
                  setQuickFilter(e.target.value);
                }}
              />
            </div>
          )}
          <span className="text-muted text-xs" aria-live="polite">
            {t('grid.rows', { count: rows.length })}
          </span>
          <div className="ml-auto flex gap-2">
            {toolbar}
            {exportable && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  apiRef.current?.exportDataAsCsv({
                    fileName: `${label.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`,
                    columnSeparator: ';',
                  });
                }}
              >
                <Download aria-hidden="true" /> {t('grid.export')}
              </Button>
            )}
          </div>
        </div>
      )}
      <div role="region" aria-label={label}>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <AgGridView<T>
            rows={rows}
            columns={columns}
            getRowId={getRowId}
            getRowClass={getRowClass}
            onRowClicked={onRowClicked}
            quickFilter={quickFilter}
            pageSize={pageSize}
            emptyMessage={emptyMessage ?? t('grid.empty')}
            onReady={(api) => {
              apiRef.current = api;
            }}
            selection={selection}
          />
        </Suspense>
      </div>
    </div>
  );
}
