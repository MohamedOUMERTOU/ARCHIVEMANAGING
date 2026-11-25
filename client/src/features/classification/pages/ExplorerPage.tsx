import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { DocumentTable, useDocumentSearch } from '@/features/documents';
import { ClassificationTree } from '../components/ClassificationTree';
import { useClassificationTree } from '../hooks/useClassificationTree';

export default function ExplorerPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const selectedId = params.get('node');
  const { tree, selected, selectedPath, isPending, isError, error, refetch } =
    useClassificationTree(selectedId);

  // Fonds et ancêtres du dossier choisi ouverts par défaut ; l'utilisateur garde la main ensuite
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const expanded = new Set<string>([...tree.map((n) => n.id), ...selectedPath.map((n) => n.id)]);
  toggled.forEach((id) => {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
  });
  const onToggle = (id: string) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex w-full max-w-sm flex-[1_1_300px] flex-col gap-3 p-3">
        <CardTitle className="px-2 pt-1">{t('classification.title')}</CardTitle>
        {isPending ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : tree.length === 0 ? (
          <EmptyState title={t('classification.empty')} hint={t('classification.emptyHint')} />
        ) : (
          <ClassificationTree nodes={tree} selectedId={selectedId} expanded={expanded} onToggle={onToggle} />
        )}
      </Card>

      <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
        {selected ? (
          <>
            <p className="text-muted text-[13px]">{selectedPath.map((n) => n.title).join(' › ')}</p>
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[28px] font-semibold text-balance">{selected.title}</h1>
              <p className="text-muted">
                {t('classification.code')} <span className="text-ink-soft font-mono">{selected.code}</span> ·{' '}
                {t('classification.documents', { count: selected.documentCount })}
              </p>
            </div>
            <NodeDocuments key={selected.id} nodeId={selected.id} />
          </>
        ) : (
          <EmptyState title={t('classification.selectHint')} />
        )}
      </section>
    </div>
  );
}

function NodeDocuments({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const { data, isPending, isError, error, refetch } = useDocumentSearch({ nodeId, page, size: 20 });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (data.totalElements === 0) return <EmptyState title={t('classification.noDocuments')} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-[13px]">{t('classification.subtreeHint')}</p>
      <DocumentTable data={data.content} caption={t('classification.subtreeHint')} />
      {data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            {t('common.previous')}
          </Button>
          <span className="text-muted text-[13px]">
            {t('common.page', { page: page + 1, total: data.totalPages })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= data.totalPages}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
