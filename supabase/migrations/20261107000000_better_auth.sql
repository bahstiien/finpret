-- Better Auth remplace Supabase Auth (docs/MIGRATION_POSTGRES.md, phase 2). Tables dans le schéma `auth`,
-- colonnes en snake_case (correspondance déclarée dans src/server/auth.ts), identifiants uuid.
-- Better Auth y accède en `service_role` ; les rôles applicatifs n'y touchent pas.

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  -- Second facteur TOTP validé pour cette session (accès au back-office, SPEC_JANVIER §8).
  mfa_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on auth.sessions (user_id);

-- Comptes de connexion : Google, Apple (le lien magique n'en crée pas).
create table if not exists auth.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id text not null,
  provider_id text not null,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accounts_user_id_idx on auth.accounts (user_id);

-- Jetons à usage unique : liens magiques, état OAuth.
create table if not exists auth.verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verifications_identifier_idx on auth.verifications (identifier);

-- Secret TOTP des administrateurs, chiffré par le serveur (AES-256-GCM, src/server/mfa.ts).
create table if not exists auth.admin_totp (
  user_id uuid primary key references auth.users on delete cascade,
  secret_encrypted text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on auth.users, auth.sessions, auth.accounts, auth.verifications, auth.admin_totp
  to service_role;

-- Profil créé à l'inscription : Better Auth renseigne `name` (Google) ; les comptes repris de Supabase gardent leurs métadonnées.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(new.name, ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ), 60)
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;
