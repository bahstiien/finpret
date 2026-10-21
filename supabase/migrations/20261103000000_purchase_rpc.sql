-- Courses réelles, lot L4 : écritures d'achats atomiques et sérialisées par semaine.
-- Vérification de l'idempotence, de la révision et du solde dans la même transaction que l'écriture ;
-- plus aucune insertion directe dans le journal.

alter table public.purchase_events add column seq bigint generated always as identity;
create index purchase_events_seq_idx on public.purchase_events (week_id, ingredient_key, seq);

-- Solde disponible : dernier total corrigé (ou 0) plus achats depuis, moins transferts sortants, plus entrants.
-- Interne : appelée seulement par les fonctions ci-dessous.
create function public.purchase_balance(p_week uuid, p_ingredient text)
returns numeric language sql stable security definer set search_path = ''
as $$
  with corr as (
    select qty, seq from public.purchase_events
    where week_id = p_week and ingredient_key = p_ingredient and type = 'correction'
    order by seq desc limit 1
  )
  select coalesce((select qty from corr), 0)
    + coalesce((select sum(e.qty) from public.purchase_events e
        where e.week_id = p_week and e.ingredient_key = p_ingredient and e.type = 'purchase'
          and e.seq > coalesce((select seq from corr), 0)), 0)
    - coalesce((select sum(e.qty) from public.purchase_events e
        where e.week_id = p_week and e.ingredient_key = p_ingredient and e.type = 'transfer_out'), 0)
    + coalesce((select sum(e.qty) from public.purchase_events e
        where e.week_id = p_week and e.ingredient_key = p_ingredient and e.type = 'transfer_in'), 0);
$$;
revoke all on function public.purchase_balance(uuid, text) from public, anon, authenticated;

-- Déclare un achat (« purchase ») ou corrige le total acheté (« correction »).
-- Erreurs métier : forbidden (42501), idempotency_conflict, version_conflict, insufficient_available_quantity.
create function public.record_purchase(
  p_week uuid, p_ingredient text, p_qty numeric, p_type text, p_op_key text, p_expected_revision int default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid;
  v_prior public.purchase_events;
  v_revision int;
begin
  -- Verrou de la semaine : les écritures d'une semaine passent l'une après l'autre.
  select household_id into v_household from public.weeks where id = p_week for update;
  if v_household is null or not public.can_edit_household(v_household) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_type not in ('purchase', 'correction') then raise exception 'invalid_type'; end if;
  if p_qty is null or p_qty < 0 or p_qty > 100000 then raise exception 'invalid_quantity'; end if;
  if p_op_key is null or length(p_op_key) < 8 or length(p_op_key) > 128 then raise exception 'invalid_op_key'; end if;

  select * into v_prior from public.purchase_events where household_id = v_household and op_key = p_op_key;
  if found then
    if v_prior.week_id = p_week and v_prior.ingredient_key = p_ingredient and v_prior.qty = p_qty and v_prior.type = p_type then
      select count(*) into v_revision from public.purchase_events where week_id = p_week;
      return jsonb_build_object('replayed', true, 'revision', v_revision);
    end if;
    raise exception 'idempotency_conflict';
  end if;

  select count(*) into v_revision from public.purchase_events where week_id = p_week;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception 'version_conflict';
  end if;

  insert into public.purchase_events (household_id, week_id, ingredient_key, qty, type, op_key)
  values (v_household, p_week, p_ingredient, p_qty, p_type, p_op_key);

  -- Une correction sous ce qui a déjà été transféré exige un rapprochement : la transaction est annulée.
  if public.purchase_balance(p_week, p_ingredient) < 0 then
    raise exception 'insufficient_available_quantity';
  end if;
  return jsonb_build_object('replayed', false, 'revision', v_revision + 1);
end;
$$;

-- Transfert explicite d'une quantité disponible vers une autre semaine du même foyer (§9.6) :
-- la source diminue de la quantité transférée, la destination l'acquiert, une seule opération.
create function public.transfer_purchase(
  p_from uuid, p_to uuid, p_ingredient text, p_qty numeric, p_op_key text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid;
  v_to_household uuid;
  v_prior public.purchase_events;
begin
  if p_from = p_to then raise exception 'same_week'; end if;
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then raise exception 'invalid_quantity'; end if;
  if p_op_key is null or length(p_op_key) < 8 or length(p_op_key) > 120 then raise exception 'invalid_op_key'; end if;

  -- Verrou des deux semaines dans un ordre fixe : pas d'interblocage entre deux transferts croisés.
  perform 1 from public.weeks where id in (p_from, p_to) order by id for update;
  select household_id into v_household from public.weeks where id = p_from;
  select household_id into v_to_household from public.weeks where id = p_to;
  if v_household is null or v_to_household is distinct from v_household or not public.can_edit_household(v_household) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_prior from public.purchase_events where household_id = v_household and op_key = p_op_key;
  if found then
    if v_prior.week_id = p_from and v_prior.ingredient_key = p_ingredient and v_prior.qty = p_qty and v_prior.type = 'transfer_out' then
      return jsonb_build_object('replayed', true);
    end if;
    raise exception 'idempotency_conflict';
  end if;

  if public.purchase_balance(p_from, p_ingredient) < p_qty then
    raise exception 'insufficient_available_quantity';
  end if;
  insert into public.purchase_events (household_id, week_id, ingredient_key, qty, type, op_key)
  values (v_household, p_from, p_ingredient, p_qty, 'transfer_out', p_op_key),
         (v_household, p_to, p_ingredient, p_qty, 'transfer_in', p_op_key || ':in');
  return jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.record_purchase(uuid, text, numeric, text, text, int) from public, anon;
revoke all on function public.transfer_purchase(uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.record_purchase(uuid, text, numeric, text, text, int) to authenticated;
grant execute on function public.transfer_purchase(uuid, uuid, text, numeric, text) to authenticated;

-- Plus d'insertion directe : tout passe par les fonctions ci-dessus.
drop policy purchase_events_insert on public.purchase_events;
revoke insert on public.purchase_events from authenticated;
