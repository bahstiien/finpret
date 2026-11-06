-- Prix de référence des ingrédients du catalogue global (seed/prices.json), pour le coût par portion des recettes.
-- price est en euros par `per` : kg (ingrédient en g), l (en ml), sinon l'unité de l'ingrédient.
create table public.ingredient_prices (
  ingredient_key text primary key references public.ingredients on delete cascade,
  price numeric not null check (price > 0),
  per text not null check (per in ('kg', 'l', 'pc', 'boite', 'cs', 'cc')),
  product text not null,
  pack text,
  pack_price numeric check (pack_price > 0),
  note text,
  -- Estimation hors drive de référence : URL de la source (affichée seulement dans les CGV).
  source text,
  store text not null,
  observed_at date not null
);

alter table public.ingredient_prices enable row level security;
create policy ingredient_prices_select on public.ingredient_prices for select to authenticated using (true);

-- Catalogue en lecture seule côté client ; aucun accès anonyme.
revoke insert, update, delete on public.ingredient_prices from authenticated;
revoke all on public.ingredient_prices from anon;
