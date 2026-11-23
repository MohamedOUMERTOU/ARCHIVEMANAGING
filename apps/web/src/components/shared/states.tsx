import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toApiError } from '@/services/api/errors';

export function LoadingState({ rows = 6 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2.5">
      <span className="sr-only">{t('states.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7" style={{ width: `${String(90 - ((i * 13) % 35))}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="border-danger/25 bg-danger-soft flex flex-col items-start gap-3 rounded-lg border p-4"
    >
      <div className="text-danger flex items-center gap-2 font-semibold">
        <AlertTriangle aria-hidden="true" className="size-4" />
        {t('states.errorTitle')}
      </div>
      <p className="text-ink-soft">{toApiError(error).message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('states.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="border-line-strong flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center">
      <Inbox aria-hidden="true" className="text-muted size-7" />
      <p className="text-ink font-medium">{title}</p>
      {hint && <p className="text-muted max-w-sm text-[13px]">{hint}</p>}
      {action}
    </div>
  );
}
