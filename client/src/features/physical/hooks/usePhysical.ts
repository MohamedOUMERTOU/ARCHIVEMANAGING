import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { documentKeys } from '@/features/documents';
import { buildTree, pathTo } from '@/utils/tree';
import { physicalApi, physicalKeys, type LoanFilter } from '../api/physical.api';

export const useLevels = () => useQuery({ queryKey: physicalKeys.levels, queryFn: physicalApi.levels });
export const useLoans = (status: LoanFilter) =>
  useQuery({ queryKey: physicalKeys.loans(status), queryFn: () => physicalApi.loans(status) });
export const useLocationDetail = (id: string | null) =>
  useQuery({
    queryKey: physicalKeys.location(id ?? ''),
    queryFn: () => physicalApi.location(id ?? ''),
    enabled: !!id,
  });

/** Arbre des emplacements, trié par code à chaque niveau, et chemin vers l'emplacement choisi. */
export function useLocationTree(selectedId: string | null) {
  const query = useQuery({ queryKey: physicalKeys.locations, queryFn: physicalApi.locations });
  const nodes = query.data;
  const tree = useMemo(
    () => (nodes ? buildTree(nodes, (a, b) => a.code.localeCompare(b.code, 'fr')) : []),
    [nodes],
  );
  const selectedPath = useMemo(
    () => (nodes && selectedId ? pathTo(nodes, selectedId) : []),
    [nodes, selectedId],
  );
  return { ...query, tree, selectedPath };
}

/**
 * Mutation des archives physiques : tout ce qui touche à un emplacement peut changer
 * l'arbre, les prêts et la fiche des documents rangés dedans.
 */
export function usePhysicalMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: physicalKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      toast.success(success);
    },
  });
}
