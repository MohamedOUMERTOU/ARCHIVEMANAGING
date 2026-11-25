# Sauvegarde de la GED : pg_dump (même version majeure que la base) + client MinIO (mc)
FROM pgsty/minio:RELEASE.2026-08-04T00-00-00Z AS mc

FROM postgres:16-alpine
COPY --from=mc /usr/bin/mcli /usr/local/bin/mc
COPY --chmod=755 entrypoint.sh backup.sh restore.sh /usr/local/bin/
VOLUME /backups
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["cron"]
