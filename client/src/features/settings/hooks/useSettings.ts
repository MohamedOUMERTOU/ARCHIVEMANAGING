import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { classificationKeys } from '@/features/classification';
import { documentKeys } from '@/features/documents';
import { settingsApi, settingsKeys } from '../api/settings.api';

export const useRules = () => useQuery({ queryKey: settingsKeys.rules, queryFn: settingsApi.rules });
export const useTypeSettings = () => useQuery({ queryKey: settingsKeys.types, queryFn: settingsApi.types });
export const useTagSettings = () => useQuery({ queryKey: settingsKeys.tags, queryFn: settingsApi.tags });
export const useUsers = () => useQuery({ queryKey: settingsKeys.users, queryFn: settingsApi.users });
export const useRoles = () => useQuery({ queryKey: settingsKeys.roles, queryFn: settingsApi.roles });
export const usePermissions = () =>
  useQuery({ queryKey: settingsKeys.permissions, queryFn: settingsApi.permissions, staleTime: Infinity });
export const useNode = (id: string | null) =>
  useQuery({
    queryKey: settingsKeys.node(id ?? ''),
    queryFn: () => settingsApi.node(id ?? ''),
    enabled: !!id,
  });

/**
 * Mutation de paramétrage : notification de succès et rechargement des listes concernées.
 * Les erreurs de champs sont laissées au formulaire (meta.silent) ; il les affiche avec applyServerErrors.
 */
export function useSettingsMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  { success, invalidate }: { success: string; invalidate: QueryKey[] },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: () => {
      invalidate.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
      toast.success(success);
    },
  });
}

/** Clés touchées par une modification du plan de classement ou des types (listes, formulaires de classement). */
export const PLAN_KEYS: QueryKey[] = [classificationKeys.all, settingsKeys.all, documentKeys.all];
export const TYPE_KEYS: QueryKey[] = [settingsKeys.types, documentKeys.types, settingsKeys.rules];
export const TAG_KEYS: QueryKey[] = [settingsKeys.tags, documentKeys.tags, documentKeys.all];
