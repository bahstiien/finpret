-- SPEC_PROGRES G1 : série de semaines fin prêtes, recettes cuisinées, tampons du passeport.
-- Toutes les écritures passent par le serveur (clé de service) : les clients n'ont que la lecture.

alter table public.sessions add column done_at timestamptz;
-- `done_at` est posé par le serveur (action finishSession) : il n'est pas dans les colonnes modifiables du client.

create table public.streak_weeks (
  household_id uuid not null references public.households on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  outcome text not null check (outcome in ('done', 'paused', 'neutral', 'missed')),
  source text check (source in ('auto', 'planned', 'admin')),
  closed_at timestamptz, -- null = pause planifiée pas encore clôturée
  primary key (household_id, week_start)
);

create table public.recipe_cooks (
  id bigserial primary key,
  household_id uuid not null references public.households on delete cascade,
  recipe_id text not null references public.recipes on delete cascade,
  week_id uuid references public.weeks on delete set null,
  kind text not null check (kind in ('main', 'soup', 'simple')),
  cooked_on date not null,
  backfilled boolean not null default false,
  unique (household_id, recipe_id, week_id)
);
create index recipe_cooks_household_idx on public.recipe_cooks (household_id, cooked_on);

create table public.achievements (
  household_id uuid not null references public.households on delete cascade,
  kind text not null check (kind in ('streak', 'country', 'season')),
  key text not null, -- '12', 'jp', '2027-autumn'
  achieved_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (household_id, kind, key)
);

alter table public.streak_weeks enable row level security;
alter table public.recipe_cooks enable row level security;
alter table public.achievements enable row level security;

create policy streak_weeks_select on public.streak_weeks
  for select to authenticated using (public.is_household_member(household_id));
create policy recipe_cooks_select on public.recipe_cooks
  for select to authenticated using (public.is_household_member(household_id));
create policy achievements_select on public.achievements
  for select to authenticated using (public.is_household_member(household_id));

revoke all on public.streak_weeks, public.recipe_cooks, public.achievements from anon, authenticated;
grant select on public.streak_weeks, public.recipe_cooks, public.achievements to authenticated;
revoke all on sequence public.recipe_cooks_id_seq from anon, authenticated;

-- Correction des origines du catalogue (§4.1) : « as » n'est pas un pays, « uk » devient « gb » (ISO 3166-1).
update public.recipes set origin = null where origin = 'as';
update public.recipes set origin = 'gb' where origin = 'uk';
