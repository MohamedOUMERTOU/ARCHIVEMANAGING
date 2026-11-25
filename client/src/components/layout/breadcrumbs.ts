import type { NavItem } from './nav-items';

type NavKey = NavItem['labelKey'];

export interface Crumb {
  label: string;
  /** Absent pour la page courante (dernier élément) */
  to?: string;
}

/** Libellés des sections principales (clé i18n du menu) */
const TOP: Record<string, NavKey> = {
  '': 'nav.dashboard',
  explorateur: 'nav.explorer',
  'a-classer': 'nav.inbox',
  recherche: 'nav.search',
  documents: 'nav.explorer',
  'archives-physiques': 'nav.physical',
  'cycle-de-vie': 'nav.lifecycle',
  audit: 'nav.audit',
  parametrage: 'nav.settings',
};

/** Sous-sections, par section */
const SUB: Record<string, Record<string, string>> = {
  'archives-physiques': { emplacements: 'Emplacements', prets: 'Prêts & consultations', niveaux: 'Niveaux' },
  'cycle-de-vie': { echeancier: 'Échéancier', bordereaux: 'Bordereaux', gels: 'Gels juridiques' },
  parametrage: {
    plan: 'Plan de classement',
    types: 'Types de document',
    regles: 'Règles de conservation',
    tags: 'Tags',
    utilisateurs: 'Utilisateurs & rôles',
    stockage: 'Stockage',
  },
};

/**
 * Fil d'Ariane déduit de l'adresse : section, sous-section, puis page de détail.
 * `t` traduit les clés du menu ; les sous-sections sont en français, comme leurs écrans.
 */
export function breadcrumbs(pathname: string, t: (key: NavKey) => string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  const [section = '', sub, detail] = parts;
  const topKey = TOP[section];
  if (!topKey) return [];
  const top = t(topKey);

  if (section === 'documents') {
    return [{ label: top, to: '/explorateur' }, { label: 'Fiche document' }];
  }
  const subLabel = sub ? SUB[section]?.[sub] : undefined;
  if (!subLabel) return [{ label: top }];
  const base = `/${section}`;
  if (detail) {
    const detailLabel = sub === 'bordereaux' ? 'Bordereau' : 'Détail';
    return [
      { label: top, to: base },
      { label: subLabel, to: `${base}/${sub ?? ''}` },
      { label: detailLabel },
    ];
  }
  return [{ label: top, to: base }, { label: subLabel }];
}
