-- Courses réelles L3/L4 : confirmation et annulation d'adaptation, atomiques, périmées refusées (AC-08, AC-13, AC-18).
begin;
select plan(12);

select set_config('t.admin', tests.create_user('admin-ad@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-ad@test.local')::text, true);
select set_config('t.other', tests.create_user('other-ad@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer AD')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
insert into public.weeks (household_id, start_date, status, plan) values
  (current_setting('t.h')::uuid, '2027-03-01', 'draft', '{"v": 1}');
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer AD');

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.v0', (select updated_at::text from public.weeks where id = current_setting('t.w')::uuid), true);
insert into public.adaptation_previews (household_id, week_id, fingerprint, payload)
values (current_setting('t.h')::uuid, current_setting('t.w')::uuid, 'fingerprint-0123456789', '{}');
select set_config('t.p', (select id::text from public.adaptation_previews limit 1), true);

-- Un autre foyer ne lit ni ne confirme.
select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.adaptation_previews), 0, 'un autre foyer ne voit aucun aperçu');
select throws_ok(
  format($$ select public.commit_adaptation(%L, 'op-adapt-0001', %L::timestamptz, 0, 'fingerprint-0123456789', '{"v": 2}', '[]') $$,
         current_setting('t.p'), current_setting('t.v0')),
  '42501', null, 'ni ne confirme l''aperçu d''un autre foyer'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select throws_ok(
  format($$ select public.commit_adaptation(%L, 'op-adapt-0002', %L::timestamptz, 0, 'fingerprint-0123456789', '{"v": 2}', '[]') $$,
         current_setting('t.p'), current_setting('t.v0')),
  '42501', null, 'la lecture seule ne confirme pas'
);

select tests.login_as(current_setting('t.admin')::uuid);
-- Empreinte différente : aperçu périmé, rien n'est écrit.
select throws_ok(
  format($$ select public.commit_adaptation(%L, 'op-adapt-0003', %L::timestamptz, 0, 'autre-empreinte-0123456', '{"v": 2}', '[]') $$,
         current_setting('t.p'), current_setting('t.v0')),
  'P0001', 'version_conflict', 'une empreinte périmée est refusée'
);
select is((select plan->>'v' from public.weeks where id = current_setting('t.w')::uuid), '1', 'et le plan est intact');
-- Un achat ajouté depuis l'aperçu le périme.
select throws_ok(
  format($$ select public.commit_adaptation(%L, 'op-adapt-0004', %L::timestamptz, 5, 'fingerprint-0123456789', '{"v": 2}', '[]') $$,
         current_setting('t.p'), current_setting('t.v0')),
  'P0001', 'version_conflict', 'une révision d''achats différente est refusée'
);
select is(
  (select (public.commit_adaptation(current_setting('t.p')::uuid, 'op-adapt-0005', current_setting('t.v0')::timestamptz, 0,
     'fingerprint-0123456789', '{"v": 2}', '[{"uid": "a", "kind": "main", "before": "r1", "after": "r2"}]'))->>'replayed'),
  'false', 'la confirmation écrit le plan et le journal'
);
select is((select plan->>'v' from public.weeks where id = current_setting('t.w')::uuid), '2', 'le plan est modifié');
select is(
  (select (public.commit_adaptation(current_setting('t.p')::uuid, 'op-adapt-0005', current_setting('t.v0')::timestamptz, 0,
     'fingerprint-0123456789', '{"v": 3}', '[]'))->>'replayed'),
  'true', 'la même clé ne rejoue pas l''adaptation'
);
select throws_ok(
  format($$ select public.commit_adaptation(%L, 'op-adapt-0006', %L::timestamptz, 0, 'fingerprint-0123456789', '{"v": 3}', '[]') $$,
         current_setting('t.p'), current_setting('t.v0')),
  'P0001', 'preview_used', 'un aperçu ne sert qu''une fois'
);

-- Annulation : nouvelle opération journalisée.
select set_config('t.e', (select id::text from public.adaptation_events where kind = 'apply'), true);
select set_config('t.v1', (select updated_at::text from public.weeks where id = current_setting('t.w')::uuid), true);
select is(
  (select (public.undo_adaptation(current_setting('t.e')::uuid, 'op-undo-0001', current_setting('t.v1')::timestamptz,
     '{"v": 1}', '[{"uid": "a", "kind": "main", "before": "r2", "after": "r1"}]'))->>'replayed'),
  'false', 'l''annulation restaure le plan'
);
select throws_ok(
  format($$ select public.undo_adaptation(%L, 'op-undo-0002', %L::timestamptz, '{"v": 1}', '[]') $$,
         current_setting('t.e'), current_setting('t.v1')),
  'P0001', 'already_undone', 'on n''annule pas deux fois'
);

select * from finish();
rollback;
