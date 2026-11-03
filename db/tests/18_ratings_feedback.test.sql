-- Retour rapide sur les repas : drapeaux sur `ratings`, contraintes et RLS (écriture réservée aux éditeurs du foyer).
begin;
select plan(9);

insert into public.recipes (id, kind, data, protein, diet_tags, allergens)
values ('test_fb', 'main', '{"n": "Plat de retour"}', 'veg', '{vegetarien}', '{}');

select set_config('t.admin', tests.create_user('admin-fb@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-fb@test.local')::text, true);
select set_config('t.other', tests.create_user('other-fb@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer FB')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer FB');

select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.ratings (household_id, recipe_id, kids_liked) values (%L, 'test_fb', true) $$, current_setting('t.h')),
  'un retour « aimé des enfants » sans avis de goût est accepté'
);
select lives_ok(
  $$ update public.ratings set too_long = true where recipe_id = 'test_fb' $$,
  'le temps s''ajoute sans toucher au goût'
);
select is(
  (select row(value, kids_liked, too_long)::text from public.ratings where recipe_id = 'test_fb'),
  '(,t,t)', 'goût vide, enfants et temps renseignés'
);
select lives_ok($$ update public.ratings set value = 1 where recipe_id = 'test_fb' $$, '« à refaire » se cumule');
select throws_ok(
  $$ update public.ratings set value = -1 where recipe_id = 'test_fb' $$,
  '23514', null, 'un refus et « aimé des enfants » se contredisent'
);
select throws_ok(
  $$ update public.ratings set value = null, kids_liked = false, too_long = false where recipe_id = 'test_fb' $$,
  '23514', null, 'une ligne vide est refusée (on la supprime)'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.ratings), 1, 'la lecture seule voit les retours du foyer');
select throws_ok(
  $$ insert into public.ratings (household_id, recipe_id, too_long)
     select household_id, 'test_fb', true from public.ratings $$,
  '42501', null, 'mais ne les modifie pas'
);

select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.ratings), 0, 'un autre foyer ne voit rien');

select * from finish();
rollback;
