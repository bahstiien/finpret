-- M6 : courses partagées par tout le foyer, lecture seule comprise (§3, §8.3).
begin;
select plan(9);

select set_config('t.admin', tests.create_user('admin-m6@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-m6@test.local')::text, true);
select set_config('t.other', tests.create_user('other-m6@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer M6')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
insert into public.shopping_items (household_id, source, label, aisle) values (current_setting('t.h')::uuid, 'manual', 'Lessive', 'maison');
select set_config('t.item', (select id::text from public.shopping_items where label = 'Lessive'), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer M6');

-- La lecture seule coche et ajoute.
select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.shopping_items), 1, 'la lecture seule voit la liste');
update public.shopping_items set checked = true where id = current_setting('t.item')::uuid;
select is((select checked from public.shopping_items where id = current_setting('t.item')::uuid), true,
  'la lecture seule coche un article');
select is((select checked_by from public.shopping_items where id = current_setting('t.item')::uuid),
  current_setting('t.viewer')::uuid, 'la base enregistre qui a coché');
select is((select added_by from public.shopping_items where id = current_setting('t.item')::uuid),
  current_setting('t.admin')::uuid, 'et qui a ajouté');
select lives_ok(
  format($$ insert into public.shopping_items (household_id, source, label, aisle) values (%L, 'manual', 'Pain', 'boulangerie') $$,
         current_setting('t.h')),
  'la lecture seule ajoute un article'
);
select throws_ok(
  format($$ update public.shopping_items set household_id = %L where id = %L $$,
         (select id from public.households where name = 'Autre foyer M6'), current_setting('t.item')),
  '42501', null, 'on ne déplace pas un article vers un autre foyer'
);

-- Isolation.
select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.shopping_items), 0, 'un autre foyer ne voit pas la liste');
select throws_ok(
  format($$ insert into public.shopping_items (household_id, source, label, aisle) values (%L, 'manual', 'Intrus', 'divers') $$,
         current_setting('t.h')),
  '42501', null, 'ni n''y ajoute d''article'
);
delete from public.shopping_items where id = current_setting('t.item')::uuid;
reset role;
select is((select count(*)::int from public.shopping_items where id = current_setting('t.item')::uuid), 1,
  'ni n''en supprime');

select * from finish();
rollback;
