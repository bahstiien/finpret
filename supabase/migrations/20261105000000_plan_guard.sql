-- Courses réelles, lot L4 : une préparation verrouillée ne se réécrit pas, même par une écriture directe.
-- Les plans portent l'identité stable `uid` de chaque préparation (groups, soup, simples). Une préparation est
-- verrouillée si la session de la semaine a démarré ou si elle figure dans preparation_states (§14).
-- Les plans sans `uid` (semaines d'avant l'activation) ne sont pas concernés.

create function public.plan_locked_keys(p_plan jsonb, p_uid text)
returns text[] language sql immutable set search_path = ''
as $$
  -- Créneaux servis par la préparation `p_uid` : « 3-dinner ».
  select coalesce(array_agg(k), '{}') from (
    select (m->>'day') || '-' || (m->>'meal') as k
      from jsonb_array_elements(coalesce(p_plan->'groups', '[]'::jsonb)) g,
           jsonb_array_elements(g->'meals') m
     where g->>'uid' = p_uid
    union all
    select (d::text) || '-dinner'
      from jsonb_array_elements_text(coalesce(p_plan->'soup'->'days', '[]'::jsonb)) d
     where p_plan->'soup'->>'uid' = p_uid
    union all
    select (s->>'day') || '-dinner'
      from jsonb_array_elements(coalesce(p_plan->'simples', '[]'::jsonb)) s
     where s->>'uid' = p_uid
  ) x;
$$;

create function public.plan_preparation(p_plan jsonb, p_uid text)
returns jsonb language sql immutable set search_path = ''
as $$
  select coalesce(
    (select to_jsonb(g) - 'uid' from jsonb_array_elements(coalesce(p_plan->'groups', '[]'::jsonb)) g where g->>'uid' = p_uid limit 1),
    case when p_plan->'soup'->>'uid' = p_uid then (p_plan->'soup') - 'uid' end,
    (select to_jsonb(s) - 'uid' from jsonb_array_elements(coalesce(p_plan->'simples', '[]'::jsonb)) s where s->>'uid' = p_uid limit 1)
  );
$$;

create function public.weeks_plan_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_uid text;
  v_uids text[];
  v_keys text[];
  v_started boolean;
begin
  if new.plan is not distinct from old.plan then return new; end if;

  select exists (select 1 from public.sessions where week_id = old.id and started_at is not null) into v_started;
  if v_started then
    select coalesce(array_agg(u), '{}') into v_uids from (
      select g->>'uid' as u from jsonb_array_elements(coalesce(old.plan->'groups', '[]'::jsonb)) g
      union select old.plan->'soup'->>'uid'
      union select s->>'uid' from jsonb_array_elements(coalesce(old.plan->'simples', '[]'::jsonb)) s
    ) x where u is not null;
  else
    select coalesce(array_agg(uid), '{}') into v_uids from public.preparation_states where week_id = old.id;
  end if;

  foreach v_uid in array v_uids loop
    -- Contenu de la préparation : recette, repas ou jours servis.
    if public.plan_preparation(old.plan, v_uid) is distinct from public.plan_preparation(new.plan, v_uid) then
      raise exception 'preparation_locked' using errcode = 'P0001';
    end if;
    -- Repas retirés ou convives modifiés sur ses créneaux : le besoin de la préparation changerait.
    v_keys := public.plan_locked_keys(old.plan, v_uid);
    if exists (
      select 1 from (
        select jsonb_array_elements_text(coalesce(old.plan->'removed', '[]'::jsonb)) as k
        except
        select jsonb_array_elements_text(coalesce(new.plan->'removed', '[]'::jsonb))
      ) a where a.k = any (v_keys)
    ) or exists (
      select 1 from (
        select jsonb_array_elements_text(coalesce(new.plan->'removed', '[]'::jsonb)) as k
        except
        select jsonb_array_elements_text(coalesce(old.plan->'removed', '[]'::jsonb))
      ) a where a.k = any (v_keys)
    ) then
      raise exception 'preparation_locked' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from unnest(v_keys) k
      where (old.plan->'guests'->k) is distinct from (new.plan->'guests'->k)
    ) then
      raise exception 'preparation_locked' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

create trigger weeks_plan_guard before update of plan on public.weeks
  for each row execute function public.weeks_plan_guard();

revoke all on function public.plan_locked_keys(jsonb, text), public.plan_preparation(jsonb, text) from public, anon, authenticated;
revoke all on function public.weeks_plan_guard() from public, anon, authenticated;
