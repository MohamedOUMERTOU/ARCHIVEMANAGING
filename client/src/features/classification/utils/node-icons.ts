import { Folder, FolderTree, Landmark, Library, type LucideIcon } from 'lucide-react';
import type { NodeType } from '../types';

/** Icône et couleur de chaque niveau du plan de classement (classes complètes pour Tailwind). */
export const NODE_ICONS: Record<NodeType, { icon: LucideIcon; chip: string }> = {
  FONDS: { icon: Landmark, chip: 'bg-info-soft text-info' },
  SERIE: { icon: Library, chip: 'bg-mod-explorer-soft text-mod-explorer' },
  SOUS_SERIE: { icon: FolderTree, chip: 'bg-mod-physical-soft text-mod-physical' },
  DOSSIER: { icon: Folder, chip: 'bg-mod-inbox-soft text-mod-inbox' },
};
