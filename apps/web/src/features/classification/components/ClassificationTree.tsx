import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import type { TreeNode } from '@/utils/tree';
import type { ClassificationNode } from '../types';
import { NODE_ICONS } from '../utils/node-icons';

type Node = TreeNode<ClassificationNode>;

interface ClassificationTreeProps {
  nodes: Node[];
  selectedId: string | null;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

/** Listes imbriquées : lisibles par les lecteurs d'écran et navigables au clavier (Tab, Entrée). */
export function ClassificationTree({ nodes, selectedId, expanded, onToggle }: ClassificationTreeProps) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('classification.treeLabel')}>
      <TreeLevel nodes={nodes} selectedId={selectedId} expanded={expanded} onToggle={onToggle} />
    </nav>
  );
}

function TreeLevel({ nodes, ...rest }: ClassificationTreeProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeItem key={node.id} node={node} {...rest} />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  selectedId,
  expanded,
  onToggle,
}: Omit<ClassificationTreeProps, 'nodes'> & { node: Node }) {
  const { t } = useTranslation();
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = node.id === selectedId;
  const typeLabel = t(`classification.nodeTypes.${node.type}`);
  const { icon: Icon, chip } = NODE_ICONS[node.type];

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md pr-2',
          isSelected ? 'bg-primary-soft' : 'hover:bg-bg',
        )}
        style={{ paddingLeft: `${String(node.depth * 16)}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => {
              onToggle(node.id);
            }}
            aria-expanded={isOpen}
            aria-label={node.title}
            className="text-muted hover:text-ink flex size-7 shrink-0 items-center justify-center rounded"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('size-4 transition-transform', isOpen && 'rotate-90')}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="size-7 shrink-0" />
        )}
        <Link
          to={`?node=${node.id}`}
          aria-current={isSelected ? 'page' : undefined}
          className={cn(
            'text-ink flex min-w-0 flex-1 items-center gap-2 py-1.5 no-underline',
            isSelected && 'text-primary-strong font-semibold',
          )}
        >
          <span
            title={typeLabel}
            className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', chip)}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{typeLabel} :</span>
          </span>
          <span className="truncate">{node.title}</span>
          <span className="text-muted ml-auto shrink-0 text-xs tabular-nums">{node.documentCount}</span>
        </Link>
      </div>
      {hasChildren && isOpen && (
        <TreeLevel nodes={node.children} selectedId={selectedId} expanded={expanded} onToggle={onToggle} />
      )}
    </li>
  );
}
