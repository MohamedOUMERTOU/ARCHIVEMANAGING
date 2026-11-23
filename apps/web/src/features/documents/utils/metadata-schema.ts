import { z } from 'zod';
import type { MetadataField } from '../types';

const NUMBER = /^-?\d[\d\s]*([.,]\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schéma Zod des métadonnées d'un type de document.
 * Les mêmes règles sont vérifiées côté serveur (MetadataValidator) : l'interface
 * prévient l'utilisateur plus tôt, le serveur reste la vraie barrière.
 */
export function metadataSchema(fields: readonly MetadataField[]) {
  const shape: Record<string, z.ZodType<string, string>> = {};
  for (const field of fields) {
    let rule = z.string().trim();
    if (field.type === 'NUMBER' || field.type === 'AMOUNT') {
      rule = rule.refine((v) => v === '' || NUMBER.test(v), { error: 'Saisissez un nombre' });
    }
    if (field.type === 'DATE') {
      rule = rule.refine((v) => v === '' || ISO_DATE.test(v), { error: 'Saisissez une date valide' });
    }
    if (field.type === 'LIST' && field.options) {
      const options = field.options;
      rule = rule.refine((v) => v === '' || options.includes(v), {
        error: 'Choisissez une valeur de la liste',
      });
    }
    if (field.required) {
      rule = rule.refine((v) => v !== '', { error: 'Champ obligatoire' });
    }
    shape[field.key] = rule;
  }
  return z.object(shape);
}

/** Valeurs initiales du formulaire : chaîne vide pour chaque champ, ou la valeur existante. */
export function metadataDefaults(
  fields: readonly MetadataField[],
  current: Record<string, unknown> = {},
): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => {
      const v = current[f.key];
      return [
        f.key,
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '',
      ];
    }),
  );
}

/** Retire les champs vides avant l'envoi. */
export function compactMetadata(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ''));
}
