-- J6/J7 (SPEC_JANVIER §5, §6, §7, §8 bis) : associations, écoles, menus d'école, abonnements, reversements, back-office.
-- Les écritures sensibles (statut d'association, abonnements, reversements, journal) passent par la clé de service
-- ou par des fonctions security definer ; les politiques ci-dessous ne donnent aux comptes que le strict nécessaire.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  city text not null check (char_length(city) between 1 and 80),
  uai text unique,
  created_at timestamptz not null default now()
);

create type public.association_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.association_role as enum ('manager', 'menu_editor');

create table public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  rna_or_siren text not null check (char_length(rna_or_siren) between 9 and 14),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  manager_name text not null check (char_length(manager_name) between 1 and 80),
  code text unique not null check (code ~ '^[A-Z0-9-]{4,20}$'),
  code_changed boolean not null default false,
  status public.association_status not null default 'pending',
  reject_reason text,
  iban_encrypted text,
  iban_last4 text,
  created_by uuid references auth.users on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.association_schools (
  association_id uuid not null references public.associations on delete cascade,
  school_id uuid not null references public.schools on delete cascade,
  primary key (association_id, school_id)
);
create index association_schools_school_idx on public.association_schools (school_id);

create table public.association_members (
  association_id uuid not null references public.associations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.association_role not null,
  primary key (association_id, user_id)
);
create index association_members_user_idx on public.association_members (user_id);

create table public.association_invitations (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token text unique not null default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid references auth.users on delete set null default auth.uid()
);
create index association_invitations_asso_idx on public.association_invitations (association_id);

alter table public.households add column association_id uuid references public.associations on delete set null;
alter table public.households add column association_joined_at timestamptz;
create index households_association_idx on public.households (association_id);

create table public.member_schools (
  member_id uuid primary key references public.members on delete cascade,
  school_id uuid not null references public.schools on delete restrict,
  canteen_days smallint[] not null default '{1,2,4,5}'
    check (canteen_days <@ array[1, 2, 3, 4, 5]::smallint[])
);
create index member_schools_school_idx on public.member_schools (school_id);

create table public.school_menus (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools on delete cascade,
  association_id uuid references public.associations on delete set null,
  date date not null,
  starter text check (char_length(starter) <= 200),
  main text check (char_length(main) <= 200),
  side text check (char_length(side) <= 200),
  dairy text check (char_length(dairy) <= 200),
  dessert text check (char_length(dessert) <= 200),
  note text check (char_length(note) <= 300),
  status text not null default 'draft' check (status in ('draft', 'published')),
  edited_after_publish boolean not null default false,
  published_by uuid references auth.users on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (school_id, date),
  check (coalesce(starter, main, side, dairy, dessert, note) is not null)
);
create index school_menus_date_idx on public.school_menus (school_id, date);

create table public.canteen_notifications (
  school_id uuid not null references public.schools on delete cascade,
  iso_week text not null,
  sent_at timestamptz not null default now(),
  primary key (school_id, iso_week)
);

create table public.subscriptions (
  household_id uuid primary key references public.households on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'trial' check (plan in ('trial', 'monthly', 'yearly', 'free')),
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations on delete cascade,
  quarter text not null check (quarter ~ '^\d{4}-T[1-4]$'),
  amount_cents int not null,
  status text not null check (status in ('ready', 'paid', 'carried_over')),
  paid_at timestamptz,
  statement_path text,
  unique (association_id, quarter)
);

create table public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations on delete cascade,
  household_id uuid references public.households on delete set null,
  stripe_invoice_id text,
  kind text not null check (kind in ('yearly', 'monthly', 'refund')),
  amount_cents int not null,
  created_at timestamptz not null default now(),
  payout_id uuid references public.payouts on delete set null
);
create unique index payout_lines_invoice_kind on public.payout_lines (stripe_invoice_id, kind) where kind <> 'refund';
create index payout_lines_asso_idx on public.payout_lines (association_id, created_at);

create table public.admin_audit (
  id bigserial primary key,
  admin_id uuid,
  action text not null,
  target text,
  props jsonb,
  created_at timestamptz not null default now()
);

create table public.association_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  association_name text not null check (char_length(association_name) between 1 and 160),
  school text,
  city text,
  families_estimate int check (families_estimate is null or families_estimate between 0 and 100000),
  consent boolean not null check (consent),
  created_at timestamptz not null default now(),
  contacted_at timestamptz
);

create table public.association_kits (
  association_id uuid primary key references public.associations on delete cascade,
  tuto_pdf_path text,
  generated_at timestamptz,
  source_hash text
);

