-- Retour rapide sur les repas : on réutilise `ratings` (une ligne par foyer et recette).
--   value      : 1 = « à refaire » (ex-favori), -1 = refusé (exclu du tirage) ; null = pas d'avis de goût.
--   kids_liked : « aimé par les enfants » (goût).
--   too_long   : « trop long » (temps de préparation, indépendant du goût).
-- Compatible avec la version précédente de l'app : elle lit `value` et traite null comme « pas d'avis ».

alter table public.ratings alter column value drop not null;
alter table public.ratings
  add column kids_liked boolean not null default false,
  add column too_long boolean not null default false;

-- Un refus et « aimé par les enfants » se contredisent ; une ligne vide n'a pas de raison d'exister.
alter table public.ratings
  add constraint ratings_refused_not_liked check (value is distinct from -1 or not kids_liked),
  add constraint ratings_not_empty check (value is not null or kids_liked or too_long);
