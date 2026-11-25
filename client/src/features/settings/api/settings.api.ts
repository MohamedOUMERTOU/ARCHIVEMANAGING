import type { MetadataField } from '@/features/documents';
import type { NodeType } from '@/features/classification';
import { http } from '@/services/api/http';

export type StartEvent = 'DATE_DOCUMENT' | 'CLOTURE_DOSSIER' | 'DATE_CREATION';
export type FinalAction = 'CONSERVER' | 'DETRUIRE' | 'VERSER';

export interface RetentionRule {
  id: string;
  name: string;
  durationYears: number | null;
  startEvent: StartEvent;
  finalAction: FinalAction;
  legalBasis: string | null;
  nodeCount: number;
  typeCount: number;
}
export type RuleInput = Pick<
  RetentionRule,
  'name' | 'durationYears' | 'startEvent' | 'finalAction' | 'legalBasis'
>;

export interface DocumentTypeSetting {
  id: string;
  code: string;
  name: string;
  defaultRetentionRuleId: string | null;
  metadataSchema: MetadataField[];
  documentCount: number;
}
export interface TypeInput {
  code?: string;
  name: string;
  defaultRetentionRuleId: string | null;
  fields: Array<{
    key: string;
    label: string;
    type: MetadataField['type'];
    required: boolean;
    options: string[];
  }>;
}

export interface TagSetting {
  id: string;
  name: string;
  color: string;
  description: string | null;
  documentCount: number;
}
export type TagInput = Pick<TagSetting, 'name' | 'color' | 'description'>;

export interface UserSetting {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  roleIds: string[];
  roleNames: string[];
  createdAt: string;
}
export interface RoleSetting {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  userCount: number;
}
export interface Permission {
  code: string;
  label: string;
}

export interface NodeDetail {
  id: string;
  parentId: string | null;
  type: NodeType;
  code: string;
  title: string;
  description: string | null;
  depth: number;
  path: string;
  closedAt: string | null;
  retentionRuleId: string | null;
  effectiveRetention: { id: string; name: string; inherited: boolean } | null;
}
export interface NodeInput {
  parentId?: string | null;
  type?: NodeType;
  code: string;
  title: string;
  description?: string | null;
  retentionRuleId?: string | null;
  closedAt?: string | null;
}

export interface StorageStatus {
  type: 'local' | 's3';
  location: string;
  endpoint: string | null;
  bucket: string | null;
  consoleUrl: string | null;
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
  usage: { documents: number; versions: number; bytes: number; bytesByType: Record<string, number> };
}

interface StoredFileRef {
  key: string;
  documentId: string;
  reference: string | null;
  title: string;
  versionNo: number;
  expectedBytes: number;
}

export interface StorageCheck {
  checkedAt: string;
  durationMs: number;
  expected: number;
  ok: number;
  missingCount: number;
  mismatchCount: number;
  orphanCount: number;
  missing: StoredFileRef[];
  mismatches: Array<StoredFileRef & { actualBytes: number }>;
  orphans: string[];
  healthy: boolean;
}

const S = '/settings';
const get = async <T>(url: string) => (await http.get<T>(url)).data;
const post = async <T>(url: string, body?: unknown) => (await http.post<T>(url, body)).data;
const put = async <T>(url: string, body: unknown) => (await http.put<T>(url, body)).data;
const patch = async <T>(url: string, body: unknown) => (await http.patch<T>(url, body)).data;
const del = async (url: string) => {
  await http.delete(url);
};

/** Reconnaissance de texte (OCR) : réglages de la société */
export interface OcrSettings {
  autoOnUpload: boolean;
  languages: string[];
  detectOrientation: boolean;
  searchablePdfDownload: boolean;
  paused: boolean;
  availableLanguages: string[];
  /** Tesseract répond sur le serveur */
  engineAvailable: boolean;
}
export type OcrSettingsInput = Pick<
  OcrSettings,
  'autoOnUpload' | 'languages' | 'detectOrientation' | 'searchablePdfDownload'
>;

export type OcrJobStatus = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE' | 'PEU_LISIBLE' | 'ECHEC';

