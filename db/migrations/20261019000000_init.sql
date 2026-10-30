-- M0 : socle. Les tables métier arrivent avec M1 (comptes et foyers) et M2 (catalogue).

-- Recherche d'ingrédients par similarité (rapprochement de l'import de recettes, SPEC §8.8).
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
