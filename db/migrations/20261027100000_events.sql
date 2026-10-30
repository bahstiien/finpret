-- J1 (SPEC_JANVIER §1, §7) : événements d'indicateurs, sans outil d'analyse tiers.
-- Aucun accès client : seules les actions serveur écrivent (clé de service) ; la lecture est réservée au back-office.

create table public.events (
  id bigserial primary key,
  user_id uuid,
  household_id uuid,
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,63}$'),
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Pas de clés étrangères : les indicateurs survivent à la suppression d'un compte ou d'un foyer.
create index events_name_created_idx on public.events (name, created_at desc);
create index events_household_idx on public.events (household_id, name);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
revoke all on sequence public.events_id_seq from anon, authenticated;
