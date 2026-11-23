import { ArrowRightLeft, Download, Eye, FilePlus2, Lock, Send } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { HoldPickerDialog } from '@/features/lifecycle';
import { OriginalCard } from '@/features/physical';
import { cn } from '@/lib/cn';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { formatDate, formatDateTime, formatSize, shortHash } from '@/utils/format';
import { NewVersionDialog, ReclassifyDialog, RequestDialog } from '../components/DocumentDialogs';
import { DocumentViewer } from '../components/DocumentViewer';
import { LifecycleCard } from '../components/LifecycleCard';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { useDocument, useDownload } from '../hooks/useDocuments';
import type { DocumentDetail } from '../types';

type DialogName = 'version' | 'request' | 'reclassify' | 'hold' | null;
type Tab = 'preview' | 'details' | 'history';

// L'onglet est dans l'adresse (?onglet=…) : un lien peut ouvrir directement l'historique
const TAB_PARAM: Record<Tab, string> = { preview: '', details: 'details', history: 'historique' };
const TAB_FROM_PARAM: Partial<Record<string, Tab>> = { details: 'details', historique: 'history' };
const TABS: Tab[] = ['preview', 'details', 'history'];
const TAB_LABEL = {
  preview: 'doc.tabPreview',
  details: 'doc.tabDetails',
  history: 'doc.tabHistory',
} as const;

