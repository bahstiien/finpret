-- Courses réelles L1/L4 : journal d'achats append-only, écrit par fonctions atomiques, isolé par foyer.
begin;
select plan(15);

insert into public.aisles (key, label, position) values ('pe_rayon', 'Rayon PE', 902);
insert into public.ingredients (key, label, unit, aisle) values ('pe_ing', 'Ingrédient PE', 'g', 'pe_rayon');
select set_config('t.admin', tests.create_user('admin-pe@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-pe@test.local')::text, true);
select set_config('t.other', tests.create_user('other-pe@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer PE')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
insert into public.weeks (household_id, start_date, status, plan) values
  (current_setting('t.h')::uuid, '2027-03-01', 'draft', '{}'),
  (current_setting('t.h')::uuid, '2027-03-08', 'draft', '{}');
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid and start_date = '2027-03-01'), true);
select set_config('t.w2', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid and start_date = '2027-03-08'), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer PE');

select tests.login_as(current_setting('t.admin')::uuid);
select is(
  (select (public.record_purchase(current_setting('t.w')::uuid, 'pe_ing', 400, 'purchase', 'op-key-0001', 0))->>'revision'),
  '1', 'un membre déclare un achat'
);
select is(
  (select (public.record_purchase(current_setting('t.w')::uuid, 'pe_ing', 400, 'purchase', 'op-key-0001', 0))->>'replayed'),
  'true', 'la même clé et le même contenu ne comptent qu''une fois'
);
select is((select count(*)::int from public.purchase_events), 1, 'et le journal n''a qu''une ligne');
select throws_ok(
  format($$ select public.record_purchase(%L, 'pe_ing', 999, 'purchase', 'op-key-0001') $$, current_setting('t.w')),
  'P0001', 'idempotency_conflict', 'la même clé avec un autre contenu est refusée'
);
select throws_ok(
  format($$ select public.record_purchase(%L, 'pe_ing', 50, 'purchase', 'op-key-0002', 0) $$, current_setting('t.w')),
  'P0001', 'version_conflict', 'une révision périmée est refusée'
);
select is(
  (select (public.record_purchase(current_setting('t.w')::uuid, 'pe_ing', 700, 'correction', 'op-key-0003', 1))->>'revision'),
  '2', 'la correction remplace le total'
);
select is((select qty from public.purchase_events where type = 'correction'), 700::numeric, 'le total corrigé vaut 700');

-- Transfert atomique et correction sous le transféré.
select is(
  (select (public.transfer_purchase(current_setting('t.w')::uuid, current_setting('t.w2')::uuid, 'pe_ing', 200, 'op-key-0004'))->>'replayed'),
  'false', 'un transfert réduit la source et crédite la destination'
);
select throws_ok(
  format($$ select public.record_purchase(%L, 'pe_ing', 100, 'correction', 'op-key-0005') $$, current_setting('t.w')),
  'P0001', 'insufficient_available_quantity', 'une correction sous le transféré exige un rapprochement'
);
select throws_ok(
  format($$ select public.transfer_purchase(%L, %L, 'pe_ing', 9999, 'op-key-0006') $$, current_setting('t.w'), current_setting('t.w2')),
  'P0001', 'insufficient_available_quantity', 'on ne transfère pas plus que le disponible'
);
select is((select count(*)::int from public.purchase_events where type = 'transfer_in'), 1, 'et rien d''autre n''a été écrit');

select throws_ok(
  format($$ insert into public.purchase_events (household_id, week_id, ingredient_key, qty, type, op_key)
            values (%L, %L, 'pe_ing', 1, 'purchase', 'op-key-direct') $$, current_setting('t.h'), current_setting('t.w')),
  '42501', null, 'plus d''insertion directe'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select throws_ok(
  format($$ select public.record_purchase(%L, 'pe_ing', 50, 'purchase', 'op-key-0007') $$, current_setting('t.w')),
  '42501', null, 'la lecture seule ne déclare pas d''achat'
);
select is((select count(*)::int from public.purchase_events), 4, 'mais elle consulte les achats');

select tests.login_as(current_setting('t.other')::uuid);
select throws_ok(
  format($$ select public.record_purchase(%L, 'pe_ing', 50, 'purchase', 'op-key-0008') $$, current_setting('t.w')),
  '42501', null, 'un autre foyer ne déclare rien dans cette semaine'
);

select * from finish();
rollback;
