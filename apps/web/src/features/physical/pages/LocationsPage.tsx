import { zodResolver } from '@hookform/resolvers/zod';
import { HandHelping, MoveRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DocumentTable, useDocumentSearch } from '@/features/documents';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/utils/format';
import { physicalApi, type Level, type LocationDetail } from '../api/physical.api';
import { LoanDialog } from '../components/LoanDialog';
import { LocationSelect } from '../components/LocationSelect';
import { LocationTree } from '../components/LocationTree';
import { OccupancyBar } from '../components/OccupancyBar';
import { useLevels, useLocationDetail, useLocationTree, usePhysicalMutation } from '../hooks/usePhysical';

type DialogState =
  | { kind: 'create'; parent: LocationDetail | null }
  | { kind: 'edit' | 'move' | 'loan' | 'delete'; detail: LocationDetail }
  | null;

export default function LocationsPage() {
  const [params] = useSearchParams();
  const selectedId = params.get('loc');
  const canManage = hasPermission(
    useAuthStore((s) => s.user),
    'physical.manage',
  );
  const { tree, selectedPath, isPending, isError, error, refetch } = useLocationTree(selectedId);
  const levels = useLevels();
  const [dialog, setDialog] = useState<DialogState>(null);
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
  const close = () => {
    setDialog(null);
  };
  const rootLevels = levels.data?.filter((l) => l.isRoot) ?? [];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex w-full max-w-md flex-[1_1_340px] flex-col gap-3 p-3">
        <div className="flex items-center gap-2 px-2 pt-1">
          <CardTitle className="flex-1">Arbre des emplacements</CardTitle>
          {canManage && rootLevels.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setDialog({ kind: 'create', parent: null });
              }}
            >
              <Plus aria-hidden="true" /> {rootLevels[0]?.name ?? 'Emplacement'}
            </Button>
          )}
        </div>
        {isPending ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : tree.length === 0 ? (
          <EmptyState
            title="Aucun emplacement."
            hint={
              rootLevels.length
                ? 'Créez votre premier bâtiment ou site.'
                : 'Définissez d’abord vos niveaux dans l’onglet « Niveaux ».'
            }
          />
        ) : (
          <LocationTree nodes={tree} selectedId={selectedId} expanded={expanded} onToggle={toggle} />
        )}
      </Card>

      <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
        {selectedId ? (
          <LocationPanel
            key={selectedId}
            id={selectedId}
            canManage={canManage}
            levels={levels.data ?? []}
            onAction={setDialog}
          />
        ) : (
          <EmptyState title="Choisissez un emplacement dans l'arbre." />
        )}
      </section>

      {dialog?.kind === 'create' && (
        <LocationFormDialog parent={dialog.parent} levels={levels.data ?? []} onClose={close} />
      )}
      {dialog?.kind === 'edit' && (
        <LocationFormDialog edit={dialog.detail} levels={levels.data ?? []} onClose={close} />
      )}
      {dialog?.kind === 'move' && <MoveDialog detail={dialog.detail} onClose={close} />}
      {dialog?.kind === 'loan' && (
        <LoanDialog
          locationId={dialog.detail.location.id}
          locationLabel={dialog.detail.location.label}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete' && <DeleteDialog detail={dialog.detail} onClose={close} />}
    </div>
  );
}

function LocationPanel({
  id,
  canManage,
  levels,
  onAction,
}: {
  id: string;
  canManage: boolean;
  levels: Level[];
  onAction: (d: DialogState) => void;
}) {
  const detail = useLocationDetail(id);
  const docs = useDocumentSearch({ locationId: id, size: 50, sort: 'reference' });

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) return <ErrorState error={detail.error} />;
  const d = detail.data;
  const loc = d.location;
  const canAddChild = d.allowedChildLevelIds.length > 0 && levels.length > 0;

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-muted text-[13px]">{d.path}</p>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{loc.label}</CardTitle>
              <Badge>{loc.levelName}</Badge>
              {!loc.active && <Badge tone="neutral">Désactivé</Badge>}
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {canAddChild && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onAction({ kind: 'create', parent: d });
                  }}
                >
                  <Plus aria-hidden="true" /> Ajouter
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onAction({ kind: 'edit', detail: d });
                }}
              >
                <Pencil aria-hidden="true" /> Modifier
              </Button>
              {loc.parentId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onAction({ kind: 'move', detail: d });
                  }}
                >
                  <MoveRight aria-hidden="true" /> Déplacer
                </Button>
              )}
              {!d.openLoan && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onAction({ kind: 'loan', detail: d });
                  }}
                >
                  <HandHelping aria-hidden="true" /> Prêter
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onAction({ kind: 'delete', detail: d });
                }}
              >
                <Trash2 aria-hidden="true" />
                <span className="sr-only">Supprimer</span>
              </Button>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2.5">
          <dt className="text-muted">Code</dt>
          <dd className="font-mono">{loc.code}</dd>
          <dt className="text-muted">Code-barres</dt>
          <dd className="font-mono">{loc.barcode ?? '—'}</dd>
          <dt className="text-muted">Contenu</dt>
          <dd>
            {loc.childCount} emplacement(s) · {loc.documentCount} document(s) rangé(s) ici
          </dd>
          {loc.canHoldDocuments && (
            <>
              <dt className="text-muted">Occupation</dt>
              <dd>
                <OccupancyBar count={loc.documentCount} capacity={loc.capacity} />
              </dd>
            </>
          )}
        </dl>

        {d.openLoan && (
          <div className="border-warning/30 bg-warning-soft text-warning rounded-lg border px-4 py-3 text-[13px]">
            <strong>En prêt</strong> à {d.openLoan.borrower} · retour prévu le {formatDate(d.openLoan.dueAt)}
            {d.openLoan.overdue && <strong> · en retard</strong>}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <CardTitle>Documents dans cet emplacement et ce qu'il contient</CardTitle>
        {docs.isPending ? (
          <LoadingState rows={3} />
        ) : docs.isError ? (
          <ErrorState error={docs.error} />
        ) : docs.data.totalElements === 0 ? (
          <EmptyState
            title="Aucun original rangé ici."
            hint="On range un document depuis sa fiche : onglet « Métadonnées & versions », bloc « Original papier »."
          />
        ) : (
          <DocumentTable data={docs.data.content} caption="Documents rangés" />
        )}
      </div>
    </>
  );
}

