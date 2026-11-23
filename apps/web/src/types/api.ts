/**
 * Corps d'erreur attendu de Spring Boot : ProblemDetail (RFC 9457),
 * avec en plus les erreurs de validation par champ.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Code métier stable, ex. "NODE_CODE_TAKEN" */
  code?: string;
  /** Erreurs de validation : { champ: message } */
  errors?: Record<string, string>;
}

/** Page de résultats au format Spring Data. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
