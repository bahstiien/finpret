-- M8 : état partagé de la session (§8.5).
begin;
select plan(11);

select set_config('t.admin', tests.create_user('admin-m8@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-m8@test.local')::text, true);
select set_config('t.other', tests.create_user('other-m8@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer M8')::text, true);
insert into public.weeks (household_id, start_date, status, plan) values (current_setting('t.h')::uuid, '2027-03-01', 'draft', '{}');
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid), true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tok', (select token from public.invitations where household_id = current_setting('t.h')::uuid), true);
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tok'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer M8');

select tests.login_as(current_setting('t.admin')::uuid);
select is((public.session_ensure(current_setting('t.w')::uuid, 'sig-1')).current_step, 0, 'la session se crée à l''étape 0');
select public.session_start(current_setting('t.w')::uuid);
select public.session_set_step(current_setting('t.w')::uuid, 3);
select public.session_set_task(current_setting('t.w')::uuid, '3-0', true);
select public.session_set_task(current_setting('t.w')::uuid, '3-1', true);
select public.session_set_task(current_setting('t.w')::uuid, '3-0', false);
select is((select tasks_done -> 'done' from public.sessions), '{"3-1": true}'::jsonb, 'les tâches se cochent une à une');
select ok((select started_at is not null from public.sessions), 'la session est commencée');
select public.session_start_timer(current_setting('t.w')::uuid, 'm1', 'Curry', 25, 3);
select public.session_start_timer(current_setting('t.w')::uuid, 'm2', 'Curry', 20, 3);
select is((select jsonb_array_length(timers) from public.sessions), 1, 'un seul minuteur actif par étape');
select public.session_timer(current_setting('t.w')::uuid, 'm2', 'snooze');
select ok(
  (select ((timers -> 0 ->> 'endsAt')::timestamptz - now()) > interval '24 minutes' from public.sessions),
  '+5 min repousse la fin du minuteur'
);
select public.session_timer(current_setting('t.w')::uuid, 'm2', 'done');
select ok((select timers -> 0 ? 'doneAt' from public.sessions), 'OK termine le minuteur');

select is((public.session_ensure(current_setting('t.w')::uuid, 'sig-2')).tasks_done -> 'done', '{}'::jsonb,
  'des étapes modifiées remettent les coches à zéro');

-- Lecture seule : elle suit la session sans la modifier.
select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.sessions), 1, 'la lecture seule voit la session');
select public.session_set_step(current_setting('t.w')::uuid, 7);
reset role;
select is((select current_step from public.sessions where week_id = current_setting('t.w')::uuid), 0,
  'la lecture seule ne change pas d''étape');

select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.sessions), 0, 'un autre foyer ne voit pas la session');
select ok((public.session_ensure(current_setting('t.w')::uuid, 'x')).week_id is null,
  'ni ne la crée ou ne la modifie (semaine invisible)');

select * from finish();
rollback;
