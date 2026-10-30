-- M8b : import de recettes par lien (SPEC §8.8, §9).
-- Ingrédients propres au foyer (créés quand un ingrédient importé n'a pas d'équivalent au catalogue)
-- et journal des imports. Les recettes importées vont dans `recipes` avec `household_id`.

create table public.household_ingredients (
  -- Préfixe « h_ » : aucune collision avec les clés du catalogue global.
  key text primary key check (key ~ '^h_[a-z0-9_]+$'),
  household_id uuid not null references public.households on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  unit text not null check (unit in ('g', 'ml', 'pc', 'boite', 'cs', 'cc')),
  aisle text not null references public.aisles,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index household_ingredients_household_idx on public.household_ingredients (household_id);

create table public.recipe_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  url text not null,
  status text not null default 'pending' check (status in ('pending', 'parsed', 'failed', 'validated')),
  method text check (method in ('jsonld', 'microdata', 'llm', 'manual')),
  -- Lignes d'ingrédients telles que lues (des faits, pas le texte des étapes).
  raw_ingredients text[],
  error text,
  recipe_id text references public.recipes on delete set null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index recipe_imports_household_idx on public.recipe_imports (household_id, created_at desc);

-- Quota mensuel par foyer, appliqué par la base. TODO(spec) : valeur à confirmer (30 retenu).
create function public.recipe_imports_quota()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.recipe_imports
      where household_id = new.household_id
        and created_at >= date_trunc('month', now())) >= 30 then
    raise exception 'quota d''import atteint' using errcode = 'P0001', hint = 'import_quota';
  end if;
  return new;
end;
$$;
create trigger recipe_imports_quota before insert on public.recipe_imports
  for each row execute function public.recipe_imports_quota();

-- ---------------------------------------------------------------------------
-- Clés d'ingrédient des courses et du garde-manger : catalogue global ou ingrédient du foyer.
-- La clé étrangère vers `ingredients` est remplacée par une vérification qui accepte les deux.
-- ---------------------------------------------------------------------------

create function public.check_ingredient_key()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.ingredient_key is null
     or exists (select 1 from public.ingredients where key = new.ingredient_key)
     or exists (select 1 from public.household_ingredients
                where key = new.ingredient_key and household_id = new.household_id) then
    return new;
  end if;
  raise exception 'ingrédient inconnu : %', new.ingredient_key using errcode = '23503';
end;
$$;

alter table public.shopping_items drop constraint shopping_items_ingredient_key_fkey;
create trigger shopping_items_ingredient_key before insert or update of ingredient_key, household_id
  on public.shopping_items for each row execute function public.check_ingredient_key();

alter table public.pantry drop constraint pantry_ingredient_key_fkey;
create trigger pantry_ingredient_key before insert or update of ingredient_key, household_id
  on public.pantry for each row execute function public.check_ingredient_key();

-- Un ingrédient du foyer supprimé disparaît des courses et du garde-manger.
create function public.household_ingredients_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.shopping_items where household_id = old.household_id and ingredient_key = old.key;
  delete from public.pantry where household_id = old.household_id and ingredient_key = old.key;
  return old;
end;
$$;
create trigger household_ingredients_cleanup after delete on public.household_ingredients
  for each row execute function public.household_ingredients_cleanup();

-- ---------------------------------------------------------------------------
-- RLS : lecture par les membres, écriture par les rôles admin et member (§9).
-- ---------------------------------------------------------------------------

alter table public.household_ingredients enable row level security;
alter table public.recipe_imports enable row level security;

create policy household_ingredients_select on public.household_ingredients
  for select to authenticated using (public.is_household_member(household_id));
create policy household_ingredients_insert on public.household_ingredients
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy household_ingredients_update on public.household_ingredients
  for update to authenticated
  using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));
create policy household_ingredients_delete on public.household_ingredients
  for delete to authenticated using (public.can_edit_household(household_id));

create policy recipe_imports_select on public.recipe_imports
  for select to authenticated using (public.is_household_member(household_id));
create policy recipe_imports_insert on public.recipe_imports
  for insert to authenticated
  with check (public.can_edit_household(household_id) and created_by = auth.uid());
create policy recipe_imports_update on public.recipe_imports
  for update to authenticated
  using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));
create policy recipe_imports_delete on public.recipe_imports
  for delete to authenticated using (public.can_edit_household(household_id));

revoke all on public.household_ingredients, public.recipe_imports from anon;
