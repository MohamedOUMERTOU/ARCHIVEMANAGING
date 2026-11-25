# GED — Architecture du front-end

## 1. Analyse des besoins

| Besoin (maquettes) | Conséquence technique |
|---|---|
| Application interne riche, beaucoup d'écrans, utilisateurs connectés | SPA React, routes protégées, code découpé par écran (lazy loading) |
| Données serveur partout (arbre, documents, recherche, historique) | Cache serveur avec TanStack Query ; états chargement / erreur / vide / succès sur chaque écran |
| Formulaires nombreux (dépôt, métadonnées, paramétrage, demandes) | React Hook Form + Zod, schémas réutilisables |
| Tableaux denses (journal, prêts, échéances, utilisateurs) | AG Grid Community via le composant commun `DataGrid` |
| Droits par rôle et par dossier | CASL côté interface pour masquer/griser les actions (le serveur reste la vraie barrière) |
| Multi-société, jeton JWT, serveur Spring Boot | Client HTTP centralisé, intercepteurs, renouvellement du jeton |
| Interface en français, autres langues possibles | i18next dès le départ, textes dans `i18n/locales` |
| Dépôt de fichiers, arbre réorganisable | React Dropzone, dnd-kit (au moment de ces écrans) |

## 2. Dépendances

Une dépendance n'est ajoutée **qu'au moment où une fonctionnalité en a besoin**.

### Installées dès maintenant (socle)

