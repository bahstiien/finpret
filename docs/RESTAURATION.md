# Sauvegarde et test de restauration

SPEC_JANVIER §8 : sauvegarde quotidienne, **test de restauration documenté avant le 18 décembre 2026**.
Ce document décrit la procédure sur le VPS (PostgreSQL et fichiers dans Docker, voir `deploy/README.md`) ; le résultat de chaque test se consigne dans le tableau en bas de page.

## Ce qui est sauvegardé

| Donnée | Où | Sauvegarde |
| --- | --- | --- |
| Base Postgres (comptes, foyers, menus, abonnements, reversements, journal) | Service `db`, volume `pgdata` | `deploy/backup.sh` chaque nuit : `pg_dump` au format personnalisé, relu par `pg_restore --list`, 14 jours sur le VPS + copie hors serveur (`BACKUP_REMOTE`) |
| Comptes et sessions (Better Auth) | Schéma `auth` de la même base | Inclus dans la sauvegarde de base |
| Fichiers privés (`asso-kits/`, `asso-statements/`) | Volume `files` | Même script : archive `tar.gz` du volume. La fiche tuto se régénère ; les relevés trimestriels, non |
| Paiements | Stripe | Source de vérité chez Stripe ; `stripe_events` permet de rejouer |

Fichiers produits : `~/finpret/backups/finpret-db-<date>.dump` et `finpret-files-<date>.tar.gz` (date en UTC), journal dans `backups/backup.log`.

## Test de restauration (30 minutes, sans toucher à la production)

Le test restaure la dernière sauvegarde dans une base **jetable** du même serveur Postgres, puis compare.

1. **Choisir** la sauvegarde : `ls -t ~/finpret/backups/finpret-db-*.dump | head -1` (moins de 24 h, sinon vérifier `backup.log` et la cron).
2. **Restaurer** dans une base de test :
   ```bash
   cd ~/finpret
   DUMP="$(ls -t backups/finpret-db-*.dump | head -1)"
   docker compose exec -T db createdb -U postgres finpret_restore
   docker compose exec -T db pg_restore -U postgres -d finpret_restore --no-owner --exit-on-error < "$DUMP"
   # Réglages de la base (posés par la migration de compatibilité) : pg_dump ne les restaure pas dans une base existante.
   docker compose exec -T db psql -U postgres -d finpret_restore -c \
     "alter database finpret_restore set search_path = \"\$user\", public, extensions; alter database finpret_restore set timezone = 'UTC'"
   ```
   Les rôles (`anon`, `authenticated`, `service_role`, `finpret_app`) existent déjà sur le serveur : les droits de la sauvegarde s'appliquent tels quels.
3. **Comparer** les tables témoins avec la production (à la sauvegarde près) :
   ```bash
   for db in finpret finpret_restore; do
     docker compose exec -T db psql -U postgres -d "$db" -tAc "
       select '$db', (select count(*) from public.households), (select count(*) from public.subscriptions),
              (select count(*) from public.associations), (select count(*) from public.school_menus),
              (select count(*) from public.payout_lines), (select count(*) from auth.users),
              (select max(version) from public.schema_migrations)"
   done
   ```
4. **Vérifier les fichiers** : `tar -tzf "$(ls -t backups/finpret-files-*.tar.gz | head -1)" | head` liste les PDF attendus.
5. **Vérifier l'application** sur la base restaurée, depuis un poste : tunnel SSH (`deploy/README.md`), `.env.local` avec
   `DATABASE_URL=postgresql://postgres:<mot de passe>@localhost:54330/finpret_restore?sslmode=disable`, `pnpm dev`, connexion avec un compte existant (lien affiché dans le terminal), ouverture du menu de la semaine et de `/asso`.
6. **Supprimer** la base de test : `docker compose exec -T db dropdb -U postgres finpret_restore`, et consigner le résultat ci-dessous.

Variante plus complète (perte du VPS) : la même procédure sur un VPS neuf, à partir de la copie hors serveur (`rclone copy <BACKUP_REMOTE> ~/finpret/backups`).

## Restauration réelle (incident)

1. Mettre l'application à l'arrêt : `docker compose stop app`.
2. Recréer la base : `docker compose exec -T db dropdb -U postgres finpret && docker compose exec -T db createdb -U postgres finpret`,
   puis `pg_restore -d finpret --no-owner --exit-on-error` et les réglages de la base (`alter database finpret set …`) comme à l'étape 2.
3. Fichiers : `docker compose run -T --rm --no-deps --entrypoint tar app -xzf - -C /data/files < backups/finpret-files-<date>.tar.gz`.
4. Redémarrer : `docker compose up -d` (le service `migrate` applique les migrations postérieures à la sauvegarde).
5. Les paiements Stripe reçus depuis la sauvegarde se rejouent depuis le tableau de bord Stripe (*Developers → Events → Resend*).

## Critères de réussite

- Les décomptes des tables témoins et la dernière migration sont identiques à la production (à la sauvegarde près).
- L'archive des fichiers contient les relevés trimestriels.
- Un compte existant se connecte et retrouve son foyer, son menu et son abonnement.
- Durée totale de restauration notée (objectif : moins de 2 heures pour le jour J).

## Journal des tests

| Date | Qui | Sauvegarde utilisée | Durée | Résultat | Remarques |
| --- | --- | --- | --- | --- | --- |
| *à jouer avant le 18 décembre 2026* | | | | | |
