import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, toApiError } from '@/services/api/errors';

const NO_RETRY: ReadonlySet<string> = new Set([
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
]);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // On ne réessaie pas une erreur qui se reproduira à l'identique
        retry: (failureCount, error) =>
          !(error instanceof ApiError && NO_RETRY.has(error.kind)) && failureCount < 2,
      },
    },
    // Erreur d'une action : notification, sauf si l'écran l'affiche lui-même (meta.silent)
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error(toApiError(error).message);
      },
    }),
  });
}
