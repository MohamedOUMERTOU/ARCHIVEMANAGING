import { zodResolver } from '@hookform/resolvers/zod';
import { FolderPlus, MoveRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClassificationTree, useClassificationTree, type NodeType } from '@/features/classification';
import { NodeSelect } from '@/features/documents';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { settingsApi, type NodeDetail } from '../api/settings.api';
import { PLAN_KEYS, useNode, useRules, useSettingsMutation } from '../hooks/useSettings';

const TYPE_LABEL: Record<NodeType, string> = {
  FONDS: 'Fonds',
  SERIE: 'Série',
  SOUS_SERIE: 'Sous-série',
  DOSSIER: 'Dossier',
};
const CHILD_TYPES: NodeType[] = ['SERIE', 'SOUS_SERIE', 'DOSSIER'];

export default function PlanSettings() {
  const [params] = useSearchParams();
  const selectedId = params.get('node');
  const { tree, selectedPath, isPending, isError, error, refetch } = useClassificationTree(selectedId);
  const [creating, setCreating] = useState<{ parent: NodeDetail | null } | null>(null);

  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const expanded = new Set<string>([...tree.map((n) => n.id), ...selectedPath.map((n) => n.id)]);
  toggled.forEach((id) => {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
  });
  const toggle = (id: string) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex w-full max-w-md flex-[1_1_320px] flex-col gap-3 p-3">
        <div className="flex items-center gap-2 px-2 pt-1">
          <CardTitle className="flex-1">Arbre de classement</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setCreating({ parent: null });
            }}
          >
            <Plus aria-hidden="true" /> Ajouter un fonds
          </Button>
        </div>
        {isPending ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : tree.length === 0 ? (
          <EmptyState title="Le plan de classement est vide." hint="Commencez par créer un fonds." />
        ) : (
          <ClassificationTree nodes={tree} selectedId={selectedId} expanded={expanded} onToggle={toggle} />
        )}
      </Card>

      <Card className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
        {selectedId ? (
          <NodeEditor
            key={selectedId}
            id={selectedId}
            onAddChild={(parent) => {
              setCreating({ parent });
            }}
          />
        ) : (
          <EmptyState title="Choisissez un nœud dans l'arbre pour le modifier." />
        )}
      </Card>

      {creating && (
        <CreateNodeDialog
          parent={creating.parent}
          onClose={() => {
            setCreating(null);
          }}
        />
      )}
    </div>
  );
}

// ───────── Fiche d'un nœud ─────────

const nodeSchema = z.object({
  code: z.string().trim().min(1, { error: 'Saisissez une cote' }).max(80),
  title: z.string().trim().min(1, { error: 'Saisissez un intitulé' }).max(255),
  description: z.string(),
  retentionRuleId: z.string(),
  closedAt: z.string(),
});
type NodeForm = z.infer<typeof nodeSchema>;

function NodeEditor({ id, onAddChild }: { id: string; onAddChild: (parent: NodeDetail) => void }) {
  const node = useNode(id);
  if (node.isPending) return <LoadingState />;
  if (node.isError) return <ErrorState error={node.error} />;
  return <NodeForm node={node.data} onAddChild={onAddChild} />;
}

