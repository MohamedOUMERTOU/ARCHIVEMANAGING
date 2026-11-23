import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError, toApiError } from '@/services/api/errors';

/** Notification d'erreur, pour une action sans formulaire. */
export function notifyError(error: unknown): void {
  toast.error(toApiError(error).message);
}

/**
 * Affiche sous chaque champ les erreurs renvoyées par le serveur (ProblemDetail.errors).
 * Les noms du serveur suivent ceux du formulaire (ex. « fields[2].key » → « fields.2.key »).
 * Sans erreur de champ, le message général part en notification.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): void {
  if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
    for (const [name, message] of Object.entries(error.fieldErrors)) {
      const path = name.replace(/\[(\d+)\]/g, '.$1') as Path<T>;
      setError(path, { type: 'server', message });
    }
    return;
  }
  toast.error(error instanceof Error ? error.message : String(error));
}
