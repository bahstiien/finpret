-- M10 : menus de la cantine (SPEC §13, §9).

create table public.canteen_menus (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  date date not null,
  text text not null check (char_length(text) between 1 and 300),
  source text not null default 'manual' check (source in ('manual', 'pdf', 'url')),
  -- Un menu importé (PDF, lien) n'est utilisé qu'après validation à l'écran.
  validated boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (member_id, date)
);
create index canteen_menus_date_idx on public.canteen_menus (date);

create trigger canteen_menus_touch before update on public.canteen_menus
  for each row execute function public.touch_updated_at();

-- Réglages de la cantine (alerte doublon, lien des menus par enfant), avec les autres réglages du foyer.
alter table public.household_settings add column canteen jsonb not null default '{}';

alter table public.canteen_menus enable row level security;

-- Lecture par tout le foyer ; saisie par les rôles admin et member (la lecture seule consulte).
create policy canteen_menus_select on public.canteen_menus
  for select to authenticated using (public.is_household_member(public.member_household(member_id)));
create policy canteen_menus_insert on public.canteen_menus
  for insert to authenticated with check (public.can_edit_household(public.member_household(member_id)));
create policy canteen_menus_update on public.canteen_menus
  for update to authenticated
  using (public.can_edit_household(public.member_household(member_id)))
  with check (public.can_edit_household(public.member_household(member_id)));
create policy canteen_menus_delete on public.canteen_menus
  for delete to authenticated using (public.can_edit_household(public.member_household(member_id)));

revoke all on public.canteen_menus from anon;
