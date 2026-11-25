import type { MetadataField } from '../types';
import { compactMetadata, metadataDefaults, metadataSchema } from './metadata-schema';

const fields: MetadataField[] = [
  { key: 'fournisseur', label: 'Fournisseur', type: 'TEXT', required: true },
  { key: 'montant', label: 'Montant', type: 'AMOUNT', required: true },
  { key: 'devise', label: 'Devise', type: 'LIST', options: ['MAD', 'EUR'] },
  { key: 'echeance', label: 'Échéance', type: 'DATE' },
];

describe('metadataSchema', () => {
  it('accepte des valeurs valides, y compris les montants à la française', () => {
    const r = metadataSchema(fields).safeParse({
      fournisseur: 'ACME',
      montant: '1 200,50',
      devise: 'MAD',
      echeance: '',
    });
    expect(r.success).toBe(true);
  });

  it('signale chaque champ invalide avec un message en français', () => {
    const r = metadataSchema(fields).safeParse({
      fournisseur: '  ',
      montant: 'douze',
      devise: 'GBP',
      echeance: '31/01',
    });
    expect(r.success).toBe(false);
    const messages = Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));
    expect(messages).toEqual({
      fournisseur: 'Champ obligatoire',
      montant: 'Saisissez un nombre',
      devise: 'Choisissez une valeur de la liste',
      echeance: 'Saisissez une date valide',
    });
  });
});

describe('metadataDefaults / compactMetadata', () => {
  it('prépare le formulaire et nettoie avant envoi', () => {
    const defaults = metadataDefaults(fields, { fournisseur: 'ACME', montant: 10 });
    expect(defaults).toEqual({ fournisseur: 'ACME', montant: '10', devise: '', echeance: '' });
    expect(compactMetadata(defaults)).toEqual({ fournisseur: 'ACME', montant: '10' });
  });
});
