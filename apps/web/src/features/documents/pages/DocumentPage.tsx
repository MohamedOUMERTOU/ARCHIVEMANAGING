import {
  ArrowRightLeft,
  Download,
  Eye,
  FilePlus2,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  Send,
} from 'lucide-react';
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
import { formatDate, formatDateTime, formatSize } from '@/utils/format';
import { NewVersionDialog, ReclassifyDialog, RequestDialog } from '../components/DocumentDialogs';
import { DocumentViewer } from '../components/DocumentViewer';
import { LifecycleCard } from '../components/LifecycleCard';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { TextCard } from '../components/TextCard';
import { useDocument, useDownload } from '../hooks/useDocuments';
import type { DocumentDetail } from '../types';

type DialogName = 'version' | 'request' | 'reclassify' | 'hold' | null;
type Tab = 'document' | 'history';

// L'onglet est dans l'adresse (?onglet=…) : un lien peut ouvrir directement l'historique.
// « details » (ancien onglet Métadonnées) mène au document : la fiche y est affichée à côté de l'aperçu.
const TAB_PARAM: Record<Tab, string> = { document: '', history: 'historique' };
const TAB_FROM_PARAM: Partial<Record<string, Tab>> = { details: 'document', historique: 'history' };
const TABS: Tab[] = ['document', 'history'];
const TAB_LABEL = { document: 'doc.tabDocument', history: 'doc.tabHistory' } as const;

// Fiche masquée ou non : mémorisé sur ce poste
const SHEET_KEY = 'ged.documentSheet';
const readSheetOpen = () => {
  try {
    return localStorage.getItem(SHEET_KEY) !== 'hidden';
  } catch {
    return true;
  }
};

export default function DocumentPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TAB_FROM_PARAM[params.get('onglet') ?? ''] ?? 'document';
  const versionParam = Number(params.get('version')) || undefined;
  // Depuis un résultat de recherche : ouvrir à la page trouvée, mot cherché surligné
  const pageParam = Number(params.get('page')) || undefined;
  const queryParam = params.get('q') ?? undefined;
  const [sheetOpen, setSheetOpen] = useState(readSheetOpen);
  const toggleSheet = () => {
    setSheetOpen((open) => {
      try {
        localStorage.setItem(SHEET_KEY, open ? 'hidden' : 'shown');
      } catch {
        // stockage indisponible (navigation privée) : le choix vaut pour la page
      }
      return !open;
    });
  };
  const goTo = (next: Tab, versionNo?: number) => {
    const p: Record<string, string> = {};
    if (next !== 'document') p.onglet = TAB_PARAM[next];
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

      <div className="border-line flex flex-wrap items-end gap-2 border-b">
        <div role="tablist" aria-label={t('doc.tabsLabel')} className="flex gap-1">
          {TABS.map((name) => (
            <button
              key={name}
              role="tab"
              type="button"
              aria-selected={tab === name}
              onClick={() => {
                goTo(name, name === 'document' ? versionParam : undefined);
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
        {tab === 'document' && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 ml-auto"
            aria-expanded={sheetOpen}
            aria-controls="document-sheet"
            onClick={toggleSheet}
          >
            {sheetOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
            {sheetOpen ? t('doc.hideSheet') : t('doc.showSheet')}
          </Button>
        )}
      </div>

      <div role="tabpanel">
        {tab === 'history' ? (
          <HistoryTimeline documentId={doc.id} />
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-[999_1_560px]">
              {destroyed ? (
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
                  initialPage={pageParam}
                  initialQuery={queryParam}
                  onVersionChange={(versionNo) => {
                    goTo('document', versionNo);
                  }}
                />
              )}
            </div>
            {sheetOpen && (
              <aside
                id="document-sheet"
                aria-label={t('doc.sheetLabel')}
                className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 xl:max-w-[380px]"
              >
                <Sheet
                  doc={doc}
                  canWrite={canWrite}
                  shownVersion={destroyed ? undefined : (versionParam ?? current?.versionNo)}
                  onView={(versionNo) => {
                    goTo('document', versionNo);
                  }}
                />
              </aside>
            )}
          </div>
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

/** Fiche affichée à côté de l'aperçu : métadonnées, cycle de vie, original papier, conservation, versions. */
function Sheet({
  doc,
  canWrite,
  shownVersion,
  onView,
}: {
  doc: DocumentDetail;
  canWrite: boolean;
  /** Version en cours d'affichage dans l'aperçu */
  shownVersion: number | undefined;
  onView: (versionNo: number) => void;
}) {
  const { t } = useTranslation();
  const download = useDownload();
  const fields = doc.type?.metadataSchema ?? [];
  const rule = doc.retentionRule;
  const destroyed = doc.status === 'ELIMINE';
  const displayed = doc.versions.find((v) => v.versionNo === shownVersion);

  return (
    <>
      <Card className="flex flex-col gap-3">
        <CardTitle>
          {t('doc.metadata')}
          {doc.type && (
            <span className="text-muted font-sans text-[13px] font-normal"> · {doc.type.name}</span>
          )}
        </CardTitle>
        <dl className={SHEET_GRID}>
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

      {displayed && !destroyed && <TextCard documentId={doc.id} version={displayed} canWrite={canWrite} />}

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
        <dl className={SHEET_GRID}>
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

      <Card className="flex flex-col gap-0 p-0">
        <CardTitle className="px-5 pt-4 pb-2">{t('doc.versions')}</CardTitle>
        <ul>
          {doc.versions.map((v, i) => {
            const shown = v.versionNo === shownVersion;
            return (
              <li
                key={v.versionNo}
                aria-current={shown ? 'true' : undefined}
                className={cn(
                  'border-line/70 flex items-start gap-3 border-t border-l-4 px-4 py-2.5',
                  shown ? 'bg-primary-soft/60 border-l-primary' : 'border-l-transparent',
                )}
              >
                <span className="w-7 shrink-0 pt-0.5 font-semibold">v{v.versionNo}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] break-all" title={v.filename}>
                    {v.filename}
                  </span>
                  <span className="text-muted text-xs" title={`sha256 ${v.sha256}`}>
                    {formatDateTime(v.createdAt)} · {formatSize(v.sizeBytes)}
                    {v.replaceReason && <> · {v.replaceReason}</>}
                  </span>
                  {(i === 0 || shown) && (
                    <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {i === 0 && <Badge tone="success">{t('doc.current')}</Badge>}
                      {shown && !destroyed && (
                        <span className="text-primary-strong text-xs font-semibold">{t('doc.shown')}</span>
                      )}
                    </span>
                  )}
                </div>
                {!destroyed &&
                  (shown ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      aria-label={`${t('doc.view')} v${String(v.versionNo)}`}
                      onClick={() => {
                        onView(v.versionNo);
                      }}
                    >
                      <Eye aria-hidden="true" />
                    </Button>
                  ))}
                {!destroyed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    aria-label={`${t('doc.download')} v${String(v.versionNo)}`}
                    onClick={() => {
                      download.mutate({ id: doc.id, versionNo: v.versionNo, filename: v.filename });
                    }}
                  >
                    <Download aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

const SHEET_GRID = 'grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]';
