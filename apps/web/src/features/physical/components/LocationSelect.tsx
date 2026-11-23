import type { ComponentProps } from 'react';
import { Select } from '@/components/ui/select';
import type { TreeNode } from '@/utils/tree';
import type { PhysicalLocation } from '../api/physical.api';
import { useLocationTree } from '../hooks/usePhysical';

type Option = { node: PhysicalLocation; label: string };

/** Arbre → liste à plat indentée ; un sous-arbre exclu (déplacement) est entièrement retiré. */
function flatten(nodes: TreeNode<PhysicalLocation>[], excludeId?: string, out: Option[] = []): Option[] {
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    out.push({ node: n, label: `${'   '.repeat(n.depth)}${n.label}` });
    flatten(n.children, excludeId, out);
  }
  return out;
}

type Props = Omit<ComponentProps<'select'>, 'children'> & {
  emptyLabel?: string;
  /** Seuls les emplacements qui reçoivent des documents (boîtes) sont choisissables */
  holdOnly?: boolean;
  /** Emplacement à exclure avec tout ce qu'il contient (déplacement) */
  excludeId?: string;
};

/** Choix d'un emplacement, présenté en arbre indenté ; les autres restent visibles pour se repérer. */
export function LocationSelect({ emptyLabel, holdOnly = false, excludeId, ...props }: Props) {
  const { tree, isPending } = useLocationTree(null);
  return (
    <Select {...props} disabled={isPending || props.disabled}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {flatten(tree, excludeId).map(({ node, label }) => {
        const disabled = !node.active || (holdOnly && !node.canHoldDocuments);
        const extra =
          node.canHoldDocuments && node.capacity !== null
            ? ` (${String(node.documentCount)}/${String(node.capacity)})`
            : '';
        return (
          <option key={node.id} value={node.id} disabled={disabled}>
            {label}
            {extra}
          </option>
        );
      })}
    </Select>
  );
}
