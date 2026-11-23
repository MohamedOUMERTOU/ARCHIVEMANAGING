import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';
import { env } from '@/app/config/env';
import { useAuthStore } from '@/stores/auth.store';
import { LoginForm } from '../components/LoginForm';
import { useLogin } from '../hooks/useAuth';

interface FromState {
  from?: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  const login = useLogin();

  if (status === 'authenticated') {
    const from = (location.state as FromState | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex min-h-full flex-wrap">
      <section className="bg-primary-strong flex flex-[1_1_420px] flex-col justify-between gap-7 p-10 text-white sm:p-14">
        <div className="font-display flex items-center gap-3 text-[22px] font-bold">
          <Archive aria-hidden="true" className="size-8" />
          {t('app.name')}
        </div>
        <div className="flex max-w-md flex-col gap-4">
          <p className="font-display text-4xl leading-tight font-semibold text-balance">
            {t('auth.tagline')}
          </p>
          <p className="text-base leading-relaxed text-white/80">{t('auth.taglineDetail')}</p>
        </div>
        <span aria-hidden="true" />
      </section>

      <main className="flex flex-[1_1_420px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[28px] font-semibold">{t('auth.title')}</h1>
            <p className="text-muted">{t('auth.subtitle')}</p>
          </div>
          <LoginForm
            onSubmit={(values) => {
              login.mutate(values);
            }}
            pending={login.isPending}
            error={login.error}
          />
          <p className="text-muted text-xs leading-relaxed">{t('auth.auditNotice')}</p>
          {env.apiMocks && (
            <p className="bg-primary-soft text-primary-strong rounded-lg px-3 py-2 text-[13px]">
              {t('auth.demoHint')}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
