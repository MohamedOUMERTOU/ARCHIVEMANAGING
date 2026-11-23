// Contrat de l'API Spring Boot (com.ged.document.DocumentDtos)

export type DocumentStatus =
  'A_CLASSER' | 'ACTIVE' | 'INTERMEDIAIRE' | 'DEFINITIF' | 'A_ELIMINER' | 'ELIMINE' | 'VERSE';

export type MetadataFieldType = 'TEXT' | 'NUMBER' | 'AMOUNT' | 'DATE' | 'LIST' | 'BOOLEAN';

export interface MetadataField {
  key: string;
  label: string;
  type: MetadataFieldType;
  required?: boolean;
  options?: string[];
}

export interface DocumentTypeRef {
  id: string;
  code: string;
  name: string;
  metadataSchema: MetadataField[];
}

export interface DocumentSummary {
  id: string;
  reference: string | null;
  title: string;
  status: DocumentStatus;
  documentDate: string | null;
  typeId: string | null;
  typeName: string | null;
  nodeId: string | null;
  nodeTitle: string | null;
  retentionUntil: string | null;
  legalHold: boolean;
  createdAt: string;
  versionCount: number;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string[];
}

export interface VersionDto {
  versionNo: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  replaceReason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface RetentionDto {
  id: string;
  name: string;
  durationYears: number | null;
  startEvent: 'DATE_DOCUMENT' | 'CLOTURE_DOSSIER' | 'DATE_CREATION';
  finalAction: 'CONSERVER' | 'DETRUIRE' | 'VERSER';
  inherited: boolean;
}

export interface DuplicateRef {
  id: string;
  reference: string | null;
  title: string;
}

export interface DocumentDetail {
  id: string;
  reference: string | null;
  title: string;
  status: DocumentStatus;
  documentDate: string | null;
  metadata: Record<string, unknown>;
  type: DocumentTypeRef | null;
  node: { id: string; code: string; title: string; path: string } | null;
  retentionRule: RetentionDto | null;
  retentionUntil: string | null;
  legalHold: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  versions: VersionDto[];
  duplicateOf: DuplicateRef | null;
  /** Emplacement de l'original papier */
  physicalLocation: { id: string; code: string; label: string; path: string } | null;
  /** Prêt en cours de l'original (seul ou avec sa boîte) */
  openLoan: { id: string; borrower: string; dueAt: string; viaBox: boolean } | null;
  /** Gels juridiques actifs, bordereau en cours, date du sort final exécuté */
  lifecycle: {
    finalAction: 'CONSERVER' | 'DETRUIRE' | 'VERSER' | null;
    disposedAt: string | null;
    holds: Array<{ id: string; name: string; caseReference: string | null }>;
    pendingList: { id: string; number: string; kind: 'ELIMINATION' | 'VERSEMENT'; status: string } | null;
  };
}

export type DocumentEventType =
  | 'CREE'
  | 'CLASSE'
  | 'CONSULTE'
  | 'TELECHARGE'
  | 'COPIE_DEMANDEE'
  | 'COPIE_REMISE'
  | 'ORIGINAL_DEMANDE'
  | 'ORIGINAL_SORTI'
  | 'ORIGINAL_RENDU'
  | 'RECLASSE'
  | 'VERSION_REMPLACEE'
  | 'METADONNEES_MODIFIEES'
  | 'RANGE'
  | 'DEPLACE'
  | 'GEL_POSE'
  | 'GEL_LEVE'
  | 'VERSE'
  | 'ECHEANCE_RECALCULEE'
  | 'SORT_PROPOSE'
  | 'SORT_ABANDONNE'
  | 'CONSERVATION_DEFINITIVE'
  | 'ELIMINE';

export interface DocumentEvent {
  id: string;
  type: DocumentEventType;
  actor: string | null;
  onBehalfOf: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
}

export interface UploadResult {
  id: string;
  title: string;
  sha256: string;
  duplicateOf: DuplicateRef | null;
}

export interface SearchParams {
  q?: string;
  status?: DocumentStatus;
  typeId?: string;
  nodeId?: string;
  from?: string;
  to?: string;
  tag?: string;
  /** Emplacement physique (avec tout ce qu'il contient) */
  locationId?: string;
  page?: number;
  size?: number;
  sort?: 'date' | 'title' | 'reference' | 'created';
}

export interface ClassifyInput {
  nodeId: string;
  typeId: string;
  title: string;
  documentDate: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
}

export type RequestKind = 'COPIE_SIMPLE' | 'COPIE_CERTIFIEE' | 'ORIGINAL';

/** Lien d'aperçu signé, valable quelques minutes (null si le format ne s'affiche pas dans le navigateur). */
export interface ViewLink {
  url: string | null;
  mimeType: string;
  previewable: boolean;
  expiresAt: string | null;
}
