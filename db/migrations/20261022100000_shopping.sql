-- M6 : liste de courses partagée en temps réel (SPEC §8.3, §9).
-- Une ligne par article : chaque coche, ajout ou suppression est une modification isolée (aucun écrasement global).

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  week_id uuid references public.weeks on delete cascade,
  source text not null check (source in ('menu', 'pantry_check', 'manual')),
  ingredient_key text references public.ingredients on delete cascade,
  label text,
  qty_text text,
  aisle text not null,
  checked boolean not null default false,
  checked_by uuid references auth.users on delete set null,
  added_by uuid references auth.users on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (ingredient_key is not null or label is not null)
);
-- Un ingrédient du menu ou du placard n'apparaît qu'une fois par semaine.
create unique index shopping_items_menu_key on public.shopping_items (week_id, source, ingredient_key)
  where source in ('menu', 'pantry_check');
create index shopping_items_household_idx on public.shopping_items (household_id, week_id);

create trigger shopping_items_touch before update on public.shopping_items
  for each row execute function public.touch_updated_at();

-- Qui a coché : renseigné par la base, pas par le client.
create function public.shopping_items_checked_by()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.checked is distinct from old.checked then
    new.checked_by := case when new.checked then auth.uid() else null end;
  end if;
  return new;
end;
$$;
create trigger shopping_items_checked before update on public.shopping_items
  for each row execute function public.shopping_items_checked_by();

alter table public.shopping_items enable row level security;

-- Tout le foyer, lecture seule comprise, coche et ajoute des articles (§3).
create policy shopping_select on public.shopping_items
  for select to authenticated using (public.is_household_member(household_id));
create policy shopping_insert on public.shopping_items
  for insert to authenticated with check (public.is_household_member(household_id));
create policy shopping_update on public.shopping_items
  for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_delete on public.shopping_items
  for delete to authenticated using (public.is_household_member(household_id));

-- Colonnes modifiables côté client : la coche et les articles ajoutés à la main.
revoke insert, update on public.shopping_items from authenticated;
grant insert (id, household_id, week_id, source, ingredient_key, label, qty_text, aisle, checked)
  on public.shopping_items to authenticated;
grant update (checked, label, qty_text, aisle) on public.shopping_items to authenticated;
revoke all on public.shopping_items from anon;

-- Temps réel, filtré par foyer côté client et par la RLS côté serveur.
alter table public.shopping_items replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
end;
$$;
