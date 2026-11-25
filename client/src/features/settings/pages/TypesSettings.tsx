import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { settingsApi, type DocumentTypeSetting, type TypeInput } from '../api/settings.api';
import { TYPE_KEYS, useRules, useSettingsMutation, useTypeSettings } from '../hooks/useSettings';
import { slugKey } from '../utils/slug';

const FIELD_TYPES = [
  ['TEXT', 'Texte'],
  ['NUMBER', 'Nombre'],
  ['AMOUNT', 'Montant'],
  ['DATE', 'Date'],
  ['LIST', 'Liste de valeurs'],
  ['BOOLEAN', 'Oui / Non'],
] as const;

const fieldSchema = z.object({
  label: z.string().trim().min(1, { error: 'Libellé obligatoire' }),
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, { error: 'Minuscules, chiffres et _' }),
  type: z.enum(['TEXT', 'NUMBER', 'AMOUNT', 'DATE', 'LIST', 'BOOLEAN']),
  required: z.boolean(),
  options: z.string(),
});
const typeSchema = z
  .object({
    code: z.string(),
    name: z.string().trim().min(1, { error: 'Saisissez un nom' }).max(120),
    defaultRetentionRuleId: z.string(),
    fields: z.array(fieldSchema),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.fields.forEach((f, i) => {
      if (seen.has(f.key))
        ctx.addIssue({ code: 'custom', path: ['fields', i, 'key'], message: 'Clé déjà utilisée' });
      seen.add(f.key);
      if (f.type === 'LIST' && !f.options.split(',').some((o) => o.trim())) {
        ctx.addIssue({ code: 'custom', path: ['fields', i, 'options'], message: 'Au moins une valeur' });
      }
    });
  });
type TypeForm = z.infer<typeof typeSchema>;

const NEW = 'nouveau';

export default function TypesSettings() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('type');
  const types = useTypeSettings();

  if (types.isPending) return <LoadingState />;
  if (types.isError) return <ErrorState error={types.error} onRetry={() => void types.refetch()} />;
  const current = types.data.find((t) => t.id === selected);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex w-full max-w-xs flex-[1_1_260px] flex-col gap-1 p-3">
        <div className="flex items-center px-2 pb-2">
          <CardTitle className="flex-1">Types de document</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setParams({ type: NEW });
            }}
          >
            <Plus aria-hidden="true" /> Nouveau
          </Button>
        </div>
        {types.data.length === 0 && <EmptyState title="Aucun type." />}
        {types.data.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={t.id === selected}
            onClick={() => {
              setParams({ type: t.id });
            }}
            className={cn(
              'hover:bg-bg flex items-center gap-2 rounded-lg px-3 py-2.5 text-left',
              t.id === selected && 'bg-primary-soft text-primary-strong font-semibold',
            )}
          >
            <span className="flex-1">{t.name}</span>
            <span className="text-muted text-xs font-normal">{t.metadataSchema.length} champs</span>
          </button>
        ))}
      </Card>

      <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        {selected === NEW ? (
          <TypeEditor key={NEW} type={null} />
        ) : current ? (
          <TypeEditor key={current.id} type={current} />
        ) : (
          <EmptyState title="Choisissez un type, ou créez-en un." />
        )}
      </Card>
    </div>
  );
}

function toInput(v: TypeForm, isNew: boolean): TypeInput {
  return {
    ...(isNew ? { code: v.code } : {}),
    name: v.name,
    defaultRetentionRuleId: v.defaultRetentionRuleId || null,
    fields: v.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options:
        f.type === 'LIST'
          ? f.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
    })),
  };
}

