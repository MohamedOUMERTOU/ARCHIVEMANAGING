import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormField } from '@/components/shared/FormField';
import { DataGrid, type ColDef } from '@/components/shared/DataGrid';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { applyServerErrors, notifyError } from '@/lib/forms';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/utils/format';
import {
  settingsApi,
  settingsKeys,
  type Permission,
  type RoleSetting,
  type UserSetting,
} from '../api/settings.api';
import { usePermissions, useRoles, useSettingsMutation, useUsers } from '../hooks/useSettings';

const USER_KEYS = [settingsKeys.users, settingsKeys.roles];

export default function UsersSettings() {
  const users = useUsers();
  const roles = useRoles();
  const permissions = usePermissions();
  const [dialog, setDialog] = useState<
    { kind: 'create' } | { kind: 'edit' | 'password'; user: UserSetting } | null
  >(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const columns = useMemo<ColDef<UserSetting>[]>(
    () => [
      {
        field: 'fullName',
        headerName: 'Utilisateur',
        flex: 2,
        minWidth: 220,
        autoHeight: true,
        getQuickFilterText: ({ data }) => `${data.fullName} ${data.email}`,
        cellRenderer: ({ data: u }: CustomCellRendererProps<UserSetting>) =>
          u ? (
            <div className="py-2 leading-snug">
              <div className="font-semibold">{u.fullName}</div>
              <div className="text-muted text-xs">{u.email}</div>
            </div>
          ) : null,
      },
      {
        colId: 'roles',
        headerName: 'Rôles',
        flex: 2,
        minWidth: 180,
        autoHeight: true,
        valueGetter: ({ data }) => data?.roleNames.join(', ') ?? '',
        cellRenderer: ({ data: u }: CustomCellRendererProps<UserSetting>) =>
          u ? (
            <div className="flex flex-wrap gap-1 py-2">
              {u.roleNames.length ? (
                u.roleNames.map((r) => <Badge key={r}>{r}</Badge>)
              ) : (
                <span className="text-muted">Aucun rôle</span>
              )}
            </div>
          ) : null,
      },
      {
        field: 'active',
        headerName: 'Statut',
        maxWidth: 140,
        filter: false,
        valueFormatter: ({ value }: { value: boolean }) => (value ? 'Actif' : 'Désactivé'),
        cellRenderer: ({ value }: { value: boolean }) => (
          <Badge tone={value ? 'success' : 'neutral'}>{value ? 'Actif' : 'Désactivé'}</Badge>
        ),
      },
      {
        field: 'createdAt',
        headerName: 'Créé le',
        maxWidth: 140,
        filter: false,
        cellClass: 'tabular-nums',
        valueFormatter: ({ value }: { value: string }) => formatDate(value.slice(0, 10)),
      },
      {
        colId: 'actions',
        headerName: '',
        maxWidth: 110,
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'flex items-center justify-end',
        cellRenderer: ({ data: u }: CustomCellRendererProps<UserSetting>) =>
          u ? (
            <span className="whitespace-nowrap">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Modifier ${u.fullName}`}
                onClick={() => {
                  setDialog({ kind: 'edit', user: u });
                }}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Nouveau mot de passe pour ${u.fullName}`}
                onClick={() => {
                  setDialog({ kind: 'password', user: u });
                }}
              >
                <KeyRound aria-hidden="true" />
              </Button>
            </span>
          ) : null,
      },
    ],
    [],
  );

  if (users.isPending || roles.isPending || permissions.isPending) return <LoadingState />;
  if (users.isError) return <ErrorState error={users.error} onRetry={() => void users.refetch()} />;
  if (roles.isError) return <ErrorState error={roles.error} />;
  if (permissions.isError) return <ErrorState error={permissions.error} />;
  const selectedRole = roleId === 'new' ? null : roles.data.find((r) => r.id === roleId);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 p-0">
        <div className="flex items-center gap-2 px-5 pt-4">
          <CardTitle className="flex-1">Utilisateurs · {users.data.length}</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setDialog({ kind: 'create' });
            }}
          >
            <UserPlus aria-hidden="true" /> Nouvel utilisateur
          </Button>
        </div>
        <div className="px-5 pb-5">
          <DataGrid
            rows={users.data}
            columns={columns}
            label="Utilisateurs"
            getRowId={(u) => u.id}
            searchable
            exportable
            pageSize={25}
            getRowClass={(u) => (u.active ? undefined : 'opacity-60')}
          />
        </div>
      </Card>

      <Card className="flex w-full max-w-md flex-[1_1_340px] flex-col gap-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1">Rôles</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRoleId('new');
            }}
          >
            <Plus aria-hidden="true" /> Nouveau rôle
          </Button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {roles.data.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-current={r.id === roleId}
                onClick={() => {
                  setRoleId(r.id);
                }}
                className={cn(
                  'hover:bg-bg flex w-full items-center rounded-lg px-3 py-2 text-left',
                  r.id === roleId && 'bg-primary-soft text-primary-strong font-semibold',
                )}
              >
                <span className="flex-1">{r.name}</span>
                <span className="text-muted text-xs font-normal">{r.userCount}</span>
              </button>
            </li>
          ))}
        </ul>
        {roleId && (
          <RoleEditor
            key={roleId}
            role={selectedRole ?? null}
            catalog={permissions.data}
            onDone={(id) => {
              setRoleId(id);
            }}
          />
        )}
      </Card>

      {dialog?.kind === 'create' && (
        <UserDialog
          user={null}
          roles={roles.data}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <UserDialog
          user={dialog.user}
          roles={roles.data}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'password' && (
        <PasswordDialog
          user={dialog.user}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

// ───────── Utilisateur ─────────

const userSchema = z.object({
  email: z.string(),
  fullName: z.string().trim().min(1, { error: 'Saisissez le nom' }).max(255),
  password: z.string(),
  active: z.boolean(),
  roleIds: z.array(z.string()),
});
type UserForm = z.infer<typeof userSchema>;

function UserDialog({
  user,
  roles,
  onClose,
}: {
  user: UserSetting | null;
  roles: RoleSetting[];
  onClose: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  const isNew = user === null;
  const form = useForm<UserForm>({
    resolver: zodResolver(
      isNew
        ? userSchema.extend({
            email: z.email({ error: 'Adresse e-mail invalide' }),
            password: z.string().min(10, { error: '10 caractères au minimum' }),
          })
        : userSchema,
    ),
    defaultValues: {
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      password: '',
      active: user?.active ?? true,
      roleIds: user?.roleIds ?? [],
    },
  });
  const save = useSettingsMutation(
    (v: UserForm) =>
      isNew
        ? settingsApi.createUser({
            email: v.email,
            fullName: v.fullName,
            password: v.password,
            roleIds: v.roleIds,
          })
        : settingsApi.updateUser(user.id, { fullName: v.fullName, active: v.active, roleIds: v.roleIds }),
    { success: isNew ? 'Utilisateur créé' : 'Utilisateur enregistré', invalidate: USER_KEYS },
  );
  const errors = form.formState.errors;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={isNew ? 'Nouvel utilisateur' : `Modifier ${user.fullName}`}
      description={isNew ? 'Communiquez-lui le mot de passe provisoire par un canal sûr.' : user.email}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            save.mutate(v, {
              onSuccess: onClose,
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
      >
        {isNew && (
          <FormField id="u-email" label="Adresse e-mail" error={errors.email?.message} required>
            <Input
              id="u-email"
              type="email"
              autoComplete="off"
              className="h-10"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
          </FormField>
        )}
        <FormField id="u-name" label="Nom" error={errors.fullName?.message} required>
          <Input
            id="u-name"
            className="h-10"
            aria-invalid={!!errors.fullName}
            {...form.register('fullName')}
          />
        </FormField>
        {isNew && (
          <FormField id="u-pass" label="Mot de passe provisoire" error={errors.password?.message} required>
            <Input
              id="u-pass"
              type="password"
              autoComplete="new-password"
              className="h-10"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
          </FormField>
        )}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-ink-soft mb-1.5 text-[13px] font-medium">Rôles</legend>
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={r.id}
                className="accent-primary size-4"
                {...form.register('roleIds')}
              />
              {r.name}
              {r.permissions.includes('*') && <Badge tone="info">tous les droits</Badge>}
            </label>
          ))}
        </fieldset>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              disabled={user.id === me?.id}
              {...form.register('active')}
            />
            Compte actif
            {user.id === me?.id && <span className="text-muted text-xs">(votre propre compte)</span>}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const passwordSchema = z
  .object({ password: z.string().min(10, { error: '10 caractères au minimum' }), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Les deux saisies diffèrent' });

function PasswordDialog({ user, onClose }: { user: UserSetting; onClose: () => void }) {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const reset = useSettingsMutation((p: string) => settingsApi.resetPassword(user.id, p), {
    success: 'Mot de passe changé ; ses sessions ouvertes sont fermées',
    invalidate: [],
  });
  const errors = form.formState.errors;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Nouveau mot de passe pour ${user.fullName}`}
      description="Ses sessions en cours seront fermées."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) =>
          void form.handleSubmit((v) => {
            reset.mutate(v.password, {
              onSuccess: onClose,
              onError: (err) => {
                applyServerErrors(err, form.setError);
              },
            });
          })(e)
        }
      >
        <FormField id="p-new" label="Nouveau mot de passe" error={errors.password?.message} required>
          <Input
            id="p-new"
            type="password"
            autoComplete="new-password"
            className="h-10"
            {...form.register('password')}
          />
        </FormField>
        <FormField id="p-confirm" label="Confirmation" error={errors.confirm?.message} required>
          <Input
            id="p-confirm"
            type="password"
            autoComplete="new-password"
            className="h-10"
            {...form.register('confirm')}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={reset.isPending}>
            Changer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────── Rôle ─────────

const roleSchema = z.object({
  name: z.string().trim().min(1, { error: 'Saisissez un nom' }).max(80),
  description: z.string().max(255),
  permissions: z.array(z.string()),
});
type RoleForm = z.infer<typeof roleSchema>;

function RoleEditor({
  role,
  catalog,
  onDone,
}: {
  role: RoleSetting | null;
  catalog: Permission[];
  onDone: (id: string | null) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const form = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissions: role?.permissions ?? [],
    },
  });
  const save = useSettingsMutation(
    (v: RoleForm) => {
      const input = { name: v.name, description: v.description || null, permissions: v.permissions };
      return role ? settingsApi.updateRole(role.id, input) : settingsApi.createRole(input);
    },
    { success: 'Rôle enregistré', invalidate: USER_KEYS },
  );
  const remove = useSettingsMutation(() => settingsApi.deleteRole(role?.id ?? ''), {
    success: 'Rôle supprimé',
    invalidate: USER_KEYS,
  });
  const errors = form.formState.errors;

  return (
    <form
      noValidate
      className="border-line flex flex-col gap-3 border-t pt-4"
      onSubmit={(e) =>
        void form.handleSubmit((v) => {
          save.mutate(v, {
            onSuccess: (r) => {
              onDone(r.id);
            },
            onError: (err) => {
              applyServerErrors(err, form.setError);
            },
          });
        })(e)
      }
    >
      <FormField id="ro-name" label="Nom du rôle" error={errors.name?.message} required>
        <Input id="ro-name" className="h-10" aria-invalid={!!errors.name} {...form.register('name')} />
      </FormField>
      <FormField id="ro-desc" label="Description">
        <Input id="ro-desc" className="h-10" {...form.register('description')} />
      </FormField>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-ink-soft mb-1.5 text-[13px] font-medium">Permissions</legend>
        {catalog.map((p) => (
          <label
            key={p.code}
            className="hover:bg-bg flex items-start gap-2.5 rounded-md px-1 py-1.5 text-[13px]"
          >
            <input
              type="checkbox"
              value={p.code}
              className="accent-primary mt-0.5 size-4"
              {...form.register('permissions')}
            />
            <span>
              {p.label}
              <span className="text-muted block font-mono text-[11px]">{p.code}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap justify-between gap-2">
        {role ? (
          <Button
            variant="danger"
            size="sm"
            disabled={role.userCount > 0}
            title={role.userCount > 0 ? 'Rôle attribué à des utilisateurs' : undefined}
            onClick={() => {
              setConfirm(true);
            }}
          >
            <Trash2 aria-hidden="true" /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={save.isPending}>
          Enregistrer le rôle
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer le rôle « ${role?.name ?? ''} » ?`}
        message="Possible seulement si aucun utilisateur ne l'a."
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              onDone(null);
            },
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
