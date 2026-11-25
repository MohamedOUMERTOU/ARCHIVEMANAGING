# GED Archives

Gestion d'archives papier et numériques, multi-société : plan de classement, dépôt et classement des documents, versions, durées de conservation, historique de chaque document, journal d'audit chaîné.

| Dossier | Contenu |
|---|---|
| `apps/server` | API Java 25 · Spring Boot 4.2 · PostgreSQL · Flyway |
| `apps/web` | Interface React 19 · TypeScript · Vite · Tailwind · TanStack Query · AG Grid |
| `deploy/minio` | Préparation de MinIO : bucket, compte applicatif et ses droits |
| `docs/` | Architecture, diagramme de classes, choix du front-end |
| `apps/api` | Ancien prototype NestJS, gardé comme référence du modèle de données (non utilisé) |

## Déploiement avec Docker

Prérequis : Docker Desktop (ou Docker Engine + Compose v2), environ 5 Go d'espace libre pour les images.

```bash
cp .env.example .env          # puis changer les mots de passe et secrets (base, JWT, MinIO)
docker compose up -d --build
```

L'application est servie sur **http://localhost:8088** (variable `WEB_PORT`).

Au premier démarrage, avec `DEMO_DATA=true`, une société de démonstration est créée :

| Compte | Rôle | Peut |
|---|---|---|
| `admin@exemple.com` | Administrateur | tout |
| `s.amrani@exemple.com` | Archiviste | classer, reclasser, gérer le plan, lire l'audit, préparer éliminations et versements, poser des gels |
| `k.benali@exemple.com` | Comptable | déposer et classer |
| `y.tazi@exemple.com` | Juriste | déposer et classer, viser les bordereaux, poser et lever des gels |

Mot de passe de tous les comptes : `demo1234`. **En production : `DEMO_DATA=false`.**

### Architecture des conteneurs

```
navigateur ──► web (nginx :80) ──/api──► server (Spring Boot :8080) ──► db (PostgreSQL 16)
                  └ fichiers statiques           │
                                                 └──S3──► minio (:9000, console :9001)
```

