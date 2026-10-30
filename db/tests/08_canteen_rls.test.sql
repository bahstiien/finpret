-- M10 : menus de la cantine, par enfant du foyer (SPEC §13).
begin;
select plan(7);

select set_config('t.admin', tests.create_user('admin-m10@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-m10@test.local')::text, true);
select set_config('t.other', tests.create_user('other-m10@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer M10')::text, true);
insert into public.members (household_id, name, kind) values (current_setting('t.h')::uuid, 'Léo', 'child');
select set_config('t.leo', (select id::text from public.members where name = 'Léo' and household_id = current_setting('t.h')::uuid), true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer M10');

select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.canteen_menus (member_id, date, text, source) values (%L, '2026-10-19', 'Coquillettes bolognaise', 'pdf') $$,
         current_setting('t.leo')),
  'un membre importe un menu'
);
select is((select validated from public.canteen_menus), false, 'un menu importé attend sa validation');
select throws_ok(
  format($$ insert into public.canteen_menus (member_id, date, text) values (%L, '2026-10-19', 'Doublon') $$, current_setting('t.leo')),
  '23505', null, 'un seul menu par enfant et par jour'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.canteen_menus), 1, 'la lecture seule voit les menus');
update public.canteen_menus set validated = true;
reset role;
select is((select validated from public.canteen_menus), false, 'mais ne les valide pas');

select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.canteen_menus), 0, 'un autre foyer ne voit pas les menus');
select throws_ok(
  format($$ insert into public.canteen_menus (member_id, date, text) values (%L, '2026-10-20', 'Intrus') $$, current_setting('t.leo')),
  '42501', null, 'ni n''en ajoute'
);

select * from finish();
rollback;
