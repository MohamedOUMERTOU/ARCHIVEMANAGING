import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/app/config/env';
import { endpoints } from '@/services/endpoints';
import { useAuthStore } from '@/stores/auth.store';
import type { Session } from '@/types/user';
import { toApiError } from './errors';

const baseConfig = {
  baseURL: env.apiBaseUrl,
  // Le jeton de rafraîchissement voyage dans un cookie HttpOnly posé par Spring Boot
  withCredentials: true,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
};

/** Client utilisé par toutes les fonctionnalités. */
export const http = axios.create(baseConfig);

/** Client sans intercepteurs, réservé au rafraîchissement (évite les boucles). */
const bare = axios.create(baseConfig);

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const NO_REFRESH_URLS: readonly string[] = [
  endpoints.auth.login,
  endpoints.auth.refresh,
  endpoints.auth.logout,
];

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Un seul rafraîchissement à la fois, partagé par toutes les requêtes en échec
let refreshing: Promise<string> | null = null;

export async function refreshSession(): Promise<Session> {
  const { data } = await bare.post<Session>(endpoints.auth.refresh);
  useAuthStore.getState().setSession(data);
  return data;
}

function refreshAccessToken(): Promise<string> {
  refreshing ??= refreshSession()
    .then((s) => s.accessToken)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const canRefresh =
      error.response?.status === 401 &&
      config !== undefined &&
      !config._retried &&
      !NO_REFRESH_URLS.some((url) => config.url?.endsWith(url));

    if (canRefresh) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return await http.request(config);
      } catch {
        useAuthStore.getState().clearSession();
      }
    }
    return Promise.reject(toApiError(error));
  },
);
