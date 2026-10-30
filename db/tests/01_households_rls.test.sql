-- M1 : isolation des foyers, rôles et invitations (SPEC §3, §4, critères du jalon M1).
begin;
select plan(29);

-- Comptes ---------------------------------------------------------------------
select set_config('t.alice', tests.create_user('alice@test.local')::text, true);  -- admin du foyer A
select set_config('t.bob',   tests.create_user('bob@test.local')::text, true);    -- membre de A
select set_config('t.carol', tests.create_user('carol@test.local')::text, true);  -- lecture seule dans A
select set_config('t.dave',  tests.create_user('dave@test.local')::text, true);   -- admin du foyer D
select set_config('t.eve',   tests.create_user('eve@test.local')::text, true);    -- sans foyer

select is(
  (select count(*)::int from public.profiles where user_id = current_setting('t.alice')::uuid),
  1, 'un profil est créé à l''inscription'
);

-- Création des foyers ------------------------------------------------------------
select tests.login_as(current_setting('t.alice')::uuid);
select set_config('t.hA', public.create_household('Foyer A')::text, true);
select is(public.household_role_of(current_setting('t.hA')::uuid), 'admin'::public.household_role,
  'le créateur du foyer en est administrateur');
select is((select active_household from public.profiles where user_id = auth.uid()),
  current_setting('t.hA')::uuid, 'le foyer créé devient le foyer actif');

select tests.login_as(current_setting('t.dave')::uuid);
select set_config('t.hD', public.create_household('Foyer D')::text, true);
insert into public.members (household_id, name, kind) values (current_setting('t.hD')::uuid, 'Léo', 'child');

-- Invitations ----------------------------------------------------------------------
select tests.login_as(current_setting('t.alice')::uuid);
insert into public.invitations (household_id, role) values (current_setting('t.hA')::uuid, 'member');
select set_config('t.tokMember', (select token from public.invitations where role = 'member'), true);
insert into public.invitations (household_id, role) values (current_setting('t.hA')::uuid, 'viewer');
select set_config('t.tokViewer', (select token from public.invitations where role = 'viewer'), true);
insert into public.members (household_id, name, kind) values (current_setting('t.hA')::uuid, 'Camille', 'adult');

select ok(length(current_setting('t.tokMember')) = 48, 'le jeton d''invitation est généré par la base (48 caractères)');
select ok(
  (select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
   from public.invitations where token = current_setting('t.tokMember')),
  'l''invitation expire au bout de 7 jours'
);

select tests.login_as_anon();
select results_eq(
  format('select household_name, role::text, status from public.get_invitation(%L)', current_setting('t.tokMember')),
  $$ values ('Foyer A'::text, 'member'::text, 'valid'::text) $$,
  'un visiteur non connecté voit l''aperçu d''une invitation valide'
);

select tests.login_as(current_setting('t.bob')::uuid);
select is(public.accept_invitation(current_setting('t.tokMember')), current_setting('t.hA')::uuid,
  'accepter une invitation renvoie le foyer');
select is(public.household_role_of(current_setting('t.hA')::uuid), 'member'::public.household_role,
  'une invitation crée l''adhésion avec le rôle prévu');

select tests.login_as(current_setting('t.carol')::uuid);
select public.accept_invitation(current_setting('t.tokViewer'));

select tests.login_as(current_setting('t.eve')::uuid);
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.tokMember')),
  'P0001', 'invitation_used', 'une invitation ne sert qu''une fois'
);

reset role;
insert into public.invitations (household_id, role, expires_at, created_by)
values (current_setting('t.hA')::uuid, 'member', now() - interval '1 minute', current_setting('t.alice')::uuid);
select set_config('t.tokExpired',
  (select token from public.invitations where expires_at < now() and accepted_at is null), true);
select tests.login_as(current_setting('t.eve')::uuid);
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.tokExpired')),
  'P0001', 'invitation_expired', 'une invitation expirée est refusée'
);
select throws_ok($$ select public.accept_invitation('inconnu') $$,
  'P0001', 'invitation_not_found', 'un jeton inconnu est refusé');

