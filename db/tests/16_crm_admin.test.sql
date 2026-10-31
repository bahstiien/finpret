-- CRM du back-office : notes de suivi sans accès client, rôles d'administrateur.
begin;
select plan(5);

select set_config('t.u', tests.create_user('crm-user@test.local')::text, true);
select set_config('t.adm', tests.create_user('crm-admin@test.local')::text, true);

reset role;
insert into public.admins (user_id) values (current_setting('t.adm')::uuid);
insert into public.admin_notes (user_id, admin_id, body)
  values (current_setting('t.u')::uuid, current_setting('t.adm')::uuid, 'Relance à prévoir');

select is((select role from public.admins where user_id = current_setting('t.adm')::uuid), 'owner',
  'un administrateur nommé sans rôle est complet (owner)');
select throws_ok(
  $$ update public.admins set role = 'root' where user_id = current_setting('t.adm')::uuid $$,
  '23514', null, 'seuls les rôles owner et support existent');

select tests.login_as(current_setting('t.u')::uuid);
select throws_ok($$ select * from public.admin_notes $$, '42501', null,
  'un utilisateur ne lit pas les notes de suivi');
select tests.login_as(current_setting('t.adm')::uuid);
select throws_ok($$ select * from public.admin_notes $$, '42501', null,
  'même un administrateur passe par le serveur (aucun accès client aux notes)');

reset role;
select is((select count(*)::int from public.admin_notes where user_id = current_setting('t.u')::uuid), 1,
  'la note est enregistrée');

select * from finish();
rollback;
