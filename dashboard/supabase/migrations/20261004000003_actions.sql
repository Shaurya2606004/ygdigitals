-- Every change the app makes, one function per action, mirroring the actions in src/store.js (same checks,
-- same notification texts). Each runs in one transaction: the change, its notifications and its activity
-- line land together or not at all. Arguments arrive as one jsonb object shaped like the app's own records
-- (camelCase keys). On edits, only the keys that are present change, so two people editing different
-- fields of the same record never overwrite each other.
-- Adding people and logins needs the auth admin API, so that lives in the `people` edge function instead.

/* ---------- small helpers ---------- */

create function private.need(ok boolean, msg text) returns void language plpgsql set search_path = '' as $$
begin
  if ok is not true then
    raise exception using message = msg, errcode = 'P0001';
  end if;
end $$;

-- the studio works in India: "today" is the IST date, not the server's UTC one
create function private.today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- timestamps inside jsonb in exactly the format the browser writes (Date.toISOString), so they sort as text
create function private.iso(t timestamptz default now()) returns text language sql stable set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create function private.ids(j jsonb) returns uuid[] language sql immutable set search_path = '' as $$
  select coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]' end)::uuid), '{}')
$$;

create function private.q(t text) returns text language sql immutable set search_path = '' as $$
  select '“' || t || '”'
$$;

-- 'Sat, 4 Oct' and '3 pm' / '3:30 pm', like fmtDay / fmtTime in src/util.js
create function private.fmt_day(d date) returns text language sql immutable set search_path = '' as $$
  select to_char(d, 'Dy, FMDD Mon')
$$;

create function private.fmt_time(hm text) returns text language sql immutable set search_path = '' as $$
  select (case when h % 12 = 0 then 12 else h % 12 end)::text
    || case when m > 0 then ':' || lpad(m::text, 2, '0') else '' end
    || case when h < 12 then ' am' else ' pm' end
  from (select split_part(hm, ':', 1)::int as h, split_part(hm, ':', 2)::int as m) x
$$;

create function private.task_label(s text) returns text language sql immutable set search_path = '' as $$
  select '{"todo":"To do","doing":"In progress","review":"Review","done":"Done"}'::jsonb ->> s
$$;

create function private.project_label(s text) returns text language sql immutable set search_path = '' as $$
  select '{"planning":"Planning","active":"In progress","review":"Client review","hold":"On hold","done":"Delivered"}'::jsonb ->> s
$$;

create function private.first_name(id uuid) returns text language sql stable set search_path = '' as $$
  select coalesce((select split_part(name, ' ', 1) from public.people where people.id = first_name.id), 'Someone')
$$;

create function private.admins() returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.people where role = 'admin' and active
$$;

create function private.staff() returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.people where role <> 'client' and active
$$;

create function private.client_users(cid text) returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.people where role = 'client' and active and client_id = cid
$$;

-- active people tagged as @FirstName (case-insensitive, whole word)
create function private.mentions(txt text) returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.people
  where active and txt ~* ('@' || regexp_replace(split_part(name, ' ', 1), '([^[:alnum:]_])', '\\\1', 'g') || '\y')
$$;

create function private.log(who uuid, txt text, lnk text default '') returns void language sql set search_path = '' as $$
  insert into public.activity (user_id, text, link) values (who, txt, lnk)
$$;

-- one notification per distinct active person, never to yourself
create function private.notify(who uuid, ids uuid[], txt text, lnk text default '') returns void language sql set search_path = '' as $$
  insert into public.notifications (user_id, from_id, text, link)
  select p.id, who, txt, lnk from public.people p where p.id = any (ids) and p.id <> who and p.active
$$;

/* ---------- clients ---------- */

