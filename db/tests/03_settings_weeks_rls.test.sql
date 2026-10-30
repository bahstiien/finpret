-- M4 : réglages (administrateur), présence, semaines, avis, garde-manger et congélateur (admin et membre).
begin;
select plan(16);

-- Catalogue minimal propre au test (en superutilisateur).
insert into public.aisles (key, label, position) values ('m4_rayon', 'Rayon M4', 901);
insert into public.ingredients (key, label, unit, aisle) values ('m4_ing', 'Ingrédient M4', 'g', 'm4_rayon');
insert into public.recipes (id, kind, data) values ('m4_recette', 'main', '{"n": "Plat M4"}');

select set_config('t.admin', tests.create_user('admin-m4@test.local')::text, true);
select set_config('t.member', tests.create_user('member-m4@test.local')::text, true);
select set_config('t.viewer', tests.create_user('viewer-m4@test.local')::text, true);
select set_config('t.other', tests.create_user('other-m4@test.local')::text, true);

select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer M4')::text, true);
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'member');
insert into public.invitations (household_id, role) values (current_setting('t.h')::uuid, 'viewer');
select set_config('t.tm', (select token from public.invitations where role = 'member'), true);
select set_config('t.tv', (select token from public.invitations where role = 'viewer'), true);
select tests.login_as(current_setting('t.member')::uuid);
select public.accept_invitation(current_setting('t.tm'));
select tests.login_as(current_setting('t.viewer')::uuid);
select public.accept_invitation(current_setting('t.tv'));
select tests.login_as(current_setting('t.other')::uuid);
select public.create_household('Autre foyer');

-- Réglages ---------------------------------------------------------------------------
select tests.login_as(current_setting('t.admin')::uuid);
select lives_ok(
  format($$ insert into public.household_settings (household_id, diet, menu, session, shopping, equipment)
            values (%L, '{}', '{}', '{}', '{}', '{}') $$, current_setting('t.h')),
  'l''administrateur enregistre les réglages'
);
insert into public.members (household_id, name, kind) values (current_setting('t.h')::uuid, 'Léo', 'child');
select set_config('t.leo', (select id::text from public.members where name = 'Léo'), true);
select lives_ok(
  format($$ insert into public.presence_rules (member_id, weekday, meal, present) values (%L, 1, 'lunch', false) $$,
         current_setting('t.leo')),
  'l''administrateur règle la présence'
);
update public.households set timezone = 'Europe/Brussels', alternating_from = '2027-01-04' where id = current_setting('t.h')::uuid;
select is((select timezone from public.households where id = current_setting('t.h')::uuid), 'Europe/Brussels',
  'l''administrateur règle le fuseau horaire');

select tests.login_as(current_setting('t.member')::uuid);
update public.household_settings set menu = '{"pirate": true}' where household_id = current_setting('t.h')::uuid;
reset role;
select is((select menu from public.household_settings where household_id = current_setting('t.h')::uuid), '{}'::jsonb,
  'un membre ne modifie pas le paramétrage');
select tests.login_as(current_setting('t.member')::uuid);
select throws_ok(
  format($$ insert into public.presence_rules (member_id, weekday, meal, present) values (%L, 2, 'lunch', false) $$,
         current_setting('t.leo')),
  '42501', null, 'un membre ne modifie pas la présence'
);
select is((select count(*)::int from public.presence_rules), 1, 'mais il la lit');

-- Semaines, avis, garde-manger, congélateur ----------------------------------------------
select lives_ok(
  format($$ insert into public.weeks (household_id, start_date, status, plan) values (%L, '2027-03-01', 'draft', '{}') $$,
         current_setting('t.h')),
  'un membre génère une semaine'
);
select throws_ok(
  format($$ insert into public.weeks (household_id, start_date, status, plan) values (%L, '2027-03-02', 'draft', '{}') $$,
         current_setting('t.h')),
  '23514', null, 'une semaine commence un lundi'
);
select lives_ok(
  format($$ insert into public.pantry (household_id, ingredient_key, qty) values (%L, 'm4_ing', null) $$,
         current_setting('t.h')),
  'un membre gère le garde-manger'
);

select tests.login_as(current_setting('t.viewer')::uuid);
select is((select count(*)::int from public.weeks), 1, 'la lecture seule voit la semaine');
select throws_ok(
  format($$ insert into public.weeks (household_id, start_date, status, plan) values (%L, '2027-03-08', 'draft', '{}') $$,
         current_setting('t.h')),
  '42501', null, 'la lecture seule ne génère pas de semaine'
);
select throws_ok(
  format($$ insert into public.freezer (household_id, recipe_id, portions) values (%L, 'm4_recette', 2) $$,
         current_setting('t.h')),
  '42501', null, 'la lecture seule ne gère pas le congélateur'
);
select is((select count(*)::int from public.household_settings), 1, 'la lecture seule lit les réglages');

-- Isolation --------------------------------------------------------------------------------
select tests.login_as(current_setting('t.other')::uuid);
select is((select count(*)::int from public.weeks where household_id = current_setting('t.h')::uuid), 0,
  'un autre foyer ne voit pas les semaines');
select is((select count(*)::int from public.presence_rules), 0, 'ni la présence');
select is((select count(*)::int from public.household_settings where household_id = current_setting('t.h')::uuid), 0,
  'ni les réglages');

select * from finish();
rollback;
