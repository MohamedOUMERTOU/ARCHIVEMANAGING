import { Flame, Lock } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { FormField } from '@/components/shared/FormField';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/services/api/errors';
import { notifyError } from '@/lib/forms';
import { formatSize } from '@/utils/format';
import { lifecycleApi, type ListDetail, type ListKind } from '../api/lifecycle.api';
import { useHolds, useLifecycleMutation, useLists } from '../hooks/useLifecycle';
import { LIST_KIND } from '../utils/labels';

/** Message d'un champ renvoyé par le serveur, à défaut le message général. */
const fieldError = (err: unknown, field: string) =>
  err instanceof ApiError ? (err.fieldErrors[field] ?? undefined) : undefined;

// ───────── Motif obligatoire (refus, annulation, levée de gel…) ─────────

export function ReasonDialog({
  open,
  title,
  description,
  label = 'Motif',
  confirmLabel,
  danger = false,
  required = true,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  confirmLabel: string;
  danger?: boolean;
  required?: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={title}
      description={description}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
          e.preventDefault();
          if (required && !value.trim()) {
            setError('Ce champ est obligatoire');
            return;
          }
          onConfirm(value.trim());
        }}
      >
        <FormField id="lc-reason" label={label} error={error} required={required}>
          <Textarea
            id="lc-reason"
            rows={3}
            value={value}
            aria-invalid={!!error}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Nouveau bordereau, ou ajout à un brouillon ─────────

