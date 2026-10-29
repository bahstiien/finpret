-- Ce que Supabase mettait en place avant les migrations du projet, pour un PostgreSQL nu (VPS, dev local, PGlite).
-- Les politiques RLS restent inchangées : elles visent les rôles `authenticated` / `anon` et lisent `auth.uid()`.
-- Le serveur ouvre chaque requête utilisateur par `set_config('request.jwt.claims', …)` puis `set role authenticated`
-- (voir src/server/db.ts) ; le client admin passe en `service_role`, qui contourne la RLS.
-- Idempotente : peut être rejouée sans erreur.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end
$$;
set search_path = "$user", public, extensions;

-- Rôles sans connexion ; le rôle de connexion de l'application en devient membre (deploy/README.md).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Schéma auth : les comptes. Better Auth (phase 2) y ajoutera ses sessions, comptes OAuth et facteurs TOTP.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text,
  email_verified boolean not null default false,
  image text,
  -- Colonnes héritées de Supabase, lues par handle_new_user() et les tests.
  instance_id uuid,
  aud text,
  role text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on auth.users to service_role;

-- Utilisateur courant, posé par le serveur pour la durée de la transaction.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
