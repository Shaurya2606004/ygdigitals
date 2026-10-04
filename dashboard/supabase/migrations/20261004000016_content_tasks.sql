-- The content plan and the tasks, kept in step (asked for 2026-10-05):
--  * a post can belong to a project. A post in a project gets one task there (its department: Reels and Shorts are
--    Video, the rest Design), due the day before it goes out, once it's a week away — when it's saved, or by the
--    9 am job. A task someone deletes stays deleted (posts.task_made).
--  * the task moves the post: started → In production, done → Ready for approval (and the client is asked)
--  * the post moves the task: posted or undelivered → done; sent back for changes → To do again; a new day, title
--    or maker carries over
--  * every task remembers who last changed its status, and when

alter table public.posts
  add column project_id text references public.projects on delete set null,
  add column task_made boolean not null default false;
create index on public.posts (project_id);

alter table public.tasks
  add column post_id text unique references public.posts on delete cascade,
  add column status_by uuid references public.people on delete set null,
  add column status_at timestamptz;
create index on public.tasks (status_by);

-- whoever changed a task's status last (no one = the hub itself), whichever action did it
create function private.status_changed() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.status_by := (select auth.uid());
    new.status_at := now();
  end if;
  return new;
end $$;
create trigger status_changed before update of status on public.tasks for each row execute function private.status_changed();

-- a post's task: due the day before it goes out (today at the latest, unless the day has already passed)
create function private.post_due(d date) returns date language sql stable set search_path = '' as $$
  select least(d, greatest(d - 1, private.today()))
$$;

-- make a post's task once it's a week away; by = who's doing it (no one: the morning job, so the project lead gave it)
create function private.post_task(s public.posts, by uuid) returns void language plpgsql security definer set search_path = '' as $$
declare
  giver uuid;
  tid text := 'pt-' || s.id; -- the app makes the same id, so its copy and the server's are one task
begin
  if s.project_id is null or s.task_made or s.status not in ('idea', 'production') or s.date > private.today() + 7 then
    return;
  end if;
  giver := coalesce(by, (select manager_id from public.projects where id = s.project_id));
  insert into public.tasks (id, project_id, post_id, assignee_id, status, due, title, dept, created_by)
  values (tid, s.project_id, s.id, s.assignee_id, case s.status when 'production' then 'doing' else 'todo' end,
    private.post_due(s.date), s.format || ': ' || s.title, s.dept, giver)
  on conflict do nothing;
  insert into public.task_private (task_id, "desc") values (tid, s.brief) on conflict do nothing;
  update public.posts set task_made = true where id = s.id;
  if s.assignee_id is not null and giver is not null then
    perform private.notify(giver, array[s.assignee_id], 'gave you ' || private.q(s.format || ': ' || s.title) || ' — it goes out '
      || private.fmt_day(s.date), '#/tasks/' || tid);
  end if;
end $$;

-- a post saved: its task if it's due one, and the task follows the post
create function private.post_saved() returns trigger language plpgsql security definer set search_path = '' as $$
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
    when new.status = 'production' and old.status in ('ready', 'scheduled') and k.status = 'done' then 'todo' -- the client asked for changes
    else k.status end;
  ti := case when new.title is distinct from old.title or new.format is distinct from old.format then new.format || ': ' || new.title else k.title end;
  du := case when new.date is distinct from old.date then private.post_due(new.date) else k.due end;
  who := case when new.assignee_id is distinct from old.assignee_id then new.assignee_id else k.assignee_id end;
  if (st, ti, du, who) is distinct from (k.status, k.title, k.due, k.assignee_id) then
    update public.tasks set status = st, title = ti, due = du, assignee_id = who,
      completed_at = case when st = 'done' then coalesce(k.completed_at, private.today()) end
    where id = k.id;
  end if;
  return null;
end $$;
create trigger post_saved after insert or update on public.posts for each row execute function private.post_saved();

-- a post's task changed: the post follows (started → In production, done → Ready for approval; a new maker carries over)
create function private.task_moved() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.posts;
  st text;
  who uuid;
begin
  select * into s from public.posts where id = new.post_id for update;
  if s.id is null then
    return null;
  end if;
  st := case
    when new.status is distinct from old.status and new.status = 'done' and s.status in ('idea', 'production') then 'ready'
    when new.status is distinct from old.status and new.status in ('doing', 'review') and s.status = 'idea' then 'production'
    else s.status end;
  who := case when new.assignee_id is distinct from old.assignee_id then new.assignee_id else s.assignee_id end;
  if (st, who) is distinct from (s.status, s.assignee_id) then
    update public.posts set status = st, assignee_id = who where id = s.id;
    if st = 'ready' and s.status <> 'ready' then
      perform private.notify((select auth.uid()), private.client_users(s.client_id), 'has a ' || s.format || ' ready for your approval: ' || private.q(s.title), '#/content');
    end if;
  end if;
  return null;
end $$;
create trigger task_moved after update of status, assignee_id on public.tasks for each row when (new.post_id is not null)
  execute function private.task_moved();

revoke execute on function private.post_task(public.posts, uuid) from public, anon, authenticated;
revoke execute on function private.post_saved(), private.task_moved(), private.status_changed() from public, anon, authenticated;

