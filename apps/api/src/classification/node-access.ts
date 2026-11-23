import { ancestorIds } from '../common/tree-path';

export interface NodeRights {
  read: boolean;
  write: boolean;
  delete: boolean;
  admin: boolean;
}

export interface PermissionRow {
  roleId: string;
  nodeId: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canAdmin: boolean;
}

export const NO_RIGHTS: NodeRights = { read: false, write: false, delete: false, admin: false };
export const ALL_RIGHTS: NodeRights = { read: true, write: true, delete: true, admin: true };

/**
 * Droits effectifs sur un nœud.
 * Pour chaque rôle, on prend la règle posée sur le nœud ou, à défaut, sur l'ancêtre le plus proche
 * (une règle plus profonde remplace celle du dessus). Les rôles s'additionnent.
 */
export function effectiveRights(idPath: string, roleIds: string[], rows: PermissionRow[]): NodeRights {
  const chain = ancestorIds(idPath).reverse(); // du nœud vers la racine
  const result: NodeRights = { ...NO_RIGHTS };

  for (const roleId of roleIds) {
    const roleRows = rows.filter((r) => r.roleId === roleId);
    for (const nodeId of chain) {
      const rule = roleRows.find((r) => r.nodeId === nodeId);
      if (!rule) continue;
      result.read ||= rule.canRead;
      result.write ||= rule.canWrite;
      result.delete ||= rule.canDelete;
      result.admin ||= rule.canAdmin;
      break;
    }
  }
  // Pouvoir écrire ou administrer implique de pouvoir lire
  if (result.write || result.delete || result.admin) result.read = true;
  return result;
}
