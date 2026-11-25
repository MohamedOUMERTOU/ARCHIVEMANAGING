import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from './RequireAuth';

// Chaque écran est un fichier JS séparé, chargé à la première visite
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const ExplorerPage = lazy(() => import('@/features/classification/pages/ExplorerPage'));
const DocumentPage = lazy(() => import('@/features/documents/pages/DocumentPage'));
const InboxPage = lazy(() => import('@/features/inbox/pages/InboxPage'));
const SearchPage = lazy(() => import('@/features/search/pages/SearchPage'));
const AuditPage = lazy(() => import('@/features/audit/pages/AuditPage'));
const SettingsLayout = lazy(() => import('@/features/settings/pages/SettingsLayout'));
const SettingsIndex = lazy(() => import('@/features/settings/pages/SettingsIndex'));
const PlanSettings = lazy(() => import('@/features/settings/pages/PlanSettings'));
const TypesSettings = lazy(() => import('@/features/settings/pages/TypesSettings'));
const RulesSettings = lazy(() => import('@/features/settings/pages/RulesSettings'));
const TagsSettings = lazy(() => import('@/features/settings/pages/TagsSettings'));
const UsersSettings = lazy(() => import('@/features/settings/pages/UsersSettings'));
const StorageSettings = lazy(() => import('@/features/settings/pages/StorageSettings'));
const OcrSettings = lazy(() => import('@/features/settings/pages/OcrSettings'));
const PhysicalLayout = lazy(() => import('@/features/physical/pages/PhysicalLayout'));
const LocationsPage = lazy(() => import('@/features/physical/pages/LocationsPage'));
const LoansPage = lazy(() => import('@/features/physical/pages/LoansPage'));
const LevelsPage = lazy(() => import('@/features/physical/pages/LevelsPage'));
const LifecycleLayout = lazy(() => import('@/features/lifecycle/pages/LifecycleLayout'));
const DuePage = lazy(() => import('@/features/lifecycle/pages/DuePage'));
const ListsPage = lazy(() => import('@/features/lifecycle/pages/ListsPage'));
const ListDetailPage = lazy(() => import('@/features/lifecycle/pages/ListDetailPage'));
const HoldsPage = lazy(() => import('@/features/lifecycle/pages/HoldsPage'));
const NotFoundPage = lazy(() => import('@/components/shared/NotFoundPage'));

export const routes: RouteObject[] = [
  {
    path: '/connexion',
    element: (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'explorateur', element: <ExplorerPage /> },
          { path: 'a-classer', element: <InboxPage /> },
          { path: 'recherche', element: <SearchPage /> },
          { path: 'documents/:id', element: <DocumentPage /> },
          { path: 'audit', element: <AuditPage /> },
          {
            path: 'archives-physiques',
            element: <PhysicalLayout />,
            children: [
              { index: true, element: <Navigate to="emplacements" replace /> },
              { path: 'emplacements', element: <LocationsPage /> },
              { path: 'prets', element: <LoansPage /> },
              { path: 'niveaux', element: <LevelsPage /> },
            ],
          },
          {
            path: 'parametrage',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <SettingsIndex /> },
              { path: 'plan', element: <PlanSettings /> },
              { path: 'types', element: <TypesSettings /> },
              { path: 'regles', element: <RulesSettings /> },
              { path: 'tags', element: <TagsSettings /> },
              { path: 'utilisateurs', element: <UsersSettings /> },
              { path: 'stockage', element: <StorageSettings /> },
              { path: 'ocr', element: <OcrSettings /> },
            ],
          },
          {
            path: 'cycle-de-vie',
            element: <LifecycleLayout />,
            children: [
              { index: true, element: <Navigate to="echeancier" replace /> },
              { path: 'echeancier', element: <DuePage /> },
              { path: 'bordereaux', element: <ListsPage /> },
              { path: 'bordereaux/:id', element: <ListDetailPage /> },
              { path: 'gels', element: <HoldsPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
