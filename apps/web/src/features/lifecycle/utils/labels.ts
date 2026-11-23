import type { FinalAction, ListKind, ListStatus } from '../api/lifecycle.api';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const FINAL_ACTION: Record<FinalAction, { label: string; tone: Tone }> = {
  DETRUIRE: { label: 'Détruire', tone: 'danger' },
  VERSER: { label: 'Verser', tone: 'info' },
  CONSERVER: { label: 'Conserver', tone: 'success' },
};

export const LIST_KIND: Record<ListKind, string> = {
  ELIMINATION: 'Élimination',
  VERSEMENT: 'Versement',
};

export const LIST_STATUS: Record<ListStatus, { label: string; tone: Tone }> = {
  BROUILLON: { label: 'Brouillon', tone: 'neutral' },
  SOUMIS: { label: 'En attente de visa', tone: 'warning' },
  APPROUVE: { label: 'Visé, à exécuter', tone: 'info' },
  REFUSE: { label: 'Refusé', tone: 'danger' },
  EXECUTE: { label: 'Exécuté', tone: 'success' },
  ANNULE: { label: 'Annulé', tone: 'neutral' },
};

/** Sort final attendu pour un type de bordereau. */
export const ACTION_FOR_KIND: Record<ListKind, FinalAction> = {
  ELIMINATION: 'DETRUIRE',
  VERSEMENT: 'VERSER',
};

/** Jours entre aujourd'hui et l'échéance : négatif si dépassée. */
export function daysUntil(date: string, today: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** « échu depuis 3 ans », « dans 38 jours », « aujourd'hui ». */
export function dueLabel(date: string, today: string): string {
  const d = daysUntil(date, today);
  if (d === 0) return "aujourd'hui";
  const abs = Math.abs(d);
  const span =
    abs >= 730
      ? `${String(Math.floor(abs / 365))} ans`
      : abs >= 60
        ? `${String(Math.floor(abs / 30))} mois`
        : `${String(abs)} jours`;
  return d < 0 ? `échu depuis ${span}` : `dans ${span}`;
}

/**
 * Raison pour laquelle un document de l'échéancier ne peut pas être coché pour un bordereau,
 * ou null s'il peut l'être.
 */
export function selectionBlocker(
  item: {
    legalHold: boolean;
    pendingListNumber: string | null;
    status: string;
    retentionUntil: string | null;
  },
  today: string,
): string | null {
  if (item.legalHold) return 'Sous gel juridique';
  if (item.pendingListNumber) return `Déjà sur le bordereau ${item.pendingListNumber}`;
  if (item.status !== 'ACTIVE' && item.status !== 'INTERMEDIAIRE')
    return 'Statut ne permettant pas de sort final';
  if (!item.retentionUntil || daysUntil(item.retentionUntil, today) > 0) return 'Pas encore échu';
  return null;
}
