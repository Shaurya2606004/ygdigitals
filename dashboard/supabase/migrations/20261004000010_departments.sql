-- Departments: each person works in one (Video, Design, Social media, Websites, Packaging), and tasks and posts belong
-- to one. A team member sees their department's work plus anything they own, made, or lead — nothing else of the
-- studio. Admins and the "All" department (the PA) still see everything. Freelancers keep their own rule (009).
-- Also: the admin can delete a client and everything that belongs to them.

alter table public.people add column dept text not null default ''
  check (dept in ('', 'video', 'design', 'social', 'website', 'packaging', 'all'));
alter table public.tasks add column dept text not null default ''
  check (dept in ('', 'video', 'design', 'social', 'website', 'packaging'));
alter table public.posts add column dept text not null default ''
  check (dept in ('', 'video', 'design', 'social', 'website', 'packaging'));
create index on public.tasks (dept);

/* ---------- who sees what ---------- */

-- the whole studio: admins and anyone in the "All" department
create function private.sees_all() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' or (role = 'member' and dept = 'all') from public.people where id = (select auth.uid()) and active), false)
$$;

create function private.my_dept() returns text language sql stable security definer set search_path = '' as $$
  select dept from public.people where id = (select auth.uid()) and active
$$;

-- one task, one person: the single rule every task action checks (the read policy below is the same rule, set-based)
create function private.sees_task(t public.tasks, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role = 'admin'
    or (u.role = 'member' and (u.dept = 'all' or (t.dept <> '' and t.dept = u.dept) or t.assignee_id = u.id or t.created_by = u.id
      or exists (select 1 from public.projects p where p.id = t.project_id and p.manager_id = u.id)))
    or (u.role = 'freelancer' and (t.assignee_id = u.id
      or exists (select 1 from public.projects p where p.id = t.project_id and (p.manager_id = u.id or u.id = any (p.member_ids))))))
$$;

-- a project a member works in: they lead it, are on it, or own work in it
create function private.sees_project(pid text, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role = 'admin' or (u.role = 'member' and u.dept = 'all')
    or exists (select 1 from public.projects p where p.id = pid and (p.manager_id = u.id or u.id = any (p.member_ids)
      or (u.role = 'member' and exists (select 1 from public.tasks t where t.project_id = p.id and private.sees_task(t, u))))))
$$;

create function private.sees_post(s public.posts, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role = 'admin'
    or (u.role = 'member' and (u.dept in ('all', 'social') or (s.dept <> '' and s.dept = u.dept) or s.assignee_id = u.id)))
$$;

-- the caller's tasks and projects as a member (empty for everyone else), worked out once per query
create function private.member_tasks() returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.id), '{}') from (select private.me() u) me, public.tasks t
  where (me.u).role = 'member' and private.sees_task(t, me.u)
$$;
create function private.member_projects() returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.id), '{}') from (select private.me() u) me, public.projects p
  where (me.u).role = 'member' and (p.manager_id = (me.u).id or (me.u).id = any (p.member_ids)
    or p.id in (select t.project_id from public.tasks t where t.id = any ((select private.member_tasks())::text[])))
$$;

-- which department a deliverable's kind of work belongs to ('' = everyone on the project)
create function private.type_dept(type text) returns text language sql immutable set search_path = '' as $$
  select case type when 'Video' then 'video' when 'Photos' then 'video' when 'Design' then 'design'
    when 'Website' then 'website' when 'Listing' then 'website' when 'Copy' then 'social' else '' end
$$;

