-- Suggestions de recettes : un utilisateur propose une modification d'une recette de la bibliothèque, ou une
-- nouvelle recette. Elles arrivent dans le back-office, où un administrateur les applique au catalogue global.

create table public.recipe_suggestions (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('edit', 'new')),
  -- Recette visée (modification). Conservée même si la recette est désactivée.
  recipe_id text references public.recipes on delete set null,
  -- Type proposé (nouvelle recette).
  recipe_kind text check (recipe_kind in ('main', 'soup', 'simple', 'cake')),
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 4000),
  source_url text check (char_length(source_url) <= 2000),
  user_id uuid references auth.users on delete set null,
  household_id uuid references public.households on delete set null,
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected')),
  note text check (char_length(note) <= 2000),
  -- Recette du catalogue créée ou modifiée en appliquant la suggestion.
  applied_recipe_id text,
  handled_by uuid references auth.users on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recipe_suggestions_target check (
    (kind = 'edit' and recipe_id is not null) or (kind = 'new' and recipe_kind is not null)
  )
);
create index recipe_suggestions_status_idx on public.recipe_suggestions (status, created_at desc);
create index recipe_suggestions_user_idx on public.recipe_suggestions (user_id, created_at desc);

-- Aucun accès client : l'action serveur vérifie la session puis écrit avec `service_role`.
alter table public.recipe_suggestions enable row level security;
revoke all on public.recipe_suggestions from anon, authenticated;
revoke all on sequence public.recipe_suggestions_id_seq from anon, authenticated;
grant select, insert, update, delete on public.recipe_suggestions to service_role;
grant usage on sequence public.recipe_suggestions_id_seq to service_role;

-- Recette du catalogue global modifiée ou créée depuis le back-office : `pnpm seed` ne l'écrase plus et ne la
-- désactive plus tant qu'elle n'a pas été reportée dans seed/*.json (voir scripts/seed.ts).
alter table public.recipes add column if not exists edited_in_admin_at timestamptz;