| Paquet | Rôle |
|---|---|
| react, react-dom | Bibliothèque d'interface |
| typescript 6.0 | Typage strict. Pas la 7 : typescript-eslint ne la supporte pas encore |
| vite + @vitejs/plugin-react | Serveur de développement et build |
| react-router | Routage, routes protégées |
| tailwindcss + @tailwindcss/vite | Styles utilitaires, tokens de couleurs des maquettes |
| class-variance-authority, clsx, tailwind-merge, @radix-ui/react-slot, @radix-ui/react-label | Base des composants shadcn/ui (variantes, fusion de classes, accessibilité) |
| lucide-react | Icônes |
| sonner | Notifications (« Document classé », erreurs) |
| axios | Client HTTP centralisé, intercepteurs |
| @tanstack/react-query | Cache et synchronisation des données serveur |
| zustand | État global léger : session (jeton en mémoire), préférences d'interface |
| react-hook-form, zod, @hookform/resolvers | Formulaires et validation |
| i18next, react-i18next | Traductions |
| msw | Simule l'API Spring Boot tant qu'elle n'existe pas (développement et tests) |
| vitest, jsdom, @testing-library/* | Tests unitaires et de composants |
| eslint, typescript-eslint, plugins React, prettier | Qualité et formatage |

### Versions bloquées par Node 20

La machine de développement reste sur Node 20.19, qui n'est plus maintenu depuis avril 2026. Quatre paquets sont donc gardés sur la dernière version compatible :

| Paquet | Version utilisée | Dernière version | Raison |
|---|---|---|---|
| vitest | 4.1 | 5.x | Vitest 5 exige Node 22.12+ (`Map.groupBy`) |
| jsdom | 27.4 | 31.x | jsdom 31 exige Node 22.22+ (undici 8) |
| msw | 2.x | 3.x | MSW 3 utilise `Set.prototype.intersection` (Node 22+) |
| @testing-library/jest-dom | 6.x | 8.x | Les types de la version 8 sont faits pour Vitest 5 |

Après un passage à Node 24 (`nvm install 24 && nvm use 24`), on pourra les mettre à jour. Avec MSW 3, l'option `onUnhandledRequest` devient `onUnhandledFrame`.

### Ajoutées plus tard, avec leur écran

| Paquet | Quand |
|---|---|
| ag-grid-community, ag-grid-react, @ag-grid-community/locale (v36, Community, licence MIT) | **Installé** : toutes les grilles (documents, audit, prêts, règles, tags, utilisateurs) via `components/shared/DataGrid.tsx` : tri, filtres de colonne, filtre rapide, pagination, export CSV, thème aux couleurs de l'application, textes en français. Chargé dans un fichier à part (`ag-grid-*.js`). Les modules Enterprise (licence payante) ne sont pas utilisés |
| pdfjs-dist 6.5 (pdf.js, licence Apache 2.0) | **Installé** : visionneuse de la page document (`features/documents/components/viewer/`) : défilement continu, vignettes, zoom, ajustement, rotation, recherche surlignée (Ctrl+F). Chargé à la demande (~1 Mo, plus le worker). Polices, tables de caractères et décodeurs wasm sont servis par l'application sous `/pdfjs/` (plugin `ged-pdfjs-assets` de `vite.config.ts`) ; la politique de sécurité autorise `wasm-unsafe-eval` pour ces décodeurs, et nginx sert les `.mjs` en JavaScript. Le paquet annonce Node 22+, mais il ne s'exécute que dans le navigateur (l'image Docker construit en Node 22) ; les tests remplacent la visionneuse par une doublure |
| react-dropzone | **Installé** : écran « À classer » |
| date-fns | **Installé** : dates en français |
| @radix-ui/react-dialog | **Installé** : nouvelle version, demandes, reclassement |
| @dnd-kit/* | Réorganisation du plan de classement |
| @casl/ability, @casl/react | Menus d'actions selon les droits |
| recharts | Graphiques du tableau de bord |
| motion | Transitions, seulement si utile |
| @playwright/test | Parcours de bout en bout (connexion → dépôt → classement) |
| tiptap, react-markdown | Pas prévus : aucun écran n'en a besoin pour l'instant |

## 3. Organisation du code

```
apps/web/src/
├── app/
│   ├── config/        # variables d'environnement typées
│   ├── providers/     # QueryClient, i18n, notifications, routeur
│   └── router/        # définition des routes, garde d'authentification
├── components/
│   ├── ui/            # composants shadcn/ui (Button, Input, Card…)
│   ├── shared/        # composants métier réutilisables (états vide/erreur…)
│   └── layout/        # coque de l'application (en-tête, menu)
├── features/          # un dossier par fonctionnalité, autonome
│   ├── auth/          # connexion, session (api/, hooks/, components/, schemas/, pages/)
│   ├── dashboard/     # tableau de bord
│   ├── classification/# plan de classement, explorateur
│   ├── documents/     # fiche, visionneuse (components/viewer/), texte reconnu
│   ├── inbox/         # « À classer » et dépôt
│   ├── search/        # recherche (métadonnées et contenu)
│   ├── physical/      # emplacements, niveaux, prêts
│   ├── lifecycle/     # échéancier, bordereaux, gels juridiques
│   ├── audit/         # journal d'audit
│   ├── notifications/ # menu des notifications
│   └── settings/      # paramétrage (dont stockage et reconnaissance de texte)
├── hooks/             # hooks génériques
├── lib/               # utilitaires techniques (cn, …)
├── services/
│   ├── api/           # instance axios, intercepteurs, erreurs normalisées
│   └── endpoints/     # chemins de l'API, regroupés par domaine
├── stores/            # stores Zustand
├── types/             # types partagés (contrat d'API)
├── utils/             # fonctions pures (arbres, dates…)
├── i18n/locales/{fr,en}/
├── mocks/             # API simulée (MSW)
└── main.tsx
```

Règle : une fonctionnalité utilisée ailleurs expose son API publique dans son `index.ts` (hooks, composants, types) ; on n'importe jamais les fichiers internes d'une autre fonctionnalité. Seule exception : le routeur (`app/router/routes.tsx`) charge les pages par leur chemin, pour que chaque écran reste dans un fichier à part (lazy loading). Le code partagé va dans `components/shared`, `hooks`, `utils` ou `services`.

## 4. Authentification avec Spring Boot

- `POST /api/auth/login` renvoie un **jeton d'accès** (courte durée) dans le corps et pose un **jeton de rafraîchissement** dans un cookie `HttpOnly; Secure; SameSite=Strict`.
- Le jeton d'accès reste **en mémoire** (store Zustand non persisté), jamais dans `localStorage` : un script injecté ne peut pas le lire.
- Au rechargement de la page, l'application appelle `POST /api/auth/refresh` (le cookie part tout seul) pour récupérer un jeton.
- Intercepteur de réponse : sur un `401`, une seule tentative de rafraîchissement est partagée par toutes les requêtes en attente. En cas d'échec, déconnexion et retour à l'écran de connexion.
- Toutes les erreurs sont converties en `ApiError` (statut, code, message, erreurs par champ) : un format unique pour l'interface. Le format attendu côté Spring Boot est `ProblemDetail` (RFC 9457).

## 5. Mise en œuvre par étapes

1. **Socle** : outillage, structure, client HTTP, session, i18n, coque, connexion, plan de classement en lecture (API simulée).
2. Explorateur et fiche document.
3. « À classer » et dépôt (react-dropzone).
4. Recherche avec actions (CASL).
5. Paramétrage.
6. Archives physiques, prêts, récolement.
7. Cycle de vie, versements, audit (AG Grid).
8. Tableau de bord (Recharts), parcours Playwright.

Chaque étape se termine par : vérification des types, lint, tests, build.

## 6. Commandes

```bash
pnpm install          # à la racine du dépôt
pnpm dev              # http://localhost:5173, avec l'API simulée (MSW)
pnpm test             # Vitest
pnpm lint             # ESLint (règles strictes typescript-eslint)
pnpm typecheck        # TypeScript
pnpm build            # build de production, sans le simulateur
```

Compte de démonstration de l'API simulée : `admin@exemple.com` / `demo1234`.
Pour brancher le vrai serveur Spring Boot (port 8080) : mettre `VITE_API_MOCKS=false` dans `apps/web/.env.development.local`. Vite transmet alors `/api` au port 8080.