function TypeEditor({ type }: { type: DocumentTypeSetting | null }) {
  const navigate = useNavigate();
  const rules = useRules();
  const isNew = type === null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useForm<TypeForm>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      code: type?.code ?? '',
      name: type?.name ?? '',
      defaultRetentionRuleId: type?.defaultRetentionRuleId ?? '',
      fields: (type?.metadataSchema ?? []).map((f) => ({
        label: f.label,
        key: f.key,
        type: f.type,
        required: !!f.required,
        options: (f.options ?? []).join(', '),
      })),
    },
  });
  const fields = useFieldArray({ control: form.control, name: 'fields' });
  const save = useSettingsMutation(
    (v: TypeForm) =>
      isNew ? settingsApi.createType(toInput(v, true)) : settingsApi.updateType(type.id, toInput(v, false)),
    { success: 'Type enregistré', invalidate: TYPE_KEYS },
  );
  const remove = useSettingsMutation(() => settingsApi.deleteType(type?.id ?? ''), {
    success: 'Type supprimé',
    invalidate: TYPE_KEYS,
  });
  const errors = form.formState.errors;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void form.handleSubmit((v) => {
          save.mutate(v, {
            onSuccess: (saved) => {
              void navigate(`?type=${saved.id}`, { replace: true });
            },
            onError: (err) => {
              applyServerErrors(err, form.setError);
            },
          });
        })(e)
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle className="flex-1 text-lg">{isNew ? 'Nouveau type de document' : type.name}</CardTitle>
        {!isNew && <span className="text-muted text-[13px]">{type.documentCount} document(s)</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField id="t-name" label="Nom" error={errors.name?.message} required>
          <Input id="t-name" className="h-10" aria-invalid={!!errors.name} {...form.register('name')} />
        </FormField>
        <FormField
          id="t-code"
          label="Code"
          error={errors.code?.message}
          hint={isNew ? 'Ex. FACTURE ; non modifiable ensuite' : 'Non modifiable'}
        >
          <Input
            id="t-code"
            className="h-10 font-mono uppercase"
            disabled={!isNew}
            {...form.register('code')}
          />
        </FormField>
        <FormField id="t-rule" label="Règle par défaut" hint="Si le dossier n'a pas de règle">
          <Select id="t-rule" {...form.register('defaultRetentionRuleId')}>
            <option value="">Aucune</option>
            {rules.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Champs de métadonnées</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            fields.append({ label: '', key: '', type: 'TEXT', required: false, options: '' });
          }}
        >
          <Plus aria-hidden="true" /> Ajouter un champ
        </Button>
      </div>

      {fields.fields.length === 0 ? (
        <p className="text-muted text-[13px]">
          Aucun champ : seuls le titre et la date seront demandés au classement.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.fields.map((f, i) => (
            <FieldRow
              key={f.id}
              index={i}
              control={form.control}
              register={form.register}
              setKey={(key) => {
                form.setValue(`fields.${i}.key`, key, { shouldValidate: false });
              }}
              errors={errors.fields?.[i]}
              onUp={
                i > 0
                  ? () => {
                      fields.move(i, i - 1);
                    }
                  : undefined
              }
              onDown={
                i < fields.fields.length - 1
                  ? () => {
                      fields.move(i, i + 1);
                    }
                  : undefined
              }
              onRemove={() => {
                fields.remove(i);
              }}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        {!isNew ? (
          <Button
            variant="danger"
            disabled={type.documentCount > 0}
            title={type.documentCount > 0 ? 'Type utilisé par des documents' : undefined}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            <Trash2 aria-hidden="true" /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={save.isPending}>
          Enregistrer
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer le type « ${type?.name ?? ''} » ?`}
        message="Possible seulement si aucun document n'utilise ce type."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              void navigate('?', { replace: true });
            },
            onError: (err) => {
              notifyError(err);
              setConfirmDelete(false);
            },
          });
        }}
      />
    </form>
  );
}

interface FieldRowProps {
  index: number;
  control: Control<TypeForm>;
  register: ReturnType<typeof useForm<TypeForm>>['register'];
  setKey: (key: string) => void;
  errors:
    { label?: { message?: string }; key?: { message?: string }; options?: { message?: string } } | undefined;
  onUp: (() => void) | undefined;
  onDown: (() => void) | undefined;
  onRemove: () => void;
}

function FieldRow({ index, control, register, setKey, errors, onUp, onDown, onRemove }: FieldRowProps) {
  const type = useWatch({ control, name: `fields.${index}.type` });
  const key = useWatch({ control, name: `fields.${index}.key` });
  const p = `f${String(index)}`;
  const labelField = register(`fields.${index}.label`);

  return (
    <li className="border-line grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
      <FormField id={`${p}-label`} label="Libellé" error={errors?.label?.message} required>
        <Input
          id={`${p}-label`}
          className="h-9"
          {...labelField}
          onBlur={(e) => {
            void labelField.onBlur(e);
            // La clé se propose d'elle-même à partir du libellé, tant qu'elle est vide
            if (!key) setKey(slugKey(e.target.value));
          }}
        />
      </FormField>
      <FormField id={`${p}-key`} label="Clé" error={errors?.key?.message} required>
        <Input id={`${p}-key`} className="h-9 font-mono text-[13px]" {...register(`fields.${index}.key`)} />
      </FormField>
      <FormField id={`${p}-type`} label="Type">
        <Select id={`${p}-type`} className="h-9" {...register(`fields.${index}.type`)}>
          {FIELD_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex items-end gap-1">
        <Button variant="ghost" size="sm" aria-label="Monter le champ" disabled={!onUp} onClick={onUp}>
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Descendre le champ" disabled={!onDown} onClick={onDown}>
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Retirer le champ" onClick={onRemove}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <label className="flex items-center gap-2 text-[13px] sm:col-span-4">
        <input type="checkbox" className="accent-primary size-4" {...register(`fields.${index}.required`)} />
        Obligatoire au classement
      </label>
      {type === 'LIST' && (
        <FormField
          id={`${p}-opt`}
          label="Valeurs possibles"
          hint="Séparées par des virgules"
          error={errors?.options?.message}
          className="sm:col-span-4"
        >
          <Input
            id={`${p}-opt`}
            className="h-9"
            placeholder="MAD, EUR, USD"
            {...register(`fields.${index}.options`)}
          />
        </FormField>
      )}
    </li>
  );
}
