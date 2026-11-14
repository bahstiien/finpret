-- Prise en main (SPEC_PRISE_EN_MAIN §5) : progression par foyer, conseils vus par compte, journal d'envoi de la séquence.

-- Progression par foyer : lecture par les membres, écriture par les actions serveur uniquement.
create table if not exists public.onboarding_progress (
  household_id uuid primary key references public.households on delete cascade,
  -- { "<étape>": { "done_at": "…", "by": "<user_id>|null", "via": "event|solo" } }
  steps jsonb not null default '{}',
  -- Niveau choisi pour la première session (null = « débutant » par défaut).
  first_session_level text check (first_session_level in ('beginner', 'confident')),
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.onboarding_progress enable row level security;
drop policy if exists onboarding_progress_select on public.onboarding_progress;
create policy onboarding_progress_select on public.onboarding_progress
  for select to authenticated using (public.is_household_member(household_id));
revoke all on public.onboarding_progress from anon, authenticated;
grant select on public.onboarding_progress to authenticated;

-- Conseils vus : par compte. `user_settings` n'accorde l'écriture client qu'à `notifications` : `tips_seen` reste serveur.
alter table public.user_settings add column if not exists tips_seen text[] not null default '{}';

-- Journal d'envoi : type « onboarding », une clé de message au plus par compte
-- (le couple compte, type, jour est déjà unique : un message de la séquence par jour).
alter table public.notification_log drop constraint if exists notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check
  check (kind in ('dinner', 'thaw', 'shopping', 'session', 'test', 'canteen_published', 'trial_ending', 'streak_paused',
    'renewal_notice', 'onboarding'));
create unique index if not exists notification_log_onboarding_key
  on public.notification_log (user_id, (payload->>'key')) where kind = 'onboarding';

-- Décompte des conseils du jour et lecture des événements d'un compte.
create index if not exists events_user_name_created_idx on public.events (user_id, name, created_at desc);