create function public.save_client(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  cid text := nullif(p ->> 'id', '');
  nm text := trim(coalesce(p ->> 'name', ''));
  existed boolean;
begin
  perform private.need(me.role = 'admin', 'You don''t have permission to manage clients.');
  existed := exists (select 1 from public.clients where id = cid);
  if existed then
    select case when p ? 'name' then nm else name end into nm from public.clients where id = cid;
  end if;
  perform private.need(length(nm) > 0, 'Add the client’s business name.');
  if existed then
    update public.clients set
      name = nm,
      industry = case when p ? 'industry' then coalesce(p ->> 'industry', '') else industry end,
      city = case when p ? 'city' then coalesce(p ->> 'city', '') else city end,
      contact = case when p ? 'contact' then coalesce(p ->> 'contact', '') else contact end,
      email = case when p ? 'email' then coalesce(p ->> 'email', '') else email end,
      phone = case when p ? 'phone' then coalesce(p ->> 'phone', '') else phone end
    where id = cid;
    if p ? 'notes' then
      update public.client_private set notes = coalesce(p ->> 'notes', '') where client_id = cid;
    end if;
  else
    insert into public.clients (id, name, industry, city, contact, email, phone)
    values (coalesce(cid, gen_random_uuid()::text), nm, coalesce(p ->> 'industry', ''), coalesce(p ->> 'city', ''),
      coalesce(p ->> 'contact', ''), coalesce(p ->> 'email', ''), coalesce(p ->> 'phone', ''))
    returning id into cid;
    insert into public.client_private (client_id, notes) values (cid, coalesce(p ->> 'notes', ''));
  end if;
  perform private.log(me.id, case when existed then 'updated ' else 'added the client ' end || nm, '#/settings/clients');
  return cid;
end $$;

/* ---------- projects ---------- */

create function public.save_project(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
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
  t.due := case when old.id is null or p ? 'due' then nullif(p ->> 'due', '')::date else old.due end;
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
    insert into public.projects (id, client_id, name, status, priority, start, due, manager_id, member_ids, brief, created_at)
    values (t.id, t.client_id, t.name, t.status, t.priority, t.start, t.due, t.manager_id, t.member_ids, t.brief, private.today());
    insert into public.channels (id, type, project_id, client_visible) values ('ch-' || t.id, 'project', t.id, true);
    perform private.notify(me.id, t.member_ids || t.manager_id, 'added you to the new project ' || private.q(t.name), lnk);
    perform private.log(me.id, 'started the project ' || private.q(t.name) || ' for '
      || coalesce((select name from public.clients where id = t.client_id), 'a client'), lnk);
    return t.id;
  end if;

  update public.projects set client_id = t.client_id, name = t.name, status = t.status, priority = t.priority, start = t.start,
    due = t.due, manager_id = t.manager_id, member_ids = t.member_ids, brief = t.brief
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

/* ---------- tasks ---------- */

create function public.save_task(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  tid text := nullif(p ->> 'id', '');
  old public.tasks;
  t public.tasks;
  lnk text;
begin
  select * into old from public.tasks where id = tid for update;
  perform private.need(me.role in ('admin', 'member'), case when old.id is null
    then 'You don''t have permission to create tasks.' else 'You don''t have permission to edit this task.' end);

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

-- pass work on with a note: they own it now, it starts again at To do, and the note stays on the task
create function public.handoff(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  t public.tasks;
  to_id uuid := nullif(p ->> 'toId', '')::uuid;
  note text := trim(coalesce(p ->> 'note', ''));
  from_name text;
  to_name text;
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to hand off this task.');
  select * into t from public.tasks where id = p ->> 'id' for update;
  perform private.need(t.id is not null, 'This task no longer exists.');
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

create function public.comment_task(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  t public.tasks;
  txt text := trim(coalesce(p ->> 'text', ''));
  tagged uuid[];
  lnk text;
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to comment on tasks.');
  perform private.need(length(txt) between 1 and 4000, 'Write a comment first.');
  select * into t from public.tasks where id = p ->> 'id';
  perform private.need(t.id is not null, 'This task no longer exists.');
  update public.task_private set comments = comments || jsonb_build_array(jsonb_build_object(
    'id', coalesce(nullif(p ->> 'commentId', ''), gen_random_uuid()::text), 'userId', me.id, 'text', txt, 'at', private.iso()))
  where task_id = t.id;
  lnk := '#/tasks/' || t.id;
  tagged := private.mentions(txt);
  perform private.notify(me.id, tagged, 'mentioned you on ' || private.q(t.title) || ': ' || left(txt, 90), lnk);
  perform private.notify(me.id, array(select x from unnest(array[t.assignee_id, t.created_by]) x where not x = any (tagged)),
    'commented on ' || private.q(t.title) || ': ' || left(txt, 90), lnk);
end $$;

-- sets the item to the state the person saw it change to (not a blind toggle), so two clicks never cancel out
create function public.check_item(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to tick this checklist.');
  update public.task_private set checklist = coalesce((
    select jsonb_agg(case when e ->> 'id' = p ->> 'itemId' then jsonb_set(e, '{done}', to_jsonb(coalesce((p ->> 'done')::boolean, false))) else e end order by n)
    from jsonb_array_elements(checklist) with ordinality as x(e, n)), '[]')
  where task_id = p ->> 'id';
  perform private.need(found, 'This task no longer exists.');
end $$;

create function public.delete_task(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  t public.tasks;
begin
  select * into t from public.tasks where id = p ->> 'id';
  perform private.need(t.id is not null, 'This task no longer exists.');
  perform private.need(me.role = 'admin' or (me.role = 'member' and t.created_by = me.id), 'You don''t have permission to delete this task.');
  delete from public.tasks where id = t.id;
  perform private.log(me.id, 'deleted the task ' || private.q(t.title));
end $$;

/* ---------- deliverables: maker → admin check → client approval ---------- */

create function public.submit_deliverable(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  x public.deliverables;
  lnk text := coalesce(p ->> 'link', '');
  note text := coalesce(p ->> 'note', '');
  url text;
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to submit work.');
  perform private.need(lnk ~ '^https?://\S+$', 'Paste a link to the file (Google Drive, Frame.io, Figma, the live site…).');
  select * into x from public.deliverables where id = p ->> 'id' for update;
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

create function public.review_deliverable(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  x public.deliverables;
  pr public.projects;
  ok boolean := coalesce((p ->> 'approve')::boolean, false);
  note text := trim(coalesce(p ->> 'note', ''));
  url text;
begin
  perform private.need(me.role = 'admin', 'You don''t have permission to check work before it goes to the client.');
  select * into x from public.deliverables where id = p ->> 'id' for update;
  perform private.need(x.status = 'internal', 'This is not waiting for a check.');
  perform private.need(ok or note <> '', 'Say what needs to change.');
  select * into pr from public.projects where id = x.project_id;
  url := '#/projects/' || pr.id || '/deliverables';
  if ok then
    update public.deliverables set status = 'client', sent = true,
      history = history || jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(), 'action', 'sent v' || version || ' to the client', 'note', note))
    where id = x.id;
    perform private.notify(me.id, private.client_users(pr.client_id), 'sent ' || private.q(x.title) || ' v' || x.version || ' for your approval', url);
    perform private.notify(me.id, array[x.submitted_by], 'checked your ' || private.q(x.title) || ' and sent it to the client', url);
    perform private.log(me.id, 'sent ' || private.q(x.title) || ' v' || x.version || ' to '
      || coalesce((select name from public.clients where id = pr.client_id), 'the client'), url);
  else
    update public.deliverables set status = 'changes',
      history = history || jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(), 'action', 'asked for changes before it goes to the client', 'note', note))
    where id = x.id;
    perform private.notify(me.id, array[x.submitted_by], 'asked for changes on ' || private.q(x.title) || ': ' || note, url);
  end if;
end $$;

create function public.decide_deliverable(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  x public.deliverables;
  pr public.projects;
  ok boolean := coalesce((p ->> 'approve')::boolean, false);
  note text := trim(coalesce(p ->> 'note', ''));
  proxy text;
  url text;
begin
  select * into x from public.deliverables where id = p ->> 'id' for update;
  select * into pr from public.projects where id = x.project_id;
  perform private.need(me.role = 'admin' or (me.role = 'client' and me.client_id = pr.client_id), 'You don''t have permission to approve this work.');
  perform private.need(x.status = 'client', 'This is not waiting for the client.');
  perform private.need(ok or note <> '', 'Tell the team what to change.');
  proxy := case when me.role <> 'client' then ' on the client’s behalf' else '' end;
  url := '#/projects/' || pr.id || '/deliverables';
  update public.deliverables set status = case when ok then 'approved' else 'changes' end,
    history = history || jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(),
      'action', case when ok then 'approved v' || version || proxy else 'requested changes' || proxy end, 'note', note))
  where id = x.id;
  perform private.notify(me.id, array[x.submitted_by, pr.manager_id] || private.admins(),
    case when ok then 'approved ' || private.q(x.title) || ' v' || x.version else 'requested changes on ' || private.q(x.title) || ': ' || note end, url);
  perform private.log(me.id, case when ok then 'approved ' || private.q(x.title) || ' v' || x.version || proxy
    else 'requested changes on ' || private.q(x.title) || proxy end, url);
end $$;

/* ---------- calendar ---------- */

create function public.save_event(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  eid text := nullif(p ->> 'id', '');
  old public.events;
  e public.events;
  whn text;
  added uuid[];
begin
  perform private.need(me.id is not null, 'Please sign in again.');
  select * into old from public.events where id = eid for update;
  if old.id is not null then
    perform private.need(me.role = 'admin' or old.created_by = me.id, 'You don''t have permission to edit this meeting.');
  end if;

  e.id := coalesce(old.id, eid, gen_random_uuid()::text);
  e.title := case when old.id is null or p ? 'title' then trim(coalesce(p ->> 'title', '')) else old.title end;
  e.type := case when p ? 'type' then p ->> 'type' else coalesce(old.type, 'meeting') end;
  e.date := case when old.id is null or p ? 'date' then nullif(p ->> 'date', '')::date else old.date end;
  e.start := case when old.id is null or p ? 'start' then p ->> 'start' else old.start end;
  e."end" := case when old.id is null or p ? 'end' then p ->> 'end' else old."end" end;
  e.repeat := case when p ? 'repeat' then p ->> 'repeat' else coalesce(old.repeat, 'none') end;
  e.location := case when old.id is null or p ? 'location' then coalesce(p ->> 'location', '') else old.location end;
  e.agenda := case when old.id is null or p ? 'agenda' then coalesce(p ->> 'agenda', '') else old.agenda end;
  e.project_id := case when old.id is null or p ? 'projectId' then nullif(p ->> 'projectId', '') else old.project_id end;
  e.attendee_ids := case when old.id is null or p ? 'attendeeIds'
    then array(select distinct x from unnest(me.id || private.ids(p -> 'attendeeIds')) x)
    else old.attendee_ids end;

  perform private.need(length(e.title) > 0, 'Give it a title.');
  perform private.need(e.date is not null, 'Pick a date.');
  perform private.need(e.start < e."end", 'The end time must be after the start time.');
  if me.role = 'client' then
    -- a client can only invite the studio team and their own colleagues, about their own projects
    perform private.need(not exists (select 1 from unnest(e.attendee_ids) x
      where not exists (select 1 from public.people where id = x and (role <> 'client' or client_id = me.client_id))),
      'You can invite the YG team and people from your own company.');
    perform private.need(e.project_id is null or exists (select 1 from public.projects where id = e.project_id and client_id = me.client_id),
      'Pick one of your own projects.');
  end if;

  whn := private.fmt_day(e.date) || ', ' || private.fmt_time(e.start);
  if old.id is null then
    insert into public.events (id, title, type, date, start, "end", repeat, attendee_ids, location, agenda, project_id, created_by, rsvp)
    values (e.id, e.title, e.type, e.date, e.start, e."end", e.repeat, e.attendee_ids, e.location, e.agenda, e.project_id, me.id,
      jsonb_build_object(me.id::text, 'yes'));
    perform private.notify(me.id, e.attendee_ids, 'invited you to ' || private.q(e.title) || ' on ' || whn, '#/calendar');
    perform private.log(me.id, 'scheduled ' || private.q(e.title) || ' for ' || whn, '#/calendar');
    return e.id;
  end if;

  update public.events set title = e.title, type = e.type, date = e.date, start = e.start, "end" = e."end", repeat = e.repeat,
    attendee_ids = e.attendee_ids, location = e.location, agenda = e.agenda, project_id = e.project_id
  where id = e.id;
  added := array(select x from unnest(e.attendee_ids) x where not x = any (old.attendee_ids));
  perform private.notify(me.id, added, 'invited you to ' || private.q(e.title) || ' on ' || whn, '#/calendar');
  if old.date <> e.date or old.start <> e.start or old."end" <> e."end" then
    perform private.notify(me.id, array(select x from unnest(e.attendee_ids) x where not x = any (added)),
      'moved ' || private.q(e.title) || ' to ' || whn, '#/calendar');
  end if;
  perform private.log(me.id, 'updated ' || private.q(e.title), '#/calendar');
  return e.id;
end $$;

create function public.delete_event(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  e public.events;
begin
  select * into e from public.events where id = p ->> 'id';
  perform private.need(e.id is not null, 'This meeting no longer exists.');
  perform private.need(me.role = 'admin' or e.created_by = me.id, 'You don''t have permission to cancel this meeting.');
  delete from public.events where id = e.id;
  perform private.notify(me.id, e.attendee_ids, 'cancelled ' || private.q(e.title) || ' (' || private.fmt_day(e.date) || ', ' || private.fmt_time(e.start) || ')', '#/calendar');
  perform private.log(me.id, 'cancelled ' || private.q(e.title), '#/calendar');
end $$;

create function public.rsvp(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  e public.events;
  answer text := p ->> 'answer';
begin
  perform private.need(answer in ('yes', 'no'), 'Answer yes or no.');
  select * into e from public.events where id = p ->> 'id';
  perform private.need(me.id = any (e.attendee_ids), 'You are not invited to this.');
  update public.events set rsvp = rsvp || jsonb_build_object(me.id::text, answer) where id = e.id;
  if answer = 'no' then
    perform private.notify(me.id, array[e.created_by], 'can’t make ' || private.q(e.title) || ' (' || private.fmt_day(e.date) || ')', '#/calendar');
  end if;
end $$;

/* ---------- chat ---------- */

-- same id the browser computes (dmId in src/store.js): 'dm-' + both ids sorted as plain text
create function public.open_dm(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  other public.people;
  cid text;
begin
  select * into other from public.people where id = nullif(p ->> 'otherId', '')::uuid and active;
  perform private.need(me.id is not null and other.id is not null and other.id <> me.id, 'Pick who to message.');
  perform private.need(me.role <> 'client' or other.role <> 'client', 'You can message the YG team.');
  cid := 'dm-' || least(me.id::text collate "C", other.id::text collate "C") || '-' || greatest(me.id::text collate "C", other.id::text collate "C");
  insert into public.channels (id, type, member_ids) values (cid, 'dm', array[me.id, other.id]) on conflict (id) do nothing;
  return cid;
end $$;

create function public.send_message(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  c public.channels;
  txt text := trim(coalesce(p ->> 'text', ''));
  short text;
  lnk text;
  place text;
begin
  select * into c from public.channels where id = p ->> 'channelId';
  perform private.need(c.id is not null and private.sees_channel(c, me) and (not c.read_only or me.role = 'admin'),
    'You don''t have permission to post here.');
  perform private.need(length(txt) between 1 and 4000, 'Write a message first.');
  insert into public.messages (id, channel_id, user_id, text) values (coalesce(nullif(p ->> 'id', ''), gen_random_uuid()::text), c.id, me.id, txt);
  insert into public.reads (user_id, channel_id, at) values (me.id, c.id, now())
  on conflict (user_id, channel_id) do update set at = excluded.at;

  short := case when length(txt) > 90 then left(txt, 90) || '…' else txt end;
  lnk := '#/chat/' || c.id;
  if c.type = 'dm' then
    perform private.notify(me.id, c.member_ids, 'messaged you: ' || short, lnk);
    return;
  end if;
  place := case when c.type = 'project' then coalesce((select name from public.projects where id = c.project_id), 'project') else c.name end;
  perform private.notify(me.id, array(select u.id from public.people u where u.id = any (private.mentions(txt)) and private.sees_channel(c, u)),
    'mentioned you in #' || place || ': ' || short, lnk);
  -- a client writing in their project channel should never go unseen
  if c.type = 'project' and me.role = 'client' then
    perform private.notify(me.id, (select manager_id from public.projects where id = c.project_id) || private.admins(),
      'wrote in #' || place || ': ' || short, lnk);
  end if;
  if c.read_only then
    perform private.notify(me.id, private.staff(), 'posted an announcement: ' || short, lnk);
  end if;
end $$;

create function public.mark_read(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  c public.channels;
begin
  select * into c from public.channels where id = p ->> 'channelId';
  perform private.need(c.id is not null and private.sees_channel(c, me), 'This conversation is not available.');
  insert into public.reads (user_id, channel_id, at) values (me.id, c.id, now())
  on conflict (user_id, channel_id) do update set at = excluded.at;
end $$;

/* ---------- content plan ---------- */

create function public.save_post(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  sid text := nullif(p ->> 'id', '');
  old public.posts;
  s public.posts;
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to plan content.');
  select * into old from public.posts where id = sid for update;
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

  perform private.need(length(s.title) > 0, 'Give the post a working title or hook.');
  perform private.need(s.client_id is not null and s.date is not null, 'Pick the client and the day it goes out.');

  if old.id is null then
    insert into public.posts (id, client_id, date, time, platform, format, title, status, assignee_id, caption)
    values (s.id, s.client_id, s.date, s.time, s.platform, s.format, s.title, s.status, s.assignee_id, s.caption);
  else
    update public.posts set client_id = s.client_id, date = s.date, time = s.time, platform = s.platform, format = s.format,
      title = s.title, status = s.status, assignee_id = s.assignee_id, caption = s.caption
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

create function public.decide_post(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  s public.posts;
  ok boolean := coalesce((p ->> 'approve')::boolean, false);
  note text := trim(coalesce(p ->> 'note', ''));
begin
  select * into s from public.posts where id = p ->> 'id' for update;
  perform private.need(s.id is not null and (me.role in ('admin', 'member') or (me.role = 'client' and me.client_id = s.client_id)),
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

create function public.delete_post(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to delete posts.');
  delete from public.posts where id = p ->> 'id';
end $$;

/* ---------- you ---------- */

create function public.read_notifications(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  update public.notifications set read = true
  where user_id = me.id and not read and (p -> 'ids' is null or jsonb_typeof(p -> 'ids') = 'null' or id in (select jsonb_array_elements_text(p -> 'ids')));
end $$;

create function public.update_profile(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  nm text := trim(coalesce(p ->> 'name', ''));
begin
  perform private.need(me.id is not null, 'Please sign in again.');
  perform private.need(length(nm) > 0, 'Your name cannot be empty.');
  update public.people set name = nm, phone = coalesce(p ->> 'phone', ''), title = coalesce(p ->> 'title', '') where id = me.id;
end $$;

/* ---------- loading ---------- */

-- everything the signed-in person may see, in one round trip. Runs as the caller, so the policies in 002
-- decide what's in it. Chat brings the latest 200 messages per conversation; activity and notifications
-- the latest 100.
create function public.bootstrap() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'people', (select coalesce(jsonb_agg(t order by t.created_at), '[]') from public.people t),
    'clients', (select coalesce(jsonb_agg(t order by t.created_at), '[]') from public.clients t),
    'client_private', (select coalesce(jsonb_agg(t), '[]') from public.client_private t),
    'projects', (select coalesce(jsonb_agg(t order by t.created_at, t.id), '[]') from public.projects t),
    'tasks', (select coalesce(jsonb_agg(t order by t.created_at, t.id), '[]') from public.tasks t),
    'task_private', (select coalesce(jsonb_agg(t), '[]') from public.task_private t),
    'deliverables', (select coalesce(jsonb_agg(t order by t.created_at), '[]') from public.deliverables t),
    'events', (select coalesce(jsonb_agg(t order by t.date, t.start), '[]') from public.events t),
    'channels', (select coalesce(jsonb_agg(t order by t.created_at), '[]') from public.channels t),
    'messages', (select coalesce(jsonb_agg(m order by m.at), '[]') from public.channels c
      cross join lateral (select * from public.messages x where x.channel_id = c.id order by x.at desc limit 200) m),
    'reads', (select coalesce(jsonb_agg(t), '[]') from public.reads t),
    'posts', (select coalesce(jsonb_agg(t order by t.date, t.time), '[]') from public.posts t),
    'activity', (select coalesce(jsonb_agg(a order by a.at desc), '[]') from (select * from public.activity order by at desc limit 100) a),
    'notifications', (select coalesce(jsonb_agg(n order by n.at desc), '[]') from (select * from public.notifications order by at desc limit 100) n)
  )
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
