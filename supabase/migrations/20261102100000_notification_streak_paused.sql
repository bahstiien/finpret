-- SPEC_PROGRES §3.7 : information « série mise en pause » (seule notification liée à la série).
alter table public.notification_log drop constraint notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check
  check (kind in ('dinner', 'thaw', 'shopping', 'session', 'test', 'canteen_published', 'trial_ending', 'streak_paused'));