-- Isolation entre foyers -------------------------------------------------------------
select tests.login_as(current_setting('t.dave')::uuid);
select is((select count(*)::int from public.households where id = current_setting('t.hA')::uuid), 0,
  'un compte ne voit pas le foyer d''un autre');
select is((select count(*)::int from public.memberships where household_id = current_setting('t.hA')::uuid), 0,
  'ni ses adhésions');
select is((select count(*)::int from public.members where household_id = current_setting('t.hA')::uuid), 0,
  'ni ses membres');
select is((select count(*)::int from public.invitations where household_id = current_setting('t.hA')::uuid), 0,
  'ni ses invitations');
select is((select count(*)::int from public.profiles where user_id = current_setting('t.alice')::uuid), 0,
  'ni les profils de ses comptes');

update public.households set name = 'Piraté' where id = current_setting('t.hA')::uuid;
reset role;
select is((select name from public.households where id = current_setting('t.hA')::uuid), 'Foyer A',
  'un compte ne modifie pas le foyer d''un autre');

select tests.login_as(current_setting('t.dave')::uuid);
select throws_ok(
  format($$ insert into public.invitations (household_id) values (%L) $$, current_setting('t.hA')),
  '42501', null, 'un compte n''invite pas dans le foyer d''un autre'
);
select throws_ok(
  format($$ update public.profiles set active_household = %L where user_id = auth.uid() $$, current_setting('t.hA')),
  '42501', null, 'le foyer actif doit être un foyer dont on est membre'
);
select throws_ok(
  format($$ insert into public.memberships (household_id, user_id) values (%L, auth.uid()) $$, current_setting('t.hA')),
  '42501', null, 'on ne s''ajoute pas soi-même à un foyer'
);

select tests.login_as_anon();
select throws_ok($$ select count(*) from public.households $$, '42501', null,
  'un visiteur non connecté n''accède pas aux foyers');

-- Rôles dans le foyer -----------------------------------------------------------------
select tests.login_as(current_setting('t.bob')::uuid);
select is((select count(*)::int from public.members where household_id = current_setting('t.hA')::uuid), 1,
  'un membre voit les membres de son foyer');
select is((select count(*)::int from public.invitations), 0, 'un membre ne voit pas les jetons d''invitation');
select throws_ok(
  format($$ insert into public.invitations (household_id) values (%L) $$, current_setting('t.hA')),
  '42501', null, 'un membre ne crée pas d''invitation'
);
update public.memberships set role = 'admin' where user_id = auth.uid();
select is(public.household_role_of(current_setting('t.hA')::uuid), 'member'::public.household_role,
  'un membre ne change pas son propre rôle');

select tests.login_as(current_setting('t.carol')::uuid);
select throws_ok(
  format($$ insert into public.members (household_id, name, kind) values (%L, 'Intrus', 'adult') $$, current_setting('t.hA')),
  '42501', null, 'la lecture seule ne modifie pas les membres'
);

-- Au moins un administrateur -------------------------------------------------------------
select tests.login_as(current_setting('t.alice')::uuid);
select throws_ok(
  $$ update public.memberships set role = 'member' where user_id = auth.uid() $$,
  'P0001', 'last_admin', 'le dernier administrateur ne peut pas se rétrograder'
);
select throws_ok(
  format('select public.leave_household(%L)', current_setting('t.hA')),
  'P0001', 'last_admin', 'le dernier administrateur ne peut pas quitter le foyer'
);

-- Révocation d'une invitation en attente
insert into public.invitations (household_id) values (current_setting('t.hA')::uuid);
delete from public.invitations where accepted_at is null and expires_at > now();
select is(
  (select count(*)::int from public.invitations where accepted_at is null and expires_at > now()), 0,
  'l''administrateur révoque une invitation en attente'
);

select * from finish();
rollback;
