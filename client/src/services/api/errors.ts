import { isAxiosError } from 'axios';
import type { ProblemDetail } from '@/types/api';

export type ApiErrorKind =
  'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'server' | 'unknown';

/** Erreur unique pour toute l'interface, quelle que soit sa source. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly fieldErrors: Record<string, string>;

  constructor(params: {
    message: string;
    kind: ApiErrorKind;
    status?: number | null;
    code?: string | null;
    fieldErrors?: Record<string, string>;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.status = params.status ?? null;
    this.code = params.code ?? null;
    this.fieldErrors = params.fieldErrors ?? {};
  }
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: "Vous n'avez pas les droits nécessaires pour cette action.",
  not_found: "L'élément demandé n'existe pas ou a été supprimé.",
  conflict: "Cette action entre en conflit avec l'état actuel des données.",
  validation: 'Certaines informations sont invalides.',
  server: 'Une erreur est survenue sur le serveur. Réessayez dans un instant.',
  unknown: 'Une erreur inattendue est survenue.',
};

function isProblemDetail(value: unknown): value is ProblemDetail {
  return typeof value === 'object' && value !== null;
}

/** Convertit n'importe quelle erreur (axios, réseau, code) en ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError({ message: DEFAULT_MESSAGES.network, kind: 'network' });
    }
    const status = error.response.status;
    const kind = kindFromStatus(status);
    const body: unknown = error.response.data;
    const problem = isProblemDetail(body) ? body : {};
    return new ApiError({
      message: problem.detail ?? problem.title ?? DEFAULT_MESSAGES[kind],
      kind,
      status,
      code: problem.code ?? null,
      fieldErrors: problem.errors ?? {},
    });
  }

  return new ApiError({
    message: error instanceof Error ? error.message : DEFAULT_MESSAGES.unknown,
    kind: 'unknown',
  });
}
