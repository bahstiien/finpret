-- Anti-gaspi : date limite des ingrédients du garde-manger et ingrédients sauvés du stock.
-- Compatible avec la version précédente de l'app : `use_by` est facultative, et l'ancienne app ne lit pas `pantry_saves`.

-- « À utiliser avant le » : le moteur favorise les recettes qui écoulent un ingrédient à date courte.
alter table public.pantry add column use_by date;

-- Ingrédients pris dans le stock par une session terminée (écran Progrès).
-- `qty` dans l'unité de l'ingrédient (null = « assez », quantité inconnue) ; `urgent` : à date courte à la session.
create table public.pantry_saves (
  household_id uuid not null references public.households on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  ingredient_key text not null references public.ingredients on delete cascade,
  qty numeric check (qty is null or qty >= 0),
  urgent boolean not null default false,
  saved_on date not null,
  primary key (household_id, week_id, ingredient_key)
);
create index pantry_saves_household_idx on public.pantry_saves (household_id, saved_on);

-- Écritures par le serveur seulement (comme recipe_cooks) : les clients n'ont que la lecture.
alter table public.pantry_saves enable row level security;
create policy pantry_saves_select on public.pantry_saves
  for select to authenticated using (public.is_household_member(household_id));
revoke all on public.pantry_saves from anon, authenticated;
grant select on public.pantry_saves to authenticated;
