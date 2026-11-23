import { http } from '@/services/api/http';

export type FinalAction = 'CONSERVER' | 'DETRUIRE' | 'VERSER';
export type ListKind = 'ELIMINATION' | 'VERSEMENT';
export type ListStatus = 'BROUILLON' | 'SOUMIS' | 'APPROUVE' | 'REFUSE' | 'EXECUTE' | 'ANNULE';

export interface DueItem {
  id: string;
  reference: string | null;
  title: string;
  typeName: string | null;
  nodePath: string | null;
  status: string;
  documentDate: string | null;
  retentionUntil: string | null;
  finalAction: FinalAction | null;
  ruleName: string | null;
  legalHold: boolean;
  pendingListNumber: string | null;
  pendingListId: string | null;
  paperLocation: string | null;
  originalOnLoan: boolean;
  versionCount: number;
  bytes: number;
}

export interface Summary {
  byAction: Array<{ finalAction: FinalAction; due: number; upcoming: number }>;
  onHold: number;
  awaitingStart: number;
  openLists: number;
  awaitingVisa: number;
  activeHolds: number;
  today: string;
}

export interface HoldSummary {
  id: string;
  name: string;
  caseReference: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseReason: string | null;
  documentCount: number;
}

export interface HoldDetail {
  hold: HoldSummary;
  documents: Array<{
    id: string;
    reference: string | null;
    title: string;
    status: string;
    retentionUntil: string | null;
    finalAction: FinalAction | null;
    addedBy: string;
    addedAt: string;
  }>;
}

export interface ListSummary {
  id: string;
  number: string;
  kind: ListKind;
  status: ListStatus;
  title: string;
  destination: string | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  executedAt: string | null;
  documentCount: number;
  bytes: number;
}

export interface ListItem {
  documentId: string;
  reference: string | null;
  title: string;
  typeName: string | null;
  documentDate: string | null;
  retentionUntil: string | null;
  ruleName: string | null;
  versionCount: number;
  bytes: number;
  currentStatus: string;
  legalHold: boolean;
  paperLocation: string | null;
  originalOnLoan: boolean;
}

export interface ListDetail {
  list: ListSummary;
  notes: string | null;
  submittedBy: string | null;
  decisionComment: string | null;
  executedBy: string | null;
  items: ListItem[];
  /** Ce qui empêche, à l'instant, de soumettre, viser ou exécuter */
  blockers: string[];
}

export interface DueQuery {
  horizonDays: number;
  finalAction?: FinalAction;
  awaiting?: boolean;
}

const L = '/lifecycle';
const get = async <T>(url: string, params?: object) => (await http.get<T>(url, { params })).data;
const post = async <T>(url: string, body?: unknown) => (await http.post<T>(url, body)).data;

async function saveFile(url: string, filename: string) {
  const { data } = await http.get<Blob>(url, { responseType: 'blob', timeout: 0 });
  const href = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 1000);
}

export const lifecycleApi = {
  summary: () => get<Summary>(`${L}/summary`),
  due: (q: DueQuery) => get<DueItem[]>(`${L}/due`, q),
  recalculate: () =>
    post<{ examined: number; changed: number; changedReferences: string[] }>(`${L}/recalculate`),
  keepDefinitively: (documentIds: string[]) =>
    post<{ documents: number }>(`${L}/definitive`, { documentIds }),

  holds: () => get<HoldSummary[]>(`${L}/holds`),
  hold: (id: string) => get<HoldDetail>(`${L}/holds/${id}`),
  createHold: (input: {
    name: string;
    caseReference: string | null;
    reason: string;
    documentIds: string[];
  }) => post<HoldDetail>(`${L}/holds`, input),
  addToHold: (id: string, documentIds: string[]) =>
    post<HoldDetail>(`${L}/holds/${id}/documents`, { documentIds }),
  removeFromHold: (id: string, documentId: string, reason: string) =>
    post<HoldDetail>(`${L}/holds/${id}/documents/${documentId}/remove`, { reason }),
  releaseHold: (id: string, reason: string) => post<HoldDetail>(`${L}/holds/${id}/release`, { reason }),

  lists: (status?: 'open' | 'closed') => get<ListSummary[]>(`${L}/lists`, status ? { status } : undefined),
  list: (id: string) => get<ListDetail>(`${L}/lists/${id}`),
  createList: (input: {
    kind: ListKind;
    title: string;
    destination: string | null;
    notes: string | null;
    documentIds: string[];
  }) => post<ListDetail>(`${L}/lists`, input),
  addToList: (id: string, documentIds: string[]) =>
    post<ListDetail>(`${L}/lists/${id}/documents`, { documentIds }),
  removeFromList: async (id: string, documentId: string) =>
    (await http.delete<ListDetail>(`${L}/lists/${id}/documents/${documentId}`)).data,
  submit: (id: string) => post<ListDetail>(`${L}/lists/${id}/submit`),
  approve: (id: string, comment: string | null) => post<ListDetail>(`${L}/lists/${id}/approve`, { comment }),
  reject: (id: string, comment: string) => post<ListDetail>(`${L}/lists/${id}/reject`, { comment }),
  cancel: (id: string, reason: string) => post<ListDetail>(`${L}/lists/${id}/cancel`, { reason }),
  execute: (id: string, confirmNumber: string) =>
    post<ListDetail>(`${L}/lists/${id}/execute`, { confirmNumber }),
  exportCsv: (id: string, number: string) => saveFile(`${L}/lists/${id}/export.csv`, `${number}.csv`),
  exportPackage: (id: string, number: string) => saveFile(`${L}/lists/${id}/package.zip`, `${number}.zip`),
};

export const lifecycleKeys = {
  all: ['lifecycle'] as const,
  summary: ['lifecycle', 'summary'] as const,
  due: (q: DueQuery) => ['lifecycle', 'due', q] as const,
  holds: ['lifecycle', 'holds'] as const,
  hold: (id: string) => ['lifecycle', 'hold', id] as const,
  lists: (status?: string) => ['lifecycle', 'lists', status ?? 'all'] as const,
  list: (id: string) => ['lifecycle', 'list', id] as const,
};
