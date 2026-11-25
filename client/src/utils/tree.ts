export interface FlatNode {
  id: string;
  parentId: string | null;
}

export type TreeNode<T extends FlatNode> = T & { children: TreeNode<T>[] };

/**
 * Transforme une liste à plat (id, parentId) en arbre.
 * Un nœud dont le parent est absent de la liste devient une racine : on n'en perd aucun.
 */
export function buildTree<T extends FlatNode>(
  items: readonly T[],
  compare?: (a: T, b: T) => number,
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const item of items) byId.set(item.id, { ...item, children: [] });

  const roots: TreeNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  if (compare) {
    const sortDeep = (nodes: TreeNode<T>[]) => {
      nodes.sort(compare);
      nodes.forEach((n) => {
        sortDeep(n.children);
      });
    };
    sortDeep(roots);
  }
  return roots;
}

/** Les ancêtres d'un nœud, de la racine jusqu'à lui (fil d'Ariane). */
export function pathTo<T extends FlatNode>(items: readonly T[], id: string): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const path: T[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
