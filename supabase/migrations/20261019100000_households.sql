-- M1 : comptes, foyers, adhésions, invitations, rôles et RLS (SPEC §3, §4, §9).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.household_role as enum ('admin', 'member', 'viewer');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.household_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.household_role not null default 'member',
  token text unique not null default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users on delete set null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index invitations_household_idx on public.invitations (household_id);

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  active_household uuid references public.households on delete set null
);

create table public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  notifications jsonb not null default '{}'
);

-- Personnes qui mangent (adultes et enfants), avec ou sans compte. Complétées par l'onboarding (M4).
create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id uuid references auth.users on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('adult', 'child')),
  birthdate date,
  portion_override numeric check (portion_override is null or portion_override between 0 and 3),
  diet text,
  archived boolean not null default false
);
create index members_household_idx on public.members (household_id);

-- ---------------------------------------------------------------------------
-- Fonctions d'appartenance (security definer : évitent la récursion des politiques)
-- ---------------------------------------------------------------------------

create function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create function public.household_role_of(hid uuid)
returns public.household_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.memberships m
  where m.household_id = hid and m.user_id = auth.uid();
$$;

-- Peut modifier les données du foyer (menu, stock, session) : admin ou membre (§3).
create function public.can_edit_household(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.household_role_of(hid) in ('admin', 'member'), false);
$$;

create function public.is_household_admin(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.household_role_of(hid) = 'admin', false);
$$;

-- Deux comptes partagent-ils un foyer ? (lecture des profils des co-membres)
create function public.shares_household_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- Profil créé à l'inscription
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ), 60)
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Au moins un administrateur par foyer (§3)
-- ---------------------------------------------------------------------------

create function public.ensure_household_has_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Suppression en cascade du foyer : rien à protéger.
  if not exists (select 1 from public.households h where h.id = old.household_id) then
    return null;
  end if;
  if old.role = 'admin' and not exists (
    select 1 from public.memberships m
    where m.household_id = old.household_id and m.role = 'admin'
  ) then
    raise exception 'last_admin' using errcode = 'P0001',
      hint = 'Un foyer doit garder au moins un administrateur.';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_keep_admin
  after update or delete on public.memberships
  deferrable initially immediate
  for each row execute function public.ensure_household_has_admin();

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- TODO(spec) §16 Q4 : limites proposées (5 foyers par compte), à valider par le PO.
create function public.create_household(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships where user_id = uid) >= 5 then
    raise exception 'too_many_households' using errcode = 'P0001';
  end if;
  insert into public.households (name, created_by) values (btrim(p_name), uid) returning id into hid;
  insert into public.memberships (household_id, user_id, role) values (hid, uid, 'admin');
  update public.profiles set active_household = hid where user_id = uid;
  return hid;
end;
$$;

-- Aperçu d'une invitation à partir de son jeton (page /join/[token], avant connexion).
create function public.get_invitation(p_token text)
returns table (household_name text, role public.household_role, status text)
language sql stable security definer set search_path = ''
as $$
  select
    h.name,
    i.role,
    case
      when i.accepted_at is not null then 'used'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end
  from public.invitations i
  join public.households h on h.id = i.household_id
  where i.token = p_token;
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invitations;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.memberships where household_id = inv.household_id and user_id = uid
  ) then
    if (select count(*) from public.memberships where user_id = uid) >= 5 then
      raise exception 'too_many_households' using errcode = 'P0001';
    end if;
    insert into public.memberships (household_id, user_id, role) values (inv.household_id, uid, inv.role);
  end if;
  -- Déjà membre : on garde le rôle existant, l'invitation est quand même consommée.

  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.profiles set active_household = inv.household_id where user_id = uid;
  return inv.household_id;
end;
$$;

-- Quitter un foyer (le dernier administrateur ne peut pas partir).
create function public.leave_household(p_household uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.memberships where household_id = p_household and user_id = auth.uid();
$$;

revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.leave_household(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.members enable row level security;

-- Foyers : création par la RPC create_household uniquement.
create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated using (public.is_household_admin(id)) with check (public.is_household_admin(id));
create policy households_delete on public.households
  for delete to authenticated using (public.is_household_admin(id));

-- Adhésions : création par create_household / accept_invitation uniquement.
create policy memberships_select on public.memberships
  for select to authenticated using (public.is_household_member(household_id));
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));
create policy memberships_delete on public.memberships
  for delete to authenticated using (public.is_household_admin(household_id));

-- Invitations : gérées par les administrateurs ; les jetons ne sont visibles que d'eux.
create policy invitations_select on public.invitations
  for select to authenticated using (public.is_household_admin(household_id));
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.is_household_admin(household_id) and created_by = auth.uid() and accepted_at is null);
create policy invitations_delete on public.invitations
  for delete to authenticated using (public.is_household_admin(household_id) and accepted_at is null);

-- Profils : le sien, et ceux des personnes avec qui on partage un foyer.
create policy profiles_select on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.shares_household_with(user_id));
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (active_household is null or public.is_household_member(active_household))
  );

create policy user_settings_select on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy user_settings_update on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Membres du foyer : lecture pour tous, écriture par l'administrateur (§3 « Paramétrage du foyer, membres »).
create policy members_select on public.members
  for select to authenticated using (public.is_household_member(household_id));
create policy members_insert on public.members
  for insert to authenticated with check (public.is_household_admin(household_id));
create policy members_update on public.members
  for update to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));
create policy members_delete on public.members
  for delete to authenticated using (public.is_household_admin(household_id));

-- Colonnes modifiables : on ne change ni le foyer d'une adhésion, ni le propriétaire d'un profil.
revoke update on public.households, public.memberships, public.invitations, public.profiles,
  public.user_settings from authenticated;
grant update (name) on public.households to authenticated;
grant update (role) on public.memberships to authenticated;
grant update (display_name, active_household) on public.profiles to authenticated;
grant update (notifications) on public.user_settings to authenticated;
revoke insert on public.households, public.memberships, public.invitations, public.profiles,
  public.user_settings from authenticated;
-- Le jeton et l'expiration sont toujours générés par la base.
grant insert (household_id, email, role) on public.invitations to authenticated;

-- Le rôle anon n'a aucun accès direct aux tables.
revoke all on public.households, public.memberships, public.invitations, public.profiles,
  public.user_settings, public.members from anon;