-- ---------------------------------------------------------------------------
-- Fonctions d'appartenance (security definer : évitent la récursion des politiques)
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins a where a.user_id = auth.uid()); $$;

create function public.association_role_of(aid uuid)
returns public.association_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.association_members m where m.association_id = aid and m.user_id = auth.uid();
$$;

create function public.is_association_member(aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.association_role_of(aid) is not null; $$;

create function public.is_association_manager(aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.association_role_of(aid) = 'manager', false); $$;

-- L'association `aid` est-elle approuvée et liée à l'école `sid` dont le compte est membre (manager ou éditeur) ?
create function public.can_edit_school(sid uuid, aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.association_members m
    join public.associations a on a.id = m.association_id
    join public.association_schools s on s.association_id = m.association_id
    where m.user_id = auth.uid() and m.association_id = aid and s.school_id = sid and a.status = 'approved'
  );
$$;

-- Le compte voit-il les menus de l'école `sid` en tant qu'éditeur d'une association liée (lecture seule comprise) ?
create function public.reads_school_menus(sid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.association_members m
    join public.association_schools s on s.association_id = m.association_id
    where m.user_id = auth.uid() and s.school_id = sid
  );
$$;

-- Un membre du foyer du compte est-il relié à l'école `sid` ?
create function public.family_in_school(sid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.member_schools ms
    join public.members m on m.id = ms.member_id
    join public.memberships mb on mb.household_id = m.household_id
    where ms.school_id = sid and mb.user_id = auth.uid()
  );
$$;

-- Le foyer du compte est-il rattaché à l'association `aid` ?
create function public.household_of_association(aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.households h
    join public.memberships mb on mb.household_id = h.id
    where h.association_id = aid and mb.user_id = auth.uid()
  );
$$;

-- L'école `sid` fait-elle partie de l'association à laquelle le foyer du membre `mid` est rattaché ?
create function public.school_allowed_for_member(mid uuid, sid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.households h on h.id = m.household_id
    join public.association_schools s on s.association_id = h.association_id
    where m.id = mid and s.school_id = sid
  );
$$;

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------

-- Essai de 14 jours à la création du foyer (30 jours avec un code d'association : prolongé au rattachement).
create function public.households_create_subscription()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (household_id, plan, status, trial_ends_at)
  values (new.id, 'trial', 'trialing', new.created_at + interval '14 days')
  on conflict do nothing;
  return new;
end;
$$;
create trigger households_subscription after insert on public.households
  for each row execute function public.households_create_subscription();

insert into public.subscriptions (household_id, plan, status, trial_ends_at)
select h.id, 'trial', 'trialing', h.created_at + interval '14 days' from public.households h
on conflict do nothing;

-- Le rattachement à une association ne s'écrit qu'avec la clé de service (auth.uid() est nul).
create function public.households_guard_association()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.association_id is distinct from old.association_id
          or new.association_joined_at is distinct from old.association_joined_at) then
    raise exception 'association_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger households_association_guard before update on public.households
  for each row execute function public.households_guard_association();

-- Association : statut et IBAN réservés aux administrateurs et à la clé de service ; code modifiable une fois.
create function public.associations_guard()
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
       or new.created_by is distinct from old.created_by then
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
create trigger associations_guard_update before update on public.associations
  for each row execute function public.associations_guard();

-- Menu d'école : publication, badge « modifié ».
create function public.school_menus_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := now();
      new.published_by := auth.uid();
    elsif old.status = 'published' and new.status = 'published'
      and (new.starter, new.main, new.side, new.dairy, new.dessert, new.note)
          is distinct from (old.starter, old.main, old.side, old.dairy, old.dessert, old.note) then
      new.edited_after_publish := true;
    end if;
    new.association_id := old.association_id;
    new.school_id := old.school_id;
    new.date := old.date;
  elsif new.status = 'published' then
    new.published_at := now();
    new.published_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger school_menus_touch_row before insert or update on public.school_menus
  for each row execute function public.school_menus_touch();

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- Création d'une association : profil, écoles, et le créateur comme responsable (statut pending). 3 par jour et par compte.
create function public.create_association(
  p_name text, p_rna text, p_email text, p_manager text, p_code text, p_schools jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
  sid uuid;
  s jsonb;
  s_name text;
  s_city text;
  s_uai text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.associations a
      where a.created_by = uid and a.created_at > now() - interval '1 day') >= 3 then
    raise exception 'too_many_associations' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_schools) <> 'array' or jsonb_array_length(p_schools) not between 1 and 10 then
    raise exception 'schools_required' using errcode = 'P0001';
  end if;

  insert into public.associations (name, rna_or_siren, email, manager_name, code, created_by)
  values (btrim(p_name), btrim(p_rna), btrim(p_email), btrim(p_manager), p_code, uid)
  returning id into aid;
  insert into public.association_members (association_id, user_id, role) values (aid, uid, 'manager');

  for s in select * from jsonb_array_elements(p_schools) loop
    s_name := btrim(s ->> 'name');
    s_city := btrim(s ->> 'city');
    s_uai := nullif(btrim(coalesce(s ->> 'uai', '')), '');
    sid := null;
    if s_uai is not null then
      select id into sid from public.schools where uai = s_uai;
    end if;
    if sid is null then
      select id into sid from public.schools where lower(name) = lower(s_name) and lower(city) = lower(s_city);
    end if;
    if sid is null then
      insert into public.schools (name, city, uai) values (s_name, s_city, s_uai) returning id into sid;
    end if;
    insert into public.association_schools (association_id, school_id) values (aid, sid) on conflict do nothing;
  end loop;
  return aid;
