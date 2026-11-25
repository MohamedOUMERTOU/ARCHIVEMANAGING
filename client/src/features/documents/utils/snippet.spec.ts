import { describe, expect, it } from 'vitest';
import { readability, snippetParts } from './snippet';

describe('snippetParts', () => {
  it('sépare les mots trouvés du reste', () => {
    expect(snippetParts('réception de la \u0002climatisation\u0003 sans \u0002réserve\u0003.')).toEqual([
      { text: 'réception de la ', match: false },
      { text: 'climatisation', match: true },
      { text: ' sans ', match: false },
      { text: 'réserve', match: true },
      { text: '.', match: false },
    ]);
  });

  it("n'interprète jamais de HTML", () => {
    expect(snippetParts('<b>\u0002x\u0003</b>')).toEqual([
      { text: '<b>', match: false },
      { text: 'x', match: true },
      { text: '</b>', match: false },
    ]);
  });

  it('accepte un extrait sans mot surligné', () => {
    expect(snippetParts('texte')).toEqual([{ text: 'texte', match: false }]);
  });
});

describe('readability', () => {
  it('classe la lisibilité en trois niveaux', () => {
    expect(readability(96)).toBe('good');
    expect(readability(70)).toBe('fair');
    expect(readability(54)).toBe('poor');
  });
});
