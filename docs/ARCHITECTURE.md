# GED — Système de gestion d'archives : Architecture

## 1. Objectifs fonctionnels

| Module | Rôle |
|---|---|
| **Documents** | Upload, versions, aperçu, téléchargement, métadonnées |
| **Plan de classement** | Arborescence Fonds → Série → Dossier → Document |
| **Métadonnées** | Champs communs (titre, date, auteur, cote) + champs propres à chaque type de document |
| **Recherche** | Recherche plein texte (contenu OCR inclus) + filtres sur les métadonnées |
| **Cycle de vie** | Durée de conservation (DUA), sort final (conserver / détruire / verser), gel juridique |
| **Archives physiques** | Chaque société définit ses propres niveaux (Bâtiment, Salle, Armoire, Boîte…) et construit son arbre d'emplacements |
| **Multi-société** | Données isolées par société (`organization_id`) |
| **À classer (bac d'arrivée)** | Dépôt sans classement (téléversement, scanner, e-mail, ZIP), suggestions de type et de dossier, classement un par un ou par lot |
| **Prêts et consultations** | Sortie et retour des boîtes ou dossiers papier, fiche fantôme, relances en cas de retard |
| **Versements** | Bordereau de versement (âge courant → intermédiaire → définitif) avec visas du service versant et de l'archiviste |
| **Éliminations** | Demande d'élimination, visas successifs (service producteur, archiviste, juridique), PV de destruction conservé |
| **Gel juridique** | Bloque l'élimination et le versement d'un document tant qu'un litige ou un contrôle est en cours |
| **Récolement** | Campagne d'inventaire par scan des codes-barres, anomalies (absente, mal rangée, non référencée), rapport signé |
| **Tableau de bord** | Tâches de l'archiviste, échéances, prêts en retard, occupation des salles, répartition par âge |
| **Sécurité** | Utilisateurs, rôles, droits par nœud du plan de classement |
| **Traçabilité** | Journal d'audit en ajout seul (qui a fait quoi, quand) + empreinte SHA-256 de chaque fichier |

## 2. Vue d'ensemble

```
┌───────────────────────────┐
│  web (nginx)              │  SPA React ; transmet /api au serveur
└─────────────┬─────────────┘
              │ REST/JSON (jeton JWT)
┌─────────────▼─────────────┐
│  server (Spring Boot)     │  modules métier ; lecture du texte (OCR)
│                           │  en arrière-plan, file d'attente en base
└──────┬─────────────┬──────┘
┌──────▼──────┐ ┌────▼────────────────┐
│ PostgreSQL  │ │ MinIO (S3)          │
│ métadonnées,│ │ fichiers déposés,   │
│ audit, texte│ │ copies avec texte   │
│ (plein      │ │ reconnu (versions   │
│  texte)     │ │ d'objets)           │
└──────▲──────┘ └────▲────────────────┘
       └──── backup ─┘  chaque nuit : dump vérifié + miroir des fichiers → ./backups
```

## 3. Stack retenue

| Couche | Choix | Pourquoi |
|---|---|---|
| Backend | Java 25, **Spring Boot 4.2** (Web MVC, Security, Data JPA, JdbcTemplate) | Structure par domaines, validation, sécurité éprouvée |
| Migrations | Flyway (`apps/server/src/main/resources/db/migration`) | Schéma versionné, appliqué au démarrage |
| Base de données | **PostgreSQL 16** | Relationnel, JSONB pour les métadonnées dynamiques, recherche plein texte (`ged_fr` : français, sans accents) |
| Stockage | MinIO (compatible S3), versions d'objets ; dossier local possible | Interface `FileStorage` ; comptes séparés pour l'application, l'élimination et la sauvegarde |
| Tâches de fond | Planificateur Spring + file en base (`FOR UPDATE SKIP LOCKED`) | Pas de Redis à exploiter ; plusieurs serveurs possibles |
| OCR | Tesseract 5 (fra, ara, eng) + Apache PDFBox | Gratuit, multilingue, exécuté dans le conteneur `server` |
| Recherche | PostgreSQL plein texte | Suffisant au volume actuel ; Meilisearch/OpenSearch si besoin plus tard |
| Frontend | React 19, Vite, Tailwind, TanStack Query, AG Grid, pdf.js | Détail dans `docs/FRONTEND.md` |
| Authentification | JWT de courte durée + cookie de rafraîchissement ; rôles et permissions | LDAP/AD et double authentification prévus plus tard |
| Déploiement | Docker Compose | `db`, `minio`, `minio-init`, `server`, `web`, `backup` (+ `restore` à la demande) |

## 4. Modèle de données (noyau)

Modèle de départ, pour comprendre les grandes entités. Le schéma réel, qui fait foi, est dans les migrations Flyway (`apps/server/src/main/resources/db/migration`) ; certains noms y diffèrent (bordereaux : `disposal_lists`, texte des documents : `document_texts`…).

```
users(id, email, password_hash, name, active)
roles(id, name)                         user_roles(user_id, role_id)
permissions(id, role_id, node_id, action)   -- read | write | delete | admin

classification_nodes(id, parent_id, type, code, title, retention_rule_id)
    -- type : FONDS | SERIE | SOUS_SERIE | DOSSIER

document_types(id, name, metadata_schema JSONB)   -- ex. Facture, Contrat, PV

documents(id, node_id, type_id, title, reference, doc_date,
          metadata JSONB, status, retention_until, legal_hold,
          physical_location_id, created_by, created_at)
    -- status : A_CLASSER | ACTIVE | INTERMEDIAIRE | A_ELIMINER | ELIMINE | VERSE
    -- A_CLASSER : node_id et type_id sont vides, document visible seulement
    --             par le déposant et les archivistes ; pas de cote ni de DUA

intake_items(id, organization_id, document_id, source, source_ref,
             suggested_type_id, suggested_node_id, confidence, uploaded_by, uploaded_at)
    -- source : UPLOAD | SCANNER | EMAIL | ZIP ; une ligne par document à classer

document_versions(id, document_id, version_no, storage_key, filename,
                  mime_type, size, sha256, ocr_text, created_by, created_at)

retention_rules(id, name, duration_years, start_event, final_action)
    -- final_action : CONSERVER | DETRUIRE | VERSER

organizations(id, code, name, settings JSONB, active)
    -- toutes les tables métier portent organization_id (multi-société)

location_levels(id, organization_id, code, name, icon, is_root,
                can_hold_documents, capacity, attributes_schema JSONB)
location_level_children(parent_level_id, child_level_id)  -- enfants autorisés

physical_locations(id, organization_id, level_id, parent_id, code, label,
                   barcode, id_path, depth, attributes JSONB, active)
    -- arbre défini librement par chaque société
    -- id_path = chemin d'ID (inchangé si on renomme, recalculé pour le
    --           sous-arbre si on déplace) ; le chemin lisible est calculé
    --           à l'affichage, jamais stocké

audit_log(id, user_id, action, entity, entity_id, details JSONB, ip, at)
    -- ajout seul, aucune mise à jour ni suppression

tags(id, organization_id, name, description, color, restricted)
document_tags(document_id, tag_id)

document_events(id, organization_id, document_id, type, actor_id, on_behalf_of,
                reason, before JSONB, after JSONB, related_type, related_id, at)
    -- historique propre à chaque document, en ajout seul
    -- type : CREE | CONSULTE | TELECHARGE | COPIE_DEMANDEE | COPIE_REMISE |
    --        ORIGINAL_DEMANDE | ORIGINAL_SORTI | ORIGINAL_RENDU | RECLASSE |
    --        VERSION_REMPLACEE | METADONNEES_MODIFIEES | RANGE | DEPLACE |
    --        GEL_POSE | GEL_LEVE | VERSE | ELIMINE
    -- before / after : ancien et nouveau dossier, cote, version, emplacement…

document_requests(id, organization_id, document_id, kind, requested_by,
                  on_behalf_of, reason, wanted_for, status, validated_by,
                  delivered_at, copy_number, loan_id NULL)
    -- kind : COPIE_SIMPLE | COPIE_CERTIFIEE | ORIGINAL_CONSULTATION | ORIGINAL_PRET
    -- status : DEMANDEE | VALIDEE | REFUSEE | REMISE | RENDUE
    -- une demande d'original acceptée crée un prêt (loans)

document_aliases(old_reference, document_id, changed_at)
    -- une ancienne cote, après reclassement, mène toujours au document

loans(id, organization_id, location_id NULL, document_id NULL, borrower_id,
      kind, reason, out_at, due_at, returned_at, ghost_card_printed)
    -- kind : PRET | CONSULTATION_SUR_PLACE ; on prête une boîte ou un document

transfers(id, organization_id, reference, from_service, target_location_id,
          status, transferred_at, extreme_dates, linear_meters)
transfer_items(id, transfer_id, location_id, analysis, extreme_dates,
               retention_until, final_action, new_location_id)
    -- bordereau de versement ; status : BROUILLON | VISE_VERSANT | PRIS_EN_CHARGE

disposal_requests(id, organization_id, reference, status, requested_by, pv_reference)
disposal_items(request_id, document_id)
approvals(id, subject_type, subject_id, step, role, user_id, decision, decided_at)
    -- visas génériques, réutilisés pour les éliminations et les versements

legal_holds(id, organization_id, reason, opened_by, opened_at, closed_at)
legal_hold_items(hold_id, document_id)

inventory_campaigns(id, organization_id, scope_location_id, status, started_at, closed_at)
inventory_scans(id, campaign_id, location_id NULL, scanned_code, found_in_id,
                result, scanned_by, scanned_at)
    -- result : CONFORME | MAL_RANGEE | ABSENTE | NON_REFERENCEE
```

## 5. Structure du code

```
ged/
├── docker-compose.yml         # db, minio, minio-init, server, web, backup (+ restore)
├── .env.example               # secrets et réglages à copier dans .env (jamais commité)
├── apps/
│   ├── server/                # API Spring Boot (Maven) ; un paquet par domaine
│   │   └── src/main/
│   │       ├── java/com/ged/
│   │       │   ├── auth/ user/ org/          # connexion, comptes, rôles, sociétés
│   │       │   ├── classification/           # plan de classement
│   │       │   ├── document/                 # dépôt, classement, versions, aperçu, recherche
│   │       │   ├── ocr/                      # lecture du texte, file d'attente, paramétrage
│   │       │   ├── physical/                 # archives physiques, emplacements, prêts
│   │       │   ├── retention/ lifecycle/     # conservation, échéances, bordereaux, gels
│   │       │   ├── audit/                    # journal chaîné
│   │       │   ├── storage/                  # stockage local ou S3, contrôle d'intégrité
│   │       │   ├── settings/                 # types, règles, tags, utilisateurs
│   │       │   ├── seed/                     # données de démonstration
│   │       │   └── common/ config/           # erreurs, JSON, sécurité, propriétés
│   │       └── resources/db/migration/       # V1__init.sql, V2… (Flyway)
│   └── web/                   # SPA React, servie par nginx (organisation : docs/FRONTEND.md)
├── deploy/
│   ├── minio/init.sh          # bucket et comptes : application, élimination, sauvegarde
│   └── backup/                # image de sauvegarde et de restauration
└── docs/
```

## 6. Flux principal : dépôt d'un document

1. `POST /api/documents` (multipart) → vérification de la permission `documents.write`
2. Copie du fichier dans MinIO avec calcul du SHA-256 au passage ; création du document (statut « à classer ») et de sa version 1
3. Événement dans l'historique du document et entrée dans le journal d'audit chaîné
4. Demande de lecture du texte mise en file (si activée) ; en arrière-plan : texte du PDF ou OCR des pages scannées, index plein texte, copie PDF portant le texte reconnu
5. Au classement : cote attribuée dans le dossier, échéance de conservation calculée selon la règle du dossier ou du type

## 7. Principes

- **Intégrité** : un fichier n'est jamais écrasé ; toute modification crée une nouvelle version.
- **Pas de suppression physique** sans passer par le workflow d'élimination (validation + PV d'élimination).
- **Audit obligatoire** sur chaque lecture et chaque écriture sensible.
- **Métadonnées dynamiques** stockées en JSONB et validées par le `metadata_schema` du type de document.
- **Théorie des trois âges** : chaque document passe de l'âge courant à l'âge intermédiaire (versement), puis aux archives définitives (versement) ou à l'élimination. Le statut et l'emplacement suivent ces étapes.
- **Preuve de l'élimination** : après destruction, on garde les métadonnées du document, le bordereau d'élimination et le PV.
- **Gel juridique prioritaire** : un document gelé ne peut ni être éliminé ni être versé, même si son échéance est passée.
- **Journal chaîné** : chaque entrée d'audit contient l'empreinte de l'entrée précédente, ce qui permet de détecter une modification.
- **Repères normatifs** : ISO 15489 (records management), ISO 14721 / OAIS (archivage à long terme), ISO 23081 (métadonnées), NF Z42-013 / ISO 14641 (archivage électronique à valeur probante), MoReq2010. À vérifier selon le pays et le secteur de chaque société.

## 8. Feuille de route

| Phase | Contenu |
|---|---|
| **MVP** | Authentification, plan de classement, upload/versions, métadonnées, recherche simple, audit |
| **V2** | OCR + plein texte, types de documents dynamiques, droits par nœud |
| **V3** | Archives physiques dynamiques, codes-barres, prêts, récolement |
| **V4** | Cycle de vie : échéances, éliminations avec visas, versements, gel juridique |
| **V5** | Tableau de bord, signature électronique des visas, annuaire d'entreprise (LDAP), double authentification |

## 9. Maquettes

Les 19 écrans sont sur le canevas « GED Archives — Maquettes » :
- **Écrans principaux** : explorateur, fiche document, recherche, archives physiques.
- **Paramétrage** : plan de classement, types de document, tags, règles de conservation, niveaux physiques, utilisateurs et rôles, sociétés.
- **Opérations & accès** : connexion, dépôt, cycle de vie, journal d'audit, tableau de bord, prêts, bordereau de versement, récolement.
