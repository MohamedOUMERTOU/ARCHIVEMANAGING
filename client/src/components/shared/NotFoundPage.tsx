import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from './states';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('notFound.title')}
      action={
        <Link to="/" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {t('notFound.back')}
        </Link>
      }
    />
  );
}
