import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { classificationKeys } from '@/features/classification';
import { documentKeys, documentsApi } from '../api/documents.api';
import type { ClassifyInput, RequestKind, SearchParams } from '../types';

export function useDocumentSearch(params: SearchParams, enabled = true) {
  return useQuery({
    queryKey: documentKeys.search(params),
    queryFn: () => documentsApi.search(params),
    // Garde la page précédente affichée pendant le chargement de la suivante
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDocument(id: string) {
  return useQuery({ queryKey: documentKeys.detail(id), queryFn: () => documentsApi.get(id) });
}

export function useDocumentEvents(id: string, enabled = true) {
  return useQuery({ queryKey: documentKeys.events(id), queryFn: () => documentsApi.events(id), enabled });
}

/**
 * Lien d'aperçu (valable 10 minutes côté serveur, utile seulement au chargement du fichier).
 * - Fixe tant que l'aperçu est affiché : le renouveler rechargerait le document et ferait perdre la page lue.
 * - Jamais réutilisé depuis le cache (gcTime 0) : chaque nouvel affichage demande un lien neuf.
 * - Clé hors de documentKeys.all : les autres actions sur le document ne rechargent pas l'aperçu.
 */
export function useViewLink(id: string, versionNo: number | undefined) {
  return useQuery({
    queryKey: ['document-view', id, versionNo],
    queryFn: () => documentsApi.viewLink(id, versionNo ?? 1),
    enabled: versionNo !== undefined,
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useDocumentTypes() {
  return useQuery({ queryKey: documentKeys.types, queryFn: documentsApi.types, staleTime: 10 * 60_000 });
}

export function useTags() {
  return useQuery({ queryKey: documentKeys.tags, queryFn: documentsApi.tags, staleTime: 60_000 });
}

/** Après une modification : listes, fiche, historique et compteurs de l'arbre sont à recharger. */
function useInvalidateDocuments() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: documentKeys.all });
    void qc.invalidateQueries({ queryKey: classificationKeys.all });
    void qc.invalidateQueries({ queryKey: documentKeys.tags });
    if (id) void qc.invalidateQueries({ queryKey: documentKeys.events(id) });
  };
}

export function useUpload() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: documentsApi.upload,
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useClassify() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClassifyInput }) => documentsApi.classify(id, input),
    onSuccess: (doc) => {
      invalidate(doc.id);
    },
    // Les erreurs de champs sont affichées dans le formulaire
    meta: { silent: true },
  });
}

export function useReclassify(id: string) {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: ({ nodeId, reason }: { nodeId: string; reason: string }) =>
      documentsApi.reclassify(id, nodeId, reason),
    onSuccess: (doc) => {
      invalidate(id);
      toast.success(`Document reclassé : nouvelle cote ${doc.reference ?? ''}`);
    },
  });
}

export function useAddVersion(id: string) {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: ({ file, reason }: { file: File; reason: string }) =>
      documentsApi.addVersion(id, file, reason),
    onSuccess: () => {
      invalidate(id);
      toast.success('Nouvelle version enregistrée');
    },
  });
}

export function useDocumentRequest(id: string) {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: (input: { kind: RequestKind; onBehalfOf: string; reason: string }) =>
      documentsApi.request(id, input),
    onSuccess: () => {
      invalidate(id);
      toast.success("Demande envoyée à l'archiviste");
    },
  });
}

export function useDownload() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: ({ id, versionNo, filename }: { id: string; versionNo: number; filename: string }) =>
      documentsApi.download(id, versionNo, filename),
    onSuccess: (_d, vars) => {
      invalidate(vars.id);
    },
  });
}
