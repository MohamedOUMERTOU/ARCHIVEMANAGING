# GED — Diagramme de classes

```mermaid
classDiagram
    direction LR

    %% ===== Sécurité =====
    class User {
        +UUID id
        +String email
        +String passwordHash
        +String fullName
        +Boolean active
        +DateTime createdAt
        +login(password) Token
        +hasPermission(node, action) Boolean
    }

    class Role {
        +UUID id
        +String name
        +String description
    }

    class Permission {
        +UUID id
        +PermissionAction action
        +Boolean inherited
    }

    class PermissionAction {
        <<enumeration>>
        READ
        WRITE
        DELETE
        ADMIN
    }

    %% ===== Plan de classement =====
    class ClassificationNode {
        +UUID id
        +NodeType type
        +String code
        +String title
        +String description
        +getPath() String
        +getChildren() ClassificationNode[]
        +effectiveRetentionRule() RetentionRule
    }

    class NodeType {
        <<enumeration>>
        FONDS
        SERIE
        SOUS_SERIE
        DOSSIER
    }

    %% ===== Documents =====
    class Document {
        +UUID id
        +String title
        +String reference
        +Date documentDate
        +JSON metadata
        +DocumentStatus status
        +Date retentionUntil
        +Boolean legalHold
        +DateTime createdAt
        +addVersion(file) DocumentVersion
        +currentVersion() DocumentVersion
        +computeRetention() Date
        +move(node) void
    }

    class DocumentStatus {
        <<enumeration>>
        ACTIVE
        INTERMEDIAIRE
        A_ELIMINER
        ELIMINE
        VERSE
    }

    class DocumentVersion {
        +UUID id
        +Int versionNo
        +String storageKey
        +String filename
        +String mimeType
        +Long size
        +String sha256
        +String ocrText
        +DateTime createdAt
        +verifyIntegrity() Boolean
    }

    class DocumentType {
        +UUID id
        +String name
        +JSON metadataSchema
        +validate(metadata) Boolean
    }

    class Tag {
        +UUID id
        +String name
    }

    %% ===== Cycle de vie =====
    class RetentionRule {
        +UUID id
        +String name
        +Int durationYears
        +StartEvent startEvent
        +FinalAction finalAction
        +computeEndDate(doc) Date
    }

    class StartEvent {
        <<enumeration>>
        DATE_DOCUMENT
        DATE_CLOTURE_DOSSIER
        DATE_CREATION
    }

    class FinalAction {
        <<enumeration>>
        CONSERVER
        DETRUIRE
        VERSER
    }

    class DisposalRequest {
        +UUID id
        +DisposalStatus status
        +DateTime requestedAt
        +DateTime validatedAt
        +String pvReference
        +approve(user) void
        +reject(user, reason) void
        +execute() void
    }

    class DisposalStatus {
        <<enumeration>>
        EN_ATTENTE
        APPROUVEE
        REJETEE
        EXECUTEE
    }

    %% ===== Société (multi-tenant) =====
    class Organization {
        +UUID id
        +String code
        +String name
        +JSON settings
        +Boolean active
    }

    %% ===== Archives physiques (dynamiques) =====
    class LocationLevel {
        +UUID id
        +String code
        +String name
        +String icon
        +Boolean isRoot
        +Boolean canHoldDocuments
        +Int capacity
        +JSON attributesSchema
        +canHaveChild(level) Boolean
    }

    class PhysicalLocation {
        +UUID id
        +String code
        +String label
        +String barcode
        +String idPath
        +Int depth
        +JSON attributes
        +Boolean active
        +getDisplayPath() String
        +getChildren() PhysicalLocation[]
        +addChild(level, data) PhysicalLocation
        +move(newParent) void
        +occupancy() Int
    }

    %% ===== Traçabilité =====
    class AuditLog {
        +UUID id
        +String action
        +String entity
        +UUID entityId
        +JSON details
        +String ip
        +DateTime at
    }

    %% ===== Services techniques =====
    class StorageProvider {
        <<interface>>
        +put(key, stream) void
        +get(key) Stream
        +exists(key) Boolean
    }
    class LocalStorage
    class S3Storage
    StorageProvider <|.. LocalStorage
    StorageProvider <|.. S3Storage

    %% ===== Relations =====
    User "*" -- "*" Role : possède
    Role "1" *-- "*" Permission
    Permission "*" --> "1" ClassificationNode : porte sur
    Permission --> PermissionAction

    ClassificationNode "0..1" o-- "*" ClassificationNode : parent / enfants
    ClassificationNode --> NodeType
    ClassificationNode "*" --> "0..1" RetentionRule : règle

    ClassificationNode "1" o-- "*" Document : contient
    Document "1" *-- "1..*" DocumentVersion : versions
    Document "*" --> "1" DocumentType : typé par
    Document "*" -- "*" Tag
    Document --> DocumentStatus
    Document "*" --> "0..1" PhysicalLocation : rangé dans
    Document "*" --> "1" User : créé par
    DocumentVersion "*" --> "1" User : déposé par
    DocumentVersion ..> StorageProvider : stocké via

    RetentionRule --> StartEvent
    RetentionRule --> FinalAction

    DisposalRequest "1" o-- "1..*" Document : concerne
    DisposalRequest "*" --> "1" User : demandeur
    DisposalRequest "*" --> "0..1" User : validateur
    DisposalRequest --> DisposalStatus

    Organization "1" *-- "*" LocationLevel : définit ses niveaux
    Organization "1" *-- "*" PhysicalLocation : possède
    Organization "1" *-- "*" User
    Organization "1" *-- "*" ClassificationNode
    Organization "1" *-- "*" DocumentType
    Organization "1" *-- "*" RetentionRule

    LocationLevel "*" -- "*" LocationLevel : enfants autorisés
    PhysicalLocation "*" --> "1" LocationLevel : est de niveau
    PhysicalLocation "0..1" o-- "*" PhysicalLocation : parent / enfants

    AuditLog "*" --> "1" User : auteur
```

