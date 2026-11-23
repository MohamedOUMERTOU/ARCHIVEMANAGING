import { z } from 'zod';

const schema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api'),
  VITE_API_MOCKS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(`Configuration invalide : ${parsed.error.message}`);
}

/** Variables d'environnement validées au démarrage. */
export const env = {
  apiBaseUrl: parsed.data.VITE_API_BASE_URL,
  apiMocks: parsed.data.VITE_API_MOCKS,
} as const;
