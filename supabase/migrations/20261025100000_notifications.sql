-- M9 : notifications (SPEC §12, §9). Abonnements Web Push par appareil et journal d'envoi idempotent.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  endpoint text unique not null check (endpoint ~ '^https://'),
  -- { p256dh, auth } fournis par le navigateur.
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_log (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('dinner', 'thaw', 'shopping', 'session', 'test')),
  -- Jour local du foyer : clé d'idempotence avec le compte et le type.
  day date not null,
  sent_at timestamptz not null default now(),
  payload jsonb
);
-- Un rappel par compte, type et jour, même si le cron passe deux fois (le test peut se répéter).
create unique index notification_log_once on public.notification_log (user_id, kind, day) where kind <> 'test';

-- Réserve l'envoi : vrai la première fois, faux ensuite (aucun doublon entre deux passages du cron).
create function public.claim_notification(p_user uuid, p_kind text, p_day date, p_payload jsonb default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notification_log (user_id, kind, day, payload)
  values (p_user, p_kind, p_day, p_payload)
  on conflict (user_id, kind, day) where kind <> 'test' do nothing;
  return found;
end;
$$;
revoke execute on function public.claim_notification(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.claim_notification(uuid, text, date, jsonb) to service_role;

-- RLS : chaque compte gère ses appareils et lit son propre journal ; l'envoi passe par la clé de service.
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create policy notification_log_select on public.notification_log
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.notification_log from authenticated;
revoke all on public.push_subscriptions, public.notification_log from anon;
