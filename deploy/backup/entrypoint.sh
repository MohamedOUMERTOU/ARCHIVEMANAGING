#!/bin/sh
# cron    : sauvegarde planifiée (BACKUP_CRON), plus une sauvegarde au démarrage si BACKUP_ON_START=true
# backup  : une sauvegarde immédiate
# restore : restauration (voir restore.sh)
set -eu

case "${1:-cron}" in
  cron)
    # crond ne transmet pas l'environnement du conteneur aux tâches : on le fige dans un fichier privé
    umask 077
    export -p > /run/backup.env
    echo "${BACKUP_CRON:-0 2 * * *} /usr/local/bin/backup.sh >> /backups/backup.log 2>&1" > /etc/crontabs/root
    mkdir -p /backups
    echo "Sauvegardes planifiées : « ${BACKUP_CRON:-0 2 * * *} » (fuseau ${TZ:-UTC}), conservation ${BACKUP_KEEP_DAYS:-14} jours"
    if [ "${BACKUP_ON_START:-false}" = "true" ]; then
      /usr/local/bin/backup.sh 2>&1 | tee -a /backups/backup.log || true
    fi
    exec crond -f -l 6
    ;;
  backup)
    exec /usr/local/bin/backup.sh
    ;;
  restore)
    shift
    exec /usr/local/bin/restore.sh "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
