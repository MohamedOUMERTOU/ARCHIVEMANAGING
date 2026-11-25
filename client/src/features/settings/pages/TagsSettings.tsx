import { zodResolver } from '@hookform/resolvers/zod';
import { Combine, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { settingsApi, type TagSetting } from '../api/settings.api';
import { TAG_KEYS, useSettingsMutation, useTagSettings } from '../hooks/useSettings';

const COLORS = [
  ['#1F5A8C', 'Bleu'],
  ['#1E7A4F', 'Vert'],
  ['#B54708', 'Orange'],
  ['#B42318', 'Rouge'],
  ['#6941C6', 'Violet'],
  ['#566170', 'Gris'],
] as const;

function TagChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold"
      style={{ borderColor: `${color}55`, color }}
    >
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export default function TagsSettings() {
  const tags = useTagSettings();
  const [editing, setEditing] = useState<TagSetting | 'new' | null>(null);
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState<TagSetting | null>(null);
  const remove = useSettingsMutation((id: string) => settingsApi.deleteTag(id), {
    success: 'Tag supprimé',
    invalidate: TAG_KEYS,
  });
  const columns = useMemo<ColDef<TagSetting>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Tag',
        minWidth: 160,
        cellRenderer: ({ data }: CustomCellRendererProps<TagSetting>) =>
          data ? <TagChip name={data.name} color={data.color} /> : null,
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 2,
        minWidth: 200,
        wrapText: true,
        autoHeight: true,
        cellClass: 'text-ink-soft',
        valueFormatter: ({ value }: { value: string | null }) => value ?? '—',
      },
      {
        field: 'documentCount',
        headerName: 'Documents',
        maxWidth: 140,
        filter: 'agNumberColumnFilter',
        cellClass: 'tabular-nums',
      },
      {
        colId: 'actions',
        headerName: '',
        maxWidth: 110,
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'flex items-center justify-end',
        cellRenderer: ({ data: t }: CustomCellRendererProps<TagSetting>) =>
          t ? (
            <span className="whitespace-nowrap">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Modifier ${t.name}`}
                onClick={() => {
                  setEditing(t);
                }}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Supprimer ${t.name}`}
                onClick={() => {
                  setDeleting(t);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </span>
          ) : null,
      },
    ],
    [],
  );

  if (tags.isPending) return <LoadingState />;
  if (tags.isError) return <ErrorState error={tags.error} onRetry={() => void tags.refetch()} />;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 p-0">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          <CardTitle className="flex-1">Tags · {tags.data.length}</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            disabled={tags.data.length < 2}
            onClick={() => {
              setMerging(true);
            }}
          >
            <Combine aria-hidden="true" /> Fusionner deux tags
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus aria-hidden="true" /> Nouveau tag
          </Button>
        </div>
        {tags.data.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Aucun tag." hint="Les tags saisis au classement apparaissent ici." />
          </div>
        ) : (
          <div className="px-5 pb-5">
            <DataGrid
              rows={tags.data}
              columns={columns}
              label="Tags"
              getRowId={(t) => t.id}
              searchable
              exportable
              pageSize={25}
            />
          </div>
        )}
      </Card>

      {editing && (
        <Card className="flex w-full max-w-sm flex-[1_1_300px] flex-col gap-4">
          <TagEditor
            key={editing === 'new' ? 'new' : editing.id}
            tag={editing === 'new' ? null : editing}
            onDone={() => {
              setEditing(null);
            }}
          />
        </Card>
      )}
      {merging && (
        <MergeDialog
          tags={tags.data}
          onClose={() => {
            setMerging(false);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`Supprimer le tag « ${deleting?.name ?? ''} » ?`}
        message={`Il sera retiré de ${String(deleting?.documentCount ?? 0)} document(s). Les documents eux-mêmes ne changent pas.`}
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

const tagSchema = z.object({
  name: z.string().trim().min(1, { error: 'Saisissez un nom' }).max(80),
  color: z.string(),
  description: z.string().max(255),
});
type TagForm = z.infer<typeof tagSchema>;

function TagEditor({ tag, onDone }: { tag: TagSetting | null; onDone: () => void }) {
  const form = useForm<TagForm>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: tag?.name ?? '',
      color: tag?.color ?? COLORS[0][0],
      description: tag?.description ?? '',
    },
  });
  const [name, color] = useWatch({ control: form.control, name: ['name', 'color'] });
  const save = useSettingsMutation(
    (v: TagForm) => {
      const input = { name: v.name, color: v.color, description: v.description || null };
      return tag ? settingsApi.updateTag(tag.id, input) : settingsApi.createTag(input);
    },
    { success: 'Tag enregistré', invalidate: TAG_KEYS },
  );
  const errors = form.formState.errors;

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
      <CardTitle className="text-lg">{tag ? `Modifier « ${tag.name} »` : 'Nouveau tag'}</CardTitle>
      <FormField
        id="g-name"
        label="Nom"
        error={errors.name?.message}
        hint="Enregistré en minuscules"
        required
      >
        <Input id="g-name" className="h-10" aria-invalid={!!errors.name} {...form.register('name')} />
      </FormField>
      <FormField id="g-desc" label="Description">
        <Input id="g-desc" className="h-10" {...form.register('description')} />
      </FormField>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink-soft mb-2 text-[13px] font-medium">Couleur</legend>
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map(([value, label]) => (
            <label key={value} className="relative cursor-pointer">
              <input type="radio" value={value} className="peer sr-only" {...form.register('color')} />
              <span
                className="peer-checked:ring-ink peer-focus-visible:outline-primary block size-8 rounded-full ring-2 ring-transparent ring-offset-2 peer-focus-visible:outline-2"
                style={{ background: value }}
              />
              <span className="sr-only">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-muted">Aperçu</span>
        <TagChip name={(name || 'tag').toLowerCase()} color={color} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function MergeDialog({ tags, onClose }: { tags: TagSetting[]; onClose: () => void }) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const merge = useSettingsMutation(({ s, t }: { s: string; t: string }) => settingsApi.mergeTags(s, t), {
    success: 'Tags fusionnés',
    invalidate: TAG_KEYS,
  });
  const from = tags.find((t) => t.id === source);
  const into = tags.find((t) => t.id === target);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Fusionner deux tags"
      description="Les documents du tag supprimé reçoivent le tag conservé. L'opération est inscrite au journal."
    >
      <FormField id="mg-src" label="Tag à supprimer" required>
        <Select
          id="mg-src"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
          }}
        >
          <option value="">Choisissez…</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.documentCount})
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="mg-dst" label="Tag conservé" required>
        <Select
          id="mg-dst"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
        >
          <option value="">Choisissez…</option>
          {tags
            .filter((t) => t.id !== source)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.documentCount})
              </option>
            ))}
        </Select>
      </FormField>
      {from && into && (
        <p className="bg-primary-soft/50 rounded-lg px-3 py-2 text-[13px]">
          {from.documentCount} document(s) passeront de « {from.name} » à « {into.name} ».
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button
          disabled={!source || !target || merge.isPending}
          onClick={() => {
            merge.mutate({ s: source, t: target }, { onSuccess: onClose, onError: notifyError });
          }}
        >
          Fusionner
        </Button>
      </div>
    </Dialog>
  );
}
