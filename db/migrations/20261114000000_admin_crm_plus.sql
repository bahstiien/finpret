-- CRM du back-office, suite : action créée depuis une demande, roadmap Notion synchronisée dans la todolist,
-- pipeline des prospects associations et étiquettes sur les comptes.

-- Une action peut venir d'une demande de contact ou d'une ligne de la roadmap Notion.
alter table public.admin_tasks
  add column contact_message_id bigint references public.contact_messages on delete set null,
  add column notion_page_id text unique,
  add column notion_url text,
  add column synced_at timestamptz;

-- Pipeline des prospects associations (remplace le simple « contacté oui/non », `contacted_at` reste renseigné).
alter table public.association_leads
  add column stage text not null default 'to_contact'
    check (stage in ('to_contact', 'contacted', 'presented', 'kit_sent', 'partner', 'lost')),
  add column stage_changed_at timestamptz,
  add column note text check (char_length(note) <= 2000);
update public.association_leads set stage = 'contacted', stage_changed_at = contacted_at where contacted_at is not null;
create index association_leads_stage_idx on public.association_leads (stage, created_at desc);

-- Étiquettes libres sur les comptes (ambassadeur, bêta-testeur, VIP, à risque…).
create table public.account_tags (
  user_id uuid not null references auth.users on delete cascade,
  tag text not null check (char_length(tag) between 1 and 30),
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);
create index account_tags_tag_idx on public.account_tags (tag);

-- Aucun accès client : lecture et écriture par le serveur uniquement (`service_role`).
alter table public.account_tags enable row level security;
revoke all on public.account_tags from anon, authenticated;
grant select, insert, update, delete on public.account_tags to service_role;
