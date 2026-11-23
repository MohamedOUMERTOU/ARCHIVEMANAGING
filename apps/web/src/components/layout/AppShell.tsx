import { LogOut, Search, Upload } from 'lucide-react';
import { Suspense, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LoadingState } from '@/components/shared/states';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { NotificationsMenu } from '@/features/notifications/NotificationsMenu';
import { cn } from '@/lib/cn';
import { hasPermission, useAuthStore } from '@/stores/auth.store';
import { breadcrumbs } from './breadcrumbs';
import { MODULES } from './modules';
import { AppLogo, navItems } from './nav-items';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export function AppShell() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const items = navItems.filter(
    (item) => !item.permissions || item.permissions.some((p) => hasPermission(user, p)),
  );

  return (
    <div className="flex min-h-full flex-wrap">
      <a
        href="#contenu"
        className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:p-2"
      >
        Aller au contenu
      </a>

      {/* Barre latérale bleu nuit : pleine hauteur sur grand écran, en haut sur téléphone */}
      <nav
        aria-label={t('nav.main')}
        className="bg-nav flex w-full flex-col gap-1 px-3 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto"
      >
        <Link
          to="/"
          className="font-display mb-3 flex items-center gap-2.5 px-2.5 text-[17px] font-semibold text-white no-underline"
        >
          <span className="bg-primary flex size-8 items-center justify-center rounded-lg">
            <AppLogo aria-hidden="true" className="size-[18px] text-white" />
          </span>
          {t('app.name')}
        </Link>
        <div className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
          {items.map(({ to, labelKey, icon: Icon, module }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 font-medium no-underline',
                  isActive ? 'bg-primary text-white' : 'text-nav-ink hover:bg-nav-raised hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    aria-hidden="true"
                    className={cn('size-[18px] shrink-0', isActive ? 'text-white' : MODULES[module].nav)}
                  />
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </div>
        {user && (
          <p className="border-nav-line text-nav-muted mt-auto hidden border-t px-2.5 pt-3 text-xs md:block">
            {user.organization.name}
          </p>
        )}
      </nav>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <TopBar />
        <main id="contenu" className="min-w-0 flex-1 p-6">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/** En-tête : fil d'Ariane, recherche rapide, dépôt, notifications, compte. */
function TopBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [q, setQ] = useState('');
  const crumbs = breadcrumbs(pathname, (key) => t(key));
  const canWrite = hasPermission(user, 'documents.write');

  return (
    <header className="border-line bg-surface flex min-h-16 flex-wrap items-center gap-3 border-b px-6 py-2.5">
      {crumbs.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="min-w-0">
          <ol className="text-muted flex flex-wrap items-center gap-1.5 text-[13px]">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${String(i)}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">›</span>}
                {c.to ? (
                  <Link to={c.to} className="text-muted hover:text-ink no-underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink font-semibold">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <form
        role="search"
        className="ml-auto"
        onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
          e.preventDefault();
          const term = q.trim();
          void navigate(term ? `/recherche?q=${encodeURIComponent(term)}` : '/recherche');
          setQ('');
        }}
      >
        <label htmlFor="quick-search" className="sr-only">
          Rechercher un document
        </label>
        <div className="border-line-strong bg-bg flex h-10 w-64 items-center gap-2 rounded-full border px-3.5">
          <Search aria-hidden="true" className="text-muted size-4 shrink-0" />
          <input
            id="quick-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            placeholder="Rechercher…"
            className="placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none"
          />
        </div>
      </form>

      {canWrite && (
        <Link to="/a-classer" className={buttonVariants()}>
          <Upload aria-hidden="true" /> {t('dashboard.deposit')}
        </Link>
      )}
      <NotificationsMenu />
      {user && <AccountMenu />}
    </header>
  );
}

function AccountMenu() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  if (!user) return null;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${t('header.account')} : ${user.fullName}`}
        className="bg-nav flex size-10 items-center justify-center rounded-full text-[13px] font-semibold text-white"
      >
        {initials(user.fullName)}
      </PopoverTrigger>
      <PopoverContent aria-label={t('header.account')} className="w-72">
        <div className="flex flex-col gap-0.5 px-2 pt-1 pb-3">
          <span className="font-semibold">{user.fullName}</span>
          <span className="text-muted text-[13px]">{user.email}</span>
          {user.roles.length > 0 && <span className="text-muted text-[13px]">{user.roles.join(', ')}</span>}
        </div>
        <div className="border-line border-t px-2 py-2.5 text-[13px]">
          <span className="text-muted">{t('header.organization')} : </span>
          <span className="font-medium">{user.organization.name}</span>
        </div>
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() => {
            logout.mutate();
          }}
          className="text-danger hover:bg-danger-soft flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-medium"
        >
          <LogOut aria-hidden="true" className="size-4" /> {t('header.logout')}
        </button>
      </PopoverContent>
    </Popover>
  );
}
