import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toApiError } from '@/services/api/errors';
import { loginSchema, type LoginInput } from '../schemas/login.schema';

interface LoginFormProps {
  onSubmit: (values: LoginInput) => void;
  pending: boolean;
  error: unknown;
}

/** Formulaire sans logique réseau : il reçoit l'envoi et son état, ce qui le rend simple à tester. */
export function LoginForm({ onSubmit, pending, error }: LoginFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-5">
      {error !== null && error !== undefined && (
        <div
          role="alert"
          className="border-danger/25 bg-danger-soft text-danger flex items-start gap-2 rounded-lg border p-3"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{toApiError(error).message}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" className="text-danger text-[13px]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" className="text-danger text-[13px]">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t('auth.submitting') : t('auth.submit')}
      </Button>
    </form>
  );
}
