-- Suggestions de recettes : écrites par le serveur (service_role), jamais lues ni écrites par un client.
begin;
select plan(5);

select set_config('t.u', tests.create_user('suggest-user@test.local')::text, true);

reset role;
insert into public.recipes (id, kind, data) values ('t_suggest', 'simple', '{"n": "Essai"}');
insert into public.recipe_suggestions (kind, recipe_id, title, message)
  values ('edit', 't_suggest', 'Essai', 'Moins de sel.');

select is((select status from public.recipe_suggestions limit 1), 'new', 'une suggestion arrive « à traiter »');
select throws_ok($$ insert into public.recipe_suggestions (kind, title, message) values ('edit', 'x', 'y') $$,
  '23514', null, 'une modification vise une recette');
select throws_ok($$ insert into public.recipe_suggestions (kind, title, message) values ('new', 'x', 'y') $$,
  '23514', null, 'une nouvelle recette a un type');

select tests.login_as(current_setting('t.u')::uuid);
select throws_ok($$ select * from public.recipe_suggestions $$, '42501', null,
  'un utilisateur ne lit pas les suggestions');
select throws_ok($$ insert into public.recipe_suggestions (kind, recipe_id, title, message)
  values ('edit', 't_suggest', 'x', 'y') $$, '42501', null, 'ni n''en écrit directement');

select * from finish();
rollback;
