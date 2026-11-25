import { z } from 'zod';
import i18n from '@/i18n';

export const loginSchema = z.object({
  email: z.email({ error: () => i18n.t('auth.invalidEmail') }).trim(),
  password: z.string().min(1, { error: () => i18n.t('auth.passwordRequired') }),
});

export type LoginInput = z.infer<typeof loginSchema>;