end;
$$;

-- Aperçu d'une invitation d'éditeur (page d'acceptation, avant connexion).
create function public.get_association_invitation(p_token text)
returns table (association_name text, status text)
language sql stable security definer set search_path = ''
as $$
  select a.name,
    case when i.accepted_at is not null then 'used' when i.expires_at <= now() then 'expired' else 'valid' end
  from public.association_invitations i join public.associations a on a.id = i.association_id
  where i.token = p_token;
$$;

-- Acceptation : le compte devient éditeur de menus ; 3 éditeurs au plus par association.
create function public.accept_association_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.association_invitations;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into inv from public.association_invitations where token = p_token for update;
  if not found then raise exception 'invitation_not_found' using errcode = 'P0001'; end if;
  if inv.accepted_at is not null then raise exception 'invitation_used' using errcode = 'P0001'; end if;
  if inv.expires_at <= now() then raise exception 'invitation_expired' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.association_members where association_id = inv.association_id and user_id = uid) then
    if (select count(*) from public.association_members
        where association_id = inv.association_id and role = 'menu_editor') >= 3 then
      raise exception 'too_many_editors' using errcode = 'P0001';
    end if;
    insert into public.association_members (association_id, user_id, role)
    values (inv.association_id, uid, 'menu_editor');
  end if;
  update public.association_invitations set accepted_at = now() where id = inv.id;
  return inv.association_id;
end;
$$;

