-- CRM du back-office : rôles d'administrateur, notes de suivi par compte, suspension de compte.

-- `owner` : tout faire ; `support` : consulter seulement (aucune action d'écriture dans le back-office).
alter table public.admins
  add column role text not null default 'owner' check (role in ('owner', 'support'));

-- Compte suspendu : plus de nouvelle session (src/server/auth.ts) ; les sessions ouvertes sont supprimées à la suspension.
alter table auth.users
  add column banned_at timestamptz,
  add column ban_reason text;

create table public.admin_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  admin_id uuid references auth.users on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index admin_notes_user_idx on public.admin_notes (user_id, created_at desc);

-- Aucun accès client : lecture et écriture par le serveur uniquement (`service_role`).
alter table public.admin_notes enable row level security;
revoke all on public.admin_notes from anon, authenticated;
revoke all on sequence public.admin_notes_id_seq from anon, authenticated;
grant select, insert, update, delete on public.admin_notes to service_role;
grant usage on sequence public.admin_notes_id_seq to service_role;
