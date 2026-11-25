import { http, refreshSession } from '@/services/api/http';
import { endpoints } from '@/services/endpoints';
import type { Session } from '@/types/user';
import type { LoginInput } from '../schemas/login.schema';

export const authApi = {
  login: async (input: LoginInput): Promise<Session> => {
    const { data } = await http.post<Session>(endpoints.auth.login, input);
    return data;
  },
  /** Relit la session à partir du cookie de rafraîchissement (au démarrage). */
  refresh: refreshSession,
  logout: async (): Promise<void> => {
    await http.post(endpoints.auth.logout);
  },
};
