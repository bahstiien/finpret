-- Courses réelles L1 : journal d'achats append-only, isolé par foyer, lecture seule en consultation (§7).
begin;
select plan(7);

insert into public.aisles (key, label, position) values ('pe_rayon', 'Rayon PE', 902);
insert into public.ingredients (key, label, unit, aisle) values ('pe_ing', 'Ingrédient PE', 'g', 'pe_rayon');
select set_config('t.admin', tests.create_user('admin-pe@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-pe@test.local')::text, true);
select set_config('t.other', tests.create_user('other-pe@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer PE')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
insert into public.weeks (household_id, start_date, status, plan) values (current_setting('t.h')::uuid, '2027-03-01', 'draft', '{}');
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer PE');

select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.purchase_events (household_id, week_id, ingredient_key, qty, type, op_key)
            values (%L, %L, %L, 400, 'purchase', 'op-key-0001') $$,
         current_setting('t.h'), current_setting('t.w'), 'pe_ing'),
  'un membre déclare un achat'
);
select throws_ok(
  format($$ insert into public.purchase_events (household_id, week_id, ingredient_key, qty, type, op_key)
            values (%L, %L, %L, 400, 'purchase', 'op-key-0001') $$,
         current_setting('t.h'), current_setting('t.w'), 'pe_ing'),
  '23505', null, 'la même clé d''opération ne compte qu''une fois'
);
select throws_ok(
  format($$ update public.purchase_events set qty = 1 where household_id = %L $$, current_setting('t.h')),
  '42501', null, 'le journal ne se modifie pas'
);
select throws_ok(
  format($$ delete from public.purchase_events where household_id = %L $$, current_setting('t.h')),
  '42501', null, 'ni ne se supprime'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.purchase_events), 1, 'la lecture seule consulte les achats');
select throws_ok(
  format($$ insert into public.purchase_events (household_id, week_id, ingredient_key, qty, type, op_key)
            values (%L, %L, %L, 50, 'purchase', 'op-key-0002') $$,
         current_setting('t.h'), current_setting('t.w'), 'pe_ing'),
  '42501', null, 'mais n''en déclare pas'
);

select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.purchase_events), 0, 'un autre foyer ne voit rien');

select * from finish();
rollback;
