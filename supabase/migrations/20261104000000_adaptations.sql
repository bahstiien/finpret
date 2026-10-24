-- Courses réelles, lot L3/L4 : aperçus d'adaptation du menu, confirmation et annulation transactionnelles.
-- Un aperçu ne modifie rien. La confirmation écrit le plan et le journal dans une seule transaction, ou rien.

create table public.adaptation_previews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  created_by uuid references auth.users on delete set null default auth.uid(),
  -- Empreinte des versions du plan, des achats, du stock, des signalements et des verrous au moment de l'aperçu.
  fingerprint text not null check (length(fingerprint) between 16 and 128),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz
);
create index adaptation_previews_week_idx on public.adaptation_previews (household_id, week_id, created_at desc);

create table public.adaptation_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  preview_id uuid references public.adaptation_previews on delete set null,
  op_key text not null check (length(op_key) between 8 and 128),
  -- Avant/après ciblé : [{ uid, kind, before, after }] (identifiants de recette).
  changes jsonb not null,
  kind text not null default 'apply' check (kind in ('apply', 'undo')),
  author uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Renseigné sur l'événement d'origine quand il est annulé.
  undone_by uuid references public.adaptation_events on delete set null,
  unique (household_id, op_key)
);
create index adaptation_events_week_idx on public.adaptation_events (household_id, week_id, created_at desc);

alter table public.adaptation_previews enable row level security;
alter table public.adaptation_events enable row level security;
create policy adaptation_previews_select on public.adaptation_previews
  for select to authenticated using (public.is_household_member(household_id));
create policy adaptation_previews_insert on public.adaptation_previews
  for insert to authenticated with check (public.can_edit_household(household_id));
create policy adaptation_events_select on public.adaptation_events
  for select to authenticated using (public.is_household_member(household_id));

revoke all on public.adaptation_previews, public.adaptation_events from anon, authenticated;
grant select on public.adaptation_previews, public.adaptation_events to authenticated;
grant insert (household_id, week_id, fingerprint, payload) on public.adaptation_previews to authenticated;

-- Vrai si la session de la semaine a démarré ou si l'une des préparations listées est protégée.
create function public.adaptation_locked(p_week uuid, p_changes jsonb)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.sessions where week_id = p_week and started_at is not null)
      or exists (
        select 1 from public.preparation_states ps
        where ps.week_id = p_week
          and ps.uid in (select c->>'uid' from jsonb_array_elements(p_changes) c)
      );
$$;
revoke all on function public.adaptation_locked(uuid, jsonb) from public, anon, authenticated;

-- Confirme un aperçu : plan et journal écrits ensemble. Erreurs : forbidden (42501), version_conflict,
-- preview_expired, preview_used, preparation_locked, idempotency_conflict.
create function public.commit_adaptation(
  p_preview uuid, p_op_key text, p_expected_week_version timestamptz, p_expected_purchase_revision int,
  p_fingerprint text, p_plan jsonb, p_changes jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_preview public.adaptation_previews;
  v_household uuid;
  v_version timestamptz;
  v_prior public.adaptation_events;
  v_event uuid;
begin
  select * into v_preview from public.adaptation_previews where id = p_preview;
  if not found then raise exception 'version_conflict'; end if;
  select household_id, updated_at into v_household, v_version from public.weeks where id = v_preview.week_id for update;
  if v_household is null or not public.can_edit_household(v_household) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_op_key is null or length(p_op_key) < 8 or length(p_op_key) > 128 then raise exception 'invalid_op_key'; end if;

  select * into v_prior from public.adaptation_events where household_id = v_household and op_key = p_op_key;
  if found then
    if v_prior.preview_id = p_preview then return jsonb_build_object('replayed', true, 'event', v_prior.id); end if;
    raise exception 'idempotency_conflict';
  end if;

  if v_preview.used_at is not null then raise exception 'preview_used'; end if;
  if v_preview.expires_at <= now() then raise exception 'preview_expired'; end if;
  if v_preview.fingerprint <> p_fingerprint or v_version <> p_expected_week_version then
    raise exception 'version_conflict';
  end if;
  if (select count(*) from public.purchase_events where week_id = v_preview.week_id) <> p_expected_purchase_revision then
    raise exception 'version_conflict';
  end if;
  if public.adaptation_locked(v_preview.week_id, p_changes) then raise exception 'preparation_locked'; end if;

  update public.weeks set plan = p_plan where id = v_preview.week_id;
  insert into public.adaptation_events (household_id, week_id, preview_id, op_key, changes)
  values (v_household, v_preview.week_id, p_preview, p_op_key, p_changes) returning id into v_event;
  update public.adaptation_previews set used_at = now() where id = p_preview;
  return jsonb_build_object('replayed', false, 'event', v_event);
end;
$$;

-- Annule une adaptation : nouvelle opération journalisée, jamais un retour en arrière de la base.
create function public.undo_adaptation(
  p_event uuid, p_op_key text, p_expected_week_version timestamptz, p_plan jsonb, p_changes jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.adaptation_events;
  v_household uuid;
  v_version timestamptz;
  v_prior public.adaptation_events;
  v_new uuid;
begin
  select * into v_event from public.adaptation_events where id = p_event;
  if not found then raise exception 'version_conflict'; end if;
  select household_id, updated_at into v_household, v_version from public.weeks where id = v_event.week_id for update;
  if v_household is null or not public.can_edit_household(v_household) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_prior from public.adaptation_events where household_id = v_household and op_key = p_op_key;
  if found then
    if v_prior.kind = 'undo' and v_event.undone_by = v_prior.id then
      return jsonb_build_object('replayed', true, 'event', v_prior.id);
    end if;
    raise exception 'idempotency_conflict';
  end if;
  if v_event.kind <> 'apply' or v_event.undone_by is not null then raise exception 'already_undone'; end if;
  if v_version <> p_expected_week_version then raise exception 'version_conflict'; end if;
  if public.adaptation_locked(v_event.week_id, p_changes) then raise exception 'preparation_locked'; end if;

  update public.weeks set plan = p_plan where id = v_event.week_id;
  insert into public.adaptation_events (household_id, week_id, preview_id, op_key, changes, kind)
  values (v_household, v_event.week_id, null, p_op_key, p_changes, 'undo') returning id into v_new;
  update public.adaptation_events set undone_by = v_new where id = p_event;
  return jsonb_build_object('replayed', false, 'event', v_new);
end;
$$;

revoke all on function public.commit_adaptation(uuid, text, timestamptz, int, text, jsonb, jsonb) from public, anon;
revoke all on function public.undo_adaptation(uuid, text, timestamptz, jsonb, jsonb) from public, anon;
grant execute on function public.commit_adaptation(uuid, text, timestamptz, int, text, jsonb, jsonb) to authenticated;
grant execute on function public.undo_adaptation(uuid, text, timestamptz, jsonb, jsonb) to authenticated;

alter table public.adaptation_events replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.adaptation_events;
  end if;
end;
$$;
