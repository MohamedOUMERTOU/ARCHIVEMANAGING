/** Morceau d'extrait : texte ordinaire ou mot trouvé. */
export interface SnippetPart {
  text: string;
  match: boolean;
}

const START = '\u0002';
const STOP = '\u0003';

/**
 * Découpe un extrait renvoyé par la recherche (mots trouvés entre U+0002 et U+0003) en morceaux
 * affichables sans interpréter de HTML.
 */
export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let match = false;
  let buffer = '';
  const flush = () => {
    if (buffer) parts.push({ text: buffer, match });
    buffer = '';
  };
  for (const ch of snippet) {
    if (ch === START || ch === STOP) {
      flush();
      match = ch === START;
    } else {
      buffer += ch;
    }
  }
  flush();
  return parts;
}

/** Lisibilité d'un texte reconnu, en trois niveaux. */
export function readability(confidence: number): 'good' | 'fair' | 'poor' {
  if (confidence >= 85) return 'good';
  if (confidence >= 65) return 'fair';
  return 'poor';
}
