import { http as mswHttp, HttpResponse } from 'msw';
import { authApi } from '@/features/auth/api/auth.api';
import { classificationApi } from '@/features/classification/api/classification.api';
import { expireAccessTokens } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from './errors';

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown', accessToken: null, user: null });
});

async function signIn() {
  useAuthStore
    .getState()
    .setSession(await authApi.login({ email: 'admin@exemple.com', password: 'demo1234' }));
}

describe('client HTTP', () => {
  it('ajoute le jeton aux requêtes', async () => {
    await signIn();
    await expect(classificationApi.tree()).resolves.toHaveLength(10);
  });

  it('renouvelle le jeton expiré une seule fois, même pour des requêtes simultanées', async () => {
    await signIn();
    const oldToken = useAuthStore.getState().accessToken;
    expireAccessTokens();

    let refreshCalls = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/auth/refresh')) refreshCalls += 1;
    });

    const results = await Promise.all([
      classificationApi.tree(),
      classificationApi.tree(),
      classificationApi.tree(),
    ]);
    expect(results.every((r) => r.length === 10)).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).not.toBe(oldToken);
    server.events.removeAllListeners();
  });

  it('déconnecte quand le renouvellement échoue', async () => {
    await signIn();
    expireAccessTokens();
    server.use(
      mswHttp.post('*/api/auth/refresh', () =>
        HttpResponse.json({ detail: 'Session expirée' }, { status: 401 }),
      ),
    );

    await expect(classificationApi.tree()).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('transforme les erreurs du serveur en ApiError lisible', async () => {
    await signIn();
    server.use(
      mswHttp.get('*/api/classification/tree', () =>
        HttpResponse.json({ status: 403, detail: 'Accès refusé au fonds Juridique' }, { status: 403 }),
      ),
    );
    await expect(classificationApi.tree()).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'Accès refusé au fonds Juridique',
    });
  });
});
