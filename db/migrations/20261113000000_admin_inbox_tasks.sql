-- Back-office : les messages du formulaire de contact sont conservés (en plus de l'e-mail à l'équipe) pour être
-- traités dans le CRM, et une liste d'actions internes (dev, marketing, réseaux sociaux) sert de todolist.

create table public.contact_messages (
  id bigint generated always as identity primary key,
  audience text not null check (audience in ('famille', 'asso')),
  name text not null check (char_length(name) between 1 and 60),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) <= 120),
  message text not null check (char_length(message) <= 2000),
  association text check (char_length(association) <= 120),
  school text check (char_length(school) <= 160),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'spam')),
  note text check (char_length(note) <= 2000),
  handled_by uuid references auth.users on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index contact_messages_email_idx on public.contact_messages (lower(email));

create table public.admin_tasks (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 160),
  details text check (char_length(details) <= 2000),
  category text not null check (category in ('dev', 'marketing', 'social')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_on date,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index admin_tasks_status_idx on public.admin_tasks (status, due_on);

-- Aucun accès client : lecture et écriture par le serveur uniquement (`service_role`).
alter table public.contact_messages enable row level security;
alter table public.admin_tasks enable row level security;
revoke all on public.contact_messages, public.admin_tasks from anon, authenticated;
revoke all on sequence public.contact_messages_id_seq, public.admin_tasks_id_seq from anon, authenticated;
grant select, insert, update, delete on public.contact_messages, public.admin_tasks to service_role;
grant usage on sequence public.contact_messages_id_seq, public.admin_tasks_id_seq to service_role;
