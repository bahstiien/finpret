-- Courses réelles L2 : préparations protégées et confirmations de couverture, isolées par foyer.
begin;
select plan(8);

insert into public.aisles (key, label, position) values ('pr_rayon', 'Rayon PR', 904);
insert into public.ingredients (key, label, unit, aisle) values ('pr_ing', 'Ingrédient PR', 'g', 'pr_rayon');
select set_config('t.admin', tests.create_user('admin-pr@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-pr@test.local')::text, true);
select set_config('t.other', tests.create_user('other-pr@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer PR')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
insert into public.weeks (household_id, start_date, status, plan) values (current_setting('t.h')::uuid, '2027-03-01', 'draft', '{}');
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer PR');

select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.preparation_states (week_id, uid, household_id, state) values (%L, 'prep-1', %L, 'started') $$,
         current_setting('t.w'), current_setting('t.h')),
  'un membre marque une préparation commencée'
);
select lives_ok(
  format($$ update public.preparation_states set state = 'prepared' where week_id = %L $$, current_setting('t.w')),
  'puis préparée'
);
select lives_ok(
  format($$ update public.preparation_states set state = 'started' where week_id = %L $$, current_setting('t.w')),
  'un retour en arrière est accepté mais sans effet'
);
select is((select state from public.preparation_states where week_id = current_setting('t.w')::uuid), 'prepared',
  'une préparation préparée ne redevient pas commencée');
select throws_ok(
  format($$ delete from public.preparation_states where week_id = %L $$, current_setting('t.w')),
  '42501', null, 'une protection ne se supprime pas'
);
select lives_ok(
  format($$ insert into public.coverage_confirmations (week_id, ingredient_key, household_id, confirmed_need)
            values (%L, 'pr_ing', %L, 200) $$, current_setting('t.w'), current_setting('t.h')),
  'un membre confirme une couverture bornée au besoin'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.preparation_states), 1, 'la lecture seule consulte');

select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.preparation_states) + (select count(*)::int from public.coverage_confirmations), 0,
  'un autre foyer ne voit rien');

select * from finish();
rollback;
