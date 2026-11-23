import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Card, CardTitle } from '@/components/ui/card';
import { DocumentViewer, useDocument, useDocumentSearch, useDocumentTypes } from '@/features/documents';
import { cn } from '@/lib/cn';
import { formatDateTime, formatSize } from '@/utils/format';
import { ClassifyForm } from '../components/ClassifyForm';
import { UploadDropzone } from '../components/UploadDropzone';

const INBOX = { status: 'A_CLASSER', sort: 'created', size: 50 } as const;

export default function InboxPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('doc');
  const inbox = useDocumentSearch(INBOX);
  const select = (id: string | null) => {
    setParams(id ? { doc: id } : {}, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-semibold">{t('inbox.title')}</h1>
        <p className="text-muted">{t('inbox.intro')}</p>
      </div>

      <UploadDropzone onUploaded={select} />

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label={t('inbox.listLabel')}
          className="flex w-full max-w-sm flex-[1_1_300px] flex-col gap-2"
        >
          {inbox.isPending ? (
            <LoadingState rows={4} />
          ) : inbox.isError ? (
            <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
          ) : inbox.data.content.length === 0 ? (
            <EmptyState title={t('inbox.empty')} hint={t('inbox.emptyHint')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {inbox.data.content.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-current={d.id === selectedId}
                    onClick={() => {
                      select(d.id);
                    }}
                    className={cn(
                      'border-line bg-surface flex w-full items-start gap-3 rounded-lg border p-3 text-left',
                      d.id === selectedId &&
                        'border-primary bg-primary-soft/40 shadow-[inset_3px_0_0_var(--color-primary)]',
                    )}
                  >
                    <FileText aria-hidden="true" className="text-muted mt-0.5 size-5 shrink-0" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold">{d.filename ?? d.title}</span>
                      <span className="text-muted text-xs">
                        {formatDateTime(d.createdAt)} · {formatSize(d.sizeBytes)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
          {selectedId ? (
            <SelectedDocument
              id={selectedId}
              onDone={() => {
                select(null);
              }}
            />
          ) : (
            <EmptyState title={t('inbox.pick')} />
          )}
        </Card>
      </div>
    </div>
  );
}

function SelectedDocument({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = useTranslation();
  const doc = useDocument(id);
  const types = useDocumentTypes();

  if (doc.isPending || types.isPending) return <LoadingState />;
  if (doc.isError) return <ErrorState error={doc.error} />;
  if (types.isError) return <ErrorState error={types.error} />;

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardTitle className="text-lg">{t('inbox.classifyTitle')}</CardTitle>
        <p className="text-muted text-[13px]">{doc.data.versions[0]?.filename}</p>
        {doc.data.duplicateOf && (
          <p className="bg-warning-soft text-warning rounded-md px-3 py-2 text-[13px]">
            {t('doc.duplicate', { ref: doc.data.duplicateOf.reference ?? doc.data.duplicateOf.title })}
          </p>
        )}
      </div>
      {/* On classe en lisant le document : l'aperçu est juste au-dessus du formulaire */}
      <DocumentViewer
        documentId={doc.data.id}
        title={doc.data.title}
        versions={doc.data.versions}
        heightClass="h-[55vh]"
      />
      {/* key : un nouveau formulaire propre pour chaque document */}
      <ClassifyForm key={doc.data.id} doc={doc.data} types={types.data} onDone={onDone} />
    </>
  );
}
