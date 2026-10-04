-- YG Hub tables. Read through row-level security (002), written only through the functions in 003.
-- Ids are text so the browser can make them up front: the screen updates instantly and the server's copy
-- lands on the same row. Every row that can change carries `rev`, bumped on each update, so the app can
-- tell a late echo of an older write from fresh data.

create schema if not exists private;

create function private.bump_rev() returns trigger language plpgsql set search_path = '' as $$
begin
  new.rev := old.rev + 1;
  return new;
end $$;

create table public.clients (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  name text not null check (length(trim(name)) between 1 and 200),
  industry text not null default '' check (length(industry) <= 200),
  city text not null default '' check (length(city) <= 200),
  contact text not null default '' check (length(contact) <= 200),
  email text not null default '' check (length(email) <= 320),
  phone text not null default '' check (length(phone) <= 40),
  created_at timestamptz not null default now(),
  rev int not null default 0
);

-- the studio's own notes about a client; clients never see this table
create table public.client_private (
  client_id text primary key references public.clients on delete cascade,
  notes text not null default '' check (length(notes) <= 10000),
  rev int not null default 0
);

create table public.people (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null unique check (length(email) <= 320),
  role text not null check (role in ('admin', 'member', 'client')),
  client_id text references public.clients on delete restrict,
  title text not null default '' check (length(title) <= 200),
  phone text not null default '' check (length(phone) <= 40),
  color text not null default '#e04c5c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rev int not null default 0,
  check ((role = 'client') = (client_id is not null))
);
create index on public.people (client_id);

create table public.projects (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  client_id text not null references public.clients on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  status text not null default 'planning' check (status in ('planning', 'active', 'review', 'hold', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  start date,
  due date,
  manager_id uuid references public.people on delete set null,
  member_ids uuid[] not null default '{}',
  brief text not null default '' check (length(brief) <= 10000),
  created_at date not null default current_date,
  rev int not null default 0,
  check (start is null or due is null or start <= due)
);
create index on public.projects (client_id);
create index on public.projects (manager_id);

-- what a client may see of a task (their read-only plan) ...
create table public.tasks (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  project_id text not null references public.projects on delete cascade,
  assignee_id uuid references public.people on delete set null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due date,
  title text not null check (length(trim(title)) between 1 and 300),
  created_by uuid references public.people on delete set null,
  created_at timestamptz not null default now(),
  completed_at date,
  rev int not null default 0
);
create index on public.tasks (project_id);
create index on public.tasks (assignee_id);
create index on public.tasks (created_by);

-- ... and the studio-only part: details, checklist, comments and handoff notes
create table public.task_private (
  task_id text primary key references public.tasks on delete cascade,
  "desc" text not null default '' check (length("desc") <= 20000),
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  comments jsonb not null default '[]' check (jsonb_typeof(comments) = 'array'),
  rev int not null default 0
);

create table public.deliverables (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  project_id text not null references public.projects on delete cascade,
  title text not null check (length(trim(title)) between 1 and 300),
  type text not null default 'Other' check (length(type) <= 40),
  link text not null check (link ~ '^https?://\S+$' and length(link) <= 2000),
  version int not null default 1,
  status text not null default 'internal' check (status in ('internal', 'changes', 'client', 'approved')),
  sent boolean not null default false,
  submitted_by uuid references public.people on delete set null,
  history jsonb not null default '[]' check (jsonb_typeof(history) = 'array'),
  created_at timestamptz not null default now(),
  rev int not null default 0
);
create index on public.deliverables (project_id);
create index on public.deliverables (submitted_by);

create table public.events (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  title text not null check (length(trim(title)) between 1 and 300),
  type text not null default 'meeting' check (type in ('meeting', 'client', 'shoot', 'review')),
  date date not null,
  start text not null check (start ~ '^\d\d:\d\d$'),
  "end" text not null check ("end" ~ '^\d\d:\d\d$'),
  repeat text not null default 'none' check (repeat in ('none', 'weekdays', 'weekly')),
  attendee_ids uuid[] not null default '{}',
  location text not null default '' check (length(location) <= 1000),
  agenda text not null default '' check (length(agenda) <= 5000),
  project_id text references public.projects on delete set null,
  created_by uuid references public.people on delete set null,
  rsvp jsonb not null default '{}' check (jsonb_typeof(rsvp) = 'object'),
  created_at timestamptz not null default now(),
  rev int not null default 0,
  check (start < "end")
);
create index on public.events (project_id);
create index on public.events (created_by);

create table public.channels (
  id text primary key check (length(id) <= 100),
  type text not null check (type in ('public', 'project', 'dm')),
  name text not null default '' check (length(name) <= 80),
  project_id text unique references public.projects on delete cascade,
  member_ids uuid[] not null default '{}',
  read_only boolean not null default false,
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  rev int not null default 0
);

create table public.messages (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  channel_id text not null references public.channels on delete cascade,
  user_id uuid references public.people on delete set null,
  text text not null check (length(text) between 1 and 4000),
  at timestamptz not null default now()
);
create index on public.messages (channel_id, at desc);
create index on public.messages (user_id);

-- when each person last read each channel (unread counts)
create table public.reads (
  user_id uuid not null references public.people on delete cascade,
  channel_id text not null references public.channels on delete cascade,
  at timestamptz not null default now(),
  primary key (user_id, channel_id)
);
create index on public.reads (channel_id);

create table public.posts (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  client_id text not null references public.clients on delete cascade,
  date date not null,
  time text not null default '19:00' check (time ~ '^\d\d:\d\d$'),
  platform text not null default 'Instagram' check (length(platform) <= 40),
  format text not null default 'Post' check (length(format) <= 40),
  title text not null check (length(trim(title)) between 1 and 300),
  status text not null default 'idea' check (status in ('idea', 'production', 'ready', 'scheduled', 'posted')),
  assignee_id uuid references public.people on delete set null,
  caption text not null default '' check (length(caption) <= 5000),
  notes jsonb not null default '[]' check (jsonb_typeof(notes) = 'array'),
  created_at timestamptz not null default now(),
  rev int not null default 0
);
create index on public.posts (client_id);
create index on public.posts (assignee_id);

create table public.activity (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.people on delete set null,
  text text not null,
  link text not null default '',
  at timestamptz not null default now()
);
create index on public.activity (at desc);
create index on public.activity (user_id);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.people on delete cascade,
  from_id uuid references public.people on delete set null,
  text text not null,
  link text not null default '',
  at timestamptz not null default now(),
  read boolean not null default false,
  rev int not null default 0
);
create index on public.notifications (user_id, at desc);
create index on public.notifications (from_id);

do $$
declare t text;
begin
  foreach t in array array['clients', 'client_private', 'people', 'projects', 'tasks', 'task_private', 'deliverables', 'events', 'channels', 'posts', 'notifications'] loop
    execute format('create trigger bump_rev before update on public.%I for each row execute function private.bump_rev()', t);
  end loop;
end $$;
