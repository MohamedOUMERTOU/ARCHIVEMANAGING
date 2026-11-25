-- Archives physiques : niveaux propres à chaque société, emplacements en arbre, prêts

CREATE TABLE location_levels (
    id                  uuid PRIMARY KEY,
    organization_id     uuid         NOT NULL REFERENCES organizations(id),
    code                varchar(40)  NOT NULL,
    name                varchar(120) NOT NULL,
    is_root             boolean      NOT NULL DEFAULT false,
    can_hold_documents  boolean      NOT NULL DEFAULT false,
    -- Nombre maximal de documents (niveaux qui reçoivent des documents) ; NULL = sans limite
    capacity            integer,
    UNIQUE (organization_id, code)
);

-- « Le niveau parent peut contenir le niveau enfant »
CREATE TABLE location_level_children (
    parent_level_id  uuid NOT NULL REFERENCES location_levels(id) ON DELETE CASCADE,
    child_level_id   uuid NOT NULL REFERENCES location_levels(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_level_id, child_level_id),
    CHECK (parent_level_id <> child_level_id)
);

CREATE TABLE physical_locations (
    id               uuid PRIMARY KEY,
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    level_id         uuid         NOT NULL REFERENCES location_levels(id),
    parent_id        uuid REFERENCES physical_locations(id),
    code             varchar(80)  NOT NULL,
    label            varchar(255) NOT NULL,
    barcode          varchar(80),
    -- Chemin d'ID, comme pour le plan de classement : recalculé seulement lors d'un déplacement
    id_path          text         NOT NULL,
    depth            integer      NOT NULL,
    active           boolean      NOT NULL DEFAULT true,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);
CREATE INDEX idx_locations_path ON physical_locations(organization_id, id_path text_pattern_ops);
CREATE UNIQUE INDEX idx_locations_barcode ON physical_locations(organization_id, barcode) WHERE barcode IS NOT NULL;

-- Emplacement de l'original papier d'un document
ALTER TABLE documents ADD COLUMN physical_location_id uuid REFERENCES physical_locations(id);
CREATE INDEX idx_documents_location ON documents(physical_location_id);

CREATE TABLE loans (
    id               uuid PRIMARY KEY,
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    -- On prête une boîte (emplacement) ou un document seul
    location_id      uuid REFERENCES physical_locations(id),
    document_id      uuid REFERENCES documents(id),
    borrower         varchar(255) NOT NULL,
    kind             varchar(20)  NOT NULL,
    reason           varchar(500),
    out_at           timestamptz  NOT NULL DEFAULT now(),
    due_at           date         NOT NULL,
    returned_at      timestamptz,
    ghost_card       boolean      NOT NULL DEFAULT true,
    created_by       uuid         NOT NULL REFERENCES users(id),
    returned_by      uuid REFERENCES users(id),
    CHECK ((location_id IS NULL) <> (document_id IS NULL))
);
CREATE INDEX idx_loans_open ON loans(organization_id) WHERE returned_at IS NULL;