export default function DocumentPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TAB_FROM_PARAM[params.get('onglet') ?? ''] ?? 'preview';
  const versionParam = Number(params.get('version')) || undefined;
  const goTo = (next: Tab, versionNo?: number) => {
    const p: Record<string, string> = {};
    if (next !== 'preview') p.onglet = TAB_PARAM[next];
    if (versionNo !== undefined) p.version = String(versionNo);
    setParams(p, { replace: true });
  };
  const { data: doc, isPending, isError, error, refetch } = useDocument(id);
  const user = useAuthStore((s) => s.user);
  const download = useDownload();
  const [dialog, setDialog] = useState<DialogName>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const current = doc.versions[0];
  const filed = doc.status !== 'A_CLASSER';
  // Gelé, proposé à l'élimination, éliminé ou versé : le document est figé
  const frozen = doc.legalHold || ['A_ELIMINER', 'ELIMINE', 'VERSE'].includes(doc.status);
  const destroyed = doc.status === 'ELIMINE';
  const canWrite = hasPermission(user, 'documents.write') && !frozen;
  const canReclassify = filed && hasPermission(user, 'documents.reclassify') && !frozen;
  const canHold =
    filed &&
    !['ELIMINE', 'VERSE'].includes(doc.status) &&
    (hasPermission(user, 'lifecycle.manage') || hasPermission(user, 'lifecycle.approve'));

  return (
    <div className="flex flex-col gap-4">
      {doc.node && (
        <p className="text-muted text-[13px]">
          <Link to={`/explorateur?node=${doc.node.id}`} className="text-muted">
            {doc.node.path}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[28px] font-semibold text-balance">{doc.title}</h1>
            <StatusBadge status={doc.status} legalHold={doc.legalHold} />
          </div>
          <p className="text-muted">
            {doc.reference && (
              <>
                {t('doc.reference')} <span className="text-ink-soft font-mono">{doc.reference}</span> ·{' '}
              </>
            )}
            {t('doc.createdAt')} {formatDateTime(doc.createdAt)} · {doc.createdBy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && !destroyed && (
            <Button
              variant="secondary"
              disabled={download.isPending}
              onClick={() => {
                download.mutate({ id: doc.id, versionNo: current.versionNo, filename: current.filename });
              }}
            >
              <Download aria-hidden="true" /> {t('doc.download')}
            </Button>
          )}
          {canWrite && (
            <Button
              variant="secondary"
              onClick={() => {
                setDialog('version');
              }}
            >
              <FilePlus2 aria-hidden="true" /> {t('doc.newVersion')}
            </Button>
          )}
          {canReclassify && (
            <Button
              variant="secondary"
              onClick={() => {
                setDialog('reclassify');
              }}
            >
              <ArrowRightLeft aria-hidden="true" /> {t('doc.reclassify')}
            </Button>
          )}
          {canHold && (
            <Button
              variant="secondary"
              onClick={() => {
                setDialog('hold');
              }}
            >
              <Lock aria-hidden="true" /> Placer sous gel
            </Button>
          )}
          {!destroyed && (
            <Button
              onClick={() => {
                setDialog('request');
              }}
            >
              <Send aria-hidden="true" /> {t('doc.request')}
            </Button>
          )}
        </div>
      </div>

      {!filed && (
        <div className="border-warning/30 bg-warning-soft text-warning flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
          {t('doc.toFileNotice')}
          <Link
            to={`/a-classer?doc=${doc.id}`}
            className={buttonVariants({ size: 'sm', variant: 'secondary' })}
          >
            {t('doc.fileIt')}
          </Link>
        </div>
      )}
      {(destroyed || doc.status === 'VERSE' || doc.status === 'A_ELIMINER') && (
        <div
          role="status"
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            doc.status === 'A_ELIMINER'
              ? 'border-warning/30 bg-warning-soft text-warning'
              : 'border-line bg-bg text-ink-soft',
          )}
        >
          {destroyed
            ? 'Document éliminé : son contenu a été détruit. Sa notice et son historique sont conservés comme preuve.'
            : doc.status === 'VERSE'
              ? 'Document versé aux archives : il est consultable ici mais ne peut plus être modifié.'
              : "Document proposé à l'élimination : il est figé tant que le bordereau est en cours."}
          {doc.lifecycle.pendingList && (
            <>
              {' '}
              <Link to={`/cycle-de-vie/bordereaux/${doc.lifecycle.pendingList.id}`}>
                Voir le bordereau {doc.lifecycle.pendingList.number}
              </Link>
            </>
          )}
        </div>
      )}
      {doc.duplicateOf && (
        <div className="border-warning/30 bg-warning-soft text-warning rounded-lg border px-4 py-3">
          <Link to={`/documents/${doc.duplicateOf.id}`} className="text-warning">
            {t('doc.duplicate', { ref: doc.duplicateOf.reference ?? doc.duplicateOf.title })}
          </Link>
        </div>
      )}

      <div role="tablist" aria-label={t('doc.tabsLabel')} className="border-line flex gap-1 border-b">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={tab === name}
            onClick={() => {
              goTo(name, name === 'preview' ? versionParam : undefined);
            }}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 font-medium',
              tab === name
                ? 'border-primary text-primary-strong font-semibold'
                : 'text-ink-soft border-transparent',
            )}
          >
            {t(TAB_LABEL[name])}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'history' ? (
          <HistoryTimeline documentId={doc.id} />
        ) : tab === 'details' ? (
          <Details
            doc={doc}
            onView={(versionNo) => {
              goTo('preview', versionNo);
            }}
          />
        ) : destroyed ? (
          <EmptyState
            title="Contenu détruit"
            hint="Ce document a été éliminé à l'issue de sa durée de conservation. Consultez l'onglet Historique pour le bordereau."
          />
        ) : (
          <DocumentViewer
            documentId={doc.id}
            title={doc.title}
            versions={doc.versions}
            versionNo={versionParam}
            onVersionChange={(versionNo) => {
              goTo('preview', versionNo);
            }}
          />
        )}
      </div>

      <NewVersionDialog documentId={doc.id} open={dialog === 'version'} onOpenChange={close} />
      {dialog === 'hold' && (
        <HoldPickerDialog
          documentIds={[doc.id]}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      <RequestDialog
        documentId={doc.id}
        open={dialog === 'request'}
        onOpenChange={close}
        canRequestOriginal={filed}
      />
      <ReclassifyDialog
        documentId={doc.id}
        open={dialog === 'reclassify'}
        onOpenChange={close}
        currentNodeId={doc.node?.id ?? null}
      />
    </div>
  );
}

