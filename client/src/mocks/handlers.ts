import { delay, http, HttpResponse } from 'msw';
import type { ProblemDetail } from '@/types/api';
import type { CurrentUser, Session } from '@/types/user';
import { classificationNodes, users } from './db';

// Imite le contrat attendu du serveur Spring Boot (voir docs/FRONTEND.md, section 4)
const api = (path: string) => `*/api${path}`;

// Jetons d'accès valides -> utilisateur. Le « cookie » de rafraîchissement est simulé en mémoire.
const accessTokens = new Map<string, string>();
let refreshUserId: string | null = null;

function problem(status: number, detail: string, extra: Partial<ProblemDetail> = {}) {
  return HttpResponse.json<ProblemDetail>({ status, title: detail, detail, ...extra }, { status });
}

function issueSession(userId: string): Session {
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('utilisateur inconnu');
  const { password: _password, ...publicUser } = user;
  const accessToken = `mock.${userId}.${crypto.randomUUID()}`;
  accessTokens.set(accessToken, userId);
  refreshUserId = userId;
  return { accessToken, user: publicUser };
}

function currentUser(request: Request): CurrentUser | null {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const userId = token ? accessTokens.get(token) : undefined;
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export const handlers = [
  http.post(api('/auth/login'), async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { email?: string; password?: string };
    const user = users.find((u) => u.email === body.email?.toLowerCase() && u.password === body.password);
    if (!user) return problem(401, 'E-mail ou mot de passe incorrect', { code: 'BAD_CREDENTIALS' });
    return HttpResponse.json(issueSession(user.id));
  }),

  http.post(api('/auth/refresh'), async () => {
    await delay(150);
    if (!refreshUserId) return problem(401, 'Session expirée', { code: 'NO_SESSION' });
    return HttpResponse.json(issueSession(refreshUserId));
  }),

  http.post(api('/auth/logout'), () => {
    refreshUserId = null;
    accessTokens.clear();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(api('/classification/tree'), async ({ request }) => {
    await delay(400);
    if (!currentUser(request)) return problem(401, 'Jeton invalide ou expiré');
    return HttpResponse.json(classificationNodes);
  }),
];

/** Pour les tests : invalide les jetons d'accès, mais garde la session de rafraîchissement. */
export function expireAccessTokens() {
  accessTokens.clear();
}

/** Pour les tests : remet l'API simulée à zéro. */
export function resetMockSession() {
  accessTokens.clear();
  refreshUserId = null;
}
