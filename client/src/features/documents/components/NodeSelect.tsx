import type { ComponentProps } from 'react';
import { Select } from '@/components/ui/select';
import { useClassificationTree, type ClassificationNode } from '@/features/classification';
import type { TreeNode } from '@/utils/tree';

function flatten(
  nodes: TreeNode<ClassificationNode>[],
  out: Array<{ node: ClassificationNode; label: string }> = [],
) {
  for (const n of nodes) {
    // Espaces insécables pour montrer la profondeur dans une liste native
    out.push({ node: n, label: `${'   '.repeat(n.depth)}${n.title}` });
    flatten(n.children, out);
  }
  return out;
}

type NodeSelectProps = Omit<ComponentProps<'select'>, 'children'> & {
  /** Libellé de l'option vide (ex. « Tous les dossiers ») ; absente si non fourni */
  emptyLabel?: string;
};

/** Choix d'un nœud du plan de classement, présenté en arbre indenté. */
export function NodeSelect({ emptyLabel, ...props }: NodeSelectProps) {
  const { tree, isPending } = useClassificationTree(null);
  return (
    <Select {...props} disabled={isPending || props.disabled}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {flatten(tree).map(({ node, label }) => (
        <option key={node.id} value={node.id}>
          {label}
        </option>
      ))}
    </Select>
  );
}
