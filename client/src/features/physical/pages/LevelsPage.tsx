import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { physicalApi, type Level } from '../api/physical.api';
import { useLevels, usePhysicalMutation } from '../hooks/usePhysical';
import { LEVEL_ICON_KEYS, LEVEL_ICONS, levelIcon } from '../utils/level-icons';
import { cn } from '@/lib/cn';

export default function LevelsPage() {
  const levels = useLevels();
  const canManage = hasPermission(
    useAuthStore((s) => s.user),
    'physical.manage',
  );
  const [editing, setEditing] = useState<Level | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Level | null>(null);
  const setChildren = usePhysicalMutation(
    ({ id, children }: { id: string; children: string[] }) => physicalApi.setChildren(id, children),
    'Règle mise à jour',
  );
  const remove = usePhysicalMutation((id: string) => physicalApi.deleteLevel(id), 'Niveau supprimé');

  if (levels.isPending) return <LoadingState />;
  if (levels.isError) return <ErrorState error={levels.error} onRetry={() => void levels.refetch()} />;
  const list = levels.data;

  const toggle = (parent: Level, child: Level) => {
    const has = parent.childLevelIds.includes(child.id);
    const children = has
      ? parent.childLevelIds.filter((c) => c !== child.id)
      : [...parent.childLevelIds, child.id];
    setChildren.mutate({ id: parent.id, children }, { onError: notifyError });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <CardTitle>Qui peut contenir quoi</CardTitle>
            <p className="text-muted text-[13px]">
              Chaque ligne est un niveau parent : cochez les niveaux qu'il peut contenir. Votre société
              construit ainsi son propre arbre.
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setEditing('new');
              }}
            >
              <Plus aria-hidden="true" /> Nouveau niveau
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <EmptyState
            title="Aucun niveau."
            hint="Commencez par un niveau racine (bâtiment, site…) puis un niveau qui reçoit les documents (boîte, carton…)."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <caption className="sr-only">Niveaux qu'un niveau parent peut contenir</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-line text-muted border-b px-3 py-2 text-left text-xs font-semibold"
                  >
                    Parent ↓ · Enfant →
                  </th>
                  {list.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      className="border-line border-b px-3 py-2 text-xs font-semibold whitespace-nowrap"
                    >
                      <span className="flex flex-col items-center gap-1">
                        <LevelChip level={c} />
                        {c.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <th
                      scope="row"
                      className="border-line/60 border-r border-b px-3 py-2 text-left font-semibold whitespace-nowrap"
                    >
                      <span className="flex items-center gap-2">
                        <LevelChip level={p} />
                        {p.name}
                        {p.isRoot && <Badge tone="info">racine</Badge>}
                        {p.canHoldDocuments && <Badge tone="success">documents</Badge>}
                        {canManage && (
                          <button
                            type="button"
                            aria-label={`Modifier le niveau ${p.name}`}
                            className="text-muted hover:text-ink ml-auto"
                            onClick={() => {
                              setEditing(p);
                            }}
                          >
                            <Pencil aria-hidden="true" className="size-3.5" />
                          </button>
                        )}
                      </span>
                    </th>
                    {list.map((c) => (
                      <td key={c.id} className="border-line/60 border-b px-3 py-2 text-center">
                        {c.id === p.id ? (
                          <span aria-hidden="true" className="text-line-strong">
                            ·
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            aria-label={`${p.name} peut contenir ${c.name}`}
                            className="accent-primary size-4"
                            checked={p.childLevelIds.includes(c.id)}
                            disabled={!canManage || setChildren.isPending}
                            onChange={() => {
                              toggle(p, c);
                            }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted text-xs">
          Le serveur refuse un choix qui créerait une boucle, ou qui rendrait invalides des emplacements
          existants.
        </p>
      </Card>

      {editing && (
        <LevelDialog
          level={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
          onDelete={(l) => {
            setEditing(null);
            setDeleting(l);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`Supprimer le niveau « ${deleting?.name ?? ''} » ?`}
        message="Possible seulement si aucun emplacement ne l'utilise."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting)
            remove.mutate(deleting.id, {
              onSettled: () => {
                setDeleting(null);
              },
              onError: notifyError,
            });
        }}
      />
    </div>
  );
}

function LevelChip({ level }: { level: Level }) {
  const { icon: Icon, chip } = levelIcon(level.icon, level.canHoldDocuments);
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', chip)}
    >
      <Icon className="size-3.5" />
    </span>
  );
}

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/, { error: 'Lettres, chiffres et _ (ex. BOITE)' }),
    name: z.string().trim().min(1, { error: 'Saisissez un nom' }).max(120),
    isRoot: z.boolean(),
    canHoldDocuments: z.boolean(),
    capacity: z.string(),
    icon: z.string(),
  })
  .superRefine((v, ctx) => {
    const n = Number(v.capacity);
    if (v.canHoldDocuments && v.capacity !== '' && (!Number.isInteger(n) || n < 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['capacity'],
        message: 'Nombre entier positif, ou vide pour sans limite',
      });
    }
  });
type LevelForm = z.infer<typeof schema>;

function LevelDialog({
  level,
  onClose,
  onDelete,
}: {
  level: Level | null;
  onClose: () => void;
  onDelete: (l: Level) => void;
}) {
  const form = useForm<LevelForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: level?.code ?? '',
      name: level?.name ?? '',
      isRoot: level?.isRoot ?? false,
      canHoldDocuments: level?.canHoldDocuments ?? false,
      capacity: level?.capacity ? String(level.capacity) : '',
      icon: level?.icon ?? '',
    },
  });
  const icon = useWatch({ control: form.control, name: 'icon' });
  const hold = useWatch({ control: form.control, name: 'canHoldDocuments' });
  const save = usePhysicalMutation((v: LevelForm) => {
    const input = {
      code: v.code.toUpperCase(),
      name: v.name,
      isRoot: v.isRoot,
      canHoldDocuments: v.canHoldDocuments,
      capacity: v.canHoldDocuments && v.capacity ? Number(v.capacity) : null,
      icon: v.icon || null,
    };
    return level ? physicalApi.updateLevel(level.id, input) : physicalApi.createLevel(input);
  }, 'Niveau enregistré');
  const errors = form.formState.errors;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={level ? `Niveau « ${level.name} »` : 'Nouveau niveau'}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            save.mutate(v, {
              onSuccess: onClose,
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField id="lv-name" label="Nom" error={errors.name?.message} required>
            <Input id="lv-name" className="h-10" aria-invalid={!!errors.name} {...form.register('name')} />
          </FormField>
          <FormField id="lv-code" label="Code" error={errors.code?.message} required>
            <Input
              id="lv-code"
              className="h-10 font-mono uppercase"
              aria-invalid={!!errors.code}
              {...form.register('code')}
            />
          </FormField>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Icône dans l'arbre</legend>
          <div className="grid grid-cols-6 gap-1.5">
            {LEVEL_ICON_KEYS.map((key) => {
              const { icon: Icon, label, chip } = LEVEL_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={icon === key}
                  title={label}
                  onClick={() => {
                    form.setValue('icon', key, { shouldDirty: true });
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px]',
                    icon === key
                      ? 'border-primary bg-primary-soft/50 font-semibold'
                      : 'border-line text-ink-soft hover:bg-bg',
                  )}
                >
                  <span className={cn('flex size-7 items-center justify-center rounded-md', chip)}>
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          {!icon && (
            <p className="text-muted text-xs">
              Sans choix, l'icône est déduite du code (BOITE, SALLE, ARMOIRE…).
            </p>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary size-4" {...form.register('isRoot')} />
          Peut être en haut de l'arbre (bâtiment, site…)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary size-4" {...form.register('canHoldDocuments')} />
          Reçoit des documents (boîte, carton, classeur…)
        </label>
        {hold && (
          <FormField
            id="lv-cap"
            label="Capacité (documents)"
            error={errors.capacity?.message}
            hint="Vide : sans limite"
          >
            <Input id="lv-cap" type="number" min={1} className="h-10" {...form.register('capacity')} />
          </FormField>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          {level ? (
            <Button
              variant="danger"
              disabled={level.locationCount > 0}
              title={
                level.locationCount > 0
                  ? `${String(level.locationCount)} emplacement(s) l'utilisent`
                  : undefined
              }
              onClick={() => {
                onDelete(level);
              }}
            >
              <Trash2 aria-hidden="true" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
