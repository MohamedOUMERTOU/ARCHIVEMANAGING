import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { settingsApi, type FinalAction, type RetentionRule, type StartEvent } from '../api/settings.api';
import { TYPE_KEYS, useRules, useSettingsMutation } from '../hooks/useSettings';
import { describeRule } from '../utils/rules';

const START_LABEL: Record<StartEvent, string> = {
  DATE_DOCUMENT: 'Date du document',
  CLOTURE_DOSSIER: 'Clôture du dossier',
  DATE_CREATION: 'Date de dépôt',
};
const FINAL_LABEL: Record<FinalAction, { label: string; tone: 'success' | 'info' | 'danger' }> = {
  CONSERVER: { label: 'Conserver', tone: 'success' },
  VERSER: { label: 'Verser', tone: 'info' },
  DETRUIRE: { label: 'Détruire', tone: 'danger' },
};

const schema = z
  .object({
    name: z.string().trim().min(1, { error: 'Saisissez un nom' }).max(120),
    unlimited: z.boolean(),
    durationYears: z.string(),
    startEvent: z.enum(['DATE_DOCUMENT', 'CLOTURE_DOSSIER', 'DATE_CREATION']),
    finalAction: z.enum(['CONSERVER', 'VERSER', 'DETRUIRE']),
    legalBasis: z.string().max(255),
  })
  .superRefine((v, ctx) => {
    const n = Number(v.durationYears);
    if (!v.unlimited && (!Number.isInteger(n) || n < 1 || n > 200)) {
      ctx.addIssue({ code: 'custom', path: ['durationYears'], message: 'Entre 1 et 200 ans' });
    }
  });
type RuleForm = z.infer<typeof schema>;

const RULE_COLUMNS: ColDef<RetentionRule>[] = [
  { field: 'name', headerName: 'Règle', flex: 2, minWidth: 200, cellClass: 'font-semibold' },
  {
    field: 'durationYears',
    headerName: 'Durée',
    minWidth: 110,
    filter: 'agNumberColumnFilter',
    cellClass: 'tabular-nums',
    valueFormatter: ({ value }: { value: number | null }) =>
      value === null ? 'Illimitée' : `${String(value)} ans`,
  },
  {
    field: 'startEvent',
    headerName: 'Point de départ',
    minWidth: 160,
    valueFormatter: ({ value }: { value: RetentionRule['startEvent'] }) => START_LABEL[value],
  },
  {
    field: 'finalAction',
    headerName: 'Sort final',
    minWidth: 130,
    valueFormatter: ({ value }: { value: RetentionRule['finalAction'] }) => FINAL_LABEL[value].label,
    cellRenderer: ({ value }: { value: RetentionRule['finalAction'] }) => (
      <Badge tone={FINAL_LABEL[value].tone}>{FINAL_LABEL[value].label}</Badge>
    ),
  },
  {
    colId: 'usage',
    headerName: 'Utilisée par',
    minWidth: 160,
    cellClass: 'text-muted',
    valueGetter: ({ data }) => (data ? data.nodeCount + data.typeCount : 0),
    valueFormatter: ({ data }) =>
      data ? `${String(data.nodeCount)} nœud(s) · ${String(data.typeCount)} type(s)` : '',
  },
];

export default function RulesSettings() {
  const rules = useRules();
  const [editing, setEditing] = useState<RetentionRule | 'new' | null>(null);

  if (rules.isPending) return <LoadingState />;
  if (rules.isError) return <ErrorState error={rules.error} onRetry={() => void rules.refetch()} />;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 p-0">
        <div className="flex items-center gap-2 px-5 pt-4">
          <CardTitle className="flex-1">Référentiel de conservation · {rules.data.length} règles</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus aria-hidden="true" /> Nouvelle règle
          </Button>
        </div>
        {rules.data.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Aucune règle de conservation." />
          </div>
        ) : (
          <div className="px-5">
            <DataGrid
              rows={rules.data}
              columns={RULE_COLUMNS}
              label="Règles de conservation"
              getRowId={(r) => r.id}
              searchable={rules.data.length > 8}
              exportable
              onRowClicked={setEditing}
              getRowClass={(r) =>
                editing !== 'new' && editing?.id === r.id
                  ? 'bg-primary-soft/40 cursor-pointer'
                  : 'cursor-pointer'
              }
            />
          </div>
        )}
        <p className="text-muted px-5 pb-4 text-xs">
          Cliquez sur une ligne pour la modifier. Une règle posée sur un nœud s'applique à tous ses
          sous-dossiers, sauf s'ils en définissent une autre.
        </p>
      </Card>

      {editing && (
        <Card className="flex w-full max-w-md flex-[1_1_340px] flex-col gap-4">
          <RuleEditor
            key={editing === 'new' ? 'new' : editing.id}
            rule={editing === 'new' ? null : editing}
            onDone={() => {
              setEditing(null);
            }}
          />
        </Card>
      )}
    </div>
  );
}

