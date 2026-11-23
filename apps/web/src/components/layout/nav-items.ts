import {
  Archive,
  Box,
  Clock,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { fr } from '@/i18n/locales/fr/common';
import type { ModuleKey } from './modules';

export interface NavItem {
  to: string;
  labelKey: `nav.${Exclude<keyof typeof fr.nav, 'main'>}`;
  icon: LucideIcon;
  /** Couleur du module (icône du menu, pastilles, cartes) */
  module: ModuleKey;
  /** Permissions générales : l'entrée s'affiche si l'utilisateur en a au moins une */
  permissions?: readonly string[];
}

export const navItems: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, module: 'explorer' },
  { to: '/explorateur', labelKey: 'nav.explorer', icon: FolderTree, module: 'explorer' },
  { to: '/a-classer', labelKey: 'nav.inbox', icon: Inbox, module: 'inbox' },
  { to: '/recherche', labelKey: 'nav.search', icon: Search, module: 'search' },
  { to: '/archives-physiques', labelKey: 'nav.physical', icon: Box, module: 'physical' },
  {
    to: '/cycle-de-vie',
    labelKey: 'nav.lifecycle',
    icon: Clock,
    module: 'lifecycle',
    permissions: ['lifecycle.manage', 'lifecycle.approve'],
  },
  { to: '/audit', labelKey: 'nav.audit', icon: FileText, module: 'audit', permissions: ['audit.read'] },
  {
    to: '/parametrage',
    labelKey: 'nav.settings',
    icon: SlidersHorizontal,
    module: 'settings',
    permissions: ['settings.manage', 'classification.manage'],
  },
];

export const AppLogo = Archive;
