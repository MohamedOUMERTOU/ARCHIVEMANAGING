import { slugKey } from './slug';

describe('slugKey', () => {
  it('propose une clé technique à partir du libellé', () => {
    expect(slugKey('N° de facture')).toBe('n_de_facture');
    expect(slugKey('Échéance prévue')).toBe('echeance_prevue');
    expect(slugKey('  Montant TTC (MAD) ')).toBe('montant_ttc_mad');
  });

  it('commence toujours par une lettre', () => {
    expect(slugKey('2e signataire')).toBe('champ_2e_signataire');
    expect(slugKey('***')).toBe('');
  });
});