## Notes de lecture

- **Composition (`*--`)** : une `DocumentVersion` n'existe pas sans son `Document`, une `Permission` pas sans son `Role`.
- **Agrégation (`o--`)** : un nœud du plan de classement contient des documents, mais un document peut être déplacé vers un autre nœud.
- **Auto-association** : `ClassificationNode` et `PhysicalLocation` sont des arbres (relation parent / enfants).
- **Multi-société** : chaque `Organization` a ses propres utilisateurs, plan de classement, types de documents, règles et archives physiques. Toutes les requêtes sont filtrées par société.

## Archives physiques dynamiques

Chaque société dessine son propre arbre en deux étapes :

1. **Elle définit ses niveaux** (`LocationLevel`) et les enfants que chaque niveau accepte :

   ```
   Société A :  Bâtiment → Étage → Salle → Armoire → Étagère → Boîte
   Société B :  Site → Magasin → Travée → Conteneur
   Société C :  Entrepôt → Rack ─┬→ Carton
                                 └→ Classeur → Chemise
   ```

   La relation « enfants autorisés » est de plusieurs vers plusieurs. Un niveau peut donc avoir plusieurs types d'enfants, et l'arbre n'est pas forcément une chaîne fixe.

2. **Elle crée ses emplacements réels** (`PhysicalLocation`) dans cet arbre. Par exemple « Bâtiment Casa » → « Étage 2 » → « Salle 204 » → …

Règles appliquées :
- Un emplacement racine doit appartenir à un niveau marqué `isRoot`.
- Un enfant n'est accepté que si `parent.level.canHaveChild(enfant.level)` le permet.
- Seuls les niveaux `canHoldDocuments` (une boîte, un carton…) peuvent recevoir des documents.
- `attributesSchema` permet d'ajouter des champs libres par niveau (dimensions, température, responsable…). Ils sont stockés dans `attributes` et validés à la saisie.
- `capacity` et `occupancy()` permettent de savoir quand une boîte ou une étagère est pleine.

### Le chemin peut changer

Un chemin change quand on renomme un emplacement (son code ou son libellé) ou quand on le déplace (par exemple une armoire transférée dans une autre salle). La conception en tient compte :

| Élément | Contenu | Stocké ? | Quand il change |
|---|---|---|---|
| `parent_id` | ID du parent | Oui | C'est la **source de vérité** |
| `idPath` | Chemin fait d'**ID** : `/a1f3/9c2e/77b0/` | Oui, index technique | Seulement en cas de **déplacement** |
| `getDisplayPath()` | « Bâtiment Casa › Étage 2 › Salle 204 » | **Non**, calculé à la lecture | Toujours à jour |

- **Renommer** ne touche à rien : les ID ne changent pas, donc `idPath` non plus. Le chemin affiché suit automatiquement.
- **Déplacer** un emplacement met à jour tout son sous-arbre en une seule transaction :
  ```sql
  UPDATE physical_locations
  SET id_path = :newPrefix || substring(id_path from length(:oldPrefix) + 1),
      depth   = depth + :deltaDepth
  WHERE organization_id = :org AND id_path LIKE :oldPrefix || '%';
  ```
  Avant le déplacement, deux vérifications :
  - on ne peut pas déplacer un nœud sous l'un de ses propres descendants ;
  - le niveau du nouveau parent doit accepter le niveau de l'enfant.
- **Les documents** référencent `physical_location_id` et jamais le chemin. Ils suivent donc leur boîte automatiquement.
- **L'historique** est conservé : chaque déplacement écrit dans `AuditLog` l'ancien et le nouveau chemin affiché, figés au moment du changement. On peut ainsi toujours savoir où se trouvait une boîte à une date donnée.
- Le même principe s'applique au plan de classement (`ClassificationNode`).
- **Héritage des règles** : si un nœud n'a pas de `RetentionRule`, `effectiveRetentionRule()` remonte au parent. Les permissions suivent le même principe (`inherited`).
- **`AuditLog`** n'est jamais modifié ni supprimé : on ne fait qu'y ajouter des lignes.
- **`StorageProvider`** est une interface : on passe du disque local à S3/MinIO sans toucher au code métier.
