import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { buildTree, pathTo } from '@/utils/tree';
import { classificationApi, classificationKeys } from '../api/classification.api';
import type { ClassificationNode } from '../types';

const byCode = (a: ClassificationNode, b: ClassificationNode) => a.code.localeCompare(b.code, 'fr');

export function useClassificationTree(selectedId: string | null) {
  const query = useQuery({
    queryKey: classificationKeys.tree(),
    queryFn: classificationApi.tree,
    // L'arbre change rarement : inutile de le recharger à chaque visite
    staleTime: 5 * 60_000,
  });

  const nodes = query.data;
  const tree = useMemo(() => (nodes ? buildTree(nodes, byCode) : []), [nodes]);
  const selectedPath = useMemo(
    () => (nodes && selectedId ? pathTo(nodes, selectedId) : []),
    [nodes, selectedId],
  );

  return { ...query, tree, selectedPath, selected: selectedPath.at(-1) ?? null };
}
