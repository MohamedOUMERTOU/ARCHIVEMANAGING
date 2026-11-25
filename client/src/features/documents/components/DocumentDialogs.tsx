import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FormField } from '@/components/shared/FormField';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAddVersion, useDocumentRequest, useReclassify } from '../hooks/useDocuments';
import type { RequestKind } from '../types';
import { NodeSelect } from './NodeSelect';

interface DialogBaseProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ───────── Nouvelle version ─────────

export function NewVersionDialog({ documentId, open, onOpenChange }: DialogBaseProps) {
  const { t } = useTranslation();
  const mutation = useAddVersion(documentId);
  const schema = z.object({
    file: z.instanceof(FileList).refine((f) => f.length === 1, { error: t('doc.fileRequired') }),
    reason: z
      .string()
      .trim()
      .min(1, { error: t('doc.reasonRequired') }),
  });
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const submit = handleSubmit((v) => {
    const file = v.file.item(0);
    if (!file) return;
    mutation.mutate(
      { file, reason: v.reason },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('doc.newVersion')}
      description={t('doc.newVersionHelp')}
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <FormField id="nv-file" label={t('doc.file')} error={formState.errors.file?.message} required>
          <Input
            id="nv-file"
            type="file"
            className="h-auto py-2"
            aria-invalid={!!formState.errors.file}
            {...register('file')}
          />
        </FormField>
        <FormField id="nv-reason" label={t('doc.reason')} error={formState.errors.reason?.message} required>
          <Textarea id="nv-reason" aria-invalid={!!formState.errors.reason} {...register('reason')} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Demande de copie ou d'original ─────────

const KINDS: RequestKind[] = ['COPIE_SIMPLE', 'COPIE_CERTIFIEE', 'ORIGINAL'];

export function RequestDialog({
  documentId,
  open,
  onOpenChange,
  canRequestOriginal,
}: DialogBaseProps & { canRequestOriginal: boolean }) {
  const { t } = useTranslation();
  const mutation = useDocumentRequest(documentId);
  const schema = z.object({
    kind: z.enum(['COPIE_SIMPLE', 'COPIE_CERTIFIEE', 'ORIGINAL']),
    onBehalfOf: z.string().trim().max(255),
    reason: z
      .string()
      .trim()
      .min(1, { error: t('doc.reasonRequired') }),
  });
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'COPIE_SIMPLE', onBehalfOf: '', reason: '' },
  });

  const submit = handleSubmit((v) => {
    mutation.mutate(v, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('doc.requestTitle')}
      description={t('doc.requestHelp')}
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-ink-soft mb-2 text-[13px] font-medium">{t('doc.kind')}</legend>
          {KINDS.filter((k) => k !== 'ORIGINAL' || canRequestOriginal).map((k) => (
            <label
              key={k}
              className="border-line has-checked:border-primary has-checked:bg-primary-soft/50 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <input type="radio" value={k} className="accent-primary size-4" {...register('kind')} />
              {t(`doc.requestKinds.${k}`)}
            </label>
          ))}
        </fieldset>
        <FormField id="rq-behalf" label={t('doc.onBehalfOf')} hint={t('doc.onBehalfOfHint')}>
          <Input id="rq-behalf" {...register('onBehalfOf')} />
        </FormField>
        <FormField id="rq-reason" label={t('doc.reason')} error={formState.errors.reason?.message} required>
          <Input id="rq-reason" aria-invalid={!!formState.errors.reason} {...register('reason')} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('common.send')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Reclassement ─────────

export function ReclassifyDialog({
  documentId,
  open,
  onOpenChange,
  currentNodeId,
}: DialogBaseProps & { currentNodeId: string | null }) {
  const { t } = useTranslation();
  const mutation = useReclassify(documentId);
  const schema = z.object({
    nodeId: z.string().min(1, { error: t('inbox.pickFolder') }),
    reason: z
      .string()
      .trim()
      .min(1, { error: t('doc.reasonRequired') }),
  });
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nodeId: currentNodeId ?? '', reason: '' },
  });

  const submit = handleSubmit((v) => {
    mutation.mutate(v, {
      onSuccess: () => {
        reset({ nodeId: v.nodeId, reason: '' });
        onOpenChange(false);
      },
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('doc.reclassify')}
      description={t('doc.reclassifyHelp')}
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <FormField id="rc-node" label={t('doc.target')} error={formState.errors.nodeId?.message} required>
          <NodeSelect id="rc-node" {...register('nodeId')} />
        </FormField>
        <FormField id="rc-reason" label={t('doc.reason')} error={formState.errors.reason?.message} required>
          <Input id="rc-reason" aria-invalid={!!formState.errors.reason} {...register('reason')} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('doc.reclassify')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