-- Agrégats pour l'espace association (D13) : tout compteur inférieur à 5 est remplacé par null.
create function public.association_stats(aid uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  n_house int;
  n_month int;
  n_year int;
  q_cents int;
  paid_cents int;
begin
  if not public.is_association_member(aid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into n_house from public.households where association_id = aid;
  select count(*) into n_month from public.subscriptions s join public.households h on h.id = s.household_id
    where h.association_id = aid and s.plan = 'monthly' and s.status in ('active', 'trialing', 'past_due');
  select count(*) into n_year from public.subscriptions s join public.households h on h.id = s.household_id
    where h.association_id = aid and s.plan = 'yearly' and s.status in ('active', 'trialing', 'past_due');
  select coalesce(sum(amount_cents), 0) into q_cents from public.payout_lines
    where association_id = aid and payout_id is null and created_at >= date_trunc('quarter', now());
  select coalesce(sum(amount_cents), 0) into paid_cents from public.payouts
    where association_id = aid and status = 'paid';
  return jsonb_build_object(
    'households', case when n_house < 5 then null else n_house end,
    'monthly', case when n_month < 5 then null else n_month end,
    'yearly', case when n_year < 5 then null else n_year end,
    'current_quarter_cents', q_cents,
    'paid_total_cents', paid_cents
  );
end;
$$;

revoke execute on function
  public.create_association(text, text, text, text, text, jsonb),
  public.accept_association_invitation(text),
  public.association_stats(uuid)
  from public, anon;
grant execute on function
  public.create_association(text, text, text, text, text, jsonb),
  public.accept_association_invitation(text),
  public.association_stats(uuid)
  to authenticated;
grant execute on function public.get_association_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.admins enable row level security;
alter table public.schools enable row level security;
alter table public.associations enable row level security;
alter table public.association_schools enable row level security;
alter table public.association_members enable row level security;
alter table public.association_invitations enable row level security;
alter table public.member_schools enable row level security;
alter table public.school_menus enable row level security;
alter table public.canteen_notifications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_lines enable row level security;
alter table public.admin_audit enable row level security;
alter table public.association_leads enable row level security;
alter table public.association_kits enable row level security;

-- Aucun accès client : admins, canteen_notifications, stripe_events, payout_lines, admin_audit, association_leads.
revoke all on public.admins, public.canteen_notifications, public.stripe_events, public.payout_lines,
  public.admin_audit, public.association_leads from anon, authenticated;
revoke all on sequence public.admin_audit_id_seq from anon, authenticated;

-- Écoles : nom et commune lisibles par tout compte connecté (choix de l'école d'un enfant) ; écriture par les administrateurs.
create policy schools_select on public.schools for select to authenticated using (true);
create policy schools_admin_write on public.schools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Associations : membres et administrateurs ; profil modifiable par le responsable (statut et IBAN verrouillés par déclencheur).
create policy associations_select on public.associations for select to authenticated
  using (public.is_association_member(id) or public.is_admin());
create policy associations_update on public.associations for update to authenticated
  using (public.is_association_manager(id) or public.is_admin())
  with check (public.is_association_manager(id) or public.is_admin());

create policy association_schools_select on public.association_schools for select to authenticated
  using (public.is_association_member(association_id) or public.is_admin()
         or public.household_of_association(association_id));
create policy association_schools_admin_write on public.association_schools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy association_members_select on public.association_members for select to authenticated
  using (public.is_association_member(association_id) or public.is_admin());
create policy association_members_delete on public.association_members for delete to authenticated
  using ((public.is_association_manager(association_id) and role = 'menu_editor') or public.is_admin());

create policy association_invitations_select on public.association_invitations for select to authenticated
  using (public.is_association_manager(association_id));
create policy association_invitations_insert on public.association_invitations for insert to authenticated
  with check (public.is_association_manager(association_id) and created_by = auth.uid() and accepted_at is null);
create policy association_invitations_delete on public.association_invitations for delete to authenticated
  using (public.is_association_manager(association_id) and accepted_at is null);

-- Enfants et écoles : le foyer lit et gère ; l'école doit appartenir à l'association du foyer.
create policy member_schools_select on public.member_schools for select to authenticated
  using (public.is_household_member(public.member_household(member_id)));
create policy member_schools_insert on public.member_schools for insert to authenticated
  with check (public.can_edit_household(public.member_household(member_id))
              and public.school_allowed_for_member(member_id, school_id));
create policy member_schools_update on public.member_schools for update to authenticated
  using (public.can_edit_household(public.member_household(member_id)))
  with check (public.can_edit_household(public.member_household(member_id))
              and public.school_allowed_for_member(member_id, school_id));
create policy member_schools_delete on public.member_schools for delete to authenticated
  using (public.can_edit_household(public.member_household(member_id)));

-- Menus d'école : familles = publiés de leurs écoles ; équipe d'une association liée = tous les menus de l'école
-- (le premier menu publié pour une date fait foi : les autres éditeurs le lisent sans pouvoir le modifier).
create policy school_menus_select_family on public.school_menus for select to authenticated
  using (status = 'published' and public.family_in_school(school_id));
create policy school_menus_select_editors on public.school_menus for select to authenticated
  using (public.reads_school_menus(school_id));
create policy school_menus_insert on public.school_menus for insert to authenticated
  with check (association_id is not null and public.can_edit_school(school_id, association_id));
create policy school_menus_update on public.school_menus for update to authenticated
  using (association_id is not null and public.can_edit_school(school_id, association_id))
  with check (association_id is not null and public.can_edit_school(school_id, association_id));
create policy school_menus_delete on public.school_menus for delete to authenticated
  using (status = 'draft' and association_id is not null and public.can_edit_school(school_id, association_id));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_household_member(household_id));

create policy payouts_select on public.payouts for select to authenticated
  using (public.is_association_manager(association_id));

create policy association_kits_select on public.association_kits for select to authenticated
  using (public.is_association_member(association_id));

-- Écriture des abonnements : clé de service uniquement.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.payouts from anon, authenticated;
revoke insert, update, delete on public.association_kits from anon, authenticated;
revoke insert, update, delete on public.associations from anon, authenticated;
grant update (name, rna_or_siren, email, manager_name, code) on public.associations to authenticated;
revoke all on public.associations, public.association_members, public.association_invitations,
  public.association_schools, public.schools, public.member_schools, public.school_menus,
  public.subscriptions, public.payouts, public.association_kits from anon;