create or replace function private.sees_channel(c public.channels, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and case c.type
    when 'dm' then u.id = any (c.member_ids)
    when 'group' then u.role = 'admin' or (u.role in ('member', 'freelancer') and u.id = any (c.member_ids))
    when 'project' then (u.role in ('admin', 'member', 'freelancer') and private.sees_project(c.project_id, u))
      or (u.role = 'client' and c.client_visible and exists (select 1 from public.projects p where p.id = c.project_id and p.client_id = u.client_id))
    else u.role in ('admin', 'member')
  end
$$;

grant execute on all functions in schema private to authenticated;

drop policy read on public.clients;
create policy read on public.clients for select to authenticated using (
  (select private.sees_all()) or id = (select private.my_client())
  or id in (select client_id from public.projects where id in (select private.my_projects()))
  or ((select private.my_role()) = 'member' and (id in (select client_id from public.projects where id = any ((select private.member_projects())::text[]))
    or id in (select client_id from public.posts)))
);
drop policy read on public.client_private;
create policy read on public.client_private for select to authenticated using (
  (select private.sees_all()) or ((select private.my_role()) = 'member' and client_id in (select id from public.clients))
);
drop policy read on public.projects;
create policy read on public.projects for select to authenticated using (
  (select private.sees_all()) or client_id = (select private.my_client()) or id in (select private.my_projects())
  or id = any ((select private.member_projects())::text[])
);
drop policy read on public.tasks;
create policy read on public.tasks for select to authenticated using (
  (select private.sees_all()) or project_id in (select private.client_projects()) or project_id in (select private.my_projects())
  or ((select private.my_role()) = 'freelancer' and assignee_id = (select auth.uid()))
  or id = any ((select private.member_tasks())::text[])
);
drop policy read on public.task_private;
create policy read on public.task_private for select to authenticated using (
  (select private.sees_all()) or ((select private.my_role()) in ('member', 'freelancer') and task_id in (select id from public.tasks))
);
-- a member sees the work for approval in their projects that is their department's kind, theirs, or in a project they lead
drop policy read on public.deliverables;
create policy read on public.deliverables for select to authenticated using (
  (select private.sees_all()) or project_id in (select private.my_projects())
  or (project_id = any ((select private.member_projects())::text[]) and (submitted_by = (select auth.uid())
    or private.type_dept(type) in ('', (select private.my_dept()))
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = (select auth.uid()))))
  or (sent and project_id in (select private.client_projects()))
);
drop policy read on public.events;
create policy read on public.events for select to authenticated using (
  (select private.sees_all()) or (select auth.uid()) = any (attendee_ids) or created_by = (select auth.uid())
);
drop policy read on public.posts;
create policy read on public.posts for select to authenticated using (
  (select private.sees_all()) or client_id = (select private.my_client())
  or ((select private.my_role()) = 'member' and ((select private.my_dept()) = 'social' or (dept <> '' and dept = (select private.my_dept()))
    or assignee_id = (select auth.uid())))
);
drop policy read on public.activity;
create policy read on public.activity for select to authenticated using ((select private.sees_all()));

/* ---------- actions: a member only touches the work they can see ---------- */

