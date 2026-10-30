#!/bin/bash
# Joué une seule fois, à la création du volume pgdata (docker-entrypoint-initdb.d).
# Crée les rôles applicatifs avant les migrations : la migration de compatibilité (20261018000000_compat.sql)
# les retrouve et n'y touche pas. L'application se connecte en `finpret_app` : ni superutilisateur ni propriétaire des
# tables, elle passe par `set role` (anon, authenticated, service_role) et la RLS s'applique.
set -euo pipefail

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD manque (voir deploy/compose.env.example)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role finpret_app login password :'app_password';
grant anon, authenticated, service_role to finpret_app;
grant connect on database finpret to finpret_app;
SQL
