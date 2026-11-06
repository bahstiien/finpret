-- Back-office : demandes de contact et actions à mener, sans aucun accès client.
begin;
select plan(6);

select set_config('t.u', tests.create_user('inbox-user@test.local')::text, true);

reset role;
insert into public.contact_messages (audience, name, email, subject, message)
  values ('famille', 'Camille', 'camille@test.local', 'Mon abonnement', 'Bonjour, une question sur mon essai.');
insert into public.admin_tasks (title, category) values ('Publier le carrousel', 'social');

select is((select status from public.contact_messages limit 1), 'new', 'une demande arrive à l''état « nouvelle »');
select is((select status || '/' || priority from public.admin_tasks limit 1), 'todo/normal',
  'une action est créée « à faire », priorité normale');
select throws_ok($$ update public.admin_tasks set category = 'compta' $$, '23514', null,
  'seules les catégories dev, marketing et réseaux sociaux existent');
select throws_ok($$ update public.contact_messages set status = 'archived' $$, '23514', null,
  'seuls les états prévus existent');

select tests.login_as(current_setting('t.u')::uuid);
select throws_ok($$ select * from public.contact_messages $$, '42501', null,
  'un utilisateur ne lit pas les demandes de contact');
select throws_ok($$ select * from public.admin_tasks $$, '42501', null,
  'ni la todolist du back-office');

select * from finish();
rollback;
