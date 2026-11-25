import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessionBootstrap } from '@/features/auth';

/** Garde des routes privées : attend la vérification de session, sinon renvoie vers la connexion. */
export function RequireAuth() {
  const { t } = useTranslation();
  const status = useSessionBootstrap();
  const location = useLocation();

  if (status === 'unknown') {
    return (
      <div role="status" className="text-muted flex h-full items-center justify-center">
        {t('states.loading')}
      </div>
    );
  }
  if (status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
