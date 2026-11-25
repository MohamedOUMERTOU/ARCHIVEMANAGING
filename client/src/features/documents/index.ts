// API publique de la fonctionnalité « documents »
export { documentKeys, documentsApi } from './api/documents.api';
export { DocumentTable } from './components/DocumentTable';
export { DocumentViewer } from './components/DocumentViewer';
export { NodeSelect } from './components/NodeSelect';
export { StatusBadge } from './components/StatusBadge';
export { statusLabel, STATUSES } from './utils/status';
export { snippetParts } from './utils/snippet';
export * from './hooks/useDocuments';
export type * from './types';
export { compactMetadata, metadataDefaults, metadataSchema } from './utils/metadata-schema';
