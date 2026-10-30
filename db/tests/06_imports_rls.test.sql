-- M8b : ingrédients du foyer et journal des imports (SPEC §8.8, §9).
begin;
select plan(12);

insert into public.aisles (key, label, position) values ('m8_rayon', 'Rayon M8', 908);
insert into public.ingredients (key, label, unit, aisle) values ('m8_ing', 'Ingrédient M8', 'g', 'm8_rayon');

select set_config('t.admin', tests.create_user('admin-m8b@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-m8b@test.local')::text, true);
select set_config('t.other', tests.create_user('other-m8b@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer M8b')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select set_config('t.o', public.create_household('Autre foyer M8b')::text, true);

-- Un membre crée un ingrédient du foyer et l'ajoute aux courses.
select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.household_ingredients (key, household_id, label, unit, aisle)
            values ('h_m8b_chia', %L, 'Graines de chia', 'g', 'm8_rayon') $$, current_setting('t.h')),
  'un membre crée un ingrédient du foyer'
);
select throws_ok(
  format($$ insert into public.household_ingredients (key, household_id, label, unit, aisle)
            values ('m8_ing', %L, 'Collision', 'g', 'm8_rayon') $$, current_setting('t.h')),
  '23514', null, 'une clé du foyer ne peut pas imiter une clé du catalogue'
);
select lives_ok(
  format($$ insert into public.shopping_items (household_id, source, ingredient_key, aisle)
            values (%L, 'manual', 'h_m8b_chia', 'm8_rayon') $$, current_setting('t.h')),
  'un ingrédient du foyer peut aller dans les courses'
);
select lives_ok(
  format($$ insert into public.pantry (household_id, ingredient_key) values (%L, 'm8_ing') $$, current_setting('t.h')),
  'un ingrédient du catalogue reste accepté au garde-manger'
);
select throws_ok(
  format($$ insert into public.shopping_items (household_id, source, ingredient_key, aisle)
            values (%L, 'manual', 'inconnu', 'm8_rayon') $$, current_setting('t.h')),
  '23503', null, 'une clé inconnue est refusée'
);
insert into public.recipe_imports (household_id, url, status, method)
values (current_setting('t.h')::uuid, 'https://exemple.fr/recette', 'parsed', 'jsonld');
select is((select created_by from public.recipe_imports), current_setting('t.admin')::uuid, 'l''import garde son auteur');

-- Lecture seule : lit, n'écrit pas.
select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.household_ingredients), 1, 'la lecture seule voit les ingrédients du foyer');
select throws_ok(
  format($$ insert into public.recipe_imports (household_id, url) values (%L, 'https://exemple.fr/x') $$, current_setting('t.h')),
  '42501', null, 'la lecture seule n''importe pas'
);

-- Isolation entre foyers.
select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.household_ingredients) + (select count(*)::int from public.recipe_imports), 0,
  'un autre foyer ne voit ni les ingrédients ni les imports');
select throws_ok(
  format($$ insert into public.pantry (household_id, ingredient_key) values (%L, 'h_m8b_chia') $$, current_setting('t.o')),
  '23503', null, 'un autre foyer n''utilise pas l''ingrédient d''un foyer'
);

-- Quota mensuel.
select tests.login_as(current_setting('t.admin')::uuid);
insert into public.recipe_imports (household_id, url)
select current_setting('t.h')::uuid, 'https://exemple.fr/' || g from generate_series(1, 29) g;
select throws_ok(
  format($$ insert into public.recipe_imports (household_id, url) values (%L, 'https://exemple.fr/31') $$, current_setting('t.h')),
  'P0001', null, 'au-delà de 30 imports par mois, la base refuse'
);

-- Supprimer l'ingrédient du foyer le retire des courses.
delete from public.household_ingredients where key = 'h_m8b_chia';
select is((select count(*)::int from public.shopping_items where ingredient_key = 'h_m8b_chia'), 0,
  'l''ingrédient supprimé quitte la liste de courses');

select * from finish();
rollback;
