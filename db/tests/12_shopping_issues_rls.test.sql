-- Courses réelles L1 : signalements « Introuvable » isolés par foyer, lecture seule en consultation.
begin;
select plan(6);

insert into public.aisles (key, label, position) values ('si_rayon', 'Rayon SI', 903);
insert into public.ingredients (key, label, unit, aisle) values ('si_ing', 'Ingrédient SI', 'g', 'si_rayon');
select set_config('t.admin', tests.create_user('admin-si@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-si@test.local')::text, true);
select set_config('t.other', tests.create_user('other-si@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer SI')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
insert into public.weeks (household_id, start_date, status, plan) values (current_setting('t.h')::uuid, '2027-03-01', 'draft', '{}');
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer SI');

select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.shopping_issues (household_id, week_id, ingredient_key) values (%L, %L, 'si_ing') $$,
         current_setting('t.h'), current_setting('t.w')),
  'un membre signale un produit introuvable'
);
select lives_ok(
  format($$ update public.shopping_issues set decision = 'search_elsewhere' where week_id = %L $$, current_setting('t.w')),
  'et choisit de chercher ailleurs'
);
select throws_ok(
  format($$ insert into public.shopping_issues (household_id, week_id, ingredient_key) values (%L, %L, 'si_ing') $$,
         current_setting('t.h'), current_setting('t.w')),
  '23505', null, 'un seul signalement par ingrédient et semaine'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.shopping_issues), 1, 'la lecture seule consulte');
select is((select count(*)::int from public.shopping_issues where decision = 'open'), 0, 'et la décision est lisible');

select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.shopping_issues), 0, 'un autre foyer ne voit rien');

select * from finish();
rollback;
