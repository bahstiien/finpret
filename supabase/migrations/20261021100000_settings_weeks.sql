-- M4 : réglages du foyer, présence, semaines, avis, garde-manger et congélateur (SPEC §5, §6, §9).
-- Les réglages sont du JSON validé par Zod côté serveur (src/server/settings/schema.ts).

alter table public.households
  add column timezone text not null default 'Europe/Paris',
  -- Garde alternée : lundi d'une semaine « A » (null = pas de garde alternée).
  add column alternating_from date,
  add column onboarded_at timestamptz;

create table public.household_settings (
  household_id uuid primary key references public.households on delete cascade,
  version int not null default 1,
  diet jsonb not null,
  menu jsonb not null,
  session jsonb not null,
  shopping jsonb not null,
  equipment jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.presence_rules (
  member_id uuid not null references public.members on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  meal text not null check (meal in ('lunch', 'dinner')),
  present boolean not null,
  week_parity text not null default 'all' check (week_parity in ('all', 'A', 'B')),
  primary key (member_id, weekday, meal, week_parity)
);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  start_date date not null check (extract(isodow from start_date) = 1),
  status text not null check (status in ('draft', 'active', 'done')),
  plan jsonb not null,
  pasta_need smallint,
  pantry_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, start_date)
);
create index weeks_household_start_idx on public.weeks (household_id, start_date desc);

create table public.ratings (
  household_id uuid not null references public.households on delete cascade,
  recipe_id text not null references public.recipes on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (household_id, recipe_id)
);

create table public.pantry (
  household_id uuid not null references public.households on delete cascade,
  ingredient_key text not null references public.ingredients on delete cascade,
  qty numeric check (qty is null or qty >= 0),  -- null = « assez »
  updated_at timestamptz not null default now(),
  primary key (household_id, ingredient_key)
);

create table public.freezer (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  recipe_id text not null references public.recipes on delete cascade,
  portions int not null check (portions >= 0),
  frozen_at date not null default current_date
);
create index freezer_household_idx on public.freezer (household_id);

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger household_settings_touch before update on public.household_settings
  for each row execute function public.touch_updated_at();
create trigger weeks_touch before update on public.weeks
  for each row execute function public.touch_updated_at();
create trigger pantry_touch before update on public.pantry
  for each row execute function public.touch_updated_at();

-- Foyer d'un membre (pour la RLS de presence_rules).
create function public.member_household(mid uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select household_id from public.members where id = mid $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.household_settings enable row level security;
alter table public.presence_rules enable row level security;
alter table public.weeks enable row level security;
alter table public.ratings enable row level security;
alter table public.pantry enable row level security;
alter table public.freezer enable row level security;

-- Réglages et présence : lus par tout le foyer, modifiés par l'administrateur (§3, §6).
create policy household_settings_select on public.household_settings
  for select to authenticated using (public.is_household_member(household_id));
create policy household_settings_insert on public.household_settings
  for insert to authenticated with check (public.is_household_admin(household_id));
create policy household_settings_update on public.household_settings
  for update to authenticated
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));

create policy presence_select on public.presence_rules
  for select to authenticated using (public.is_household_member(public.member_household(member_id)));
create policy presence_insert on public.presence_rules
  for insert to authenticated with check (public.is_household_admin(public.member_household(member_id)));
create policy presence_update on public.presence_rules
  for update to authenticated
  using (public.is_household_admin(public.member_household(member_id)))
  with check (public.is_household_admin(public.member_household(member_id)));
create policy presence_delete on public.presence_rules
  for delete to authenticated using (public.is_household_admin(public.member_household(member_id)));

-- Semaines, avis, garde-manger, congélateur : lus par tout le foyer, modifiés par admin et membre (§3).
create policy weeks_select on public.weeks
  for select to authenticated using (public.is_household_member(household_id));
create policy weeks_insert on public.weeks
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy weeks_update on public.weeks
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
create policy weeks_delete on public.weeks
  for delete to authenticated using (public.can_edit_household(household_id));

create policy ratings_select on public.ratings
  for select to authenticated using (public.is_household_member(household_id));
create policy ratings_insert on public.ratings
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy ratings_update on public.ratings
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
create policy ratings_delete on public.ratings
  for delete to authenticated using (public.can_edit_household(household_id));

create policy pantry_select on public.pantry
  for select to authenticated using (public.is_household_member(household_id));
create policy pantry_insert on public.pantry
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy pantry_update on public.pantry
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
create policy pantry_delete on public.pantry
  for delete to authenticated using (public.can_edit_household(household_id));

create policy freezer_select on public.freezer
  for select to authenticated using (public.is_household_member(household_id));
create policy freezer_insert on public.freezer
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy freezer_update on public.freezer
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
create policy freezer_delete on public.freezer
  for delete to authenticated using (public.can_edit_household(household_id));

-- Fuseau horaire et garde alternée modifiables par l'administrateur, comme le nom.
grant update (timezone, alternating_from, onboarded_at) on public.households to authenticated;

revoke all on public.household_settings, public.presence_rules, public.weeks, public.ratings,
  public.pantry, public.freezer from anon;
