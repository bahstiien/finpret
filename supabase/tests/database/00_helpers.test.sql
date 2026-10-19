-- Fonctions d'aide aux tests : création de comptes et changement d'identité.
-- Ce fichier est joué en premier (ordre alphabétique) ; les fonctions vivent dans le schéma `tests`.
begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          '{}'::jsonb, now(), now());
  return uid;
end;
$$;

-- Joue la suite en tant que `uid` (rôle authenticated, comme le client Supabase).
create or replace function tests.login_as(uid uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.login_as_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Pour revenir au superutilisateur dans un test : `reset role;`

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select has_function('tests', 'login_as', array['uuid']);
select * from finish();
commit;