/** L'original papier ne se gère plus une fois le document éliminé ou versé. */
const filedForPaper = (doc: DocumentDetail) => !['A_CLASSER', 'ELIMINE', 'VERSE'].includes(doc.status);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </>
  );
}

function Details({ doc, onView }: { doc: DocumentDetail; onView: (versionNo: number) => void }) {
  const { t } = useTranslation();
  const download = useDownload();
  const fields = doc.type?.metadataSchema ?? [];
  const rule = doc.retentionRule;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
        <Card className="flex flex-col gap-3">
          <CardTitle>
            {t('doc.metadata')}
            {doc.type && (
              <span className="text-muted font-sans text-[13px] font-normal"> · {doc.type.name}</span>
            )}
          </CardTitle>
          <dl className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-x-4 gap-y-2.5">
            <Row label={t('doc.date')}>{formatDate(doc.documentDate)}</Row>
            {fields.map((f) => {
              const v = doc.metadata[f.key];
              return (
                <Row key={f.key} label={f.label}>
                  {typeof v === 'string' || typeof v === 'number' ? String(v) : '—'}
                </Row>
              );
            })}
            <Row label={t('doc.tags')}>
              {doc.tags.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <Badge key={tag} tone="info">
                      {tag}
                    </Badge>
                  ))}
                </span>
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </Card>

        <LifecycleCard doc={doc} />

        {filedForPaper(doc) && (
          <OriginalCard
            documentId={doc.id}
            documentTitle={doc.title}
            location={doc.physicalLocation}
            openLoan={doc.openLoan}
          />
        )}

        <Card className="flex flex-col gap-3">
          <CardTitle>{t('doc.retention')}</CardTitle>
          <dl className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-x-4 gap-y-2.5">
            <Row label={t('doc.rule')}>
              {rule ? (
                <>
                  {rule.name} ·{' '}
                  {rule.durationYears === null ? t('doc.unlimited') : `${String(rule.durationYears)} ans`}
                  {rule.inherited && <span className="text-muted font-normal"> ({t('doc.inherited')})</span>}
                </>
              ) : (
                '—'
              )}
            </Row>
            <Row label={t('doc.until')}>
              {doc.retentionUntil
                ? formatDate(doc.retentionUntil)
                : rule?.durationYears === null
                  ? t('doc.unlimited')
                  : rule
                    ? t('doc.untilPending')
                    : '—'}
            </Row>
            <Row label={t('doc.finalAction')}>{rule ? t(`doc.finalActions.${rule.finalAction}`) : '—'}</Row>
          </dl>
        </Card>
      </div>

      <Card className="flex min-w-0 flex-[1_1_380px] flex-col gap-0 p-0">
        <CardTitle className="px-5 pt-4 pb-2">{t('doc.versions')}</CardTitle>
        <ul>
          {doc.versions.map((v, i) => (
            <li
              key={v.versionNo}
              className="border-line/70 flex flex-wrap items-center gap-3 border-t px-5 py-3"
            >
              <span className="w-8 font-semibold">v{v.versionNo}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{v.filename}</span>
                <span className="text-muted text-xs">
                  {formatDateTime(v.createdAt)} · {v.createdBy} · {formatSize(v.sizeBytes)}
                  {v.replaceReason && <> · {v.replaceReason}</>}
                </span>
              </div>
              <span title={v.sha256} className="text-ink-soft font-mono text-xs">
                sha256 {shortHash(v.sha256)}
              </span>
              {i === 0 && <Badge tone="success">{t('doc.current')}</Badge>}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t('doc.view')} v${String(v.versionNo)}`}
                onClick={() => {
                  onView(v.versionNo);
                }}
              >
                <Eye aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t('doc.download')} v${String(v.versionNo)}`}
                onClick={() => {
                  download.mutate({ id: doc.id, versionNo: v.versionNo, filename: v.filename });
                }}
              >
                <Download aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
