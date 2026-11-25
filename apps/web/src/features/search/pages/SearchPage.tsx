import { Info, ScanText, Search, X } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { FormField } from '@/components/shared/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  NodeSelect,
  STATUSES,
  StatusBadge,
  statusLabel,
  useDocumentSearch,
  useDocumentTypes,
  useTags,
  type DocumentStatus,
  type DocumentSummary,
  type SearchParams,
  snippetParts,
} from '@/features/documents';
import { cn } from '@/lib/cn';
import { formatDate, formatSize } from '@/utils/format';

const KEYS = ['q', 'in', 'typeId', 'nodeId', 'status', 'from', 'to', 'tag', 'sort'] as const;
const SORTS = ['relevance', 'date', 'title', 'reference', 'created'] as const;
const SCOPES = ['', 'meta', 'content'] as const;
const PAGE_SIZE = 12;

/** Les critères vivent dans l'adresse : une recherche se partage et se met en favori. */
function readParams(p: URLSearchParams): SearchParams {
  const get = (k: string) => p.get(k) ?? undefined;
  const status = get('status');
  const sort = get('sort');
  const scope = get('in');
  const q = get('q');
  return {
    q,
    in: scope === 'meta' || scope === 'content' ? scope : undefined,
    typeId: get('typeId'),
    nodeId: get('nodeId'),
    status: STATUSES.includes(status as DocumentStatus) ? (status as DocumentStatus) : undefined,
    from: get('from'),
    to: get('to'),
    tag: get('tag'),
    // Avec des mots-clés, les résultats les plus pertinents d'abord (sauf autre choix)
    sort: SORTS.includes(sort as (typeof SORTS)[number])
      ? (sort as SearchParams['sort'])
      : q
        ? 'relevance'
        : undefined,
    page: Number(p.get('page') ?? 0) || 0,
    size: PAGE_SIZE,
  };
}

