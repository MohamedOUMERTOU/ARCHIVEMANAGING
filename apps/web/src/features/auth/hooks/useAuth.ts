import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '../api/auth.api';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: setSession,
    // L'erreur est affichée dans le formulaire, pas en notification
    meta: { silent: true },
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    // On déconnecte côté interface même si le serveur ne répond pas
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

/** Au chargement de l'application : retrouve la session grâce au cookie, sinon passe en anonyme. */
export function useSessionBootstrap() {
  const status = useAuthStore((s) => s.status);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    if (status !== 'unknown') return;
    let cancelled = false;
    authApi.refresh().catch(() => {
      if (!cancelled) clearSession();
    });
    return () => {
      cancelled = true;
    };
  }, [status, clearSession]);

  return status;
}
