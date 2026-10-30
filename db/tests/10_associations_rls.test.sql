-- J6/J7 : associations, écoles, menus d'école, abonnements, reversements (SPEC_JANVIER §5 à §7).
begin;
select plan(32);

select set_config('t.mgr', tests.create_user('mgr-asso@test.local')::text, true);
select set_config('t.ed', tests.create_user('editor-asso@test.local')::text, true);
select set_config('t.ed2', tests.create_user('editor2-asso@test.local')::text, true);
select set_config('t.fam', tests.create_user('fam-asso@test.local')::text, true);
select set_config('t.oth', tests.create_user('other-asso@test.local')::text, true);
select set_config('t.adm', tests.create_user('admin-asso@test.local')::text, true);
select set_config('t.mgr2', tests.create_user('mgr2-asso@test.local')::text, true);

reset role;
insert into public.admins (user_id) values (current_setting('t.adm')::uuid);

-- Création d'une association (responsable = créateur, statut pending, école créée).
select tests.login_as(current_setting('t.mgr')::uuid);
select set_config('t.a', public.create_association(
  'APE Jules Ferry', '123456789', 'bureau@ape.test', 'Camille Martin', 'APE-JULESFERRY',
  '[{"name":"École Jules Ferry","city":"Lyon","uai":"0690001A"}]'::jsonb)::text, true);
select is((select status::text from public.associations where id = current_setting('t.a')::uuid), 'pending',
  'une association nouvelle est en attente');
select is(public.association_role_of(current_setting('t.a')::uuid)::text, 'manager', 'le créateur est responsable');
select set_config('t.s', (select id::text from public.schools where uai = '0690001A'), true);
select throws_ok(
  $$ select public.create_association('X', '123456789', 'a@b.fr', 'Y', 'ab', '[{"name":"E","city":"V"}]'::jsonb) $$,
  '23514', null, 'le code doit respecter le format');

-- Statut et IBAN verrouillés pour le responsable ; code modifiable une seule fois.
select throws_ok(
  format($$ update public.associations set status = 'approved' where id = %L $$, current_setting('t.a')),
  '42501', null, 'le responsable ne valide pas son association');
select lives_ok(
  format($$ update public.associations set code = 'APE-FERRY' where id = %L $$, current_setting('t.a')),
  'le code est modifiable une fois');
select throws_ok(
  format($$ update public.associations set code = 'APE-FERRY2' where id = %L $$, current_setting('t.a')),
  'P0001', null, 'mais pas deux');

-- Validation par un administrateur (clé de service ou compte admin).
select tests.login_as(current_setting('t.adm')::uuid);
select is((select count(*)::int from public.associations), 1, 'un administrateur voit les associations');
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.associations set status = 'approved', approved_at = now() where id = current_setting('t.a')::uuid;

-- Invitation d'un éditeur, limite de trois.
select tests.login_as(current_setting('t.mgr')::uuid);
insert into public.association_invitations (association_id, email)
  values (current_setting('t.a')::uuid, 'editor@ape.test');
select set_config('t.tok', (select token from public.association_invitations limit 1), true);
select tests.login_as(current_setting('t.ed')::uuid);
select is(public.accept_association_invitation(current_setting('t.tok')), current_setting('t.a')::uuid,
  'un éditeur accepte l''invitation');
select is(public.association_role_of(current_setting('t.a')::uuid)::text, 'menu_editor', 'il devient éditeur');
select throws_ok(
  format($$ select public.accept_association_invitation(%L) $$, current_setting('t.tok')),
  'P0001', null, 'une invitation sert une seule fois');
select tests.login_as(current_setting('t.oth')::uuid);
select throws_ok(
  format($$ insert into public.association_invitations (association_id, email) values (%L, 'x@y.fr') $$, current_setting('t.a')),
  '42501', null, 'un compte étranger n''invite pas');

-- Menus : brouillon par l'éditeur, invisible des familles ; publication visible.
select tests.login_as(current_setting('t.ed')::uuid);
select lives_ok(
  format($$ insert into public.school_menus (school_id, association_id, date, main, status)
            values (%L, %L, '2027-01-04', 'Poulet rôti', 'draft') $$, current_setting('t.s'), current_setting('t.a')),
  'un éditeur saisit un menu');
select throws_ok(
  format($$ insert into public.school_menus (school_id, association_id, date, status)
            values (%L, %L, '2027-01-05', 'draft') $$, current_setting('t.s'), current_setting('t.a')),
  '23514', null, 'un menu vide est refusé');