-- save_post: a post can go into one of its client's projects (one you work in); quiet = an import, whose makers are
-- told when each task lands in their To do instead of once per post
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
  s.project_id := case when old.id is null or p ? 'projectId' then nullif(p ->> 'projectId', '') else old.project_id end;
  s.date := case when old.id is null or p ? 'date' then nullif(p ->> 'date', '')::date else old.date end;
  s.time := case when p ? 'time' then coalesce(nullif(p ->> 'time', ''), '19:00') else coalesce(old.time, '19:00') end;
  s.platform := case when p ? 'platform' then p ->> 'platform' else coalesce(old.platform, 'Instagram') end;
  s.format := case when p ? 'format' then p ->> 'format' else coalesce(old.format, 'Post') end;
  s.title := case when old.id is null or p ? 'title' then trim(coalesce(p ->> 'title', '')) else old.title end;
  s.status := case when p ? 'status' then p ->> 'status' else coalesce(old.status, 'idea') end;
  s.assignee_id := case when old.id is null or p ? 'assigneeId' then nullif(p ->> 'assigneeId', '')::uuid else old.assignee_id end;
  s.caption := case when old.id is null or p ? 'caption' then coalesce(p ->> 'caption', '') else old.caption end;
  s.brief := case when old.id is null or p ? 'brief' then coalesce(p ->> 'brief', '') else old.brief end;
  s.dept := case when old.id is null or p ? 'dept' then coalesce(p ->> 'dept', '') else old.dept end;

  perform private.need(length(s.title) > 0, 'Give the post a working title or hook.');
  perform private.need(s.client_id is not null and s.date is not null, 'Pick the client and the day it goes out.');
  perform private.need(s.project_id is null or exists (select 1 from public.projects x where x.id = s.project_id and x.client_id = s.client_id),
    'Pick one of this client''s projects.');
  perform private.need(s.project_id is not distinct from old.project_id or private.sees_project(s.project_id, me),
    'You can only add posts to a project you work in.');

  if old.id is null then
    insert into public.posts (id, client_id, project_id, date, time, platform, format, title, status, assignee_id, caption, brief, dept)
    values (s.id, s.client_id, s.project_id, s.date, s.time, s.platform, s.format, s.title, s.status, s.assignee_id, s.caption, s.brief, s.dept);
  else
    update public.posts set client_id = s.client_id, project_id = s.project_id, date = s.date, time = s.time, platform = s.platform,
      format = s.format, title = s.title, status = s.status, assignee_id = s.assignee_id, caption = s.caption, brief = s.brief, dept = s.dept
    where id = s.id;
  end if;
  if s.assignee_id is not null and (old.id is null or old.assignee_id is distinct from s.assignee_id) and not coalesce((p ->> 'quiet')::boolean, false) then
    perform private.notify(me.id, array[s.assignee_id], 'gave you the ' || s.format || ' ' || private.q(s.title) || ' (' || private.fmt_day(s.date) || ')', '#/content');
  end if;
  if s.status = 'ready' and old.status is distinct from 'ready' then
    perform private.notify(me.id, private.client_users(s.client_id), 'has a ' || s.format || ' ready for your approval: ' || private.q(s.title), '#/content');
  end if;
  perform private.log(me.id, case when old.id is null then 'planned' else 'updated' end || ' the ' || s.format || ' ' || private.q(s.title) || ' for '
    || coalesce((select name from public.clients where id = s.client_id), 'a client'), '#/content');
  return s.id;
end $$;

-- the morning job, now also putting next week's posts into their projects' To do
create or replace function private.daily() returns void language plpgsql security definer set search_path = '' as $$
declare
  t date := private.today();
  r record;
begin
  insert into private.daily_runs (day) values (t) on conflict do nothing;
  if not found then
    return;
  end if;

  perform private.post_task(s, null) from public.posts s
  where s.project_id is not null and not s.task_made and s.status in ('idea', 'production') and s.date <= t + 7;

  for r in select k.id, k.title, k.due, k.assignee_id from public.tasks k
    where k.status <> 'done' and k.due < t and k.assignee_id is not null and not private.away(k.assignee_id, t)
  loop
    perform private.nudge(r.assignee_id, private.q(r.title) || ' is overdue (was due ' || private.fmt_day(r.due)
      || ') — finish it today, or hand it over', '#/tasks/' || r.id);
  end loop;

  for r in select k.id, k.title, k.due, k.assignee_id, a from public.tasks k
    cross join unnest(private.admins()) a
    where k.status <> 'done' and k.due <= t - 2 and a is distinct from k.assignee_id
  loop
    perform private.nudge(r.a, private.q(r.title) || ' (' || case when r.assignee_id is null then 'not given to anyone' else private.first_name(r.assignee_id) end || ') is '
      || (t - r.due) || ' days overdue', '#/tasks/' || r.id);
  end loop;

  for r in select s.id, s.title, s.format, s.date, s.assignee_id, c.name from public.posts s join public.clients c on c.id = s.client_id
    where s.date < t and s.status not in ('posted', 'missed')
  loop
    perform private.nudge(x, r.format || ' ' || private.q(r.title) || ' for ' || r.name || ' was due ' || private.fmt_day(r.date)
      || ' — mark it posted, or undelivered and note the compensation', '#/content')
    from unnest(case when r.assignee_id is null or private.away(r.assignee_id, t) then private.admins() else array[r.assignee_id] end) x;
  end loop;

  for r in select k.offer, k.due, k.owner_id, c.name from public.compensations k join public.clients c on c.id = k.client_id
    where k.status = 'open' and k.due <= t
  loop
    perform private.nudge(x, 'Compensation for ' || r.name || ' ' || case when r.due = t then 'is due today' else 'is late' end || ': ' || r.offer, '#/content/owed')
    from unnest(case when r.owner_id is null or r.due < t then private.admins() || r.owner_id else array[r.owner_id] end) x
    where x is not null;
  end loop;

  -- the morning email, once the mail function's address is set
  if exists (select 1 from pg_extension where extname = 'pg_net') and exists (select 1 from private.settings where key = 'mail_url') then
    perform net.http_post(url := (select value from private.settings where key = 'mail_url'), body := jsonb_build_object('day', t));
  end if;
end $$;
revoke execute on function private.daily() from public, anon, authenticated;
