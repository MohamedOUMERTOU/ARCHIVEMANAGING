-- Reconnaissance de texte (OCR) et recherche dans le contenu des fichiers

-- Recherche en français, sans tenir compte des accents (« reception » trouve « réception »)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TEXT SEARCH CONFIGURATION ged_fr (COPY = french);
ALTER TEXT SEARCH CONFIGURATION ged_fr
    ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;

-- Réglages par société (une ligne créée à la première modification ; valeurs par défaut sinon)
CREATE TABLE ocr_settings (
    organization_id         uuid PRIMARY KEY REFERENCES organizations(id),
    auto_on_upload          boolean     NOT NULL DEFAULT true,
    languages               text[]      NOT NULL DEFAULT '{fra,ara}',
    detect_orientation      boolean     NOT NULL DEFAULT true,
    searchable_pdf_download boolean     NOT NULL DEFAULT false,
    paused                  boolean     NOT NULL DEFAULT false,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Texte d'une version de document : état du traitement, puis texte page par page.
-- status : EN_ATTENTE, EN_COURS, TERMINE, PEU_LISIBLE, ECHEC
-- method : NATIF (texte déjà dans le fichier), OCR (reconnu sur l'image), MIXTE (les deux)
CREATE TABLE document_texts (
    id                uuid PRIMARY KEY,
    organization_id   uuid         NOT NULL REFERENCES organizations(id),
    document_id       uuid         NOT NULL REFERENCES documents(id),
    version_id        uuid         NOT NULL UNIQUE REFERENCES document_versions(id),
    status            varchar(20)  NOT NULL,
    method            varchar(10),
    languages         text[],
    pages_total       integer,
    pages_done        integer      NOT NULL DEFAULT 0,
    confidence        numeric(5, 2),
    error             varchar(500),
    attempts          integer      NOT NULL DEFAULT 0,
    -- Copie PDF avec le texte reconnu en couche invisible ; l'original n'est jamais modifié
    searchable_key    varchar(255),
    searchable_size   bigint,
    searchable_sha256 varchar(64),
    requested_at      timestamptz  NOT NULL DEFAULT now(),
    started_at        timestamptz,
    -- Dernier signe de vie du traitement : une demande « en cours » sans nouvelles est relancée
    heartbeat_at      timestamptz,
    finished_at       timestamptz
);
CREATE INDEX document_texts_queue ON document_texts (requested_at) WHERE status = 'EN_ATTENTE';
CREATE INDEX document_texts_document ON document_texts (document_id);
CREATE INDEX document_texts_org_status ON document_texts (organization_id, status);

CREATE TABLE document_text_pages (
    text_id  uuid    NOT NULL REFERENCES document_texts(id) ON DELETE CASCADE,
    page_no  integer NOT NULL,
    content  text    NOT NULL,
    tsv      tsvector GENERATED ALWAYS AS (to_tsvector('ged_fr', content)) STORED,
    PRIMARY KEY (text_id, page_no)
);
CREATE INDEX document_text_pages_tsv ON document_text_pages USING gin (tsv);