function NodeForm({ node, onAddChild }: { node: NodeDetail; onAddChild: (parent: NodeDetail) => void }) {
  const navigate = useNavigate();
  const rules = useRules();
  const [dialog, setDialog] = useState<'move' | 'delete' | null>(null);
  const form = useForm<NodeForm>({
    resolver: zodResolver(nodeSchema),
    defaultValues: {
      code: node.code,
      title: node.title,
      description: node.description ?? '',
      retentionRuleId: node.retentionRuleId ?? '',
      closedAt: node.closedAt ?? '',
    },
  });
  const save = useSettingsMutation(
    (v: NodeForm) =>
      settingsApi.updateNode(node.id, {
        code: v.code,
        title: v.title,
        description: v.description || null,
        retentionRuleId: v.retentionRuleId || null,
        closedAt: v.closedAt || null,
      }),
    { success: 'Nœud enregistré', invalidate: PLAN_KEYS },
  );
  const remove = useSettingsMutation(() => settingsApi.deleteNode(node.id), {
    success: 'Nœud supprimé',
    invalidate: PLAN_KEYS,
  });

  const inherited = node.effectiveRetention?.inherited ? node.effectiveRetention.name : null;
  const errors = form.formState.errors;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <CardTitle className="text-lg">{node.title}</CardTitle>
          <p className="text-muted text-[13px]">
            {TYPE_LABEL[node.type]} · {node.path}
          </p>
        </div>
        {node.type !== 'DOSSIER' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onAddChild(node);
            }}
          >
            <FolderPlus aria-hidden="true" /> Ajouter un sous-nœud
          </Button>
        )}
        {node.type !== 'FONDS' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDialog('move');
            }}
          >
            <MoveRight aria-hidden="true" /> Déplacer
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setDialog('delete');
          }}
        >
          <Trash2 aria-hidden="true" /> Supprimer
        </Button>
      </div>

      <form
        noValidate
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            save.mutate(v, {
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <FormField id="n-code" label="Cote" error={errors.code?.message} required>
          <Input
            id="n-code"
            className="h-10 font-mono"
            aria-invalid={!!errors.code}
            {...form.register('code')}
          />
        </FormField>
        <FormField id="n-title" label="Intitulé" error={errors.title?.message} required>
          <Input id="n-title" className="h-10" aria-invalid={!!errors.title} {...form.register('title')} />
        </FormField>
        <FormField id="n-desc" label="Description" className="sm:col-span-2">
          <Textarea id="n-desc" {...form.register('description')} />
        </FormField>
        <FormField
          id="n-rule"
          label="Règle de conservation"
          hint={
            inherited
              ? `Sans règle propre, la règle « ${inherited} » est héritée du parent.`
              : 'Sans règle, rien n’est hérité.'
          }
        >
          <Select id="n-rule" {...form.register('retentionRuleId')}>
            <option value="">{inherited ? `Héritée : ${inherited}` : 'Aucune'}</option>
            {rules.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.durationYears === null ? 'illimitée' : `${String(r.durationYears)} ans`}
              </option>
            ))}
          </Select>
        </FormField>
        {node.type === 'DOSSIER' && (
          <FormField
            id="n-closed"
            label="Date de clôture"
            hint="Point de départ des règles « à la clôture du dossier »."
          >
            <Input id="n-closed" type="date" className="h-10" {...form.register('closedAt')} />
          </FormField>
        )}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>

      {dialog === 'move' && (
        <MoveNodeDialog
          node={node}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
        title={`Supprimer « ${node.title} » ?`}
        message="Seul un nœud vide (sans sous-nœud ni document) peut être supprimé. La suppression est inscrite au journal d'audit."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              void navigate('?', { replace: true });
            },
            onError: (err) => {
              notifyError(err);
              setDialog(null);
            },
          });
        }}
      />
    </>
  );
}

// ───────── Création ─────────

const createSchema = z.object({
  type: z.enum(['FONDS', 'SERIE', 'SOUS_SERIE', 'DOSSIER']),
  code: z.string().trim().min(1, { error: 'Saisissez une cote' }).max(80),
  title: z.string().trim().min(1, { error: 'Saisissez un intitulé' }).max(255),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateNodeDialog({ parent, onClose }: { parent: NodeDetail | null; onClose: () => void }) {
  const navigate = useNavigate();
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: parent ? 'SERIE' : 'FONDS', code: parent ? `${parent.code}/` : '', title: '' },
  });
  const create = useSettingsMutation(
    (v: CreateForm) => settingsApi.createNode({ ...v, parentId: parent?.id ?? null }),
    { success: 'Nœud créé', invalidate: PLAN_KEYS },
  );
  const errors = form.formState.errors;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={parent ? `Nouveau nœud sous « ${parent.title} »` : 'Nouveau fonds'}
      description="La cote doit être unique dans la société."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            create.mutate(v, {
              onSuccess: (n) => {
                onClose();
                void navigate(`?node=${n.id}`);
              },
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
      >
        {parent && (
          <FormField id="c-type" label="Niveau" required>
            <Select id="c-type" {...form.register('type')}>
              {CHILD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField id="c-code" label="Cote" error={errors.code?.message} required>
          <Input
            id="c-code"
            className="h-10 font-mono"
            aria-invalid={!!errors.code}
            {...form.register('code')}
          />
        </FormField>
        <FormField id="c-title" label="Intitulé" error={errors.title?.message} required>
          <Input id="c-title" className="h-10" aria-invalid={!!errors.title} {...form.register('title')} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Déplacement ─────────

function MoveNodeDialog({ node, onClose }: { node: NodeDetail; onClose: () => void }) {
  const [target, setTarget] = useState(node.parentId ?? '');
  const move = useSettingsMutation((parentId: string) => settingsApi.moveNode(node.id, parentId), {
    success: 'Nœud déplacé : ses sous-nœuds et documents ont suivi',
    invalidate: PLAN_KEYS,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Déplacer « ${node.title} »`}
      description="Tout le sous-arbre et ses documents suivent. Le chemin avant et après est inscrit au journal."
    >
      <FormField id="m-target" label="Nouveau parent" required>
        <NodeSelect
          id="m-target"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
        />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button
          disabled={move.isPending || !target || target === node.parentId}
          onClick={() => {
            move.mutate(target, {
              onSuccess: onClose,
              onError: notifyError,
            });
          }}
        >
          Déplacer
        </Button>
      </div>
    </Dialog>
  );
}
