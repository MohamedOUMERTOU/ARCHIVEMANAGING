-- Cycle de vie : échéances, gels juridiques, bordereaux d'élimination et de versement

-- Règle et sort final retenus pour chaque document au moment du calcul de son échéance.
-- Permet l'échéancier sans recalculer l'héritage du plan de classement à chaque lecture.
ALTER TABLE documents ADD COLUMN retention_rule_id uuid REFERENCES retention_rules(id);
ALTER TABLE documents ADD COLUMN final_action varchar(20);
-- Date d'élimination ou de versement
ALTER TABLE documents ADD COLUMN disposed_at timestamptz;
CREATE INDEX idx_documents_due ON documents(organization_id, retention_until)
    WHERE status IN ('ACTIVE', 'INTERMEDIAIRE', 'A_ELIMINER');

-- Gel juridique (« legal hold ») : suspend tout sort final tant qu'une affaire est en cours.
-- documents.legal_hold reste la synthèse : vrai si le document est dans au moins un gel actif.
CREATE TABLE legal_holds (
    id               uuid PRIMARY KEY,
    organization_id  uuid         NOT NULL REFERENCES organizations(id),
    name             varchar(200) NOT NULL,
    case_reference   varchar(120),
    reason           text         NOT NULL,
    created_by       uuid         NOT NULL REFERENCES users(id),
    created_at       timestamptz  NOT NULL DEFAULT now(),
    released_at      timestamptz,
    released_by      uuid REFERENCES users(id),
    release_reason   text,
    CHECK ((released_at IS NULL) = (released_by IS NULL))
);
CREATE INDEX idx_holds_org ON legal_holds(organization_id, released_at);

CREATE TABLE legal_hold_documents (
    hold_id      uuid        NOT NULL REFERENCES legal_holds(id),
    document_id  uuid        NOT NULL REFERENCES documents(id),
    added_by     uuid        NOT NULL REFERENCES users(id),
    added_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (hold_id, document_id)
);
CREATE INDEX idx_hold_docs_document ON legal_hold_documents(document_id);

-- Bordereau : liste de documents proposée à l'élimination ou au versement,
-- visée par une autre personne que son auteur avant exécution.
CREATE TABLE disposal_lists (
    id                uuid PRIMARY KEY,
    organization_id   uuid         NOT NULL REFERENCES organizations(id),
    number            varchar(30)  NOT NULL,
    kind              varchar(20)  NOT NULL CHECK (kind IN ('ELIMINATION', 'VERSEMENT')),
    status            varchar(20)  NOT NULL
        CHECK (status IN ('BROUILLON', 'SOUMIS', 'APPROUVE', 'REFUSE', 'EXECUTE', 'ANNULE')),
    title             varchar(200) NOT NULL,
    -- Versement : service d'archives destinataire
    destination       varchar(200),
    notes             text,
    created_by        uuid         NOT NULL REFERENCES users(id),
    created_at        timestamptz  NOT NULL DEFAULT now(),
    submitted_by      uuid REFERENCES users(id),
    submitted_at      timestamptz,
    decided_by        uuid REFERENCES users(id),
    decided_at        timestamptz,
    decision_comment  text,
    executed_by       uuid REFERENCES users(id),
    executed_at       timestamptz,
    UNIQUE (organization_id, number),
    -- Principe des quatre yeux : le viseur n'est ni l'auteur ni celui qui a soumis
    CHECK (decided_by IS NULL OR (decided_by <> created_by AND decided_by IS DISTINCT FROM submitted_by))
);
CREATE INDEX idx_lists_org ON disposal_lists(organization_id, status);

-- Contenu figé au moment de l'ajout : le bordereau reste lisible même après élimination
CREATE TABLE disposal_list_items (
    list_id          uuid         NOT NULL REFERENCES disposal_lists(id),
    document_id      uuid         NOT NULL REFERENCES documents(id),
    reference        varchar(120),
    title            varchar(500) NOT NULL,
    type_name        varchar(120),
    document_date    date,
    retention_until  date,
    rule_name        varchar(120),
    version_count    integer      NOT NULL,
    bytes            bigint       NOT NULL,
    -- Statut du document avant la proposition, rétabli si le bordereau est refusé ou annulé
    prior_status     varchar(20)  NOT NULL,
    PRIMARY KEY (list_id, document_id)
);
CREATE INDEX idx_list_items_document ON disposal_list_items(document_id);
