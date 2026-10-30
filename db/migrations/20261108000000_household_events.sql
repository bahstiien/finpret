-- Temps réel sans Supabase Realtime (docs/MIGRATION_POSTGRES.md, phase 4) : chaque changement des tables suivies
-- envoie, à la validation de la transaction, une notification `household_events` de la forme
-- {"t": table, "h": foyer, "w": semaine}. Le serveur l'écoute (LISTEN) et la relaie aux navigateurs du foyer (SSE).
-- Aucune donnée dans la notification : le navigateur relit ce qui a changé, sous la RLS de son compte.

create or replace function public.notify_household_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  perform pg_notify(
    'household_events',
    json_build_object('t', tg_table_name, 'h', r ->> 'household_id', 'w', r ->> 'week_id')::text
  );
  return null;
end;
$$;

-- Les tables que publiait `supabase_realtime`.
do $$
declare
  t text;
begin
  foreach t in array array[
    'shopping_items', 'sessions', 'purchase_events', 'shopping_issues',
    'preparation_states', 'coverage_confirmations', 'adaptation_events'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_notify', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.notify_household_event()',
      t || '_notify', t
    );
  end loop;
end
$$;
