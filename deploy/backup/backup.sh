#!/bin/sh
# Sauvegarde complète de la GED dans /backups :
#   db/ged-AAAAMMJJ-HHMMSS.dump (+ .sha256)  base PostgreSQL (format custom de pg_dump), une par passage
#   files/<bucket>/...                        copie miroir des fichiers MinIO (incrémentale)
#   last-backup.txt                           résumé de la dernière sauvegarde réussie
#
# Ordre : la base d'abord, les fichiers ensuite. Tout fichier cité par le dump est donc dans le miroir.
# Le miroir suit les éliminations (--remove) : un document détruit quitte la sauvegarde au passage suivant ;
# ses métadonnées disparaissent des dumps au bout de BACKUP_KEEP_DAYS jours.
set -eu
[ -f /run/backup.env ] && . /run/backup.env
umask 077

: "${PGHOST:=db}" "${PGUSER:=ged}" "${PGDATABASE:=ged}"
: "${PGPASSWORD:?PGPASSWORD manquant}"
: "${S3_ENDPOINT:=http://minio:9000}" "${S3_BUCKET:=ged-documents}"
: "${S3_BACKUP_ACCESS_KEY:?S3_BACKUP_ACCESS_KEY manquant}" "${S3_BACKUP_SECRET_KEY:?S3_BACKUP_SECRET_KEY manquant}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
export PGHOST PGUSER PGDATABASE PGPASSWORD

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Une seule sauvegarde à la fois
LOCK=/backups/.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  log "ÉCHEC : une sauvegarde est déjà en cours ($LOCK). Supprimez ce dossier s'il est resté après un arrêt brutal."
  exit 1
fi
trap 'rm -rf "$LOCK"' EXIT

STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /backups/db /backups/files
START=$(date +%s)
log "Début de la sauvegarde $STAMP"

# 1. Base de données
DUMP="/backups/db/ged-$STAMP.dump"
pg_dump --format=custom --compress=6 --no-owner --file="$DUMP.part"
pg_restore --list "$DUMP.part" > /dev/null   # dump lisible ?
mv "$DUMP.part" "$DUMP"
(cd /backups/db && sha256sum "ged-$STAMP.dump" > "ged-$STAMP.dump.sha256")
DUMP_SIZE=$(du -h "$DUMP" | cut -f1)
log "Base : $DUMP ($DUMP_SIZE)"

# 2. Fichiers (compte MinIO en lecture seule)
export MC_CONFIG_DIR=/tmp/mc
mc alias set src "$S3_ENDPOINT" "$S3_BACKUP_ACCESS_KEY" "$S3_BACKUP_SECRET_KEY" > /dev/null
mc mirror --quiet --overwrite --remove "src/$S3_BUCKET" "/backups/files/$S3_BUCKET" > /dev/null
FILE_COUNT=$(find "/backups/files/$S3_BUCKET" -type f | wc -l | tr -d ' ')
FILE_SIZE=$(du -sh "/backups/files/$S3_BUCKET" | cut -f1)
log "Fichiers : $FILE_COUNT fichier(s), $FILE_SIZE"

# 3. Rotation des dumps (le plus récent est toujours conservé)
find /backups/db -name 'ged-*.dump*' -type f -mtime +"$KEEP_DAYS" ! -name "ged-$STAMP.*" -print -delete \
  | sed 's/^/Supprimé (plus de '"$KEEP_DAYS"' jours) : /' || true

DURATION=$(( $(date +%s) - START ))
cat > /backups/last-backup.txt <<EOF
date=$(date -Iseconds)
dump=db/ged-$STAMP.dump
dump_size=$DUMP_SIZE
files=$FILE_COUNT
files_size=$FILE_SIZE
duration_s=$DURATION
EOF
log "Sauvegarde $STAMP terminée en ${DURATION}s"
