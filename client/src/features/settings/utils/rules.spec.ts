import { describeRule } from './rules';

describe('describeRule', () => {
  it('résume une règle en une phrase', () => {
    expect(describeRule({ durationYears: 10, startEvent: 'CLOTURE_DOSSIER', finalAction: 'VERSER' })).toBe(
      'Le document est conservé 10 ans à compter de la clôture du dossier, jusqu’au 31 décembre de l’année d’échéance ; ensuite il est versé aux archives définitives.',
    );
    expect(describeRule({ durationYears: 1, startEvent: 'DATE_CREATION', finalAction: 'DETRUIRE' })).toMatch(
      /1 an à compter de son dépôt/,
    );
  });

  it('gère la conservation illimitée', () => {
    expect(describeRule({ durationYears: null, startEvent: 'DATE_DOCUMENT', finalAction: 'CONSERVER' })).toBe(
      'Le document est conservé sans limite de durée.',
    );
  });
});