// ───────── Création et modification ─────────

const locationSchema = z.object({
  levelId: z.string().min(1, { error: 'Choisissez un niveau' }),
  code: z.string().trim().min(1, { error: 'Saisissez un code' }).max(80),
  label: z.string().trim().min(1, { error: 'Saisissez un libellé' }).max(255),
  barcode: z.string().max(80),
  active: z.boolean(),
});
type LocationForm = z.infer<typeof locationSchema>;

function LocationFormDialog({
  parent,
  edit,
  levels,
  onClose,
}: {
  parent?: LocationDetail | null;
  edit?: LocationDetail;
  levels: Level[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  // Niveaux proposés : ceux que le parent accepte (ou les niveaux racine en haut de l'arbre)
  const allowed = edit
    ? levels.filter((l) => l.id === edit.location.levelId)
    : parent
      ? levels.filter((l) => parent.allowedChildLevelIds.includes(l.id))
      : levels.filter((l) => l.isRoot);
  const form = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      levelId: edit?.location.levelId ?? allowed[0]?.id ?? '',
      code: edit?.location.code ?? '',
      label: edit?.location.label ?? '',
      barcode: edit?.location.barcode ?? '',
      active: edit?.location.active ?? true,
    },
  });
  const save = usePhysicalMutation(
    (v: LocationForm) =>
      edit
        ? physicalApi.updateLocation(edit.location.id, {
            code: v.code,
            label: v.label,
            barcode: v.barcode || null,
            active: v.active,
          })
        : physicalApi.createLocation({
            parentId: parent?.location.id ?? null,
            levelId: v.levelId,
            code: v.code,
            label: v.label,
            barcode: v.barcode || null,
          }),
    edit ? 'Emplacement enregistré' : 'Emplacement créé',
  );
  const errors = form.formState.errors;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={
        edit
          ? `Modifier « ${edit.location.label} »`
          : parent
            ? `Nouvel emplacement dans « ${parent.location.label} »`
            : 'Nouvel emplacement racine'
      }
      description={parent ? parent.path : undefined}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            save.mutate(v, {
              onSuccess: (r) => {
                onClose();
                void navigate(`?loc=${r.location.id}`);
              },
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
      >
        <FormField id="lf-level" label="Niveau" error={errors.levelId?.message} required>
          <Select id="lf-level" disabled={!!edit} {...form.register('levelId')}>
            {allowed.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.canHoldDocuments ? ' · reçoit des documents' : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="lf-code"
            label="Code"
            error={errors.code?.message}
            hint="Unique dans la société"
            required
          >
            <Input
              id="lf-code"
              className="h-10 font-mono"
              aria-invalid={!!errors.code}
              {...form.register('code')}
            />
          </FormField>
          <FormField id="lf-barcode" label="Code-barres" error={errors.barcode?.message}>
            <Input id="lf-barcode" className="h-10 font-mono" {...form.register('barcode')} />
          </FormField>
        </div>
        <FormField id="lf-label" label="Libellé" error={errors.label?.message} required>
          <Input id="lf-label" className="h-10" aria-invalid={!!errors.label} {...form.register('label')} />
        </FormField>
        {edit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary size-4" {...form.register('active')} />
            Emplacement actif (un emplacement inactif ne reçoit plus de documents)
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending || allowed.length === 0}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function MoveDialog({ detail, onClose }: { detail: LocationDetail; onClose: () => void }) {
  const [target, setTarget] = useState(detail.location.parentId ?? '');
  const move = usePhysicalMutation(
    (parentId: string) => physicalApi.moveLocation(detail.location.id, parentId),
    'Déplacé : le chemin de tout son contenu a été mis à jour',
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Déplacer « ${detail.location.label} »`}
      description={`Tout son contenu suit (${String(detail.location.childCount)} emplacement(s), ${String(detail.location.documentCount)} document(s) rangés directement). L'ancien et le nouveau chemin sont inscrits au journal et dans l'historique de chaque document.`}
    >
      <FormField id="mv-target" label="Nouvel emplacement parent" required>
        <LocationSelect
          id="mv-target"
          value={target}
          excludeId={detail.location.id}
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
          disabled={!target || target === detail.location.parentId || move.isPending}
          onClick={() => {
            move.mutate(target, { onSuccess: onClose, onError: notifyError });
          }}
        >
          Déplacer
        </Button>
      </div>
    </Dialog>
  );
}

function DeleteDialog({ detail, onClose }: { detail: LocationDetail; onClose: () => void }) {
  const navigate = useNavigate();
  const remove = usePhysicalMutation(
    () => physicalApi.deleteLocation(detail.location.id),
    'Emplacement supprimé',
  );
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Supprimer « ${detail.location.label} » ?`}
      message="Seul un emplacement vide et jamais prêté peut être supprimé ; sinon, désactivez-le."
      confirmLabel="Supprimer"
      pending={remove.isPending}
      onConfirm={() => {
        remove.mutate(undefined, {
          onSuccess: () => {
            onClose();
            void navigate('?', { replace: true });
          },
          onError: (err) => {
            notifyError(err);
            onClose();
          },
        });
      }}
    />
  );
}
