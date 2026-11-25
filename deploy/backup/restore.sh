#!/bin/sh
# Restauration d'une sauvegarde : base PostgreSQL puis fichiers MinIO.
#
#   docker compose stop server
#   docker compose --profile restore run --rm restore latest --yes
#   docker compose start server
#
# Argument : « latest » ou l'horodatage d'un dump (ex. 20261123-020000), ou --list pour les voir.
# La base actuelle est REMPLACÉE par le contenu du dump. Les fichiers absents du bucket y sont recopiés
# (aucun fichier n'est supprimé du bucket).
set -eu
umask 077

: "${PGHOST:=db}" "${PGUSER:=ged}" "${PGDATABASE:=ged}"
: "${PGPASSWORD:?PGPASSWORD manquant}"
: "${S3_ENDPOINT:=http://minio:9000}" "${S3_BUCKET:=ged-documents}"
export PGHOST PGUSER PGDATABASE PGPASSWORD

list() { ls -1 /backups/db 2>/dev/null | grep '\.dump$' | sed 's/^ged-//; s/\.dump$//' || true; }

TARGET="${1:-}"
CONFIRM="${2:-}"
if [ -z "$TARGET" ] || [ "$TARGET" = "--list" ]; then
  echo "Sauvegardes disponibles :"
  list
  [ -z "$TARGET" ] && echo "Usage : restore <horodatage|latest> --yes"
  exit 0
fi
[ "$TARGET" = "latest" ] && TARGET=$(list | tail -n 1)
DUMP="/backups/db/ged-$TARGET.dump"
[ -f "$DUMP" ] || { echo "Sauvegarde introuvable : $DUMP"; list; exit 1; }

if [ "$CONFIRM" != "--yes" ]; then
  echo "La base « $PGDATABASE » sera remplacée par $DUMP."
  echo "Arrêtez d'abord l'application (docker compose stop server), puis relancez avec --yes."
  exit 1
fi

echo "Contrôle de l'empreinte…"
(cd /backups/db && sha256sum -c "ged-$TARGET.dump.sha256")

echo "Restauration de la base…"
pg_restore --clean --if-exists --no-owner --exit-on-error --single-transaction --dbname="$PGDATABASE" "$DUMP"

if [ -d "/backups/files/$S3_BUCKET" ]; then
  : "${MINIO_ROOT_USER:?MINIO_ROOT_USER manquant}" "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD manquant}"
  echo "Recopie des fichiers absents du bucket…"
  export MC_CONFIG_DIR=/tmp/mc
  mc alias set dst "$S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null
  DEST_BUCKET="${RESTORE_BUCKET:-$S3_BUCKET}"   # autre bucket possible, pour un essai
  mc mb --ignore-existing "dst/$DEST_BUCKET" > /dev/null
  # Les clés sont uniques (uuid) : un objet déjà présent est identique, on ne recopie que les absents
  cd "/backups/files/$S3_BUCKET"
  COPIED=$(find . -type f | while read -r f; do
    key=${f#./}
    if ! mc stat "dst/$DEST_BUCKET/$key" > /dev/null 2>&1; then
      mc cp --quiet "$f" "dst/$DEST_BUCKET/$key" > /dev/null && echo "$key"
    fi
  done | wc -l | tr -d ' ')
  echo "Fichiers recopiés dans le bucket : $COPIED"
fi

echo "Restauration de $TARGET terminée. Redémarrez l'application : docker compose start server"
echo "Puis lancez « Contrôler l'intégrité » dans Paramétrage > Stockage."
