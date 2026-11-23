import { AG_GRID_LOCALE_EN_US, AG_GRID_LOCALE_FR_FR } from '@ag-grid-community/locale';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnAutoSizeModule,
  CsvExportModule,
  DateFilterModule,
  LocaleModule,
  ModuleRegistry,
  NumberFilterModule,
  PaginationModule,
  QuickFilterModule,
  RowAutoHeightModule,
  RowSelectionModule,
  RowStyleModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type GetRowIdFunc,
  type GridApi,
  type RowClassParams,
  type RowClickedEvent,
  type RowSelectionOptions,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/*
 * Partie « lourde » de la grille (AG Grid, ~1 Mo) : chargée à la demande par DataGrid,
 * elle forme son propre fichier et n'est téléchargée que par les écrans qui affichent une grille.
 */

// Modules Community uniquement (licence MIT) : on n'embarque que ce qui sert
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  QuickFilterModule,
  PaginationModule,
  CsvExportModule,
  RowAutoHeightModule,
  RowSelectionModule,
  RowStyleModule,
  CellStyleModule,
  ColumnAutoSizeModule,
  TooltipModule,
  LocaleModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);

// Thème Quartz calé sur les tokens de l'application (index.css)
const gedTheme = themeQuartz.withParams({
  fontFamily: 'inherit',
  fontSize: 14,
  dataFontSize: 14,
  // En-tête bleu ciel : titres bleu foncé (contraste 7:1), liseré bleu soutenu
  headerFontSize: 12,
  headerFontWeight: 700,
  headerTextColor: 'var(--color-grid-head-ink)',
  headerBackgroundColor: 'var(--color-grid-head)',
  headerCellHoverBackgroundColor: 'var(--color-grid-head-hover)',
  headerRowBorder: { style: 'solid', width: 2, color: 'var(--color-grid-head-line)' },
  headerColumnBorder: { style: 'solid', width: 1, color: 'var(--color-grid-head-sep)' },
  headerColumnBorderHeight: '50%',
  backgroundColor: 'var(--color-surface)',
  foregroundColor: 'var(--color-ink)',
  borderColor: 'var(--color-line)',
  accentColor: 'var(--color-primary)',
  rowHoverColor: 'color-mix(in srgb, var(--color-bg) 70%, transparent)',
  selectedRowBackgroundColor: 'var(--color-primary-soft)',
  wrapperBorderRadius: 12,
  spacing: 7,
  cellHorizontalPaddingScale: 1.15,
});

export interface AgGridViewProps<T> {
  rows: T[];
  columns: ColDef<T>[];
  getRowId?: (row: T) => string;
  getRowClass?: (row: T) => string | undefined;
  onRowClicked?: (row: T) => void;
  quickFilter: string;
  pageSize?: number;
  emptyMessage: string;
  onReady: (api: GridApi<T>) => void;
  /** Sélection multiple par cases à cocher */
  selection?: GridSelection<T>;
}

export interface GridSelection<T> {
  onChange: (rows: T[]) => void;
  /** Lignes qu'on ne peut pas cocher (document gelé, déjà sur un bordereau…) */
  isRowSelectable?: (row: T) => boolean;
}

export default function AgGridView<T>({
  rows,
  columns,
  getRowId,
  getRowClass,
  onRowClicked,
  quickFilter,
  pageSize,
  emptyMessage,
  onReady,
  selection,
}: AgGridViewProps<T>) {
  const { i18n } = useTranslation();
  const localeText = useMemo(
    () => ({
      ...(i18n.language.startsWith('en') ? AG_GRID_LOCALE_EN_US : AG_GRID_LOCALE_FR_FR),
      noRowsToShow: emptyMessage,
    }),
    [i18n.language, emptyMessage],
  );
  const defaultColDef = useMemo<ColDef<T>>(
    () => ({ sortable: true, resizable: true, filter: true, minWidth: 90, flex: 1 }),
    [],
  );
  const rowIdFn = useMemo<GetRowIdFunc<T> | undefined>(
    () => (getRowId ? (p) => getRowId(p.data) : undefined),
    [getRowId],
  );
  const rowClassFn = useMemo(
    () => (getRowClass ? (p: RowClassParams<T>) => (p.data ? getRowClass(p.data) : undefined) : undefined),
    [getRowClass],
  );
  const paginate = pageSize !== undefined && rows.length > pageSize;
  const isSelectable = selection?.isRowSelectable;
  const hasSelection = selection !== undefined;
  const rowSelection = useMemo<RowSelectionOptions<T> | undefined>(
    () =>
      hasSelection
        ? {
            mode: 'multiRow',
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
            isRowSelectable: isSelectable
              ? (node) => (node.data ? isSelectable(node.data) : false)
              : undefined,
          }
        : undefined,
    [hasSelection, isSelectable],
  );
  const onSelectionChange = selection?.onChange;

  return (
    <AgGridReact<T>
      theme={gedTheme}
      rowData={rows}
      columnDefs={columns}
      defaultColDef={defaultColDef}
      getRowId={rowIdFn}
      getRowClass={rowClassFn}
      onRowClicked={
        onRowClicked
          ? (e: RowClickedEvent<T>) => {
              if (e.data) onRowClicked(e.data);
            }
          : undefined
      }
      onGridReady={(e) => {
        onReady(e.api);
      }}
      rowSelection={rowSelection}
      onSelectionChanged={
        onSelectionChange
          ? (e) => {
              onSelectionChange(e.api.getSelectedRows());
            }
          : undefined
      }
      quickFilterText={quickFilter}
      localeText={localeText}
      domLayout="autoHeight"
      pagination={paginate}
      paginationPageSize={pageSize}
      paginationPageSizeSelector={pageSize ? [pageSize, pageSize * 2, pageSize * 5] : false}
      enableCellTextSelection
      ensureDomOrder
    />
  );
}
