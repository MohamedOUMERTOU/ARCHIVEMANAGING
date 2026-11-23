import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { ApiError, toApiError } from './errors';

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return new AxiosError('fail', 'ERR', undefined, undefined, response);
}

describe('toApiError', () => {
  it("lit le message et les erreurs de champ d'un ProblemDetail Spring Boot", () => {
    const err = toApiError(
      axiosErrorWith(400, {
        detail: 'Champs invalides',
        code: 'VALIDATION',
        errors: { code: 'Obligatoire' },
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('validation');
    expect(err.message).toBe('Champs invalides');
    expect(err.fieldErrors).toEqual({ code: 'Obligatoire' });
  });

  it('donne un message par défaut quand le corps est vide', () => {
    const err = toApiError(axiosErrorWith(403, ''));
    expect(err.kind).toBe('forbidden');
    expect(err.message).toMatch(/droits/);
  });

  it('reconnaît une panne réseau (pas de réponse)', () => {
    expect(toApiError(new AxiosError('Network Error')).kind).toBe('network');
  });

  it('classe les erreurs serveur', () => {
    expect(toApiError(axiosErrorWith(503, null)).kind).toBe('server');
  });
});
