import { breadcrumbs } from './breadcrumbs';

const t = (key: string) =>
  ({
    'nav.dashboard': 'Tableau de bord',
    'nav.lifecycle': 'Cycle de vie',
    'nav.explorer': 'Explorateur',
    'nav.settings': 'Paramétrage',
  })[key] ?? key;

describe('fil d’Ariane', () => {
  it('donne la section seule pour une page principale', () => {
    expect(breadcrumbs('/', t)).toEqual([{ label: 'Tableau de bord' }]);
    expect(breadcrumbs('/explorateur', t)).toEqual([{ label: 'Explorateur' }]);
  });

  it('ajoute la sous-section, avec un lien vers la section', () => {
    expect(breadcrumbs('/parametrage/stockage', t)).toEqual([
      { label: 'Paramétrage', to: '/parametrage' },
      { label: 'Stockage' },
    ]);
  });

  it('remonte jusqu’à la liste depuis une page de détail', () => {
    expect(breadcrumbs('/cycle-de-vie/bordereaux/123', t)).toEqual([
      { label: 'Cycle de vie', to: '/cycle-de-vie' },
      { label: 'Bordereaux', to: '/cycle-de-vie/bordereaux' },
      { label: 'Bordereau' },
    ]);
    expect(breadcrumbs('/documents/abc', t)).toEqual([
      { label: 'Explorateur', to: '/explorateur' },
      { label: 'Fiche document' },
    ]);
  });

  it('ne propose rien pour une adresse inconnue', () => {
    expect(breadcrumbs('/inconnu', t)).toEqual([]);
  });
});
