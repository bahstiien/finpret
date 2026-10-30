#!/bin/bash
# Sauvegarde quotidienne de Fin Prêt sur le VPS (SPEC_JANVIER §8) : base Postgres et fichiers privés (PDF).
# À placer dans ~/finpret avec docker-compose.yml, puis dans la crontab de l'utilisateur `deploy` :
#   30 3 * * * /home/deploy/finpret/backup.sh >> /home/deploy/finpret/backups/backup.log 2>&1
# Réglages facultatifs dans ~/finpret/backup.env (voir deploy/README.md) :
#   BACKUP_REMOTE    destination rclone hors du serveur (ex. « finpret-crypt: »), copie de chaque sauvegarde
#   BACKUP_PING_URL  adresse appelée en cas de succès (surveillance type healthchecks.io : alerte si rien ne vient)
#   KEEP_DAYS        jours conservés sur le VPS (14 par défaut)
set -euo pipefail
cd "$(dirname "$0")"
[ -f backup.env ] && . ./backup.env

DEST=backups
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
mkdir -p "$DEST"

# Base : format personnalisé de pg_dump (restauration sélective, compressée). Écrite à part puis renommée.
docker compose exec -T db pg_dump -U postgres -d finpret --format=custom >"$DEST/.db-$STAMP.dump"
# Vérification : l'archive se relit (une sauvegarde illisible ne doit pas remplacer les précédentes).
docker compose exec -T db pg_restore --list >/dev/null <"$DEST/.db-$STAMP.dump"
mv "$DEST/.db-$STAMP.dump" "$DEST/finpret-db-$STAMP.dump"

# Fichiers privés (volume `files`), lus par l'image de l'application, sans démarrer d'autre service.
docker compose run -T --rm --no-deps --entrypoint tar app -czf - -C /data/files . >"$DEST/.files-$STAMP.tar.gz"
mv "$DEST/.files-$STAMP.tar.gz" "$DEST/finpret-files-$STAMP.tar.gz"

find "$DEST" -name 'finpret-*' -mtime +"$KEEP_DAYS" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$DEST" "$BACKUP_REMOTE" --include "finpret-*-$STAMP.*"
fi
if [ -n "${BACKUP_PING_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_PING_URL" >/dev/null
fi

echo "$(date -u +%FT%TZ) sauvegarde $STAMP : $(du -h "$DEST/finpret-db-$STAMP.dump" | cut -f1) (base), $(du -h "$DEST/finpret-files-$STAMP.tar.gz" | cut -f1) (fichiers)"
