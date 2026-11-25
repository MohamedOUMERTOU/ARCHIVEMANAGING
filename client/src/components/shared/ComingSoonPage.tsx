import { useTranslation } from 'react-i18next';
import { EmptyState } from './states';

export default function ComingSoonPage() {
  const { t } = useTranslation();
  return <EmptyState title={t('comingSoon.title')} hint={t('comingSoon.body')} />;
}
