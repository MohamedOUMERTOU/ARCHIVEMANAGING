import { buildTree, pathTo } from './tree';

const items = [
  { id: 'd', parentId: 's', title: 'Dossier' },
  { id: 'f', parentId: null, title: 'Fonds' },
  { id: 's', parentId: 'f', title: 'Série' },
  { id: 'a', parentId: 'f', title: 'Autre série' },
];

describe('buildTree', () => {
  it('remet la liste à plat en arbre, quel que soit son ordre', () => {
    const [root] = buildTree(items);
    expect(root?.id).toBe('f');
    expect(root?.children.map((c) => c.id)).toEqual(['s', 'a']);
    expect(root?.children[0]?.children[0]?.id).toBe('d');
  });

  it('trie chaque niveau quand on donne un comparateur', () => {
    const [root] = buildTree(items, (x, y) => x.title.localeCompare(y.title));
    expect(root?.children.map((c) => c.title)).toEqual(['Autre série', 'Série']);
  });

  it("garde comme racine un nœud dont le parent n'est pas visible", () => {
    const roots = buildTree([{ id: 'x', parentId: 'cache' }]);
    expect(roots.map((r) => r.id)).toEqual(['x']);
  });
});

describe('pathTo', () => {
  it('donne le chemin depuis la racine', () => {
    expect(pathTo(items, 'd').map((n) => n.id)).toEqual(['f', 's', 'd']);
  });

  it('ne boucle pas sur des données corrompues', () => {
    const loop = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ];
    expect(pathTo(loop, 'a')).toHaveLength(2);
  });
});