- `web` est publié sur la machine ; la console MinIO l'est aussi, mais sur `127.0.0.1` seulement. La base, l'API et l'API S3 de MinIO restent sur le réseau interne Docker.
- Base (`ged_db-data`) et fichiers (`ged_minio-data`) sont sauvegardés ensemble par le service `backup` (voir [Sauvegardes](#sauvegardes)).

### Stockage des fichiers : MinIO

- Les fichiers des documents sont dans le bucket privé `ged-documents`, avec le **versionnage** activé : un objet remplacé ou supprimé reste récupérable.
- `minio-init` prépare MinIO à chaque démarrage (sans effet s'il est déjà prêt) et crée le compte `ged-app` utilisé par l'API. Ce compte **lit et écrit, mais ne peut rien supprimer** (politique dans [init.sh](deploy/minio/init.sh)). Le compte administrateur (`MINIO_ROOT_USER`) ne sert qu'à la préparation et à la console.
- **Console MinIO** : http://localhost:9001, avec `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`.
- **Dans l'application**, Paramétrage › Stockage montre l'état de la connexion, le volume occupé par la société, et lance un contrôle d'intégrité base ↔ bucket (fichiers manquants, tailles différentes, orphelins), inscrit au journal d'audit.
- Passage depuis l'ancien stockage sur disque : au démarrage, les fichiers absents du bucket sont repris du volume `ged_storage` (monté en lecture seule). Une fois le contrôle d'intégrité conforme, ce volume peut être supprimé.
- Les images officielles MinIO ne sont plus publiées depuis fin 2025 : on utilise `pgsty/minio`, le fork communautaire maintenu par Pigsty, en version figée. L'API passe par le SDK S3 standard : un autre service compatible S3 (Garage, SeaweedFS, Ceph, AWS S3…) se branche en changeant seulement `S3_ENDPOINT` et les identifiants.
- Sans Docker, `STORAGE_TYPE=local` (valeur par défaut) range les fichiers dans `STORAGE_DIR`.
- Derrière HTTPS : `COOKIE_SECURE=true`.

### Sauvegardes

Le service `backup` sauvegarde chaque nuit (`BACKUP_CRON`, 2 h par défaut, fuseau `TZ`) et à son démarrage, dans `BACKUP_DIR` (`./backups` par défaut) :

| Contenu | Emplacement | Conservation |
|---|---|---|
| Base PostgreSQL (`pg_dump`, avec empreinte SHA-256) | `db/ged-AAAAMMJJ-HHMMSS.dump` | `BACKUP_KEEP_DAYS` jours (14) |
| Fichiers MinIO (miroir incrémental) | `files/ged-documents/…` | état du bucket |
| Résumé de la dernière sauvegarde réussie | `last-backup.txt`, journal `backup.log` | — |

- La base est sauvegardée avant les fichiers : tout fichier cité par un dump est présent dans le miroir.
- Le service lit MinIO avec le compte `ged-backup`, **en lecture seule** : il ne peut ni modifier ni supprimer un document.
- Un document détruit par un bordereau d'élimination quitte le miroir à la sauvegarde suivante, et ses métadonnées quittent les dumps après `BACKUP_KEEP_DAYS` jours.
- **Placez `BACKUP_DIR` sur un autre disque** (ou un partage réseau), et copiez-le régulièrement hors du site : une sauvegarde sur le même disque ne protège pas d'une panne de ce disque.

```bash
docker compose exec backup backup.sh                       # sauvegarde immédiate
docker compose --profile restore run --rm restore          # liste des sauvegardes
docker compose stop server                                 # restauration : arrêter l'API,
docker compose --profile restore run --rm restore latest --yes   # restaurer (ou un horodatage)
docker compose start server                                # puis Paramétrage › Stockage › Contrôler
```

La restauration **remplace la base** par celle du dump et recopie dans le bucket les fichiers absents (rien n'est supprimé du bucket). Pour un essai sans toucher aux données : `-e PGDATABASE=une_base_vide -e RESTORE_BUCKET=un-bucket-de-test`.

### Commandes utiles

```bash
docker compose ps                    # état et santé des conteneurs
docker compose logs -f server        # journaux de l'API
docker compose down                  # arrêt (les données restent dans les volumes)
docker compose down -v               # arrêt ET suppression des données
```

## Cycle de vie

Menu **Cycle de vie** (rôles `lifecycle.manage` et `lifecycle.approve`) :

- **Échéancier** : documents échus ou arrivant à échéance, par sort final (détruire, verser, conserver). L'échéance vient de la règle du dossier (ou de son parent, ou du type de document) et se recalcule automatiquement quand une règle, la clôture d'un dossier ou la date du document change ; chaque changement est inscrit dans l'historique du document.
- **Bordereaux** : brouillon → soumis → visé → exécuté.
  - Seuls des documents échus, dont le sort final correspond, hors gel et hors autre bordereau peuvent y figurer.
  - **Quatre yeux** : le visa est donné par une autre personne que l'auteur (contrôlé aussi par la base).
  - Pendant le visa, les documents proposés à l'élimination sont figés.
  - **Élimination** : toutes les versions sont détruites dans MinIO, par un compte dédié (`ged-disposal`), seul autorisé à supprimer, ainsi que le texte lu dans les fichiers et les copies avec texte reconnu. Notice, historique et bordereau restent : le bordereau exécuté tient lieu de procès-verbal (export CSV, impression).
  - **Versement** : paquet ZIP (fichiers + `manifest.json` avec métadonnées et empreintes SHA-256), puis passage au statut « versé ».
  - L'exécution est refusée si un document a été gelé entre-temps ou si son original papier est prêté.
- **Gels juridiques** : suspendent tout sort final, toute modification et tout reclassement des documents concernés, jusqu'à la levée motivée.

Données de démonstration : contrats et dossiers du personnel échus, un gel « Litige fournisseur d'énergie », et un bordereau d'élimination préparé par l'archiviste, en attente du visa de l'administrateur ou de la juriste.

## Recherche dans le contenu (OCR)

Le texte de chaque fichier déposé est lu en arrière-plan, sans faire attendre la personne qui dépose :

| Fichier | Lecture |
|---|---|
| PDF avec du texte | Texte repris tel quel, page par page |
| PDF scanné (ou en partie) | Pages sans texte reconnues par **Tesseract** (français, arabe, anglais), dans le conteneur `server` : rien ne sort du serveur |
| Image (PNG, JPEG, TIFF, WebP…) | Reconnaissance, page par page pour un TIFF multipage |
| Texte brut | Repris tel quel |

- **Recherche** : « Chercher dans » Tout, Titre et métadonnées, ou Contenu des fichiers. Accents et pluriels ignorés, `"expression exacte"`, `-mot` pour exclure. Chaque résultat cite les pages trouvées ; « Ouvrir à la page 2 » ouvre l'aperçu à cette page, mot surligné.
- **Copie avec texte reconnu** : pour un scan ou une image, une copie PDF porte le texte en couche invisible. L'aperçu l'utilise (recherche Ctrl+F et copie possibles, un TIFF devient affichable) ; **le fichier déposé n'est jamais modifié**. Son téléchargement est une option du paramétrage.
- **Fiche du document** : bloc « Texte du fichier » (état, langues, lisibilité, « Voir le texte », « Relancer »).
- **Paramétrage › Reconnaissance de texte** : lecture au dépôt, langues, détection des pages tournées ; avancement, pause, « Lire ces N documents » pour les documents déposés avant l'activation, relance des échecs.

Réglages techniques (variables d'environnement du conteneur `server`) : `OCR_ENABLED` (true), `OCR_DPI` (300), `OCR_MAX_PAGES` (500), `OCR_PAGE_TIMEOUT` (3m), `OCR_LOW_CONFIDENCE` (65 : en dessous, le document est signalé « peu lisible »).

## Développement

```bash
# Base et API dans Docker, exposées sur 127.0.0.1
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db server

# Interface avec rechargement à chaud : http://localhost:5173
pnpm install
pnpm dev
```

### Vérifications

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build      # front-end
cd apps/server && mvn verify                                 # serveur (JDK 25 et Docker requis)
```

Les tests du serveur lancent un vrai PostgreSQL et un vrai MinIO avec Testcontainers, d'où le besoin de Docker.

## Sécurité, en bref

- Jeton d'accès JWT de 15 minutes, gardé **en mémoire** dans le navigateur. Jeton de rafraîchissement dans un cookie `HttpOnly`, `SameSite=Strict`, limité à `/api/auth` et changé à chaque usage. Un jeton rejoué ferme toutes les sessions de l'utilisateur.
- Mots de passe hachés avec bcrypt. Même réponse et même temps de réponse quand l'e-mail n'existe pas.
- Journal d'audit et historique des documents **en ajout seul** (un trigger PostgreSQL interdit toute modification) et chaînés par empreintes SHA-256 ; `GET /api/audit/verify` recalcule la chaîne.
- Fichiers stockés sous un nom aléatoire, protégés contre les chemins `../`, avec leur empreinte SHA-256. Seuls les PDF et les images peuvent s'afficher dans le navigateur ; tout le reste est forcé en téléchargement.
- nginx ajoute une politique CSP stricte, `X-Frame-Options: DENY`, `nosniff` et `no-referrer`.
