import type { DocumentStatus } from '../types';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS_INFO: Record<DocumentStatus, { label: string; tone: StatusTone }> = {
  A_CLASSER: { label: 'À classer', tone: 'warning' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  INTERMEDIAIRE: { label: 'Intermédiaire', tone: 'info' },
  DEFINITIF: { label: 'Définitif', tone: 'neutral' },
  A_ELIMINER: { label: 'À éliminer', tone: 'danger' },
  ELIMINE: { label: 'Éliminé', tone: 'neutral' },
  VERSE: { label: 'Versé', tone: 'neutral' },
};

export const statusLabel = (status: DocumentStatus) => STATUS_INFO[status].label;
export const STATUSES = Object.keys(STATUS_INFO) as DocumentStatus[];
