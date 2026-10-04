-- Who can read what — the server-side twin of can() in src/store.js. Nobody can write a table directly;
-- every change goes through a function in 003 that checks the same rules.
-- Helpers are security definer (so policies don't loop through people's own policy) and policies call them
-- as (select private.fn()) so Postgres runs each once per query, not once per row.

grant usage on schema private to authenticated;

-- the signed-in person, only while their login is active
create function private.me() returns public.people language sql stable security definer set search_path = '' as $$
  select * from public.people where id = (select auth.uid()) and active
$$;

create function private.my_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.people where id = (select auth.uid()) and active
$$;

create function private.my_client() returns text language sql stable security definer set search_path = '' as $$
  select client_id from public.people where id = (select auth.uid()) and active and role = 'client'
$$;

create function private.is_staff() returns boolean language sql stable set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'member'), false)
$$;

create function private.client_projects() returns setof text language sql stable security definer set search_path = '' as $$
  select id from public.projects where client_id = (select private.my_client())
$$;

-- one rule for channels, used by the policy below and by send_message / mentions in 003
create function private.sees_channel(c public.channels, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and case c.type
    when 'dm' then u.id = any (c.member_ids)
    when 'project' then u.role <> 'client'
      or (c.client_visible and exists (select 1 from public.projects p where p.id = c.project_id and p.client_id = u.client_id))
    else u.role <> 'client'
  end
$$;

alter table public.clients enable row level security;
alter table public.client_private enable row level security;
alter table public.people enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_private enable row level security;
alter table public.deliverables enable row level security;
alter table public.events enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.reads enable row level security;
alter table public.posts enable row level security;
alter table public.activity enable row level security;
alter table public.notifications enable row level security;

-- clients see the studio team and their own company's logins, never another client's people
create policy read on public.people for select to authenticated using (
  (select private.is_staff())
  or ((select private.my_role()) = 'client' and (role <> 'client' or client_id = (select private.my_client())))
);
create policy read on public.clients for select to authenticated using ((select private.is_staff()) or id = (select private.my_client()));
create policy read on public.client_private for select to authenticated using ((select private.is_staff()));
create policy read on public.projects for select to authenticated using ((select private.is_staff()) or client_id = (select private.my_client()));
create policy read on public.tasks for select to authenticated using ((select private.is_staff()) or project_id in (select private.client_projects()));
create policy read on public.task_private for select to authenticated using ((select private.is_staff()));
-- clients only see work once the admin has checked it and sent it
create policy read on public.deliverables for select to authenticated using (
  (select private.is_staff()) or (sent and project_id in (select private.client_projects()))
);
create policy read on public.events for select to authenticated using (
  (select private.is_staff()) or ((select private.my_role()) = 'client' and (select auth.uid()) = any (attendee_ids))
);
create policy read on public.channels for select to authenticated using (private.sees_channel(channels, (select private.me())));
create policy read on public.messages for select to authenticated using (channel_id in (select id from public.channels));
create policy read on public.reads for select to authenticated using (user_id = (select auth.uid()));
create policy read on public.posts for select to authenticated using ((select private.is_staff()) or client_id = (select private.my_client()));
create policy read on public.activity for select to authenticated using ((select private.is_staff()));
create policy read on public.notifications for select to authenticated using (user_id = (select auth.uid()));

-- reads only, and only for signed-in people; the service role (edge functions) keeps full access
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
