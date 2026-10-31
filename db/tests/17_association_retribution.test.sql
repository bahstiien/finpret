-- Rétribution par association : colonnes réservées aux administrateurs.
begin;
select plan(5);

select set_config('t.mgr', tests.create_user('mgr-retro@test.local')::text, true);
select set_config('t.adm', tests.create_user('admin-retro@test.local')::text, true);

reset role;
insert into public.admins (user_id) values (current_setting('t.adm')::uuid);

select tests.login_as(current_setting('t.mgr')::uuid);
select set_config('t.a', public.create_association(
  'APE Retro', '123456789', 'bureau@retro.test', 'Camille Martin', 'APE-RETRO',
  '[{"name":"École Retro","city":"Lyon"}]'::jsonb)::text, true);

select is((select retribution_yearly_cents from public.associations where id = current_setting('t.a')::uuid), null,
  'sans réglage, la rétribution suit le barème standard (null)');
select throws_ok(
  $$ update public.associations set retribution_yearly_cents = 5000 where id = current_setting('t.a')::uuid $$,
  '42501', null, 'le responsable ne fixe pas sa propre rétribution annuelle');
select throws_ok(
  $$ update public.associations set retribution_monthly_cents = 500 where id = current_setting('t.a')::uuid $$,
  '42501', null, 'ni la rétribution mensuelle');

-- Le back-office écrit avec la clé de service (aucun auth.uid()).
reset role;
select set_config('request.jwt.claims', '{}', true);
select lives_ok(
  $$ update public.associations set retribution_yearly_cents = 1000, retribution_monthly_cents = 80
     where id = current_setting('t.a')::uuid $$,
  'le back-office fixe la rétribution');
select throws_ok(
  $$ update public.associations set retribution_yearly_cents = 20000 where id = current_setting('t.a')::uuid $$,
  '23514', null, 'la rétribution annuelle est bornée à 100 €');

select * from finish();
rollback;
