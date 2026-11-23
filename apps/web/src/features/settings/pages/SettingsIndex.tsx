import { Navigate } from 'react-router';
import { EmptyState } from '@/components/shared/states';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { SETTINGS_TABS } from '../utils/tabs';

/** /parametrage : ouvre la première section autorisée. */
export default function SettingsIndex() {
  const user = useAuthStore((s) => s.user);
  const first = SETTINGS_TABS.find((t) => hasPermission(user, t.permission));
  return first ? (
    <Navigate to={first.to} replace />
  ) : (
    <EmptyState title="Aucune section de paramétrage ne vous est ouverte." />
  );
}
