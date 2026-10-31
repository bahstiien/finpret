-- Rétribution par association : montants propres à chaque association (centimes versés par abonnement payé).
-- null = barème standard (src/engine/payouts.ts : 800 à l'année, 50 au mois).
alter table public.associations
  add column retribution_yearly_cents int check (retribution_yearly_cents between 0 and 10000),
  add column retribution_monthly_cents int check (retribution_monthly_cents between 0 and 2000);

-- Le responsable d'une association ne fixe pas sa propre rétribution : colonnes réservées aux administrateurs.
create or replace function public.associations_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at
       or new.reject_reason is distinct from old.reject_reason
       or new.iban_encrypted is distinct from old.iban_encrypted
       or new.iban_last4 is distinct from old.iban_last4
       or new.created_by is distinct from old.created_by
       or new.retribution_yearly_cents is distinct from old.retribution_yearly_cents
       or new.retribution_monthly_cents is distinct from old.retribution_monthly_cents then
      raise exception 'association_locked' using errcode = '42501';
    end if;
    if new.code is distinct from old.code then
      if old.code_changed then
        raise exception 'code_already_changed' using errcode = 'P0001';
      end if;
      new.code_changed := true;
    end if;
    new.code_changed := old.code_changed or new.code_changed;
  end if;
  return new;
end;
$$;
