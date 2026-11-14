-- SPEC_PRISE_EN_MAIN §5 : progression lue par les membres du foyer, aucune écriture client, conseils serveur, journal idempotent.
begin;
select plan(11);

select set_config('t.a', tests.create_user('a-gs@test.local')::text, true);
select set_config('t.b', tests.create_user('b-gs@test.local')::text, true);

select tests.login_as(current_setting('t.a')::uuid);
select set_config('t.h', public.create_household('Foyer prise en main')::text, true);
select tests.login_as(current_setting('t.b')::uuid);
select set_config('t.h2', public.create_household('Autre foyer prise en main')::text, true);

-- Lignes écrites par le serveur (rôle propriétaire).
reset role;
insert into public.onboarding_progress (household_id, steps) values (current_setting('t.h')::uuid, '{"discover_menu":{"via":"event"}}');
insert into public.onboarding_progress (household_id) values (current_setting('t.h2')::uuid);

select tests.login_as(current_setting('t.a')::uuid);
select is((select count(*)::int from public.onboarding_progress), 1, 'un membre lit la progression de son foyer, pas celle des autres');
select is((select household_id from public.onboarding_progress), current_setting('t.h')::uuid, 'c''est bien celle de son foyer');
select throws_ok($$ insert into public.onboarding_progress (household_id) values (gen_random_uuid()) $$,
  '42501', null, 'un client ne crée pas de progression');
select throws_ok($$ update public.onboarding_progress set dismissed_at = now() $$,
  '42501', null, 'un client ne modifie pas la progression (action serveur)');
select throws_ok($$ delete from public.onboarding_progress $$,
  '42501', null, 'un client ne supprime pas la progression');
select throws_ok($$ update public.user_settings set tips_seen = '{menu}' $$,
  '42501', null, 'un client n''écrit pas tips_seen (action serveur)');

select tests.login_as(current_setting('t.b')::uuid);
select is((select count(*)::int from public.onboarding_progress where household_id = current_setting('t.h')::uuid), 0,
  'aucun accès inter-foyer');

-- Journal : une clé de message par compte, un message de la séquence par jour.
reset role;
insert into public.notification_log (user_id, kind, day, payload)
  values (current_setting('t.a')::uuid, 'onboarding', '2027-01-04', '{"key":"welcome"}');
select throws_ok($$ insert into public.notification_log (user_id, kind, day, payload)
  values (current_setting('t.a')::uuid, 'onboarding', '2027-01-09', '{"key":"welcome"}') $$,
  '23505', null, 'une clé de message au plus par compte');
select throws_ok($$ insert into public.notification_log (user_id, kind, day, payload)
  values (current_setting('t.a')::uuid, 'onboarding', '2027-01-04', '{"key":"week2"}') $$,
  '23505', null, 'un message de la séquence par jour et par compte');
select lives_ok($$ insert into public.notification_log (user_id, kind, day, payload)
  values (current_setting('t.a')::uuid, 'onboarding', '2027-01-05', '{"key":"shopping_eve"}') $$,
  'un autre message un autre jour est accepté');

select tests.login_as(current_setting('t.a')::uuid);
select throws_ok($$ insert into public.notification_log (user_id, kind, day, payload)
  values (current_setting('t.a')::uuid, 'onboarding', '2027-01-06', '{"key":"x"}') $$,
  '42501', null, 'un client n''écrit pas dans le journal');

select * from finish();
rollback;
