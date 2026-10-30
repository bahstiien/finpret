-- Courses réelles, lot L2 : préparations protégées et couverture « assez » bornée.
-- La session démarrée verrouille déjà toute la semaine (sessions.started_at) ; cette table protège en plus
-- une préparation individuelle « déjà commencée / préparée » (§14). Pas de retour en arrière.

create table public.preparation_states (
  week_id uuid not null references public.weeks on delete cascade,
  -- Identité stable de la préparation (`uid` du plan), pas l'indice ni l'identifiant de recette.
  uid text not null check (length(uid) between 1 and 64),
  household_id uuid not null references public.households on delete cascade,
  state text not null check (state in ('started', 'prepared')),
  updated_by uuid references auth.users on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (week_id, uid)
);
create index preparation_states_household_idx on public.preparation_states (household_id);

-- « Préparée » ne revient pas à « commencée » : une préparation protégée le reste.
create function public.preparation_states_monotonic()
returns trigger language plpgsql
as $$
begin
  if old.state = 'prepared' and new.state = 'started' then
    new.state := 'prepared';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger preparation_states_monotonic before update on public.preparation_states
  for each row execute function public.preparation_states_monotonic();

alter table public.preparation_states enable row level security;
create policy preparation_states_select on public.preparation_states
  for select to authenticated using (public.is_household_member(household_id));
create policy preparation_states_insert on public.preparation_states
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy preparation_states_update on public.preparation_states
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));

revoke all on public.preparation_states from anon, authenticated;
grant select on public.preparation_states to authenticated;
grant insert (week_id, uid, household_id, state) on public.preparation_states to authenticated;
grant update (state) on public.preparation_states to authenticated;

-- Couverture « assez » : confirmation non numérique, liée au besoin affiché au moment de la confirmation.
create table public.coverage_confirmations (
  week_id uuid not null references public.weeks on delete cascade,
  ingredient_key text not null references public.ingredients on delete restrict,
  household_id uuid not null references public.households on delete cascade,
  confirmed_need numeric(12, 4) not null check (confirmed_need >= 0 and confirmed_need <= 100000),
  author uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (week_id, ingredient_key)
);

alter table public.coverage_confirmations enable row level security;
create policy coverage_confirmations_select on public.coverage_confirmations
  for select to authenticated using (public.is_household_member(household_id));
create policy coverage_confirmations_insert on public.coverage_confirmations
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy coverage_confirmations_update on public.coverage_confirmations
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));

revoke all on public.coverage_confirmations from anon, authenticated;
grant select on public.coverage_confirmations to authenticated;
grant insert (week_id, ingredient_key, household_id, confirmed_need) on public.coverage_confirmations to authenticated;
grant update (confirmed_need) on public.coverage_confirmations to authenticated;

alter table public.preparation_states replica identity full;
alter table public.coverage_confirmations replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.preparation_states;
    alter publication supabase_realtime add table public.coverage_confirmations;
  end if;
end;
$$;
