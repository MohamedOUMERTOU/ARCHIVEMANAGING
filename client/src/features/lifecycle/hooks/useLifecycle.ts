import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentKeys } from '@/features/documents';
import { lifecycleApi, lifecycleKeys, type DueQuery } from '../api/lifecycle.api';

export const useLifecycleSummary = () =>
  useQuery({ queryKey: lifecycleKeys.summary, queryFn: lifecycleApi.summary });
export const useDue = (q: DueQuery) =>
  useQuery({ queryKey: lifecycleKeys.due(q), queryFn: () => lifecycleApi.due(q) });
export const useHolds = () => useQuery({ queryKey: lifecycleKeys.holds, queryFn: lifecycleApi.holds });
export const useHold = (id: string | null) =>
  useQuery({
    queryKey: lifecycleKeys.hold(id ?? ''),
    queryFn: () => lifecycleApi.hold(id ?? ''),
    enabled: !!id,
  });
export const useLists = (status?: 'open' | 'closed') =>
  useQuery({ queryKey: lifecycleKeys.lists(status), queryFn: () => lifecycleApi.lists(status) });
export const useList = (id: string) =>
  useQuery({ queryKey: lifecycleKeys.list(id), queryFn: () => lifecycleApi.list(id) });

/**
 * Mutation du cycle de vie : tout changement (gel, bordereau, exécution) peut modifier l'échéancier,
 * les bordereaux et la fiche des documents concernés. Erreurs gérées par l'appelant (meta.silent).
 */
export function useLifecycleMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lifecycleKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      if (success) toast.success(success);
    },
  });
}
