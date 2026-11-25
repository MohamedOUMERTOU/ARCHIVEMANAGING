import { Archive, HandHelping } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { FormField } from '@/components/shared/FormField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { notifyError } from '@/lib/forms';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/utils/format';
import { physicalApi } from '../api/physical.api';
import { usePhysicalMutation } from '../hooks/usePhysical';
import { LoanDialog } from './LoanDialog';
import { LocationSelect } from './LocationSelect';

interface OriginalCardProps {
  documentId: string;
  documentTitle: string;
  location: { id: string; code: string; label: string; path: string } | null;
  openLoan: { id: string; borrower: string; dueAt: string; viaBox: boolean } | null;
}

/** Bloc « Original papier » de la fiche document : où il est rangé, s'il est sorti, et les actions. */
export function OriginalCard({ documentId, documentTitle, location, openLoan }: OriginalCardProps) {
  const user = useAuthStore((s) => s.user);
  const canPlace = hasPermission(user, 'physical.manage') || hasPermission(user, 'documents.write');
  const canLend = hasPermission(user, 'physical.manage');
  const [dialog, setDialog] = useState<'place' | 'loan' | null>(null);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Archive aria-hidden="true" className="text-muted size-4" />
        <CardTitle className="flex-1">Original papier</CardTitle>
        {canPlace && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDialog('place');
            }}
          >
            {location ? 'Déplacer' : 'Ranger'}
          </Button>
        )}
        {canLend && location && !openLoan && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDialog('loan');
            }}
          >
            <HandHelping aria-hidden="true" /> Prêter
          </Button>
        )}
      </div>
      {location ? (
        <Link
          to={`/archives-physiques/emplacements?loc=${location.id}`}
          className="text-ink flex flex-wrap items-center gap-1.5 text-[13px] no-underline"
        >
          {location.path.split(' › ').map((part, i, all) => (
            <span key={`${part}-${String(i)}`} className="flex items-center gap-1.5">
              <span
                className={
                  i === all.length - 1
                    ? 'bg-primary-soft text-primary-strong rounded-md px-2 py-0.5 font-semibold'
                    : 'bg-bg rounded-md px-2 py-0.5'
                }
              >
                {part}
              </span>
              {i < all.length - 1 && (
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              )}
            </span>
          ))}
        </Link>
      ) : (
        <p className="text-muted text-[13px]">
          Aucun original papier rangé : document numérique uniquement, ou pas encore rangé.
        </p>
      )}
      {openLoan && (
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone="warning">En prêt</Badge>
          {openLoan.viaBox ? 'Sa boîte est prêtée' : 'Prêté'} à {openLoan.borrower} · retour prévu le{' '}
          {formatDate(openLoan.dueAt)}
        </p>
      )}

      {dialog === 'place' && (
        <PlaceDialog
          documentId={documentId}
          current={location?.id ?? null}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {dialog === 'loan' && (
        <LoanDialog
          documentId={documentId}
          documentTitle={documentTitle}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </Card>
  );
}

function PlaceDialog({
  documentId,
  current,
  onClose,
}: {
  documentId: string;
  current: string | null;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(current ?? '');
  const place = usePhysicalMutation(
    (locationId: string | null) => physicalApi.placeDocument(documentId, locationId),
    'Emplacement de l’original enregistré',
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={current ? "Déplacer l'original" : "Ranger l'original"}
      description="Seuls les niveaux qui reçoivent des documents (boîtes…) sont proposés. Le changement est inscrit dans l'historique."
    >
      <FormField id="pl-box" label="Boîte" required>
        <LocationSelect
          id="pl-box"
          holdOnly
          emptyLabel="Choisissez une boîte…"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
        />
      </FormField>
      <div className="flex flex-wrap justify-between gap-2">
        {current ? (
          <Button
            variant="ghost"
            disabled={place.isPending}
            onClick={() => {
              place.mutate(null, { onSuccess: onClose, onError: notifyError });
            }}
          >
            Retirer de son emplacement
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!target || target === current || place.isPending}
            onClick={() => {
              place.mutate(target, { onSuccess: onClose, onError: notifyError });
            }}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
