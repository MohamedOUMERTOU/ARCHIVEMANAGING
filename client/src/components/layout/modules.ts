/**
 * Couleur de chaque module (piste C). Classes écrites en entier : Tailwind ne détecte pas
 * les noms construits par concaténation.
 */
export type ModuleKey = 'explorer' | 'inbox' | 'search' | 'physical' | 'lifecycle' | 'audit' | 'settings';

export interface ModuleStyle {
  /** Icône dans la barre latérale foncée */
  nav: string;
  /** Texte ou icône sur fond clair */
  text: string;
  /** Fond teinté (pastille d'icône, étiquette) */
  soft: string;
  /** Liseré coloré en haut d'une carte */
  topLine: string;
}

export const MODULES: Record<ModuleKey, ModuleStyle> = {
  explorer: {
    nav: 'text-mod-explorer-nav',
    text: 'text-mod-explorer',
    soft: 'bg-mod-explorer-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-explorer)]',
  },
  inbox: {
    nav: 'text-mod-inbox-nav',
    text: 'text-mod-inbox',
    soft: 'bg-mod-inbox-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-inbox)]',
  },
  search: {
    nav: 'text-mod-search-nav',
    text: 'text-mod-search',
    soft: 'bg-mod-search-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-search)]',
  },
  physical: {
    nav: 'text-mod-physical-nav',
    text: 'text-mod-physical',
    soft: 'bg-mod-physical-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-physical)]',
  },
  lifecycle: {
    nav: 'text-mod-lifecycle-nav',
    text: 'text-mod-lifecycle',
    soft: 'bg-mod-lifecycle-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-lifecycle)]',
  },
  audit: {
    nav: 'text-mod-audit-nav',
    text: 'text-mod-audit',
    soft: 'bg-mod-audit-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-audit)]',
  },
  settings: {
    nav: 'text-mod-settings-nav',
    text: 'text-mod-settings',
    soft: 'bg-mod-settings-soft',
    topLine: 'shadow-[inset_0_3px_0_var(--color-mod-settings)]',
  },
};
