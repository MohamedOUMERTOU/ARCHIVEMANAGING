import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}

/** Confirmation d'une action irréversible (suppression, fusion…). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  onConfirm,
  pending,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={message}>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Annuler
        </Button>
        <Button variant="danger" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
