-- J7 (SPEC_JANVIER §8) : nouveaux types de notification, menus de cantine publiés et fin d'essai.
alter table public.notification_log drop constraint notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check
  check (kind in ('dinner', 'thaw', 'shopping', 'session', 'test', 'canteen_published', 'trial_ending'));
