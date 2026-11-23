import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import type { TreeNode } from '@/utils/tree';
import type { PhysicalLocation } from '../api/physical.api';
import { levelIcon } from '../utils/level-icons';
import { OccupancyBar } from './OccupancyBar';

type Node = TreeNode<PhysicalLocation>;

interface Props {
  nodes: Node[];
  selectedId: string | null;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

/** Arbre des emplacements, en listes imbriquées navigables au clavier. */
export function LocationTree(props: Props) {
  return (
    <nav aria-label="Arbre des emplacements">
      <Level {...props} />
    </nav>
  );
}

function Level({ nodes, ...rest }: Props) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((n) => (
        <Item key={n.id} node={n} {...rest} />
      ))}
    </ul>
  );
}

function Item({ node, selectedId, expanded, onToggle }: Omit<Props, 'nodes'> & { node: Node }) {
  const open = expanded.has(node.id);
  const selected = node.id === selectedId;
  const { icon: Icon, chip } = levelIcon(node.levelIcon, node.canHoldDocuments);
  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md pr-2',
          selected ? 'bg-primary-soft' : 'hover:bg-bg',
          !node.active && 'opacity-60',
        )}
        style={{ paddingLeft: `${String(node.depth * 16)}px` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={node.label}
            onClick={() => {
              onToggle(node.id);
            }}
            className="text-muted hover:text-ink flex size-7 shrink-0 items-center justify-center rounded"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('size-4 transition-transform', open && 'rotate-90')}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="size-7 shrink-0" />
        )}
        <Link
          to={`?loc=${node.id}`}
          aria-current={selected ? 'page' : undefined}
          className={cn(
            'text-ink flex min-w-0 flex-1 items-center gap-2 py-1.5 no-underline',
            selected && 'text-primary-strong font-semibold',
          )}
        >
          <span
            title={node.levelName}
            className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', chip)}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{node.levelName} :</span>
          </span>
          <span className="truncate">{node.label}</span>
          {node.onLoan && (
            <span className="bg-warning-soft text-warning shrink-0 rounded-full px-2 text-[11px] font-semibold">
              En prêt
            </span>
          )}
          <span aria-hidden="true" className="ml-auto" />
          {node.canHoldDocuments && (
            <OccupancyBar count={node.documentCount} capacity={node.capacity} compact />
          )}
        </Link>
      </div>
      {open && node.children.length > 0 && (
        <Level nodes={node.children} selectedId={selectedId} expanded={expanded} onToggle={onToggle} />
      )}
    </li>
  );
}
