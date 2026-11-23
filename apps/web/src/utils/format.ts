import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/** « 2025-03-14 » → « 14/03/2025 » ; tiret si vide ou invalide. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseISO(value);
  return isValid(d) ? format(d, 'dd/MM/yyyy', { locale: fr }) : '—';
}

/** Instant ISO → « 22/11/2026 · 10:42 » (heure locale). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd/MM/yyyy '·' HH:mm", { locale: fr }) : '—';
}

/** Libellé de jour pour regrouper un historique : « 22 novembre 2026 ». */
export function formatDay(value: string): string {
  const d = parseISO(value);
  return isValid(d) ? format(d, 'd MMMM yyyy', { locale: fr }) : value;
}

/** 412345 → « 403 Ko » ; unités françaises. */
export function formatSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${String(bytes)} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace('.', ',');
  return `${rounded} ${units[unit] ?? 'Go'}`;
}

/** Empreinte abrégée pour l'affichage : « 9f2c…e81a ». */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash;
}
