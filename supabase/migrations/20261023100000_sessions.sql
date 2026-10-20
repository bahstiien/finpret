-- M8 : session de batch cooking partagée (SPEC §8.5, §9).
-- L'état (étape, tâches, minuteurs) est modifié par des fonctions atomiques : deux appareils ne s'écrasent pas.

create table public.sessions (
  week_id uuid primary key references public.weeks on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  started_at timestamptz,
  current_step int not null default 0,
  -- { "sig": signature des étapes, "done": { "2-0": true } } : remis à zéro si les étapes changent.
  tasks_done jsonb not null default '{}',
  -- [{ "id", "label", "minutes", "step", "endsAt" (ISO), "doneAt" }]
  timers jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create index sessions_household_idx on public.sessions (household_id);
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

alter table public.sessions enable row level security;
create policy sessions_select on public.sessions
  for select to authenticated using (public.is_household_member(household_id));
create policy sessions_insert on public.sessions
  for insert to authenticated with check (
    public.can_edit_household(household_id)
    and exists (select 1 from public.weeks w where w.id = week_id and w.household_id = sessions.household_id)
  );
create policy sessions_update on public.sessions
  for update to authenticated
  using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
revoke all on public.sessions from anon;
revoke update on public.sessions from authenticated;
grant update (started_at, current_step, tasks_done, timers) on public.sessions to authenticated;

-- Fonctions (security invoker : la RLS s'applique).

/** Crée l'état de la session si besoin et vérifie la signature des étapes. */
create function public.session_ensure(p_week uuid, p_sig text)
returns public.sessions
language plpgsql security invoker set search_path = ''
as $$
declare
  s public.sessions;
begin
  insert into public.sessions (week_id, household_id, tasks_done)
  select w.id, w.household_id, jsonb_build_object('sig', p_sig, 'done', '{}'::jsonb)
  from public.weeks w where w.id = p_week
  on conflict (week_id) do nothing;
  -- Étapes modifiées (menu changé) : les coches ne correspondent plus.
  update public.sessions
     set tasks_done = jsonb_build_object('sig', p_sig, 'done', '{}'::jsonb), current_step = 0
   where week_id = p_week and coalesce(tasks_done ->> 'sig', '') <> p_sig;
  select * into s from public.sessions where week_id = p_week;
  return s;
end;
$$;

create function public.session_start(p_week uuid)
returns void language sql security invoker set search_path = ''
as $$ update public.sessions set started_at = coalesce(started_at, now()) where week_id = p_week $$;

create function public.session_set_step(p_week uuid, p_step int)
returns void language sql security invoker set search_path = ''
as $$ update public.sessions set current_step = greatest(0, p_step) where week_id = p_week $$;

create function public.session_set_task(p_week uuid, p_key text, p_done boolean)
returns void language sql security invoker set search_path = ''
as $$
  update public.sessions
     set tasks_done = jsonb_set(
       tasks_done,
       '{done}',
       case when p_done
         then coalesce(tasks_done -> 'done', '{}'::jsonb) || jsonb_build_object(p_key, true)
         else coalesce(tasks_done -> 'done', '{}'::jsonb) - p_key
       end)
   where week_id = p_week
$$;

/** Lance un minuteur (un seul par étape à la fois). */
create function public.session_start_timer(p_week uuid, p_id text, p_label text, p_minutes int, p_step int)
returns void language sql security invoker set search_path = ''
as $$
  update public.sessions
     set timers = (
       select coalesce(jsonb_agg(t), '[]'::jsonb) from jsonb_array_elements(timers) t
       where (t ->> 'step')::int <> p_step or t ? 'doneAt'
     ) || jsonb_build_array(jsonb_build_object(
       'id', p_id, 'label', p_label, 'minutes', p_minutes, 'step', p_step,
       'endsAt', to_char((now() + make_interval(mins => p_minutes)) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
   where week_id = p_week
$$;

/** +5 min ou OK (terminé) sur un minuteur. */
create function public.session_timer(p_week uuid, p_id text, p_action text)
returns void language sql security invoker set search_path = ''
as $$
  update public.sessions
     set timers = (
       select coalesce(jsonb_agg(
         case when t ->> 'id' <> p_id then t
              when p_action = 'snooze' then t || jsonb_build_object('endsAt', to_char(
                (greatest(now(), (t ->> 'endsAt')::timestamptz) + interval '5 minutes') at time zone 'utc',
                'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
              else t || jsonb_build_object('doneAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         end), '[]'::jsonb)
       from jsonb_array_elements(timers) t)
   where week_id = p_week
$$;

grant execute on function public.session_ensure(uuid, text), public.session_start(uuid),
  public.session_set_step(uuid, int), public.session_set_task(uuid, text, boolean),
  public.session_start_timer(uuid, text, text, int, int), public.session_timer(uuid, text, text)
  to authenticated;
revoke execute on function public.session_ensure(uuid, text), public.session_start(uuid),
  public.session_set_step(uuid, int), public.session_set_task(uuid, text, boolean),
  public.session_start_timer(uuid, text, text, int, int), public.session_timer(uuid, text, text)
  from anon, public;

alter table public.sessions replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sessions;
  end if;
end;
$$;
