// Chemins d'ID des arbres (plan de classement, emplacements physiques).
// Format : "/<id racine>/<id enfant>/.../<id>/" — on ne stocke jamais le chemin lisible,
// qui est recalculé à l'affichage : renommer un nœud ne touche donc à aucun chemin.

export function buildIdPath(parentPath: string | null, id: string): string {
  return `${parentPath ?? '/'}${id}/`;
}

/** Les ID du chemin, de la racine jusqu'au nœud lui-même. */
export function ancestorIds(idPath: string): string[] {
  return idPath.split('/').filter(Boolean);
}

export function depthOf(idPath: string): number {
  return ancestorIds(idPath).length - 1;
}

/** Vrai si `candidatePath` est le nœud `path` lui-même ou l'un de ses descendants. */
export function isSelfOrDescendant(path: string, candidatePath: string): boolean {
  return candidatePath.startsWith(path);
}

/** Nouveau chemin d'un nœud du sous-arbre après déplacement de sa racine. */
export function rebasePath(path: string, oldPrefix: string, newPrefix: string): string {
  if (!path.startsWith(oldPrefix)) throw new Error(`${path} n'est pas sous ${oldPrefix}`);
  return newPrefix + path.slice(oldPrefix.length);
}
