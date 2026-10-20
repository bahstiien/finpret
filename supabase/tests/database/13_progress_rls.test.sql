-- SPEC_PROGRES §6.2 : lecture par les membres du foyer, aucune écriture client.
begin;
select plan(9);

select set_config('t.a', tests.create_user('a-prog@test.local')::text, true);
select set_config('t.b', tests.create_user('b-prog@test.local')::text, true);

select tests.login_as(current_setting('t.a')::uuid);
select set_config('t.h', public.create_household('Foyer progrès')::text, true);
select tests.login_as(current_setting('t.b')::uuid);
select public.create_household('Autre foyer progrès');

-- Données écrites par le serveur (rôle propriétaire).
reset role;
insert into public.streak_weeks (household_id, week_start, outcome) values (current_setting('t.h')::uuid, '2027-01-04', 'done');
insert into public.recipes (id, kind, data, origin) values ('prog-jp', 'main', '{"n":"Test"}', 'jp');
insert into public.recipe_cooks (household_id, recipe_id, kind, cooked_on)
  values (current_setting('t.h')::uuid, 'prog-jp', 'main', '2027-01-03');
insert into public.achievements (household_id, kind, key) values (current_setting('t.h')::uuid, 'country', 'jp');

select tests.login_as(current_setting('t.a')::uuid);
select is((select count(*)::int from public.streak_weeks), 1, 'un membre lit la série de son foyer');
select is((select count(*)::int from public.recipe_cooks), 1, 'un membre lit les recettes cuisinées');
select is((select count(*)::int from public.achievements), 1, 'un membre lit les tampons');

select throws_ok(
  $$ insert into public.streak_weeks (household_id, week_start, outcome) values (current_setting('t.h')::uuid, '2027-01-11', 'done') $$,
  '42501', null, 'un client ne peut pas inscrire une semaine');
select throws_ok(
  $$ insert into public.achievements (household_id, kind, key) values (current_setting('t.h')::uuid, 'country', 'it') $$,
  '42501', null, 'un client ne peut pas inscrire un tampon');
select throws_ok(
  $$ update public.achievements set seen_at = now() $$,
  '42501', null, 'un client ne modifie pas un tampon (action serveur markAchievementsSeen)');
select throws_ok(
  $$ update public.sessions set done_at = now() $$,
  '42501', null, 'un client ne pose pas done_at');

select tests.login_as(current_setting('t.b')::uuid);
select is((select count(*)::int from public.streak_weeks), 0, 'un autre foyer ne lit pas la série');
select is((select count(*)::int from public.recipe_cooks) + (select count(*)::int from public.achievements), 0,
  'ni les recettes cuisinées ni les tampons');

select * from finish();
rollback;