function RuleEditor({ rule, onDone }: { rule: RetentionRule | null; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const form = useForm<RuleForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: rule?.name ?? '',
      unlimited: rule ? rule.durationYears === null : false,
      durationYears: rule?.durationYears ? String(rule.durationYears) : '10',
      startEvent: rule?.startEvent ?? 'DATE_DOCUMENT',
      finalAction: rule?.finalAction ?? 'VERSER',
      legalBasis: rule?.legalBasis ?? '',
    },
  });
  const values = useWatch({ control: form.control });
  const save = useSettingsMutation(
    (v: RuleForm) => {
      const input = {
        name: v.name,
        durationYears: v.unlimited ? null : Number(v.durationYears),
        startEvent: v.startEvent,
        finalAction: v.finalAction,
        legalBasis: v.legalBasis || null,
      };
      return rule ? settingsApi.updateRule(rule.id, input) : settingsApi.createRule(input);
    },
    { success: 'Règle enregistrée', invalidate: TYPE_KEYS },
  );
  const remove = useSettingsMutation(() => settingsApi.deleteRule(rule?.id ?? ''), {
    success: 'Règle supprimée',
    invalidate: TYPE_KEYS,
  });
  const errors = form.formState.errors;
  const inUse = rule ? rule.nodeCount + rule.typeCount > 0 : false;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void form.handleSubmit((v) => {
          save.mutate(v, {
            onSuccess: onDone,
            onError: (err) => {
              applyServerErrors(err, form.setError);
            },
          });
        })(e)
      }
    >
      <CardTitle className="text-lg">{rule ? rule.name : 'Nouvelle règle'}</CardTitle>
      <FormField id="r-name" label="Nom" error={errors.name?.message} required>
        <Input id="r-name" className="h-10" aria-invalid={!!errors.name} {...form.register('name')} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="r-years" label="Durée (années)" error={errors.durationYears?.message}>
          <Input
            id="r-years"
            type="number"
            min={1}
            max={200}
            className="h-10"
            disabled={values.unlimited}
            {...form.register('durationYears')}
          />
        </FormField>
        <label className="mt-6 flex items-center gap-2 text-[13px]">
          <input type="checkbox" className="accent-primary size-4" {...form.register('unlimited')} />
          Conservation illimitée
        </label>
      </div>
      <FormField id="r-start" label="Point de départ" required>
        <Select id="r-start" {...form.register('startEvent')}>
          {Object.entries(START_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </FormField>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink-soft mb-2 text-[13px] font-medium">Sort final</legend>
        {(['CONSERVER', 'VERSER', 'DETRUIRE'] as const).map((a) => (
          <label
            key={a}
            className="border-line has-checked:border-primary has-checked:bg-primary-soft/40 flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <input
              type="radio"
              value={a}
              className="accent-primary size-4"
              {...form.register('finalAction')}
            />
            {FINAL_LABEL[a].label}
          </label>
        ))}
      </fieldset>
      <FormField id="r-legal" label="Base légale">
        <Input
          id="r-legal"
          className="h-10"
          placeholder="Texte de référence"
          {...form.register('legalBasis')}
        />
      </FormField>

      <p className="border-primary/20 bg-primary-soft/50 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed">
        {describeRule({
          durationYears: values.unlimited ? null : Number(values.durationYears) || null,
          startEvent: values.startEvent ?? 'DATE_DOCUMENT',
          finalAction: values.finalAction ?? 'VERSER',
        })}
      </p>

      <div className="flex flex-wrap justify-between gap-2">
        {rule ? (
          <Button
            variant="danger"
            disabled={inUse}
            title={inUse ? 'Règle utilisée : retirez-la des nœuds et types d’abord' : undefined}
            onClick={() => {
              setConfirm(true);
            }}
          >
            <Trash2 aria-hidden="true" /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer la règle « ${rule?.name ?? ''} » ?`}
        message="Action inscrite au journal d'audit."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: onDone,
            onError: (err) => {
              notifyError(err);
              setConfirm(false);
            },
          });
        }}
      />
    </form>
  );
}
