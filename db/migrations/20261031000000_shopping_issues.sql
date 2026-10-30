-- Courses réelles, lot L1 : signalement « Introuvable » par ingrédient et semaine.
-- Un signalement est daté et ne supprime ni ne modifie aucun achat.

create table public.shopping_issues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  ingredient_key text not null references public.ingredients on delete restrict,
  kind text not null default 'not_found' check (kind in ('not_found')),
  -- open : à résoudre ; search_elsewhere : « Je chercherai ailleurs » ; no_more : « Je n'en achèterai pas davantage ».
  decision text not null default 'open' check (decision in ('open', 'search_elsewhere', 'no_more')),
  author uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, ingredient_key)
);
create index shopping_issues_week_idx on public.shopping_issues (household_id, week_id);

create trigger shopping_issues_touch before update on public.shopping_issues
  for each row execute function public.touch_updated_at();

alter table public.shopping_issues enable row level security;
create policy shopping_issues_select on public.shopping_issues
  for select to authenticated using (public.is_household_member(household_id));
create policy shopping_issues_insert on public.shopping_issues
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy shopping_issues_update on public.shopping_issues
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
create policy shopping_issues_delete on public.shopping_issues
  for delete to authenticated using (public.can_edit_household(household_id));

revoke all on public.shopping_issues from anon, authenticated;
grant select, delete on public.shopping_issues to authenticated;
grant insert (household_id, week_id, ingredient_key) on public.shopping_issues to authenticated;
grant update (decision) on public.shopping_issues to authenticated;

alter table public.shopping_issues replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shopping_issues;
  end if;
end;
$$;
