-- Courses réelles L4 : une préparation verrouillée ne se réécrit pas, même par une écriture directe.
begin;
select plan(8);

select set_config('t.admin', tests.create_user('admin-pg@test.local')::text, true);
select tests.login_as(current_setting('t.admin')::uuid);
select set_config('t.h', public.create_household('Foyer PG')::text, true);
insert into public.weeks (household_id, start_date, status, plan) values (
  current_setting('t.h')::uuid, '2027-03-01', 'draft',
  '{"groups": [{"uid": "g1", "id": "r1", "meals": [{"day": 1, "meal": "dinner"}, {"day": 2, "meal": "lunch"}]},
                {"uid": "g2", "id": "r2", "meals": [{"day": 3, "meal": "dinner"}]}],
    "soup": {"uid": "s1", "id": "soupe1", "days": [4, 5]},
    "simples": [{"uid": "m1", "id": "simple1", "day": 5}],
    "removed": [], "guests": {}}'
);
select set_config('t.w', (select id::text from public.weeks where household_id = current_setting('t.h')::uuid), true);

-- Rien n'est verrouillé : toute modification passe.
select lives_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{groups,0,id}', '"r9"') where id = %L $$, current_setting('t.w')),
  'sans verrou, le plan se modifie'
);

-- g1 marquée commencée.
insert into public.preparation_states (week_id, uid, household_id, state)
values (current_setting('t.w')::uuid, 'g1', current_setting('t.h')::uuid, 'started');

select throws_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{groups,0,id}', '"r10"') where id = %L $$, current_setting('t.w')),
  'P0001', 'preparation_locked', 'la recette d''une préparation commencée ne change pas'
);
select throws_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{removed}', '["1-dinner"]') where id = %L $$, current_setting('t.w')),
  'P0001', 'preparation_locked', 'ses repas ne se retirent pas'
);
select throws_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{guests}', '{"2-lunch": {"a": 5, "c": 0}}') where id = %L $$, current_setting('t.w')),
  'P0001', 'preparation_locked', 'ses convives ne changent pas'
);
select lives_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{groups,1,id}', '"r11"') where id = %L $$, current_setting('t.w')),
  'une autre préparation reste modifiable'
);
select lives_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{removed}', '["3-dinner"]') where id = %L $$, current_setting('t.w')),
  'et ses repas aussi'
);

-- Session démarrée : toutes les préparations à identité sont verrouillées.
insert into public.sessions (week_id, household_id, started_at)
values (current_setting('t.w')::uuid, current_setting('t.h')::uuid, now())
on conflict (week_id) do update set started_at = now();
select throws_ok(
  format($$ update public.weeks set plan = jsonb_set(plan, '{groups,1,id}', '"r12"') where id = %L $$, current_setting('t.w')),
  'P0001', 'preparation_locked', 'la session démarrée verrouille toute la semaine'
);
select lives_ok(
  format($$ update public.weeks set status = 'active' where id = %L $$, current_setting('t.w')),
  'les autres colonnes restent modifiables'
);

select * from finish();
rollback;
