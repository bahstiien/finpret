-- J1 : la table events n'est accessible à aucun compte (SPEC_JANVIER §7, RLS).
begin;
select plan(4);

select set_config('t.a', tests.create_user('a-events@test.local')::text, true);

reset role;
insert into public.events (user_id, name) values (current_setting('t.a')::uuid, 'signup');

select tests.login_as(current_setting('t.a')::uuid);
select throws_ok($$ select count(*) from public.events $$, '42501', null, 'un compte ne lit pas les événements');
select throws_ok(
  format($$ insert into public.events (user_id, name) values (%L, 'signup') $$, current_setting('t.a')),
  '42501', null, 'ni n''en écrit'
);

reset role;
select throws_ok($$ insert into public.events (name) values ('Nom Invalide') $$, '23514', null, 'le nom est contraint');
select is((select count(*)::int from public.events where name = 'signup'), 1, 'la clé de service écrit et lit');

select * from finish();
rollback;
