-- GED : schéma initial (noyau)
-- Toutes les tables métier portent organization_id : chaque société est isolée.

CREATE TABLE organizations (
    id          uuid PRIMARY KEY,
    code        varchar(40)  NOT NULL UNIQUE,
    name        varchar(255) NOT NULL,
    active      boolean      NOT NULL DEFAULT true,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id               uuid PRIMARY KEY,
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    name             varchar(80)  NOT NULL,
    -- Permissions générales, ex. 'documents.write', 'audit.read' ; '*' = tout
    permissions      text[]       NOT NULL DEFAULT '{}',
    UNIQUE (organization_id, name)
);

CREATE TABLE users (
    id               uuid PRIMARY KEY,
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    email            varchar(255) NOT NULL UNIQUE,
    password_hash    varchar(255) NOT NULL,
    full_name        varchar(255) NOT NULL,
    active           boolean      NOT NULL DEFAULT true,
    created_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_org ON users(organization_id);

CREATE TABLE user_roles (
    user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id  uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Seule l'empreinte SHA-256 du jeton est stockée
    token_hash  varchar(64) NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE retention_rules (
    id                 uuid PRIMARY KEY,
    organization_id    uuid         NOT NULL REFERENCES organizations(id),
    name               varchar(120) NOT NULL,
    -- NULL = conservation illimitée
    duration_years     integer,
    start_event        varchar(30)  NOT NULL,
    final_action       varchar(20)  NOT NULL,
    legal_basis        varchar(255),
    UNIQUE (organization_id, name)
);

CREATE TABLE classification_nodes (
    id                 uuid PRIMARY KEY,
    organization_id    uuid         NOT NULL REFERENCES organizations(id),
    parent_id          uuid REFERENCES classification_nodes(id),
    type               varchar(20)  NOT NULL,
    code               varchar(80)  NOT NULL,
    title              varchar(255) NOT NULL,
    description        text,
    -- Chemin d'ID '/<racine>/<…>/<id>/' : recalculé seulement lors d'un déplacement
    id_path            text         NOT NULL,
    depth              integer      NOT NULL,
    retention_rule_id  uuid REFERENCES retention_rules(id),
    closed_at          date,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);
CREATE INDEX idx_nodes_path ON classification_nodes(organization_id, id_path text_pattern_ops);

CREATE TABLE reference_counters (
    node_id     uuid PRIMARY KEY REFERENCES classification_nodes(id) ON DELETE CASCADE,
    last_value  integer NOT NULL
);

CREATE TABLE document_types (
    id                         uuid PRIMARY KEY,
    organization_id            uuid         NOT NULL REFERENCES organizations(id),
    code                       varchar(40)  NOT NULL,
    name                       varchar(120) NOT NULL,
    -- [{ "key", "label", "type", "required" }]
    metadata_schema            jsonb        NOT NULL DEFAULT '[]',
    default_retention_rule_id  uuid REFERENCES retention_rules(id),
    UNIQUE (organization_id, code)
);

CREATE TABLE documents (
    id               uuid PRIMARY KEY,
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    -- NULL tant que le document est « à classer »
    node_id          uuid REFERENCES classification_nodes(id),
    type_id          uuid REFERENCES document_types(id),
    title            varchar(500) NOT NULL,
    -- Cote, attribuée au classement
    reference        varchar(120),
    document_date    date,
    metadata         jsonb        NOT NULL DEFAULT '{}',
    status           varchar(20)  NOT NULL,
    retention_until  date,
    legal_hold       boolean      NOT NULL DEFAULT false,
    created_by       uuid         NOT NULL REFERENCES users(id),
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, reference)
);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_node ON documents(node_id);

CREATE TABLE document_versions (
    id              uuid PRIMARY KEY,
    document_id     uuid         NOT NULL REFERENCES documents(id),
    version_no      integer      NOT NULL,
    storage_key     varchar(255) NOT NULL,
    filename        varchar(255) NOT NULL,
    mime_type       varchar(120) NOT NULL,
    size_bytes      bigint       NOT NULL,
    sha256          varchar(64)  NOT NULL,
    replace_reason  text,
    created_by      uuid         NOT NULL REFERENCES users(id),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_no)
);
CREATE INDEX idx_versions_sha ON document_versions(sha256);

-- Ancienne cote après un reclassement : elle mène toujours au document
CREATE TABLE document_aliases (
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    old_reference    varchar(120) NOT NULL,
    document_id      uuid         NOT NULL REFERENCES documents(id),
    changed_at       timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, old_reference)
);

CREATE TABLE tags (
    id               uuid PRIMARY KEY,
    organization_id  uuid        NOT NULL REFERENCES organizations(id),
    name             varchar(80) NOT NULL,
    color            varchar(9)  NOT NULL DEFAULT '#566170',
    UNIQUE (organization_id, name)
);

CREATE TABLE document_tags (
    document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id       uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);

-- Historique propre à chaque document, en ajout seul
CREATE TABLE document_events (
    id               uuid PRIMARY KEY,
    organization_id  uuid        NOT NULL REFERENCES organizations(id),
    document_id      uuid        NOT NULL REFERENCES documents(id),
    type             varchar(40) NOT NULL,
    actor_id         uuid REFERENCES users(id),
    on_behalf_of     varchar(255),
    reason           text,
    before_data      jsonb,
    after_data       jsonb,
    at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_document ON document_events(document_id, at DESC);

-- Journal général, en ajout seul et chaîné par empreintes SHA-256
CREATE TABLE audit_log (
    id               bigserial PRIMARY KEY,
    organization_id  uuid,
    user_id          uuid,
    action           varchar(60)  NOT NULL,
    entity           varchar(60)  NOT NULL,
    entity_id        varchar(120),
    details          jsonb        NOT NULL DEFAULT '{}',
    ip               varchar(64),
    at               timestamptz  NOT NULL,
    prev_hash        varchar(64),
    hash             varchar(64)  NOT NULL
);
CREATE INDEX idx_audit_org ON audit_log(organization_id, id);

-- Le journal et l'historique ne peuvent être ni modifiés ni supprimés, même par erreur
CREATE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'La table % est en ajout seul', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER document_events_append_only BEFORE UPDATE OR DELETE ON document_events
    FOR EACH ROW EXECUTE FUNCTION forbid_change();
