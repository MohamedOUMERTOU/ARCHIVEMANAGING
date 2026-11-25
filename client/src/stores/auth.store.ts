import { create } from 'zustand';
import type { CurrentUser, Session } from '@/types/user';

/**
 * unknown : on ne sait pas encore (vérification au démarrage en cours)
 * authenticated / anonymous : résultat connu
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  /** Jeton d'accès gardé en mémoire uniquement : jamais dans localStorage */
  accessToken: string | null;
  user: CurrentUser | null;
  setSession: (session: Session) => void;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => {
    set({ status: 'authenticated', accessToken, user });
  },
  setAccessToken: (accessToken) => {
    set({ accessToken });
  },
  clearSession: () => {
    set({ status: 'anonymous', accessToken: null, user: null });
  },
}));

export function hasPermission(user: CurrentUser | null, permission: string): boolean {
  return !!user && (user.permissions.includes('*') || user.permissions.includes(permission));
}
