-- Index du document entier : tous les mots cherchés comptent, même s'ils sont sur des pages différentes.
-- L'index par page reste utilisé pour les extraits (« Page 2 · … »).
ALTER TABLE document_texts ADD COLUMN tsv tsvector;

-- Textes déjà lus. Au-delà de 300 000 caractères, sans les positions des mots (taille limitée d'un tsvector)
UPDATE document_texts t SET tsv = x.v
FROM (SELECT text_id,
             CASE WHEN sum(length(content)) > 300000
                  THEN strip(to_tsvector('ged_fr', string_agg(content, E'\n' ORDER BY page_no)))
                  ELSE to_tsvector('ged_fr', string_agg(content, E'\n' ORDER BY page_no)) END AS v
      FROM document_text_pages GROUP BY text_id) x
WHERE x.text_id = t.id;

CREATE INDEX document_texts_tsv ON document_texts USING gin (tsv);
