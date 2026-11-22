-- Semaine figée au lancement de la session (« Commencer ma session ») : instantané des portions et des étapes.
-- Tant que la colonne est vide, le menu reste modifiable ; une fois remplie, elle ne change plus.
alter table public.weeks add column if not exists frozen jsonb;
