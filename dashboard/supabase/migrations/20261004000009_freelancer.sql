-- Freelancers: people who work on some projects without seeing the rest of the studio. A freelancer sees the
-- projects they lead or are on, those projects' clients, tasks, work for approval and discussions, any task handed
-- to them, meetings they're invited to, and their own DMs and groups. Not other projects, the company channels,
-- the content plan, the activity log or the studio's notes about clients.

alter table public.people drop constraint people_role_check,
  add constraint people_role_check check (role in ('admin', 'member', 'freelancer', 'client'));

/* ---------- who sees what ---------- */

-- the projects a freelancer is on (nothing for anyone else: the team already sees every project)
create function private.my_projects() returns setof text language sql stable security definer set search_path = '' as $$
  select id from public.projects
  where (select private.my_role()) = 'freelancer' and (manager_id = (select auth.uid()) or (select auth.uid()) = any (member_ids))
$$;

-- may this person work on a task in this project (or on this task, when it was handed to them)? The whole team
-- can; a freelancer only in projects they lead or are on, or on a task handed to them
create function private.on_task(pid text, assignee uuid, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role in ('admin', 'member') or (u.role = 'freelancer' and (assignee = u.id
    or exists (select 1 from public.projects p where p.id = pid and (p.manager_id = u.id or u.id = any (p.member_ids))))))
$$;

