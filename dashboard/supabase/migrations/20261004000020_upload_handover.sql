-- Made, approved, uploaded, without passing anything by hand (asked for 2026-10-09):
--  * an upload task goes straight to the person in Social media, while there's just one (none or several: no one,
--    so the whole team sees it, as before)
--  * finished work can't be handed over. Done on a Video or Design task already gives its upload to Social media;
--    handing the finished task on put it back to To do, took its upload task away and made the uploader its maker
--  * work pushed past the day its post goes out moves the post to that day. Bringing work earlier never moves it
--  * a post moved to another day takes its open upload task with it

-- who uploads: the one active person in Social media
create function private.uploader() returns uuid language sql stable set search_path = '' as $$
  select case when count(*) = 1 then (array_agg(id))[1] end from public.people where active and dept = 'social' and role <> 'client'
$$;

-- as in *_social_upload.sql, given to the uploader
create or replace function private.upload_task() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tid text := 'up-' || new.id; -- the app makes the same id, so its copy and the server's are one task
  who uuid := (select auth.uid());
  goes date;
begin
  if new.status <> 'done' then
    delete from public.tasks where upload_of = new.id and status <> 'done';
    return null;
  end if;
  -- a post already out or undelivered (marking it so finishes this task too): nothing left to upload
  if exists (select 1 from public.posts where id = new.post_id and status in ('posted', 'missed')) then
    return null;
  end if;
  goes := coalesce((select date from public.posts where id = new.post_id), private.today());
  insert into public.tasks (id, project_id, upload_of, assignee_id, status, priority, due, title, dept, created_by)
  values (tid, new.project_id, new.id, private.uploader(), 'todo', new.priority, goes, left('Upload: ' || new.title, 300), 'social', who)
  on conflict do nothing;
  if found then
    insert into public.task_private (task_id) values (tid);
    perform private.notify(who, array(select p.id from public.people p, public.tasks k where k.id = tid and p.dept = 'social' and private.sees_task(k, p)),
      'finished ' || private.q(new.title) || ' — upload it', '#/tasks/' || tid);
  end if;
  return null;
end $$;

-- as in *_departments.sql, but only for work still open
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
  perform private.need(private.sees_task(t, me), 'You don''t have permission to hand over this task.');
  perform private.need(t.status <> 'done', 'This task is finished, so there’s nothing to hand over. Move it back first if it needs more work.');
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

-- as in *_made_to_send.sql, and a post moved to another day takes its open upload task with it
create or replace function private.post_saved() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k public.tasks;
  st text;
  ti text;
  du date;
  who uuid;
begin
  if tg_op = 'INSERT' or new.project_id is distinct from old.project_id or new.date is distinct from old.date or new.status is distinct from old.status then
    perform private.post_task(new, (select auth.uid()));
  end if;
  if tg_op = 'INSERT' then
    return null;
  end if;
  select * into k from public.tasks where post_id = new.id for update;
  if k.id is null then
    return null;
  end if;
  st := case
    when new.status is distinct from old.status and new.status in ('posted', 'missed') then 'done'
    when new.status = 'production' and old.status in ('made', 'ready', 'scheduled') and k.status = 'done' then 'todo'
    else k.status end;
  ti := case when new.title is distinct from old.title or new.format is distinct from old.format then new.format || ': ' || new.title else k.title end;
  du := case when new.date is distinct from old.date then private.post_due(new.date) else k.due end;
  who := case when new.assignee_id is distinct from old.assignee_id then new.assignee_id else k.assignee_id end;
  if (st, ti, du, who) is distinct from (k.status, k.title, k.due, k.assignee_id) then
    update public.tasks set status = st, title = ti, due = du, assignee_id = who,
      completed_at = case when st = 'done' then coalesce(k.completed_at, private.today()) end
    where id = k.id;
  end if;
  if new.date is distinct from old.date then
    update public.tasks set due = new.date where upload_of = k.id and status <> 'done';
  end if;
  return null;
end $$;

-- as in *_made_to_send.sql, and work pushed past the day its post goes out moves the post to that day
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

  -- pushed past the day its post goes out: the post goes out that day. Moved first, so the task's own update below
  -- has the last word on its due (moving a post sets its task's due to the day before)
  if old.post_id is not null and t.due is distinct from old.due
    and t.due > (select date from public.posts where id = old.post_id and status not in ('posted', 'missed')) then
    update public.posts set date = t.due where id = old.post_id;
  end if;

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
    elsif t.status = 'done' and t.post_id is null then -- a post's task: its post tells the lead instead (private.task_moved)
      perform private.notify(me.id, array[t.created_by], 'finished ' || private.q(t.title), lnk);
    end if;
    perform private.log(me.id, 'moved ' || private.q(t.title) || ' to ' || private.task_label(t.status), lnk);
  else
    perform private.log(me.id, case when old.id is null then 'created ' else 'updated ' end || private.q(t.title), lnk);
  end if;
  return t.id;
end $$;

revoke execute on function private.uploader() from public, anon, authenticated;
