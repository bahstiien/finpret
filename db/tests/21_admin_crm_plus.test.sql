-- Back-office, suite : étiquettes sans accès client, pipeline des prospects, liens des actions.
begin;
select plan(6);

select set_config('t.u', tests.create_user('tag-user@test.local')::text, true);

reset role;
insert into public.account_tags (user_id, tag) values (current_setting('t.u')::uuid, 'VIP');
insert into public.association_leads (name, email, association_name, consent)
  values ('Léa', 'lea@test.local', 'APE', true);

select is((select stage from public.association_leads where email = 'lea@test.local'), 'to_contact',
  'un nouveau prospect est « à contacter »');
select throws_ok($$ update public.association_leads set stage = 'gagne' $$, '23514', null,
  'seules les étapes prévues du pipeline existent');
select throws_ok(
  $$ insert into public.account_tags (user_id, tag) values (current_setting('t.u')::uuid, 'VIP') $$,
  '23505', null, 'une étiquette n''est posée qu''une fois par compte');
select throws_ok(
  $$ insert into public.admin_tasks (title, category, notion_page_id) values ('A', 'dev', 'p1'), ('B', 'dev', 'p1') $$,
  '23505', null, 'une ligne Notion ne donne qu''une action');

select tests.login_as(current_setting('t.u')::uuid);
select throws_ok($$ select * from public.account_tags $$, '42501', null,
  'un utilisateur ne lit pas les étiquettes, même les siennes');

reset role;
delete from auth.users where id = current_setting('t.u')::uuid;
select is((select count(*)::int from public.account_tags), 0, 'les étiquettes partent avec le compte');

select * from finish();
rollback;
