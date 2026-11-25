-- Correctif de V5 : ETAGERE commence par ETAGE, les étagères avaient reçu l'icône d'étage
UPDATE location_levels SET icon = 'shelf' WHERE code LIKE 'ETAGERE%' AND icon = 'floor';
