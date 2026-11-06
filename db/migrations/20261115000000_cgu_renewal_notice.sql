-- CGU acceptées à la création du compte : date et version des conditions acceptées (preuve du consentement).
alter table public.user_settings
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- Résiliation programmée (Stripe `cancel_at_period_end`) : pas de rappel de reconduction pour un abonnement qui s'arrête.
alter table public.subscriptions
  add column cancel_at_period_end boolean not null default false;

-- Rappel de reconduction de l'abonnement annuel (art. L215-1 du Code de la consommation).
alter table public.notification_log drop constraint notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check
  check (kind in ('dinner', 'thaw', 'shopping', 'session', 'test', 'canteen_published', 'trial_ending', 'streak_paused', 'renewal_notice'));