export function CreateListDialog({
  kind,
  documentIds,
  onClose,
}: {
  kind: ListKind;
  documentIds: string[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const drafts = useLists('open').data?.filter((l) => l.kind === kind && l.status === 'BROUILLON') ?? [];
  const [target, setTarget] = useState('new');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useLifecycleMutation(
    (): Promise<ListDetail> =>
      target === 'new'
        ? lifecycleApi.createList({
            kind,
            title,
            destination: destination || null,
            notes: notes || null,
            documentIds,
          })
        : lifecycleApi.addToList(target, documentIds),
    target === 'new' ? 'Bordereau créé' : 'Documents ajoutés au bordereau',
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Bordereau de ${LIST_KIND[kind].toLowerCase()}`}
      description={`${String(documentIds.length)} document(s) sélectionné(s). Le bordereau reste en brouillon tant que vous ne le soumettez pas au visa.`}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
          e.preventDefault();
          const next: Record<string, string | undefined> = {};
          if (target === 'new' && !title.trim()) next.title = 'Donnez un intitulé au bordereau';
          if (target === 'new' && kind === 'VERSEMENT' && !destination.trim()) {
            next.destination = "Indiquez le service d'archives destinataire";
          }
          setErrors(next);
          if (Object.keys(next).length) return;
          save.mutate(undefined, {
            onSuccess: (d) => {
              onClose();
              void navigate(`/cycle-de-vie/bordereaux/${d.list.id}`);
            },
            onError: (err) => {
              const title = fieldError(err, 'title');
              const dest = fieldError(err, 'destination');
              if (title || dest) setErrors({ title, destination: dest });
              else notifyError(err);
            },
          });
        }}
      >
        {drafts.length > 0 && (
          <FormField id="lc-target" label="Ajouter à">
            <Select
              id="lc-target"
              className="h-10"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
              }}
            >
              <option value="new">Un nouveau bordereau</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.number} · {d.title} (brouillon, {d.documentCount} doc.)
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {target === 'new' && (
          <>
            <FormField id="lc-title" label="Intitulé" error={errors.title} required>
              <Input
                id="lc-title"
                className="h-10"
                value={title}
                aria-invalid={!!errors.title}
                placeholder={
                  kind === 'ELIMINATION'
                    ? 'Ex. Contrats de prestations échus 2016-2018'
                    : 'Ex. Dossiers du personnel sortis avant 2018'
                }
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
              />
            </FormField>
            {kind === 'VERSEMENT' && (
              <FormField
                id="lc-dest"
                label="Service d'archives destinataire"
                error={errors.destination}
                required
              >
                <Input
                  id="lc-dest"
                  className="h-10"
                  value={destination}
                  aria-invalid={!!errors.destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                  }}
                />
              </FormField>
            )}
            <FormField
              id="lc-notes"
              label="Observations"
              hint="Reprises sur le bordereau et le procès-verbal"
            >
              <Textarea
                id="lc-notes"
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                }}
              />
            </FormField>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {target === 'new' ? 'Créer le bordereau' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Placer sous gel juridique ─────────

export function HoldPickerDialog({ documentIds, onClose }: { documentIds: string[]; onClose: () => void }) {
  const holds = useHolds().data;
  // Sans document : création d'un gel vide, qu'on remplira depuis l'échéancier ou la fiche document
  const active = documentIds.length === 0 ? [] : (holds?.filter((h) => !h.releasedAt) ?? []);
  const [target, setTarget] = useState('new');
  const [name, setName] = useState('');
  const [caseRef, setCaseRef] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useLifecycleMutation(
    () =>
      target === 'new'
        ? lifecycleApi.createHold({ name, caseReference: caseRef || null, reason, documentIds })
        : lifecycleApi.addToHold(target, documentIds),
    'Gel juridique posé',
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={documentIds.length === 0 ? 'Nouveau gel juridique' : 'Placer sous gel juridique'}
      description={
        documentIds.length === 0
          ? "Ajoutez ensuite les documents concernés depuis l'échéancier ou la fiche d'un document."
          : `${String(documentIds.length)} document(s). Tant que le gel est actif, ils ne peuvent être ni modifiés, ni reclassés, ni éliminés, ni versés.`
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
          e.preventDefault();
          const next: Record<string, string | undefined> = {};
          if (target === 'new' && !name.trim()) next.name = "Nommez l'affaire concernée";
          if (target === 'new' && !reason.trim()) next.reason = 'Indiquez le motif du gel';
          setErrors(next);
          if (Object.keys(next).length) return;
          save.mutate(undefined, { onSuccess: onClose, onError: notifyError });
        }}
      >
        {active.length > 0 && (
          <FormField id="hold-target" label="Gel">
            <Select
              id="hold-target"
              className="h-10"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
              }}
            >
              <option value="new">Nouveau gel</option>
              {active.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.caseReference ? ` · ${h.caseReference}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {target === 'new' && (
          <>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <FormField id="hold-name" label="Affaire" error={errors.name} required>
                <Input
                  id="hold-name"
                  className="h-10"
                  value={name}
                  aria-invalid={!!errors.name}
                  placeholder="Ex. Litige fournisseur d'énergie"
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                />
              </FormField>
              <FormField id="hold-case" label="Référence">
                <Input
                  id="hold-case"
                  className="h-10 font-mono"
                  value={caseRef}
                  placeholder="N° de dossier"
                  onChange={(e) => {
                    setCaseRef(e.target.value);
                  }}
                />
              </FormField>
            </div>
            <FormField id="hold-reason" label="Motif" error={errors.reason} required>
              <Textarea
                id="hold-reason"
                rows={3}
                value={reason}
                aria-invalid={!!errors.reason}
                onChange={(e) => {
                  setReason(e.target.value);
                }}
              />
            </FormField>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="danger" disabled={save.isPending}>
            <Lock aria-hidden="true" /> {documentIds.length === 0 ? 'Créer le gel' : 'Placer sous gel'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Exécution d'un bordereau visé ─────────

export function ExecuteDialog({ detail, onClose }: { detail: ListDetail; onClose: () => void }) {
  const { list, items } = detail;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const run = useLifecycleMutation(
    () => lifecycleApi.execute(list.id, value),
    list.kind === 'ELIMINATION' ? 'Élimination exécutée' : 'Versement exécuté',
  );
  const elimination = list.kind === 'ELIMINATION';
  const papers = items.filter((i) => i.paperLocation);
  const files = items.reduce((n, i) => n + i.versionCount, 0);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Exécuter le bordereau ${list.number}`}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
          e.preventDefault();
          if (value.trim() !== list.number) {
            setError(`Saisissez ${list.number}`);
            return;
          }
          run.mutate(undefined, {
            onSuccess: onClose,
            onError: (err) => {
              const f = fieldError(err, 'confirmNumber');
              if (f) setError(f);
              else notifyError(err);
            },
          });
        }}
      >
        {elimination ? (
          <div className="bg-danger-soft text-danger flex gap-3 rounded-lg px-4 py-3 text-sm">
            <Flame aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <strong>Destruction définitive, sans retour possible.</strong>
              <span>
                {items.length} document(s) · {files} fichier(s) · {formatSize(list.bytes)}. Toutes les
                versions sont détruites du stockage. Les notices, l'historique et ce bordereau sont conservés
                comme preuve.
              </span>
            </div>
          </div>
        ) : (
          <p className="bg-primary-soft text-primary-strong rounded-lg px-4 py-3 text-sm">
            {items.length} document(s) passent au statut « versé » à destination de {list.destination}.
            Remettez d'abord le paquet de versement au service d'archives.
          </p>
        )}
        {papers.length > 0 && (
          <div className="text-[13px]">
            <p className="font-medium">
              Originaux papier à {elimination ? 'détruire physiquement' : 'remettre'} ({papers.length}) :
            </p>
            <ul className="text-muted mt-1 list-disc pl-5">
              {papers.slice(0, 8).map((p) => (
                <li key={p.documentId}>
                  {p.reference} — {p.paperLocation}
                </li>
              ))}
              {papers.length > 8 && <li>et {papers.length - 8} autre(s), voir le bordereau</li>}
            </ul>
          </div>
        )}
        <FormField
          id="lc-confirm"
          label={`Pour confirmer, recopiez le numéro ${list.number}`}
          error={error}
          required
        >
          <Input
            id="lc-confirm"
            className="h-10 font-mono"
            autoComplete="off"
            value={value}
            aria-invalid={!!error}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant={elimination ? 'danger' : 'primary'} disabled={run.isPending}>
            {elimination ? 'Détruire définitivement' : 'Enregistrer le versement'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