-- Foyer de la famille, rattaché par la clé de service, enfant relié à l'école.
select tests.login_as(current_setting('t.fam')::uuid);
select set_config('t.h', public.create_household('Famille')::text, true);
insert into public.members (household_id, name, kind) values (current_setting('t.h')::uuid, 'Léa', 'child');
select set_config('t.kid', (select id::text from public.members where name = 'Léa' and household_id = current_setting('t.h')::uuid), true);
select throws_ok(
  format($$ insert into public.member_schools (member_id, school_id) values (%L, %L) $$, current_setting('t.kid'), current_setting('t.s')),
  '42501', null, 'sans rattachement à l''association, l''école n''est pas proposée');
select throws_ok(
  format($$ update public.households set association_id = %L where id = %L $$, current_setting('t.a'), current_setting('t.h')),
  '42501', null, 'un compte ne se rattache pas lui-même');
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.households set association_id = current_setting('t.a')::uuid, association_joined_at = now()
  where id = current_setting('t.h')::uuid;
select tests.login_as(current_setting('t.fam')::uuid);
select lives_ok(
  format($$ insert into public.member_schools (member_id, school_id) values (%L, %L) $$, current_setting('t.kid'), current_setting('t.s')),
  'avec le rattachement, l''enfant est relié à l''école');
select is((select count(*)::int from public.school_menus), 0, 'la famille ne voit pas les brouillons');

select tests.login_as(current_setting('t.ed')::uuid);
update public.school_menus set status = 'published';
select tests.login_as(current_setting('t.fam')::uuid);
select is((select count(*)::int from public.school_menus), 1, 'la famille voit le menu publié');
select tests.login_as(current_setting('t.oth')::uuid);
select is((select count(*)::int from public.school_menus), 0, 'un autre compte ne voit aucun menu');

-- Correction après publication : badge « modifié ».
select tests.login_as(current_setting('t.ed')::uuid);
update public.school_menus set main = 'Poulet rôti et frites';
select is((select edited_after_publish from public.school_menus), true, 'la correction après publication est signalée');
select tests.login_as(current_setting('t.fam')::uuid);
update public.school_menus set main = 'Piraté';
reset role;
select is((select main from public.school_menus), 'Poulet rôti et frites', 'une famille ne modifie pas un menu');

-- Agrégats : en dessous de 5, null ; jamais de donnée de famille.
select tests.login_as(current_setting('t.mgr')::uuid);
select is((public.association_stats(current_setting('t.a')::uuid) ->> 'households'), null, 'moins de 5 foyers : masqué');
select is((public.association_stats(current_setting('t.a')::uuid) -> 'paid_total_cents')::int, 0, 'le total versé est lisible');
select tests.login_as(current_setting('t.oth')::uuid);
select throws_ok(
  format($$ select public.association_stats(%L) $$, current_setting('t.a')),
  '42501', null, 'les agrégats sont réservés aux membres');
select tests.login_as(current_setting('t.mgr')::uuid);
select is((select count(*)::int from public.households), 0, 'le responsable ne voit aucun foyer');

-- Abonnement : essai créé avec le foyer, écriture interdite.
select tests.login_as(current_setting('t.fam')::uuid);
select is((select plan from public.subscriptions where household_id = current_setting('t.h')::uuid), 'trial', 'un essai est créé avec le foyer');
select throws_ok(
  format($$ update public.subscriptions set plan = 'yearly' where household_id = %L $$, current_setting('t.h')),
  '42501', null, 'un compte ne modifie pas son abonnement');
select tests.login_as(current_setting('t.oth')::uuid);
select is((select count(*)::int from public.subscriptions), 0, 'un abonnement n''est lisible que par son foyer');

-- Reversements : lignes sans accès client, relevés lisibles du seul responsable, une ligne par facture.
reset role;
select set_config('request.jwt.claims', '{}', true);
insert into public.payout_lines (association_id, household_id, stripe_invoice_id, kind, amount_cents)
  values (current_setting('t.a')::uuid, current_setting('t.h')::uuid, 'in_1', 'yearly', 800);
select throws_ok(
  format($$ insert into public.payout_lines (association_id, stripe_invoice_id, kind, amount_cents) values (%L, 'in_1', 'yearly', 800) $$, current_setting('t.a')),
  '23505', null, 'une facture ne compte qu''une fois');
insert into public.payouts (association_id, quarter, amount_cents, status) values (current_setting('t.a')::uuid, '2027-T1', 2000, 'ready');
select tests.login_as(current_setting('t.mgr')::uuid);
select is((select count(*)::int from public.payouts), 1, 'le responsable lit ses relevés');
select throws_ok($$ select count(*) from public.payout_lines $$, '42501', null, 'mais pas les lignes de reversement');
select tests.login_as(current_setting('t.oth')::uuid);
select is((select count(*)::int from public.payouts), 0, 'un autre compte ne lit pas les relevés');

select * from finish();
rollback;
