-- M2 : catalogue global en lecture seule, recettes privées par foyer (SPEC §9 RLS).
-- Indépendant du seed : les lignes de test sont créées ici puis annulées par le rollback.
begin;
select plan(13);

-- Catalogue de test (en superutilisateur, comme `pnpm seed`)
insert into public.aisles (key, label, position) values ('test_rayon', 'Rayon de test', 900);
insert into public.ingredients (key, label, unit, aisle, allergens)
values ('test_ingredient', 'Ingrédient de test', 'g', 'test_rayon', '{gluten}');
insert into public.packs (ingredient_key, sizes, label) values ('test_ingredient', '{500}', 'paquet');
insert into public.recipes (id, kind, data, protein, diet_tags, allergens)
values ('test_global', 'main', '{"n": "Plat de test"}', 'veg', '{vegetarien}', '{gluten}');

select set_config('t.alice', tests.create_user('alice-catalogue@test.local')::text, true);
select set_config('t.carol', tests.create_user('carol-catalogue@test.local')::text, true);
select set_config('t.dave', tests.create_user('dave-catalogue@test.local')::text, true);

select tests.login_as(current_setting('t.alice')::uuid);
select set_config('t.hA', public.create_household('Foyer catalogue A')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.hA')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.hA')::uuid), true);
select tests.login_as(current_setting('t.carol')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.dave')::uuid);
select public.create_household('Foyer catalogue D');

-- Catalogue global ----------------------------------------------------------------
select tests.login_as(current_setting('t.alice')::uuid);
select is((select label from public.ingredients where key = 'test_ingredient'), 'Ingrédient de test',
  'un compte connecté lit les ingrédients');
select is((select count(*)::int from public.packs where ingredient_key = 'test_ingredient'), 1,
  'et les contenants');
select is((select name from public.recipes where id = 'test_global'), 'Plat de test',
  'et les recettes du catalogue global (nom extrait des données)');
select throws_ok($$ insert into public.ingredients (key, label, unit, aisle) values ('pirate', 'X', 'g', 'test_rayon') $$,
  '42501', null, 'un compte ne modifie pas les ingrédients');
select throws_ok($$ insert into public.recipes (id, kind, data) values ('pirate', 'main', '{}') $$,
  '42501', null, 'un compte n''ajoute pas de recette au catalogue global');
update public.recipes set data = '{"n": "Piraté"}' where id = 'test_global';
reset role;
select is((select name from public.recipes where id = 'test_global'), 'Plat de test',
  'un compte ne modifie pas une recette du catalogue global');

select tests.login_as_anon();
select throws_ok($$ select count(*) from public.recipes $$, '42501', null,
  'un visiteur non connecté ne lit pas le catalogue');

-- Recettes privées ------------------------------------------------------------------
select tests.login_as(current_setting('t.alice')::uuid);
select lives_ok(
  format($$ insert into public.recipes (id, kind, data, household_id, status, source_name)
            values ('test_privee', 'simple', '{"n": "Recette maison"}', %L, 'draft', 'Marmiton') $$,
         current_setting('t.hA')),
  'un administrateur ajoute une recette privée à son foyer'
);

select tests.login_as(current_setting('t.carol')::uuid);
select is((select count(*)::int from public.recipes where id = 'test_privee'), 1,
  'la lecture seule voit les recettes privées du foyer');
select throws_ok(
  format($$ insert into public.recipes (id, kind, data, household_id) values ('test_carol', 'simple', '{}', %L) $$,
         current_setting('t.hA')),
  '42501', null, 'la lecture seule n''ajoute pas de recette'
);

select tests.login_as(current_setting('t.dave')::uuid);
select is((select count(*)::int from public.recipes where id = 'test_privee'), 0,
  'un autre foyer ne voit pas les recettes privées');
select throws_ok(
  format($$ insert into public.recipes (id, kind, data, household_id) values ('test_dave', 'simple', '{}', %L) $$,
         current_setting('t.hA')),
  '42501', null, 'un autre foyer n''ajoute pas de recette chez lui'
);

reset role;
select throws_ok(
  $$ insert into public.recipes (id, kind, data, status) values ('test_brouillon', 'main', '{}', 'draft') $$,
  '23514', null, 'le catalogue global ne contient pas de brouillon'
);

select * from finish();
rollback;