create or replace function public.save_task(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  tid text := nullif(p ->> 'id', '');
  old public.tasks;
  t public.tasks;
  lnk text;
begin
  select * into old from public.tasks where id = tid for update;
  perform private.need(case when old.id is null then me.role in ('admin', 'member', 'freelancer') else private.sees_task(old, me) end,
    case when old.id is null then 'You don''t have permission to create tasks.' else 'You don''t have permission to edit this task.' end);

  t.id := coalesce(old.id, tid, gen_random_uuid()::text);
  t.project_id := case when old.id is null or p ? 'projectId' then nullif(p ->> 'projectId', '') else old.project_id end;
  t.assignee_id := case when old.id is null or p ? 'assigneeId' then nullif(p ->> 'assigneeId', '')::uuid else old.assignee_id end;
  t.status := case when p ? 'status' then p ->> 'status' else coalesce(old.status, 'todo') end;
  t.priority := case when p ? 'priority' then p ->> 'priority' else coalesce(old.priority, 'normal') end;
  t.due := case when old.id is null or p ? 'due' then nullif(p ->> 'due', '')::date else old.due end;
  t.title := case when old.id is null or p ? 'title' then trim(coalesce(p ->> 'title', '')) else old.title end;
  t.dept := case when old.id is null or p ? 'dept' then coalesce(p ->> 'dept', '') else old.dept end;
  t.completed_at := case when t.status = 'done' then coalesce(old.completed_at, private.today()) end;

  perform private.need(length(t.title) > 0, 'Give the task a title.');
  perform private.need(t.project_id is not null, 'Pick the project.');
  -- new work (or work moved to another project) only goes into a project you work in
  perform private.need(t.project_id is not distinct from old.project_id or private.sees_project(t.project_id, me),
    'You can only add tasks to your own projects.');
  perform private.need(t.assignee_id is null or exists (select 1 from public.people where id = t.assignee_id and role <> 'client'),
    'Tasks can only go to YG team members.');

  if old.id is null then
    insert into public.tasks (id, project_id, assignee_id, status, priority, due, title, dept, created_by, completed_at)
    values (t.id, t.project_id, t.assignee_id, t.status, t.priority, t.due, t.title, t.dept, me.id, t.completed_at)
    returning * into t;
    insert into public.task_private (task_id, "desc", checklist)
    values (t.id, coalesce(p ->> 'desc', ''), case when jsonb_typeof(p -> 'checklist') = 'array' then p -> 'checklist' else '[]' end);
  else
    update public.tasks set project_id = t.project_id, assignee_id = t.assignee_id, status = t.status, priority = t.priority,
      due = t.due, title = t.title, dept = t.dept, completed_at = t.completed_at
    where id = t.id
    returning * into t;
    if p ? 'desc' or p ? 'checklist' then
      update public.task_private set
        "desc" = case when p ? 'desc' then coalesce(p ->> 'desc', '') else "desc" end,
        checklist = case when jsonb_typeof(p -> 'checklist') = 'array' then p -> 'checklist' else checklist end
      where task_id = t.id;
    end if;
  end if;

  lnk := '#/tasks/' || t.id;
  if t.assignee_id is not null and (old.id is null or old.assignee_id is distinct from t.assignee_id) then
    perform private.notify(me.id, array[t.assignee_id], 'gave you ' || private.q(t.title), lnk);
  end if;
  if old.id is not null and old.status <> t.status then
    if t.status = 'review' then
      perform private.notify(me.id, private.admins() || (select manager_id from public.projects where id = t.project_id),
        private.q(t.title) || ' is ready for review', lnk);
    elsif t.status = 'done' then
      perform private.notify(me.id, array[t.created_by], 'finished ' || private.q(t.title), lnk);
    end if;
    perform private.log(me.id, 'moved ' || private.q(t.title) || ' to ' || private.task_label(t.status), lnk);
  else
    perform private.log(me.id, case when old.id is null then 'created ' else 'updated ' end || private.q(t.title), lnk);
  end if;
  return t.id;
end $$;

create or replace function public.handoff(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  t public.tasks;
  to_id uuid := nullif(p ->> 'toId', '')::uuid;
  note text := trim(coalesce(p ->> 'note', ''));
  from_name text;
  to_name text;
begin
  select * into t from public.tasks where id = p ->> 'id' for update;
  perform private.need(t.id is not null, 'This task no longer exists.');
  perform private.need(private.sees_task(t, me), 'You don''t have permission to hand off this task.');
  perform private.need(exists (select 1 from public.people where id = to_id and active and role <> 'client')
    and to_id is distinct from t.assignee_id, 'Pick who to hand it to.');
  from_name := case when t.assignee_id is null then 'Unassigned' else private.first_name(t.assignee_id) end;
  to_name := private.first_name(to_id);
  update public.tasks set assignee_id = to_id, status = 'todo', completed_at = null where id = t.id;
  update public.task_private set comments = comments || jsonb_build_array(jsonb_build_object(
    'id', coalesce(nullif(p ->> 'commentId', ''), gen_random_uuid()::text), 'userId', me.id, 'at', private.iso(),
    'text', note, 'handoff', from_name || ' → ' || to_name))
  where task_id = t.id;
  perform private.notify(me.id, array[to_id], 'handed you ' || private.q(t.title) || case when note <> '' then ': ' || note else '' end, '#/tasks/' || t.id);
  perform private.log(me.id, 'handed ' || private.q(t.title) || ' to ' || to_name, '#/tasks/' || t.id);
end $$;

create or replace function public.comment_task(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  t public.tasks;
  txt text := trim(coalesce(p ->> 'text', ''));
  tagged uuid[];
  lnk text;
begin
  perform private.need(length(txt) between 1 and 4000, 'Write a comment first.');
  select * into t from public.tasks where id = p ->> 'id';
  perform private.need(t.id is not null, 'This task no longer exists.');
  perform private.need(private.sees_task(t, me), 'You don''t have permission to comment on tasks.');
  update public.task_private set comments = comments || jsonb_build_array(jsonb_build_object(
    'id', coalesce(nullif(p ->> 'commentId', ''), gen_random_uuid()::text), 'userId', me.id, 'text', txt, 'at', private.iso()))
  where task_id = t.id;
  lnk := '#/tasks/' || t.id;
  -- only people who can open the task hear about it
  tagged := array(select u.id from public.people u where u.id = any (private.mentions(txt)) and private.sees_task(t, u));
  perform private.notify(me.id, tagged, 'mentioned you on ' || private.q(t.title) || ': ' || left(txt, 90), lnk);
  perform private.notify(me.id, array(select x from unnest(array[t.assignee_id, t.created_by]) x where not x = any (tagged)),
    'commented on ' || private.q(t.title) || ': ' || left(txt, 90), lnk);
end $$;

create or replace function public.check_item(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  perform private.need(exists (select 1 from public.tasks t where t.id = p ->> 'id' and private.sees_task(t, me)),
    'You don''t have permission to tick this checklist.');
  update public.task_private set checklist = coalesce((
    select jsonb_agg(case when e ->> 'id' = p ->> 'itemId' then jsonb_set(e, '{done}', to_jsonb(coalesce((p ->> 'done')::boolean, false))) else e end order by n)
    from jsonb_array_elements(checklist) with ordinality as x(e, n)), '[]')
  where task_id = p ->> 'id';
  perform private.need(found, 'This task no longer exists.');
end $$;

create or replace function public.delete_task(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  t public.tasks;
begin
  select * into t from public.tasks where id = p ->> 'id';
  perform private.need(t.id is not null, 'This task no longer exists.');
  perform private.need(me.role = 'admin' or (t.created_by = me.id and private.sees_task(t, me)), 'You don''t have permission to delete this task.');
  delete from public.tasks where id = t.id;
  perform private.log(me.id, 'deleted the task ' || private.q(t.title));
end $$;

create or replace function public.submit_deliverable(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  x public.deliverables;
  lnk text := coalesce(p ->> 'link', '');
  note text := coalesce(p ->> 'note', '');
  url text;
begin
  perform private.need(me.role in ('admin', 'member', 'freelancer'), 'You don''t have permission to submit work.');
  perform private.need(lnk ~ '^https?://\S+$', 'Paste a link to the file (Google Drive, Frame.io, Figma, the live site…).');
  select * into x from public.deliverables where id = p ->> 'id' for update;
  perform private.need(private.sees_project(coalesce(x.project_id, p ->> 'projectId'), me), 'You can only submit work for your own projects.');
  if x.id is not null then
    update public.deliverables set version = version + 1, link = lnk, status = 'internal', submitted_by = me.id,
      history = history || jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(), 'action', 'uploaded v' || (version + 1), 'note', note))
    where id = x.id
    returning * into x;
  else
    perform private.need(length(trim(coalesce(p ->> 'title', ''))) > 0, 'Name what you are submitting.');
    perform private.need(exists (select 1 from public.projects where id = p ->> 'projectId'), 'Pick the project.');
    insert into public.deliverables (id, project_id, title, type, link, submitted_by, history)
    values (coalesce(nullif(p ->> 'id', ''), gen_random_uuid()::text), p ->> 'projectId', trim(p ->> 'title'), coalesce(nullif(p ->> 'type', ''), 'Other'),
      lnk, me.id, jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(), 'action', 'submitted v1 for a check', 'note', note)))
    returning * into x;
  end if;
  url := '#/projects/' || x.project_id || '/deliverables';
  perform private.notify(me.id, private.admins(), 'submitted ' || private.q(x.title) || ' v' || x.version || ' for a check', url);
  perform private.log(me.id, 'submitted ' || private.q(x.title) || ' v' || x.version || ' for a check', url);
  return x.id;
end $$;

create or replace function public.save_post(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  sid text := nullif(p ->> 'id', '');
  old public.posts;
  s public.posts;
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to plan content.');
  select * into old from public.posts where id = sid for update;
  perform private.need(old.id is null or private.sees_post(old, me), 'You don''t have permission to change this post.');
  s.id := coalesce(old.id, sid, gen_random_uuid()::text);
  s.client_id := case when old.id is null or p ? 'clientId' then nullif(p ->> 'clientId', '') else old.client_id end;
  s.date := case when old.id is null or p ? 'date' then nullif(p ->> 'date', '')::date else old.date end;
  s.time := case when p ? 'time' then coalesce(nullif(p ->> 'time', ''), '19:00') else coalesce(old.time, '19:00') end;
  s.platform := case when p ? 'platform' then p ->> 'platform' else coalesce(old.platform, 'Instagram') end;
  s.format := case when p ? 'format' then p ->> 'format' else coalesce(old.format, 'Post') end;
  s.title := case when old.id is null or p ? 'title' then trim(coalesce(p ->> 'title', '')) else old.title end;
  s.status := case when p ? 'status' then p ->> 'status' else coalesce(old.status, 'idea') end;
  s.assignee_id := case when old.id is null or p ? 'assigneeId' then nullif(p ->> 'assigneeId', '')::uuid else old.assignee_id end;
  s.caption := case when old.id is null or p ? 'caption' then coalesce(p ->> 'caption', '') else old.caption end;
  s.dept := case when old.id is null or p ? 'dept' then coalesce(p ->> 'dept', '') else old.dept end;

  perform private.need(length(s.title) > 0, 'Give the post a working title or hook.');
  perform private.need(s.client_id is not null and s.date is not null, 'Pick the client and the day it goes out.');

  if old.id is null then
    insert into public.posts (id, client_id, date, time, platform, format, title, status, assignee_id, caption, dept)
    values (s.id, s.client_id, s.date, s.time, s.platform, s.format, s.title, s.status, s.assignee_id, s.caption, s.dept);
  else
    update public.posts set client_id = s.client_id, date = s.date, time = s.time, platform = s.platform, format = s.format,
      title = s.title, status = s.status, assignee_id = s.assignee_id, caption = s.caption, dept = s.dept
    where id = s.id;
  end if;
  if s.assignee_id is not null and (old.id is null or old.assignee_id is distinct from s.assignee_id) then
    perform private.notify(me.id, array[s.assignee_id], 'gave you the ' || s.format || ' ' || private.q(s.title) || ' (' || private.fmt_day(s.date) || ')', '#/content');
  end if;
  if s.status = 'ready' and old.status is distinct from 'ready' then
    perform private.notify(me.id, private.client_users(s.client_id), 'has a ' || s.format || ' ready for your approval: ' || private.q(s.title), '#/content');
  end if;
  perform private.log(me.id, case when old.id is null then 'planned' else 'updated' end || ' the ' || s.format || ' ' || private.q(s.title) || ' for '
    || coalesce((select name from public.clients where id = s.client_id), 'a client'), '#/content');
  return s.id;
end $$;

create or replace function public.decide_post(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  s public.posts;
  ok boolean := coalesce((p ->> 'approve')::boolean, false);
  note text := trim(coalesce(p ->> 'note', ''));
begin
  select * into s from public.posts where id = p ->> 'id' for update;
  perform private.need(s.id is not null and (private.sees_post(s, me) or (me.role = 'client' and me.client_id = s.client_id)),
    'You don''t have permission to approve this post.');
  perform private.need(ok or note <> '', 'Say what to change.');
  update public.posts set status = case when ok then 'scheduled' else 'production' end,
    notes = notes || jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(),
      'text', case when ok then 'Approved' || case when note <> '' then ': ' || note else '' end else 'Changes: ' || note end))
  where id = s.id;
  perform private.notify(me.id, s.assignee_id || private.admins(),
    case when ok then 'approved the ' || s.format || ' ' || private.q(s.title) else 'asked for changes on ' || private.q(s.title) || ': ' || note end, '#/content');
  perform private.log(me.id, case when ok then 'approved the ' || s.format || ' ' || private.q(s.title)
    else 'asked for changes on ' || private.q(s.title) end, '#/content');
end $$;

create or replace function public.delete_post(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  perform private.need(exists (select 1 from public.posts s where s.id = p ->> 'id' and private.sees_post(s, me)), 'You don''t have permission to delete posts.');
  delete from public.posts where id = p ->> 'id';
end $$;

/* ---------- delete a client ---------- */

-- the client, their projects (with every task, piece of work and project chat), their posts and their logins.
-- Meetings stay on the calendar, just no longer linked to a project.
create function public.delete_client(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  c public.clients;
begin
  perform private.need(me.role = 'admin', 'You don''t have permission to delete clients.');
  select * into c from public.clients where id = p ->> 'id' for update;
  perform private.need(c.id is not null, 'This client no longer exists.');
  perform private.need(lower(trim(coalesce(p ->> 'confirm', ''))) = lower(c.name), 'Type the client’s name exactly to confirm.');
  delete from auth.users where id in (select id from public.people where client_id = c.id); -- their logins (and people rows) go too
  delete from public.projects where client_id = c.id;
  delete from public.clients where id = c.id;
  perform private.log(me.id, 'deleted the client ' || c.name || ' and all their work', '#/settings/clients');
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
