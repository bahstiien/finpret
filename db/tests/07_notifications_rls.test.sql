-- M9 : abonnements push par compte, journal idempotent (SPEC §12).
begin;
select plan(8);

select set_config('t.a', tests.create_user('a-m9@test.local')::text, true);
select set_config('t.b', tests.create_user('b-m9@test.local')::text, true);

select tests.login_as(current_setting('t.a')::uuid);
select lives_ok(
  $$ insert into public.push_subscriptions (endpoint, keys) values ('https://push.example/a', '{"p256dh": "x", "auth": "y"}') $$,
  'un compte enregistre son appareil'
);
select throws_ok(
  format($$ insert into public.push_subscriptions (user_id, endpoint, keys) values (%L, 'https://push.example/b', '{}') $$,
         current_setting('t.b')),
  '42501', null, 'mais pas celui d''un autre compte'
);
select throws_ok(
  $$ select public.claim_notification(auth.uid(), 'dinner', current_date) $$,
  '42501', null, 'un compte ne réserve pas d''envoi lui-même'
);
select throws_ok(
  format($$ insert into public.notification_log (user_id, kind, day) values (%L, 'dinner', current_date) $$, current_setting('t.a')),
  '42501', null, 'ni n''écrit dans le journal'
);

select tests.login_as(current_setting('t.b')::uuid);
select is((select count(*)::int from public.push_subscriptions), 0, 'un autre compte ne voit pas les appareils');

-- Le cron (clé de service) : deux passages, un seul envoi.
reset role;
select is(public.claim_notification(current_setting('t.a')::uuid, 'dinner', '2026-10-20'), true, 'premier passage : envoi réservé');
select is(public.claim_notification(current_setting('t.a')::uuid, 'dinner', '2026-10-20'), false, 'second passage : déjà envoyé');
select is(public.claim_notification(current_setting('t.a')::uuid, 'test', '2026-10-20')
          and public.claim_notification(current_setting('t.a')::uuid, 'test', '2026-10-20'), true,
          'la notification de test peut se répéter');

select * from finish();
rollback;
