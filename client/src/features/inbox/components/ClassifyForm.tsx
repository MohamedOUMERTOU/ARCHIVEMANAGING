import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  compactMetadata,
  metadataDefaults,
  metadataSchema,
  NodeSelect,
  useClassify,
  type DocumentDetail,
  type DocumentTypeRef,
  type MetadataField,
} from '@/features/documents';
import { ApiError } from '@/services/api/errors';

interface ClassifyFormProps {
  doc: DocumentDetail;
  types: DocumentTypeRef[];
  onDone: () => void;
}

interface Messages {
  folder: string;
  type: string;
  title: string;
}

function buildSchema(fields: readonly MetadataField[], m: Messages) {
  return z.object({
    nodeId: z.string().min(1, { error: m.folder }),
    typeId: z.string().min(1, { error: m.type }),
    title: z.string().trim().min(1, { error: m.title }).max(500),
    documentDate: z.string(),
    tags: z.string(),
    metadata: metadataSchema(fields),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

/** Classement d'un document « à classer » : les champs de métadonnées dépendent du type choisi. */
export function ClassifyForm({ doc, types, onDone }: ClassifyFormProps) {
  const { t } = useTranslation();
  const classify = useClassify();
  const messages: Messages = {
    folder: t('inbox.pickFolder'),
    type: t('inbox.pickType'),
    title: t('inbox.title_'),
  };

  // Le schéma dépend du type choisi : le résolveur lit les champs courants au moment de valider
  const fieldsRef = useRef<readonly MetadataField[]>([]);
  const form = useForm<FormValues>({
    resolver: (values, ctx, options) =>
      zodResolver(buildSchema(fieldsRef.current, messages))(values, ctx, options),
    defaultValues: { nodeId: '', typeId: '', title: doc.title, documentDate: '', tags: '', metadata: {} },
  });

  const typeId = useWatch({ control: form.control, name: 'typeId' });
  const fields = useMemo(() => types.find((x) => x.id === typeId)?.metadataSchema ?? [], [types, typeId]);
  useEffect(() => {
    fieldsRef.current = fields;
    form.setValue('metadata', metadataDefaults(fields, doc.metadata));
  }, [fields, doc.metadata, form]);

  const submit = form.handleSubmit((v) => {
    classify.mutate(
      {
        id: doc.id,
        input: {
          nodeId: v.nodeId,
          typeId: v.typeId,
          title: v.title,
          documentDate: v.documentDate || null,
          metadata: compactMetadata(v.metadata),
          tags: v.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      {
        onSuccess: (filed) => {
          toast.success(t('inbox.done', { ref: filed.reference ?? '' }));
          onDone();
        },
        onError: (error) => {
          // Erreurs renvoyées par le serveur, champ par champ (ex. « metadata.fournisseur »)
          if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
            Object.entries(error.fieldErrors).forEach(([name, message]) => {
              form.setError(name as keyof FormValues, { message });
            });
          } else {
            toast.error(error instanceof Error ? error.message : String(error));
          }
        },
      },
    );
  });

  const errors = form.formState.errors;
  const metaErrors = (errors.metadata ?? {}) as Record<string, { message?: string } | undefined>;

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="cl-type" label={t('inbox.type')} error={errors.typeId?.message} required>
          <Select id="cl-type" aria-invalid={!!errors.typeId} {...form.register('typeId')}>
            <option value="">{t('inbox.pickType')}</option>
            {types.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="cl-node" label={t('inbox.folder')} error={errors.nodeId?.message} required>
          <NodeSelect
            id="cl-node"
            emptyLabel={t('inbox.pickFolder')}
            aria-invalid={!!errors.nodeId}
            {...form.register('nodeId')}
          />
        </FormField>
        <FormField
          id="cl-title"
          label={t('inbox.title_')}
          error={errors.title?.message}
          required
          className="sm:col-span-2"
        >
          <Input id="cl-title" aria-invalid={!!errors.title} {...form.register('title')} />
        </FormField>
        <FormField id="cl-date" label={t('inbox.date')}>
          <Input id="cl-date" type="date" {...form.register('documentDate')} />
        </FormField>
        <FormField id="cl-tags" label={t('inbox.tags')} hint={t('inbox.tagsHint')}>
          <Input id="cl-tags" {...form.register('tags')} />
        </FormField>

        {fields.map((f) => {
          const id = `cl-meta-${f.key}`;
          const error = metaErrors[f.key]?.message;
          const common = { id, 'aria-invalid': !!error, ...form.register(`metadata.${f.key}`) };
          return (
            <FormField key={f.key} id={id} label={f.label} error={error} required={!!f.required}>
              {f.type === 'LIST' ? (
                <Select {...common}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  {...common}
                  type={f.type === 'DATE' ? 'date' : 'text'}
                  inputMode={f.type === 'AMOUNT' || f.type === 'NUMBER' ? 'decimal' : undefined}
                />
              )}
            </FormField>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={classify.isPending}>
          {classify.isPending ? t('inbox.submitting') : t('inbox.submit')}
        </Button>
      </div>
    </form>
  );
}
