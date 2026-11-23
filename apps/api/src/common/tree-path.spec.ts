import { ancestorIds, buildIdPath, depthOf, isSelfOrDescendant, rebasePath } from './tree-path';

describe('tree-path', () => {
  const fonds = buildIdPath(null, 'F');
  const serie = buildIdPath(fonds, 'S');
  const dossier = buildIdPath(serie, 'D');

  it('construit le chemin à partir du parent', () => {
    expect(fonds).toBe('/F/');
    expect(dossier).toBe('/F/S/D/');
  });

  it('donne les ancêtres et la profondeur', () => {
    expect(ancestorIds(dossier)).toEqual(['F', 'S', 'D']);
    expect(depthOf(fonds)).toBe(0);
    expect(depthOf(dossier)).toBe(2);
  });

  it('détecte un déplacement vers son propre sous-arbre', () => {
    expect(isSelfOrDescendant(serie, dossier)).toBe(true);
    expect(isSelfOrDescendant(serie, serie)).toBe(true);
    expect(isSelfOrDescendant(dossier, serie)).toBe(false);
  });

  it("ne confond pas deux ID dont l'un est le préfixe de l'autre", () => {
    expect(isSelfOrDescendant('/F/S/', '/F/S2/')).toBe(false);
  });

  it('recalcule le chemin du sous-arbre après déplacement', () => {
    // La série S passe du fonds F au fonds G
    expect(rebasePath(dossier, '/F/S/', '/G/S/')).toBe('/G/S/D/');
    expect(() => rebasePath('/X/Y/', '/F/S/', '/G/S/')).toThrow();
  });
});
