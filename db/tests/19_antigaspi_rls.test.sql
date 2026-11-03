-- Anti-gaspi : date limite du garde-manger (écrite par le foyer), ingrédients sauvés (lecture seule pour les clients).
begin;
select plan(6);

insert into public.aisles (key, label, position) values ('ag_rayon', 'Rayon AG', 903);
insert into public.ingredients (key, label, unit, aisle) values ('ag_ing', 'Ingrédient AG', 'g', 'ag_rayon');

select set_config('t.a', tests.create_user('a-ag@test.local')::text, true);
select set_config('t.b', tests.create_user('b-ag@test.local')::text, true);

select tests.login_as(current_setting('t.a')::uuid);
select set_config('t.h', public.create_household('Foyer AG')::text, true);
select tests.login_as(current_setting('t.b')::uuid);
select public.create_household('Autre foyer AG');

select tests.login_as(current_setting('t.a')::uuid);
select lives_ok(
  format($$ insert into public.pantry (household_id, ingredient_key, qty, use_by) values (%L, 'ag_ing', 200, '2027-01-08') $$,
    current_setting('t.h')),
  'le foyer pose une date limite sur son garde-manger');

-- Données écrites par le serveur (rôle propriétaire).
reset role;
insert into public.weeks (household_id, start_date, status, plan)
  values (current_setting('t.h')::uuid, '2027-01-04', 'active', '{}');
insert into public.pantry_saves (household_id, week_id, ingredient_key, qty, urgent, saved_on)
  select current_setting('t.h')::uuid, id, 'ag_ing', 200, true, '2027-01-03'
  from public.weeks where household_id = current_setting('t.h')::uuid;

select tests.login_as(current_setting('t.a')::uuid);
select is((select count(*)::int from public.pantry_saves), 1, 'un membre lit les ingrédients sauvés de son foyer');
select throws_ok(
  $$ insert into public.pantry_saves (household_id, week_id, ingredient_key, saved_on)
     select household_id, week_id, ingredient_key, saved_on from public.pantry_saves $$,
  '42501', null, 'un client ne peut pas inscrire un ingrédient sauvé');
select throws_ok(
  $$ update public.pantry_saves set qty = 9999 $$,
  '42501', null, 'un client ne modifie pas un ingrédient sauvé');

select tests.login_as(current_setting('t.b')::uuid);
select is((select count(*)::int from public.pantry_saves), 0, 'un autre foyer ne lit pas les ingrédients sauvés');
select is((select count(*)::int from public.pantry where use_by is not null), 0, 'ni les dates limites');

select * from finish();
rollback;
