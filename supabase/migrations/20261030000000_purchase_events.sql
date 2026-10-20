-- Courses réelles, lot L1 : journal d'achats append-only, distinct des besoins calculés.
-- Une correction ou un transfert est un nouvel événement ; aucune ligne n'est modifiée ni supprimée par un client.

create table public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  ingredient_key text not null references public.ingredients on delete restrict,
  -- Quantité décimale dans l'unité du catalogue ; pour une correction : nouveau total brut acquis.
  qty numeric(12, 4) not null check (qty >= 0 and qty <= 100000),
  type text not null check (type in ('purchase', 'correction', 'transfer_out', 'transfer_in')),
  -- Clé d'idempotence : une répétition réseau ne crée qu'un seul effet.
  op_key text not null check (length(op_key) between 8 and 128),
  author uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (household_id, op_key)
);
create index purchase_events_week_idx on public.purchase_events (household_id, week_id, ingredient_key, created_at);

alter table public.purchase_events enable row level security;

create policy purchase_events_select on public.purchase_events
  for select to authenticated using (public.is_household_member(household_id));
create policy purchase_events_insert on public.purchase_events
  for insert to authenticated with check (public.can_edit_household(household_id));

-- Lecture seule (viewer) : consultation uniquement (§7). Append-only : ni mise à jour ni suppression côté client (la suppression en cascade du foyer reste possible).
revoke all on public.purchase_events from anon, authenticated;
grant select on public.purchase_events to authenticated;
grant insert (household_id, week_id, ingredient_key, qty, type, op_key) on public.purchase_events to authenticated;

alter table public.purchase_events replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.purchase_events;
  end if;
end;
$$;
