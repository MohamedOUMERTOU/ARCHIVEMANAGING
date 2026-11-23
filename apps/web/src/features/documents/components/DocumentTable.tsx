import type { CustomCellRendererProps } from 'ag-grid-react';
import { Link } from 'react-router';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { formatDate } from '@/utils/format';
import type { DocumentSummary } from '../types';
import { StatusBadge } from './StatusBadge';

type Cell = CustomCellRendererProps<DocumentSummary>;
const dateFormatter = ({ value }: { value: string | null | undefined }) => formatDate(value);

const columns: ColDef<DocumentSummary>[] = [
  {
    field: 'reference',
    headerName: 'Cote',
    minWidth: 150,
    cellClass: 'font-mono text-[12.5px] text-ink-soft',
    valueFormatter: ({ value }: { value: string | null | undefined }) => value ?? '—',
  },
  {
    field: 'title',
    headerName: 'Titre',
    flex: 2,
    minWidth: 220,
    cellRenderer: ({ data, value }: Cell) =>
      data ? (
        <Link to={`/documents/${data.id}`} className="text-ink hover:text-primary font-medium no-underline">
          {String(value)}
        </Link>
      ) : null,
  },
  {
    field: 'typeName',
    headerName: 'Type',
    valueFormatter: ({ value }: { value: string | null | undefined }) => value ?? '—',
  },
  {
    field: 'documentDate',
    headerName: 'Date',
    maxWidth: 140,
    filter: false,
    valueFormatter: dateFormatter,
  },
  {
    field: 'status',
    headerName: 'Statut',
    minWidth: 150,
    cellRenderer: ({ data }: Cell) =>
      data ? <StatusBadge status={data.status} legalHold={data.legalHold} /> : null,
  },
  {
    field: 'retentionUntil',
    headerName: 'Conserver jusqu’au',
    minWidth: 160,
    filter: false,
    valueFormatter: dateFormatter,
  },
];

export function DocumentTable({ data, caption }: { data: DocumentSummary[]; caption: string }) {
  return (
    <DataGrid
      rows={data}
      columns={columns}
      label={caption}
      getRowId={(d) => d.id}
      searchable={data.length > 5}
      exportable
      pageSize={25}
    />
  );
}