export interface OcrOverview {
  progress: {
    /** Documents dont la version actuelle peut être lue */
    eligible: number;
    done: number;
    pending: number;
    running: number;
    failed: number;
    lowQuality: number;
    /** Jamais demandés (déposés avant l'OCR, ou lecture automatique désactivée) */
    notRequested: number;
    paused: boolean;
  };
  recent: Array<{
    documentId: string;
    reference: string | null;
    title: string;
    versionNo: number;
    status: OcrJobStatus;
    pagesTotal: number | null;
    pagesDone: number;
    confidence: number | null;
    error: string | null;
    requestedAt: string;
    finishedAt: string | null;
  }>;
}

export const settingsApi = {
  rules: () => get<RetentionRule[]>(`${S}/retention-rules`),
  createRule: (input: RuleInput) => post<RetentionRule>(`${S}/retention-rules`, input),
  updateRule: (id: string, input: RuleInput) => put<RetentionRule>(`${S}/retention-rules/${id}`, input),
  deleteRule: (id: string) => del(`${S}/retention-rules/${id}`),

  types: () => get<DocumentTypeSetting[]>(`${S}/document-types`),
  createType: (input: TypeInput) => post<DocumentTypeSetting>(`${S}/document-types`, input),
  updateType: (id: string, input: TypeInput) => put<DocumentTypeSetting>(`${S}/document-types/${id}`, input),
  deleteType: (id: string) => del(`${S}/document-types/${id}`),

  tags: () => get<TagSetting[]>(`${S}/tags`),
  createTag: (input: TagInput) => post<TagSetting>(`${S}/tags`, input),
  updateTag: (id: string, input: TagInput) => put<TagSetting>(`${S}/tags/${id}`, input),
  mergeTags: (sourceId: string, targetId: string) =>
    post<TagSetting>(`${S}/tags/merge`, { sourceId, targetId }),
  deleteTag: (id: string) => del(`${S}/tags/${id}`),

  permissions: () => get<Permission[]>(`${S}/permissions`),
  users: () => get<UserSetting[]>(`${S}/users`),
  createUser: (input: { email: string; fullName: string; password: string; roleIds: string[] }) =>
    post<UserSetting>(`${S}/users`, input),
  updateUser: (id: string, input: { fullName: string; active: boolean; roleIds: string[] }) =>
    put<UserSetting>(`${S}/users/${id}`, input),
  resetPassword: (id: string, password: string) => post<undefined>(`${S}/users/${id}/password`, { password }),
  roles: () => get<RoleSetting[]>(`${S}/roles`),
  createRole: (input: { name: string; description: string | null; permissions: string[] }) =>
    post<RoleSetting>(`${S}/roles`, input),
  updateRole: (id: string, input: { name: string; description: string | null; permissions: string[] }) =>
    put<RoleSetting>(`${S}/roles/${id}`, input),
  deleteRole: (id: string) => del(`${S}/roles/${id}`),

  storage: () => get<StorageStatus>(`${S}/storage`),
  checkStorage: () => post<StorageCheck>(`${S}/storage/check`),

  ocr: () => get<OcrSettings>(`${S}/ocr`),
  updateOcr: (input: OcrSettingsInput) => put<OcrSettings>(`${S}/ocr`, input),
  pauseOcr: (paused: boolean) => post<OcrSettings>(`${S}/ocr/pause`, { paused }),
  ocrOverview: () => get<OcrOverview>(`${S}/ocr/overview`),
  ocrBackfill: () => post<OcrOverview>(`${S}/ocr/backfill`),
  ocrRetryFailed: () => post<OcrOverview>(`${S}/ocr/retry-failed`),

  node: (id: string) => get<NodeDetail>(`/classification/${id}`),
  createNode: (input: NodeInput) => post<NodeDetail>('/classification', input),
  updateNode: (id: string, input: NodeInput) => patch<NodeDetail>(`/classification/${id}`, input),
  moveNode: (id: string, newParentId: string) =>
    post<NodeDetail>(`/classification/${id}/move`, { newParentId }),
  deleteNode: (id: string) => del(`/classification/${id}`),
};

export const settingsKeys = {
  all: ['settings'] as const,
  rules: ['settings', 'rules'] as const,
  types: ['settings', 'types'] as const,
  tags: ['settings', 'tags'] as const,
  users: ['settings', 'users'] as const,
  roles: ['settings', 'roles'] as const,
  permissions: ['settings', 'permissions'] as const,
  storage: ['settings', 'storage'] as const,
  ocr: ['settings', 'ocr'] as const,
  ocrOverview: ['settings', 'ocr', 'overview'] as const,
  node: (id: string) => ['settings', 'node', id] as const,
};
