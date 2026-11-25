-- Paramétrage : description des tags et des rôles
ALTER TABLE tags ADD COLUMN description varchar(255);
ALTER TABLE roles ADD COLUMN description varchar(255);
