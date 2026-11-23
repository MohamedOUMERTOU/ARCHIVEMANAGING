import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/shared/FormField';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { applyServerErrors } from '@/lib/forms';
import { physicalApi } from '../api/physical.api';
import { usePhysicalMutation } from '../hooks/usePhysical';
import { LocationSelect } from './LocationSelect';

const today = () => format(new Date(), 'yyyy-MM-dd');

const schema = z.object({
  locationId: z.string(),
  borrower: z.string().trim().min(1, { error: "Indiquez l'emprunteur" }).max(255),
  kind: z.enum(['PRET', 'CONSULTATION']),
  reason: z.string().max(500),
  dueAt: z.string().refine((v) => v >= today(), { error: 'Date de retour à venir' }),
});
type LoanForm = z.infer<typeof schema>;

interface LoanDialogProps {
  onClose: () => void;
  /** Boîte ou emplacement prêté ; si absent, on le choisit dans la liste */
  locationId?: string;
  locationLabel?: string;
  /** Prêt d'un document seul (au lieu d'une boîte) */
  documentId?: string;
  documentTitle?: string;
}

export function LoanDialog({
  onClose,
  locationId,
  locationLabel,
  documentId,
  documentTitle,
}: LoanDialogProps) {
  const form = useForm<LoanForm>({
    resolver: zodResolver(
      documentId
        ? schema
        : schema.extend({ locationId: z.string().min(1, { error: 'Choisissez ce qui est prêté' }) }),
    ),
    defaultValues: {
      locationId: locationId ?? '',
      borrower: '',
      kind: 'PRET',
      reason: '',
      dueAt: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    },
  });
  const create = usePhysicalMutation(
    (v: LoanForm) =>
      physicalApi.createLoan({
        locationId: documentId ? null : v.locationId,
        documentId: documentId ?? null,
        borrower: v.borrower,
        kind: v.kind,
        reason: v.reason || null,
        dueAt: v.dueAt,
      }),
    'Sortie enregistrée : laissez une fiche fantôme à la place',
  );
  const errors = form.formState.errors;
  const target = documentTitle ?? locationLabel;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={target ? `Prêter « ${target} »` : 'Nouveau prêt'}
      description="La sortie est inscrite dans l'historique de chaque document concerné."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            create.mutate(v, {
              onSuccess: onClose,
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
      >
        {!documentId && !locationId && (
          <FormField
            id="l-loc"
            label="Boîte ou emplacement prêté"
            error={errors.locationId?.message}
            required
          >
            <LocationSelect id="l-loc" emptyLabel="Choisissez…" {...form.register('locationId')} />
          </FormField>
        )}
        <FormField
          id="l-who"
          label="Emprunteur"
          error={errors.borrower?.message}
          hint="Personne ou service"
          required
        >
          <Input
            id="l-who"
            className="h-10"
            aria-invalid={!!errors.borrower}
            {...form.register('borrower')}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="l-kind" label="Type">
            <Select id="l-kind" {...form.register('kind')}>
              <option value="PRET">Prêt</option>
              <option value="CONSULTATION">Consultation sur place</option>
            </Select>
          </FormField>
          <FormField id="l-due" label="Retour prévu" error={errors.dueAt?.message} required>
            <Input id="l-due" type="date" min={today()} className="h-10" {...form.register('dueAt')} />
          </FormField>
        </div>
        <FormField id="l-why" label="Motif">
          <Input
            id="l-why"
            className="h-10"
            placeholder="Audit, contrôle, consultation…"
            {...form.register('reason')}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Enregistrer la sortie
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
