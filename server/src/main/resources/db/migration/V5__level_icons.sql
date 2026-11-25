-- Icône de chaque niveau d'archives physiques (bâtiment, salle, boîte…), choisie par la société.
-- Les clés correspondent au catalogue d'icônes de l'interface (LevelIcons).
ALTER TABLE location_levels ADD COLUMN icon varchar(30);

-- Valeur de départ devinée d'après le code des niveaux existants
UPDATE location_levels SET icon = CASE
    WHEN code LIKE 'BAT%' OR code LIKE 'IMMEUBLE%' THEN 'building'
    WHEN code LIKE 'SITE%' THEN 'site'
    WHEN code LIKE 'ENTREPOT%' OR code LIKE 'DEPOT%' THEN 'warehouse'
    WHEN code LIKE 'ETAGE%' OR code LIKE 'NIVEAU%' THEN 'floor'
    WHEN code LIKE 'SALLE%' OR code LIKE 'MAGASIN%' OR code LIKE 'LOCAL%' THEN 'room'
    WHEN code LIKE 'ARMOIRE%' THEN 'cabinet'
    WHEN code LIKE 'RAYON%' OR code LIKE 'TRAVEE%' THEN 'shelving'
    WHEN code LIKE 'ETAGERE%' OR code LIKE 'TABLETTE%' THEN 'shelf'
    WHEN code LIKE 'TIROIR%' THEN 'drawer'
    WHEN code LIKE 'CLASSEUR%' THEN 'binder'
    WHEN code LIKE 'CHEMISE%' OR code LIKE 'DOSSIER%' THEN 'folder'
    WHEN can_hold_documents THEN 'box'
    ELSE 'room'
END;
