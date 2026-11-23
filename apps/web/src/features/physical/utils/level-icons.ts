import {
  BookCopy,
  Building2,
  DoorOpen,
  FolderClosed,
  Inbox,
  Layers,
  LibraryBig,
  MapPin,
  Package,
  Rows3,
  Server,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface LevelIcon {
  icon: LucideIcon;
  label: string;
  /** Pastille : fond teinté et couleur de l'icône (classes complètes pour Tailwind) */
  chip: string;
}

/** Catalogue des icônes de niveau ; mêmes clés que le serveur (PhysicalService.LEVEL_ICONS). */
export const LEVEL_ICONS = {
  site: { icon: MapPin, label: 'Site', chip: 'bg-mod-search-soft text-mod-search' },
  building: { icon: Building2, label: 'Bâtiment', chip: 'bg-info-soft text-info' },
  warehouse: { icon: Warehouse, label: 'Entrepôt', chip: 'bg-info-soft text-info' },
  floor: { icon: Layers, label: 'Étage', chip: 'bg-mod-explorer-soft text-mod-explorer' },
  room: { icon: DoorOpen, label: 'Salle', chip: 'bg-mod-physical-soft text-mod-physical' },
  cabinet: { icon: Server, label: 'Armoire', chip: 'bg-mod-settings-soft text-mod-settings' },
  shelving: { icon: LibraryBig, label: 'Rayonnage', chip: 'bg-mod-inbox-soft text-mod-inbox' },
  shelf: { icon: Rows3, label: 'Étagère', chip: 'bg-mod-inbox-soft text-mod-inbox' },
  drawer: { icon: Inbox, label: 'Tiroir', chip: 'bg-mod-audit-soft text-mod-audit' },
  box: { icon: Package, label: 'Boîte', chip: 'bg-mod-lifecycle-soft text-mod-lifecycle' },
  binder: { icon: BookCopy, label: 'Classeur', chip: 'bg-mod-lifecycle-soft text-mod-lifecycle' },
  folder: { icon: FolderClosed, label: 'Chemise', chip: 'bg-mod-audit-soft text-mod-audit' },
} as const satisfies Record<string, LevelIcon>;

export type LevelIconKey = keyof typeof LEVEL_ICONS;
export const LEVEL_ICON_KEYS = Object.keys(LEVEL_ICONS) as LevelIconKey[];

/** Icône d'un niveau ; à défaut, boîte s'il reçoit des documents, salle sinon. */
export function levelIcon(key: string | null | undefined, canHoldDocuments = false): LevelIcon {
  if (key && key in LEVEL_ICONS) return LEVEL_ICONS[key as LevelIconKey];
  return canHoldDocuments ? LEVEL_ICONS.box : LEVEL_ICONS.room;
}