export default function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const query = readParams(params);
  const results = useDocumentSearch(query);
  const types = useDocumentTypes();
  const tags = useTags();

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    KEYS.forEach((k) => {
      const v = data.get(k);
      if (typeof v === 'string' && v.trim() !== '') next.set(k, v.trim());
    });
    setParams(next);
  };
  const goTo = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] font-semibold">{t('search.title')}</h1>

      {/* key : réinitialise les champs quand l'adresse change (bouton Réinitialiser, retour arrière) */}
      <form
        key={params.toString()}
        role="search"
        aria-label={t('search.formLabel')}
        onSubmit={onSubmit}
        className="border-line bg-surface flex flex-col gap-4 rounded-xl border p-5"
      >
        <div className="flex flex-wrap gap-2.5">
          <label htmlFor="s-q" className="sr-only">
            {t('search.q')}
          </label>
          <div className="border-line-strong focus-within:border-primary text-muted flex h-12 min-w-0 flex-[1_1_380px] items-center gap-2.5 rounded-lg border px-4">
            <Search aria-hidden="true" className="size-5 shrink-0" />
            <input
              id="s-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder={t('search.q')}
              className="text-ink min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </div>
          <Button type="submit" size="lg" className="h-12">
            {t('search.submit')}
          </Button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">{t('search.scope')}</legend>
          <span aria-hidden="true" className="text-ink-soft text-[13px] font-medium">
            {t('search.scope')}
          </span>
          <div className="border-line-strong inline-flex overflow-hidden rounded-lg border">
            {SCOPES.map((s) => (
              <label
                key={s || 'all'}
                className="has-checked:bg-primary-soft has-checked:text-primary-strong has-focus-visible:outline-primary border-line-strong text-ink-soft flex h-9 cursor-pointer items-center border-l px-3.5 text-[13px] font-medium first:border-l-0 has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:-outline-offset-2"
              >
                <input
                  type="radio"
                  name="in"
                  value={s}
                  defaultChecked={(query.in ?? '') === s}
                  className="sr-only"
                />
                {t(`search.scopes.${s || 'all'}`)}
              </label>
            ))}
          </div>
          <p className="text-muted text-xs">{t('search.scopeHint')}</p>
        </fieldset>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          <FormField id="s-type" label={t('search.type')}>
            <Select id="s-type" name="typeId" defaultValue={query.typeId ?? ''}>
              <option value="">{t('search.allTypes')}</option>
              {types.data?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="s-node" label={t('search.folder')}>
            <NodeSelect
              id="s-node"
              name="nodeId"
              defaultValue={query.nodeId ?? ''}
              emptyLabel={t('search.allFolders')}
            />
          </FormField>
          <FormField id="s-status" label={t('search.status')}>
            <Select id="s-status" name="status" defaultValue={query.status ?? ''}>
              <option value="">{t('search.allStatuses')}</option>
              {STATUSES.filter((s) => s !== 'A_CLASSER').map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="s-tag" label={t('search.tag')}>
            <Select id="s-tag" name="tag" defaultValue={query.tag ?? ''}>
              <option value="">{t('search.allTags')}</option>
              {tags.data?.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="s-from" label={t('search.from')}>
            <Input id="s-from" name="from" type="date" defaultValue={query.from} className="h-10" />
          </FormField>
          <FormField id="s-to" label={t('search.to')}>
            <Input id="s-to" name="to" type="date" defaultValue={query.to} className="h-10" />
          </FormField>
          <FormField id="s-sort" label={t('search.sort')}>
            <Select id="s-sort" name="sort" defaultValue={query.sort ?? 'date'}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`search.sorts.${s}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              setParams(new URLSearchParams());
            }}
          >
            {t('search.reset')}
          </Button>
        </div>
      </form>

      {results.isPending ? (
        <LoadingState />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : results.data.totalElements === 0 ? (
        <EmptyState title={t('search.empty')} hint={t('search.emptyHint')} />
      ) : (
        <section aria-live="polite" className="flex flex-col gap-4">
          <p className="font-semibold">{t('search.results', { count: results.data.totalElements })}</p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {results.data.content.map((d) => (
              <ResultCard
                key={d.id}
                doc={d}
                query={query.q}
                className={d.hits.length ? 'sm:col-span-2' : undefined}
              />
            ))}
          </ul>
          {results.data.totalPages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={results.data.number === 0}
                onClick={() => {
                  goTo(results.data.number - 1);
                }}
              >
                {t('common.previous')}
              </Button>
              <span className="text-muted text-[13px]">
                {t('common.page', { page: results.data.number + 1, total: results.data.totalPages })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={results.data.number + 1 >= results.data.totalPages}
                onClick={() => {
                  goTo(results.data.number + 1);
                }}
              >
                {t('common.next')}
              </Button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}

function ResultCard({
  doc,
  query,
  className,
}: {
  doc: DocumentSummary;
  query: string | undefined;
  className?: string | undefined;
}) {
  const { t } = useTranslation();
  const [info, setInfo] = useState(false);
  const infoId = `info-${doc.id}`;

  return (
    <li
      className={cn(
        'border-line bg-surface hover:border-primary/40 relative flex min-h-56 flex-col rounded-xl border',
        className,
      )}
    >
      <div className="bg-bg flex items-center justify-between rounded-t-xl px-4 py-3">
        <Badge tone="info">{doc.typeName ?? '—'}</Badge>
        <button
          type="button"
          aria-label={t('search.info', { title: doc.title })}
          aria-expanded={info}
          aria-controls={infoId}
          onClick={() => {
            setInfo((v) => !v);
          }}
          className="border-line-strong bg-surface text-primary hover:bg-primary-soft flex size-9 items-center justify-center rounded-full border"
        >
          <Info aria-hidden="true" className="size-[18px]" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <h2 className="text-[15px] leading-snug font-semibold">
          <Link to={`/documents/${doc.id}`} className="text-ink hover:text-primary no-underline">
            {doc.title}
          </Link>
        </h2>
        <p className="text-muted text-[13px]">{doc.nodeTitle}</p>
        {doc.hits.length > 0 && (
          <ul aria-label={t('search.hits')} className="flex flex-col gap-2 py-1">
            {doc.hits.map((h) => (
              <li
                key={h.page}
                className="bg-bg flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg px-3 py-2"
              >
                <span className="text-info inline-flex shrink-0 items-center gap-1 pt-px text-xs font-semibold">
                  <ScanText aria-hidden="true" className="size-3.5" />
                  {t('search.page', { n: h.page })}
                </span>
                <p dir="auto" className="text-ink-soft min-w-0 flex-[1_1_240px] text-[13px] leading-relaxed">
                  …{' '}
                  {snippetParts(h.snippet).map((part, i) =>
                    part.match ? (
                      <mark key={i} className="text-ink rounded-sm bg-[#FDE68A] px-0.5">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}{' '}
                  …
                </p>
                <Link
                  to={`/documents/${doc.id}?${new URLSearchParams({ page: String(h.page), q: query ?? '' }).toString()}`}
                  className="shrink-0 text-xs whitespace-nowrap"
                >
                  {t('search.openAt', { n: h.page })}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="text-muted mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-ink-soft font-mono">{doc.reference}</span>
          <span>{formatDate(doc.documentDate)}</span>
          <StatusBadge status={doc.status} legalHold={doc.legalHold} />
        </div>
      </div>

      {info && (
        <div
          id={infoId}
          role="region"
          aria-label={t('search.info', { title: doc.title })}
          className="bg-surface absolute inset-0 z-10 flex flex-col rounded-xl"
        >
          <div className="border-line flex items-center gap-2 border-b py-2 pr-2 pl-4">
            <strong className="flex-1">{doc.title}</strong>
            <button
              type="button"
              aria-label={t('search.close')}
              onClick={() => {
                setInfo(false);
              }}
              className="hover:bg-bg flex size-8 items-center justify-center rounded-md"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <dl className="grid flex-1 grid-cols-[96px_minmax(0,1fr)] content-start gap-x-3 gap-y-1.5 overflow-auto px-4 py-3 text-[13px]">
            <dt className="text-muted">Cote</dt>
            <dd className="font-mono">{doc.reference ?? '—'}</dd>
            <dt className="text-muted">Dossier</dt>
            <dd>{doc.nodeTitle ?? '—'}</dd>
            <dt className="text-muted">Conservation</dt>
            <dd>{formatDate(doc.retentionUntil)}</dd>
            <dt className="text-muted">Fichier</dt>
            <dd className="break-words">
              {doc.filename} · {formatSize(doc.sizeBytes)} ·{' '}
              {t('search.versions', { count: doc.versionCount })}
            </dd>
            {doc.tags.length > 0 && (
              <>
                <dt className="text-muted">Tags</dt>
                <dd>{doc.tags.join(', ')}</dd>
              </>
            )}
          </dl>
          <div className="px-4 pb-4">
            <Link to={`/documents/${doc.id}`} className={buttonVariants({ size: 'sm', className: 'w-full' })}>
              {t('search.open')}
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
