-- M2 : catalogue (SPEC §9). Global en lecture pour tout compte connecté ; recettes privées par foyer.
-- Le contenu global est écrit uniquement par `pnpm seed` (connexion directe à la base, hors RLS).

create table public.aisles (
  key text primary key,
  label text not null,
  position smallint not null unique
);

create table public.ingredients (
  key text primary key,
  label text not null,
  unit text not null check (unit in ('g', 'ml', 'pc', 'boite', 'cs', 'cc')),
  aisle text not null references public.aisles,
  -- Formes d'affichage du prototype : { n: [singulier, pluriel], showN, s: suffixe }
  forms jsonb not null default '{}',
  half boolean not null default false,
  allergens text[] not null default '{}',
  -- Légume soumis à la saisonnalité (rayon légumes, hors notSeasonal.json).
  seasonal boolean not null default false
);

create table public.packs (
  ingredient_key text primary key references public.ingredients on delete cascade,
  sizes int[] not null check (cardinality(sizes) between 1 and 2),
  label text not null,
  tolerance numeric not null default 0.2 check (tolerance > 0 and tolerance <= 1)
);

create table public.ingredient_synonyms (
  synonym text primary key,
  ingredient_key text not null references public.ingredients on delete cascade
);

create table public.recipes (
  id text primary key,
  kind text not null check (kind in ('main', 'soup', 'simple', 'cake', 'breakfast')),
  -- Recette complète au format du prototype (seed/README.md).
  data jsonb not null,
  name text generated always as (data ->> 'n') stored,
  origin text,
  protein text check (protein in ('volaille', 'boeuf', 'porc', 'poisson', 'veg')),
  months smallint[],
  -- null = inconnu (petits-déjeuners en texte libre) : un filtre de régime ou d'allergène doit alors écarter la recette.
  diet_tags text[] default '{}',
  allergens text[] default '{}',
  is_active boolean not null default true,
  household_id uuid references public.households on delete cascade,  -- null = catalogue global
  source_url text,
  source_name text,
  imported_by uuid references auth.users on delete set null,
  status text not null default 'validated' check (status in ('draft', 'validated')),
  created_at timestamptz not null default now(),
  -- Le catalogue global n'a ni brouillon ni source externe.
  constraint recipes_global_is_validated check (household_id is not null or status = 'validated')
);
create index recipes_kind_idx on public.recipes (kind) where is_active;
create index recipes_household_idx on public.recipes (household_id);
create index recipes_allergens_idx on public.recipes using gin (allergens);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.aisles enable row level security;
alter table public.ingredients enable row level security;
alter table public.packs enable row level security;
alter table public.ingredient_synonyms enable row level security;
alter table public.recipes enable row level security;

create policy aisles_select on public.aisles for select to authenticated using (true);
create policy ingredients_select on public.ingredients for select to authenticated using (true);
create policy packs_select on public.packs for select to authenticated using (true);
create policy ingredient_synonyms_select on public.ingredient_synonyms for select to authenticated using (true);

-- Recettes : le catalogue global pour tous ; les recettes privées pour les membres du foyer,
-- modifiables par les rôles admin et member (§9).
create policy recipes_select on public.recipes
  for select to authenticated
  using (household_id is null or public.is_household_member(household_id));
create policy recipes_insert on public.recipes
  for insert to authenticated
  with check (household_id is not null and public.can_edit_household(household_id));
create policy recipes_update on public.recipes
  for update to authenticated
  using (household_id is not null and public.can_edit_household(household_id))
  with check (household_id is not null and public.can_edit_household(household_id));
create policy recipes_delete on public.recipes
  for delete to authenticated
  using (household_id is not null and public.can_edit_household(household_id));

-- Catalogue en lecture seule côté client ; aucun accès anonyme.
revoke insert, update, delete on public.aisles, public.ingredients, public.packs, public.ingredient_synonyms
  from authenticated;
revoke all on public.aisles, public.ingredients, public.packs, public.ingredient_synonyms, public.recipes
  from anon;
