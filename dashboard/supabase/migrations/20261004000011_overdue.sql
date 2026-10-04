-- Overdue work gets resolved, not ignored. A task's owner can't quietly move their own deadline: only a supervisor,
-- the project lead or whoever gave them the task can (the owner tells them if they need more time). Also: repeating
-- tasks (finishing one makes the next), ongoing (retainer) projects with no end date, and "Undelivered" for a post
-- that was promised and never went out.

alter table public.tasks add column repeat text not null default 'none' check (repeat in ('none', 'weekly', 'monthly'));
alter table public.projects add column ongoing boolean not null default false,
  add constraint projects_ongoing_no_due check (not ongoing or due is null);
alter table public.posts drop constraint posts_status_check,
  add constraint posts_status_check check (status in ('idea', 'production', 'ready', 'scheduled', 'posted', 'missed'));

-- who may set a task's due date: a supervisor, the project lead, or whoever gave it to someone else (never its owner)
create function private.sets_due(t public.tasks, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role = 'admin'
    or exists (select 1 from public.projects p where p.id = t.project_id and p.manager_id = u.id)
    or (t.created_by = u.id and t.assignee_id is distinct from u.id))
$$;
grant execute on function private.sets_due(public.tasks, public.people) to authenticated;

create or replace function public.save_task(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  tid text := nullif(p ->> 'id', '');
  old public.tasks;
  t public.tasks;
  nxt text;
  rep text;
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
  t.repeat := case when old.id is null or p ? 'repeat' then coalesce(nullif(p ->> 'repeat', ''), 'none') else old.repeat end;
  t.completed_at := case when t.status = 'done' then coalesce(old.completed_at, private.today()) end;

  perform private.need(length(t.title) > 0, 'Give the task a title.');
  perform private.need(t.project_id is not null, 'Pick the project.');
  perform private.need(t.project_id is not distinct from old.project_id or private.sees_project(t.project_id, me),
    'You can only add tasks to your own projects.');
  perform private.need(t.assignee_id is null or exists (select 1 from public.people where id = t.assignee_id and role <> 'client'),
    'Tasks can only go to YG team members.');
  perform private.need(old.id is null or t.due is not distinct from old.due or private.sets_due(old, me),
    'Only a supervisor, the project lead or whoever gave you this task can change its date. Tell them if you need more time.');
  perform private.need(t.repeat = 'none' or t.due is not null, 'A repeating task needs a due date.');

  -- finishing a repeating task makes the next one; the chain carries on from there
  if t.status = 'done' and old.status is distinct from 'done' and t.repeat <> 'none' then
    nxt := coalesce(nullif(p ->> 'nextId', ''), gen_random_uuid()::text);
    rep := t.repeat;
    t.repeat := 'none';
  end if;

  if old.id is null then
    insert into public.tasks (id, project_id, assignee_id, status, priority, due, title, dept, repeat, created_by, completed_at)
    values (t.id, t.project_id, t.assignee_id, t.status, t.priority, t.due, t.title, t.dept, t.repeat, me.id, t.completed_at)
    returning * into t;
    insert into public.task_private (task_id, "desc", checklist)
    values (t.id, coalesce(p ->> 'desc', ''), case when jsonb_typeof(p -> 'checklist') = 'array' then p -> 'checklist' else '[]' end);
  else
    update public.tasks set project_id = t.project_id, assignee_id = t.assignee_id, status = t.status, priority = t.priority,
      due = t.due, title = t.title, dept = t.dept, repeat = t.repeat, completed_at = t.completed_at
    where id = t.id
    returning * into t;
    if p ? 'desc' or p ? 'checklist' then
      update public.task_private set
        "desc" = case when p ? 'desc' then coalesce(p ->> 'desc', '') else "desc" end,
        checklist = case when jsonb_typeof(p -> 'checklist') = 'array' then p -> 'checklist' else checklist end
      where task_id = t.id;
    end if;
  end if;

  if nxt is not null then
    insert into public.tasks (id, project_id, assignee_id, status, priority, due, title, dept, repeat, created_by)
    values (nxt, t.project_id, t.assignee_id, 'todo', t.priority,
      case rep when 'weekly' then t.due + 7 else (t.due + interval '1 month')::date end,
      t.title, t.dept, rep, coalesce(old.created_by, me.id));
    insert into public.task_private (task_id, "desc", checklist)
    select nxt, x."desc", coalesce((select jsonb_agg(e || '{"done":false}' order by n) from jsonb_array_elements(x.checklist) with ordinality as c(e, n)), '[]')
    from public.task_private x where x.task_id = t.id;
  end if;

  lnk := '#/tasks/' || t.id;
  if t.assignee_id is not null and (old.id is null or old.assignee_id is distinct from t.assignee_id) then
    perform private.notify(me.id, array[t.assignee_id], 'gave you ' || private.q(t.title), lnk);
  end if;
  if old.id is not null and t.due is distinct from old.due and t.assignee_id is not null then
    perform private.notify(me.id, array[t.assignee_id], 'moved ' || private.q(t.title) || ' to ' || coalesce(private.fmt_day(t.due), 'no due date'), lnk);
  end if;
  if old.id is not null and old.status <> t.status then
    if t.status = 'review' then
      perform private.notify(me.id, private.admins() || (select manager_id from public.projects where id = t.project_id),
        private.q(t.title) || ' is ready to check', lnk);
    elsif t.status = 'done' then
      perform private.notify(me.id, array[t.created_by], 'finished ' || private.q(t.title), lnk);
    end if;
    perform private.log(me.id, 'moved ' || private.q(t.title) || ' to ' || private.task_label(t.status), lnk);
  else
    perform private.log(me.id, case when old.id is null then 'created ' else 'updated ' end || private.q(t.title), lnk);
  end if;
  return t.id;
end $$;

create or replace function public.save_project(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  pid text := nullif(p ->> 'id', '');
  old public.projects;
  t public.projects;
  lnk text;
  added uuid[];
begin
  select * into old from public.projects where id = pid for update;
  if old.id is null then
    perform private.need(me.role = 'admin', 'You don''t have permission to create projects.');
  else
    perform private.need(me.role = 'admin' or me.id = old.manager_id, 'You don''t have permission to edit this project.');
  end if;

  t.id := coalesce(old.id, pid, gen_random_uuid()::text);
  t.name := case when old.id is null or p ? 'name' then trim(coalesce(p ->> 'name', '')) else old.name end;
  t.client_id := case when old.id is null or p ? 'clientId' then nullif(p ->> 'clientId', '') else old.client_id end;
  t.status := case when p ? 'status' then p ->> 'status' else coalesce(old.status, 'planning') end;
  t.priority := case when p ? 'priority' then p ->> 'priority' else coalesce(old.priority, 'normal') end;
  t.start := case when old.id is null or p ? 'start' then nullif(p ->> 'start', '')::date else old.start end;
  t.ongoing := case when old.id is null or p ? 'ongoing' then coalesce((p ->> 'ongoing')::boolean, false) else old.ongoing end;
  t.due := case when t.ongoing then null when old.id is null or p ? 'due' then nullif(p ->> 'due', '')::date else old.due end;
  t.manager_id := case when old.id is null or p ? 'managerId' then nullif(p ->> 'managerId', '')::uuid else old.manager_id end;
  t.member_ids := case when old.id is null or p ? 'memberIds' then private.ids(p -> 'memberIds') else old.member_ids end;
  t.brief := case when old.id is null or p ? 'brief' then coalesce(p ->> 'brief', '') else old.brief end;

  perform private.need(length(t.name) > 0, 'Give the project a name.');
  perform private.need(t.client_id is not null, 'Pick the client.');
  perform private.need(t.start is null or t.due is null or t.start <= t.due, 'The due date is before the start date.');
  perform private.need(not exists (select 1 from unnest(t.member_ids || t.manager_id) x
    where x is not null and not exists (select 1 from public.people where id = x and role <> 'client')),
    'Only YG team members can lead or join a project.');

  lnk := '#/projects/' || t.id;
  if old.id is null then
    insert into public.projects (id, client_id, name, status, priority, start, due, ongoing, manager_id, member_ids, brief, created_at)
    values (t.id, t.client_id, t.name, t.status, t.priority, t.start, t.due, t.ongoing, t.manager_id, t.member_ids, t.brief, private.today());
    insert into public.channels (id, type, project_id, client_visible) values ('ch-' || t.id, 'project', t.id, true);
    perform private.notify(me.id, t.member_ids || t.manager_id, 'added you to the new project ' || private.q(t.name), lnk);
    perform private.log(me.id, 'started the project ' || private.q(t.name) || ' for '
      || coalesce((select name from public.clients where id = t.client_id), 'a client'), lnk);
    return t.id;
  end if;

  update public.projects set client_id = t.client_id, name = t.name, status = t.status, priority = t.priority, start = t.start,
    due = t.due, ongoing = t.ongoing, manager_id = t.manager_id, member_ids = t.member_ids, brief = t.brief
  where id = t.id;
  added := array(select x from unnest(t.manager_id || t.member_ids) x
    where x is not null and x is distinct from old.manager_id and not x = any (old.member_ids));
  perform private.notify(me.id, added, 'added you to the project ' || private.q(t.name), lnk);
  if old.status <> t.status then
    perform private.notify(me.id, t.member_ids || t.manager_id, 'marked ' || private.q(t.name) || ' ' || private.project_label(t.status), lnk);
    if t.status = 'done' then
      perform private.notify(me.id, private.client_users(t.client_id), 'marked ' || private.q(t.name) || ' as delivered', lnk);
    end if;
    perform private.log(me.id, 'marked ' || private.q(t.name) || ' ' || private.project_label(t.status), lnk);
  else
    perform private.log(me.id, 'updated the project ' || private.q(t.name), lnk);
  end if;
  return t.id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