create or replace function private.sees_channel(c public.channels, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and case c.type
    when 'dm' then u.id = any (c.member_ids)
    when 'group' then u.role = 'admin' or (u.role in ('member', 'freelancer') and u.id = any (c.member_ids))
    when 'project' then u.role in ('admin', 'member')
      or (u.role = 'freelancer' and exists (select 1 from public.projects p where p.id = c.project_id and (p.manager_id = u.id or u.id = any (p.member_ids))))
      or (u.role = 'client' and c.client_visible and exists (select 1 from public.projects p where p.id = c.project_id and p.client_id = u.client_id))
    else u.role in ('admin', 'member')
  end
$$;

-- "everyone on the team" for notifications (announcements): the people who can read the company channels
create or replace function private.staff() returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.people where role in ('admin', 'member') and active
$$;

grant execute on all functions in schema private to authenticated;

drop policy read on public.people;
create policy read on public.people for select to authenticated using (
  (select private.is_staff())
  or ((select private.my_role()) = 'client' and (role <> 'client' or client_id = (select private.my_client())))
  or ((select private.my_role()) = 'freelancer' and (role <> 'client'
    or client_id in (select client_id from public.projects where id in (select private.my_projects()))))
);
drop policy read on public.clients;
create policy read on public.clients for select to authenticated using (
  (select private.is_staff()) or id = (select private.my_client())
  or id in (select client_id from public.projects where id in (select private.my_projects()))
);
drop policy read on public.projects;
create policy read on public.projects for select to authenticated using (
  (select private.is_staff()) or client_id = (select private.my_client()) or id in (select private.my_projects())
);
drop policy read on public.tasks;
create policy read on public.tasks for select to authenticated using (
  (select private.is_staff()) or project_id in (select private.client_projects()) or project_id in (select private.my_projects())
  or ((select private.my_role()) = 'freelancer' and assignee_id = (select auth.uid()))
);
drop policy read on public.task_private;
create policy read on public.task_private for select to authenticated using (
  (select private.is_staff()) or ((select private.my_role()) = 'freelancer' and task_id in (select id from public.tasks))
);
drop policy read on public.deliverables;
create policy read on public.deliverables for select to authenticated using (
  (select private.is_staff()) or project_id in (select private.my_projects())
  or (sent and project_id in (select private.client_projects()))
);
drop policy read on public.events;
create policy read on public.events for select to authenticated using (
  (select private.is_staff())
  or ((select private.my_role()) in ('client', 'freelancer') and ((select auth.uid()) = any (attendee_ids) or created_by = (select auth.uid())))
);

/* ---------- actions: freelancers only touch work in their own projects ---------- */

create or replace function public.save_task(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  tid text := nullif(p ->> 'id', '');
  old public.tasks;
  t public.tasks;
  lnk text;
begin
  select * into old from public.tasks where id = tid for update;
  perform private.need(old.id is null and me.role in ('admin', 'member', 'freelancer') or private.on_task(old.project_id, old.assignee_id, me),
    case when old.id is null then 'You don''t have permission to create tasks.' else 'You don''t have permission to edit this task.' end);

  t.id := coalesce(old.id, tid, gen_random_uuid()::text);
  t.project_id := case when old.id is null or p ? 'projectId' then nullif(p ->> 'projectId', '') else old.project_id end;
  t.assignee_id := case when old.id is null or p ? 'assigneeId' then nullif(p ->> 'assigneeId', '')::uuid else old.assignee_id end;
  t.status := case when p ? 'status' then p ->> 'status' else coalesce(old.status, 'todo') end;
  t.priority := case when p ? 'priority' then p ->> 'priority' else coalesce(old.priority, 'normal') end;
  t.due := case when old.id is null or p ? 'due' then nullif(p ->> 'due', '')::date else old.due end;
  t.title := case when old.id is null or p ? 'title' then trim(coalesce(p ->> 'title', '')) else old.title end;
  t.completed_at := case when t.status = 'done' then coalesce(old.completed_at, private.today()) end;

  perform private.need(length(t.title) > 0, 'Give the task a title.');
  perform private.need(t.project_id is not null, 'Pick the project.');
  -- a freelancer only adds tasks to (or moves them into) projects they're on
  perform private.need(private.on_task(t.project_id, case when t.project_id = old.project_id then old.assignee_id end, me),
    'You can only add tasks to your own projects.');
  perform private.need(t.assignee_id is null or exists (select 1 from public.people where id = t.assignee_id and role <> 'client'),
    'Tasks can only go to YG team members.');

  if old.id is null then
    insert into public.tasks (id, project_id, assignee_id, status, priority, due, title, created_by, completed_at)
    values (t.id, t.project_id, t.assignee_id, t.status, t.priority, t.due, t.title, me.id, t.completed_at)
    returning * into t;
    insert into public.task_private (task_id, "desc", checklist)
    values (t.id, coalesce(p ->> 'desc', ''), case when jsonb_typeof(p -> 'checklist') = 'array' then p -> 'checklist' else '[]' end);
  else
    update public.tasks set project_id = t.project_id, assignee_id = t.assignee_id, status = t.status, priority = t.priority,
      due = t.due, title = t.title, completed_at = t.completed_at
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
  perform private.need(private.on_task(t.project_id, t.assignee_id, me), 'You don''t have permission to hand off this task.');
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
  perform private.need(private.on_task(t.project_id, t.assignee_id, me), 'You don''t have permission to comment on tasks.');
  update public.task_private set comments = comments || jsonb_build_array(jsonb_build_object(
    'id', coalesce(nullif(p ->> 'commentId', ''), gen_random_uuid()::text), 'userId', me.id, 'text', txt, 'at', private.iso()))
  where task_id = t.id;
  lnk := '#/tasks/' || t.id;
  tagged := private.mentions(txt);
  perform private.notify(me.id, tagged, 'mentioned you on ' || private.q(t.title) || ': ' || left(txt, 90), lnk);
  perform private.notify(me.id, array(select x from unnest(array[t.assignee_id, t.created_by]) x where not x = any (tagged)),
    'commented on ' || private.q(t.title) || ': ' || left(txt, 90), lnk);
end $$;

create or replace function public.check_item(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  perform private.need(exists (select 1 from public.tasks t where t.id = p ->> 'id' and private.on_task(t.project_id, t.assignee_id, me)),
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
  perform private.need(me.role = 'admin' or (t.created_by = me.id and private.on_task(t.project_id, t.assignee_id, me)), 'You don''t have permission to delete this task.');
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
  perform private.need(private.on_task(coalesce(x.project_id, p ->> 'projectId'), null, me), 'You can only submit work for your own projects.');
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

create or replace function public.save_group(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  gid text := nullif(p ->> 'id', '');
  g public.channels;
  nm text;
  ids uuid[];
  added uuid[];
  gone uuid[];
begin
  perform private.need(me.role in ('admin', 'member', 'freelancer'), 'You don''t have permission to create groups.');
  select * into g from public.channels where id = gid and type = 'group';
  perform private.need(g.id is null or me.id = any (g.member_ids), 'Only the people in a group can change it.');
  nm := case when p ? 'name' or g.id is null then trim(coalesce(p ->> 'name', '')) else g.name end;
  perform private.need(length(nm) between 1 and 80, 'Give the group a name (up to 80 characters).');
  ids := case when p ? 'memberIds' or g.id is null
    then array(select id from public.people where id = any (private.ids(p -> 'memberIds') || me.id) and role <> 'client' and active)
    else g.member_ids end;
  perform private.need(cardinality(ids) >= 2, 'Add at least one other person.');

  if g.id is null then
    perform private.need(gid ~ '^grp-[0-9a-f-]{36}$', 'That group id is not valid.');
    insert into public.channels (id, type, name, member_ids) values (gid, 'group', nm, ids);
    perform private.system_line(gid, me.id, 'created the group');
    perform private.notify(me.id, ids, 'added you to the group ' || private.q(nm), '#/chat/' || gid);
    return gid;
  end if;

  added := array(select unnest(ids) except select unnest(g.member_ids));
  gone := array(select unnest(g.member_ids) except select unnest(ids));
  update public.channels set name = nm, member_ids = ids where id = gid;
  if nm <> g.name then
    perform private.system_line(gid, me.id, 'renamed the group to ' || private.q(nm));
  end if;
  if cardinality(added) > 0 then
    perform private.system_line(gid, me.id, 'added ' || private.names(added));
    perform private.notify(me.id, added, 'added you to the group ' || private.q(nm), '#/chat/' || gid);
  end if;
  if cardinality(gone) > 0 then
    perform private.system_line(gid, me.id, 'removed ' || private.names(gone));
    perform private.notify(me.id, gone, 'removed you from the group ' || private.q(nm), '#/chat/' || gid);
  end if;
  return gid;
end $$;
