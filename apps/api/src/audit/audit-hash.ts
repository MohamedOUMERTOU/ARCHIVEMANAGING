import { createHash } from 'crypto';

export interface AuditHashInput {
  organizationId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
  ip: string | null;
  at: Date;
}

/** JSON avec les clés triées : la même donnée donne toujours la même empreinte. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * Empreinte d'une entrée du journal, liée à l'entrée précédente.
 * Modifier ou supprimer une entrée casse toutes les empreintes qui suivent.
 */
export function computeAuditHash(prevHash: string | null, entry: AuditHashInput): string {
  return createHash('sha256')
    .update(prevHash ?? 'GENESIS')
    .update('|')
    .update(canonicalJson({ ...entry, at: entry.at.toISOString() }))
    .digest('hex');
}

/** Vérifie une suite d'entrées dans l'ordre ; renvoie l'id de la première entrée altérée. */
export function verifyAuditChain(
  entries: Array<AuditHashInput & { id: bigint | number; prevHash: string | null; hash: string }>,
): { valid: true } | { valid: false; brokenAt: string } {
  let prev: string | null = null;
  for (const e of entries) {
    const { id, prevHash, hash, ...data } = e;
    if (prevHash !== prev || computeAuditHash(prev, data) !== hash) {
      return { valid: false, brokenAt: String(id) };
    }
    prev = hash;
  }
  return { valid: true };
}
