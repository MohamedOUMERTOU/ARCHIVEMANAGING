import { http } from '@/services/api/http';
import { endpoints } from '@/services/endpoints';
import type { Page } from '@/types/api';
import type {
  ClassifyInput,
  DocumentDetail,
  DocumentEvent,
  DocumentSummary,
  DocumentTypeRef,
  RequestKind,
  SearchParams,
  TextPage,
  TextStatus,
  UploadResult,
  ViewLink,
} from '../types';

export const documentsApi = {
  search: async (params: SearchParams): Promise<Page<DocumentSummary>> => {
    const { data } = await http.get<Page<DocumentSummary>>(endpoints.documents.list, { params });
    return data;
  },
  get: async (id: string): Promise<DocumentDetail> => {
    const { data } = await http.get<DocumentDetail>(endpoints.documents.one(id));
    return data;
  },
  events: async (id: string): Promise<DocumentEvent[]> => {
    const { data } = await http.get<DocumentEvent[]>(endpoints.documents.events(id));
    return data;
  },
  upload: async (files: File[]): Promise<UploadResult[]> => {
    const form = new FormData();
    files.forEach((f) => {
      form.append('files', f);
    });
    const { data } = await http.post<UploadResult[]>(endpoints.documents.list, form, { timeout: 0 });
    return data;
  },
  classify: async (id: string, input: ClassifyInput): Promise<DocumentDetail> => {
    const { data } = await http.post<DocumentDetail>(endpoints.documents.classify(id), input);
    return data;
  },
  reclassify: async (id: string, nodeId: string, reason: string): Promise<DocumentDetail> => {
    const { data } = await http.post<DocumentDetail>(endpoints.documents.reclassify(id), { nodeId, reason });
    return data;
  },
  addVersion: async (id: string, file: File, reason: string): Promise<DocumentDetail> => {
    const form = new FormData();
    form.append('file', file);
    form.append('reason', reason);
    const { data } = await http.post<DocumentDetail>(endpoints.documents.versions(id), form, { timeout: 0 });
    return data;
  },
  request: async (
    id: string,
    input: { kind: RequestKind; onBehalfOf: string; reason: string },
  ): Promise<DocumentEvent[]> => {
    const { data } = await http.post<DocumentEvent[]>(endpoints.documents.requests(id), input);
    return data;
  },
  /** Le fichier passe par axios (jeton dans l'en-tête), puis le navigateur le propose au téléchargement. */
  download: async (id: string, versionNo: number, filename: string): Promise<void> => {
    await saveFrom(endpoints.documents.content(id, versionNo), filename);
  },
  /** Copie PDF portant le texte reconnu (si le paramétrage l'autorise) */
  downloadSearchable: async (id: string, versionNo: number, filename: string): Promise<void> => {
    await saveFrom(endpoints.documents.searchable(id, versionNo), filename);
  },
  text: async (id: string, versionNo: number): Promise<TextStatus> => {
    const { data } = await http.get<TextStatus>(endpoints.documents.text(id), {
      params: { version: versionNo },
    });
    return data;
  },
  textPages: async (id: string, versionNo: number): Promise<TextPage[]> => {
    const { data } = await http.get<TextPage[]>(endpoints.documents.textPages(id), {
      params: { version: versionNo },
    });
    return data;
  },
  retryText: async (id: string, versionNo: number): Promise<TextStatus> => {
    const { data } = await http.post<TextStatus>(endpoints.documents.textRetry(id), null, {
      params: { version: versionNo },
    });
    return data;
  },
  viewLink: async (id: string, versionNo: number): Promise<ViewLink> => {
    const { data } = await http.post<ViewLink>(endpoints.documents.viewLink(id, versionNo));
    return data;
  },
  types: async (): Promise<DocumentTypeRef[]> => {
    const { data } = await http.get<DocumentTypeRef[]>(endpoints.documentTypes);
    return data;
  },
  tags: async (): Promise<string[]> => {
    const { data } = await http.get<string[]>(endpoints.tags);
    return data;
  },
};

async function saveFrom(path: string, filename: string): Promise<void> {
  const { data } = await http.get<Blob>(path, { responseType: 'blob', timeout: 0 });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export const documentKeys = {
  all: ['documents'] as const,
  search: (params: SearchParams) => [...documentKeys.all, 'search', params] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
  events: (id: string) => [...documentKeys.all, 'events', id] as const,
  text: (id: string, versionNo: number) => [...documentKeys.all, 'text', id, versionNo] as const,
  textPages: (id: string, versionNo: number) => [...documentKeys.all, 'text-pages', id, versionNo] as const,
  types: ['document-types'] as const,
  tags: ['tags'] as const,
};
