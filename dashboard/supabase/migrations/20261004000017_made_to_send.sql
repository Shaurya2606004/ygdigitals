-- Made, then sent. A maker finishing a post's task no longer sends it to the client: the post waits as "Made, to
-- send", and the project's lead and the supervisors hear about it (in the app and by email). One of them checks it and
-- sends it to the client — by email too, if they tick it — or sends it back for changes. Until it's sent, the client
-- sees it as "In production".
--   * posts.link: where the finished file is (Drive, Dropbox…), for the check and for the client
--   * who sends: the project's lead or a supervisor (private.sends_post); save_post and send_post both check it
--   * email: queued in private.outbox in the same transaction as the change, then sent by the mail function
--     (functions/daily-mail), which empties the queue each time it's woken

alter table public.posts
  drop constraint posts_status_check,
  add constraint posts_status_check check (status in ('idea', 'production', 'made', 'ready', 'scheduled', 'posted', 'missed')),
  add column link text not null default '' check (link = '' or (link ~* '^https?://' and length(link) <= 1000));

-- who checks a made post and sends it to the client: its project's lead, or a supervisor
create function private.sends_post(s public.posts, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role = 'admin' or exists (select 1 from public.projects p where p.id = s.project_id and p.manager_id = u.id))
$$;
-- …and who hears that one is made: the lead and the supervisors (owners get their short Home instead)
create function private.senders(pid text) returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.people
  where active and ((role = 'admin' and not owner) or id = (select manager_id from public.projects where id = pid))
$$;

-- a project's lead sees its posts, whatever their department (to send them)
create or replace function private.sees_post(s public.posts, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and (u.role = 'admin'
    or (u.role = 'member' and (u.dept in ('all', 'social') or (s.dept <> '' and s.dept = u.dept) or s.assignee_id = u.id
      or exists (select 1 from public.projects p where p.id = s.project_id and p.manager_id = u.id))))
$$;
drop policy read on public.posts;
create policy read on public.posts for select to authenticated using (
  (select private.sees_all()) or client_id = (select private.my_client())
  or ((select private.my_role()) = 'member' and ((select private.my_dept()) = 'social' or (dept <> '' and dept = (select private.my_dept()))
    or assignee_id = (select auth.uid()) or project_id in (select id from public.projects where manager_id = (select auth.uid()))))
);

/* ---------- email ---------- */

create table private.outbox (
  id bigint generated always as identity primary key,
  email text not null,
  reply_to text not null default '',
  subject text not null,
  intro text not null,
  work text not null default '', -- a link to the finished file
  link text not null default '', -- where it is in the hub ('#/content/post/…'), '' for someone without a login
  at timestamptz not null default now()
);

-- these people's email addresses (active ones, never the person acting)
create function private.emails(ids uuid[], but uuid) returns text[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(email), '{}') from public.people where id = any (ids) and active and id is distinct from but
$$;

-- queue an email to each address and wake the mail function. Nothing is queued until the function's address is set,
-- so a backlog can't build up and go out late.
create function private.mail(emails text[], subject text, intro text, work text, lnk text, reply text default '') returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from private.settings where key = 'mail_url') then
    return;
  end if;
  insert into private.outbox (email, reply_to, subject, intro, work, link)
  select distinct e, coalesce(reply, ''), subject, intro, coalesce(work, ''), coalesce(lnk, '') from unnest(emails) e where coalesce(e, '') <> '';
  if found and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(url := (select value from private.settings where key = 'mail_url'), body := '{"outbox": true}'::jsonb);
  end if;
end $$;

-- the mail function takes everything waiting (the service role only); each email is taken once
create function public.claim_outbox() returns table (email text, reply_to text, subject text, intro text, work text, link text)
language sql security definer set search_path = '' as $$
  delete from private.outbox where id in (select id from private.outbox order by id limit 100 for update skip locked)
  returning email, reply_to, subject, intro, work, link
$$;

/* ---------- the task moves the post ---------- */

-- finished → Made, to send (the lead and the supervisors are told); reopened before it went out → back in production
create or replace function private.task_moved() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.posts;
  st text;
  who uuid;
  actor uuid := (select auth.uid());
  what text;
  lnk text;
begin
  select * into s from public.posts where id = new.post_id for update;
  if s.id is null then
    return null;
  end if;
  st := case
    when new.status is distinct from old.status and new.status = 'done' and s.status in ('idea', 'production') then 'made'
    when new.status is distinct from old.status and old.status = 'done' and s.status in ('made', 'ready') then 'production'
    when new.status is distinct from old.status and new.status in ('doing', 'review') and s.status = 'idea' then 'production'
    else s.status end;
  who := case when new.assignee_id is distinct from old.assignee_id then new.assignee_id else s.assignee_id end;
  if (st, who) is distinct from (s.status, s.assignee_id) then
    update public.posts set status = st, assignee_id = who where id = s.id;
    if st = 'made' then
      what := s.format || ' ' || private.q(s.title) || ' for ' || (select name from public.clients where id = s.client_id);
      lnk := '#/content/post/' || s.id;
      perform private.notify(actor, private.senders(s.project_id), 'made the ' || what || ' — check it and send it to the client', lnk);
      perform private.mail(private.emails(private.senders(s.project_id), actor), 'To check and send: ' || what,
        private.first_name(actor) || ' made the ' || what || '. It goes out ' || private.fmt_day(s.date) || '. Check it, then send it to the client.',
        s.link, lnk);
    end if;
  end if;
  return null;
end $$;

-- sent back for changes (by the lead, or by the client) → the task is back in its maker's To do
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
  return null;
end $$;

-- save_task as before, except finishing a post's task: the lead hears "made … check it and send it" from its post
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
    elsif t.status = 'done' and t.post_id is null then -- a post's task: its post tells the lead instead (private.task_moved)
      perform private.notify(me.id, array[t.created_by], 'finished ' || private.q(t.title), lnk);
    end if;
    perform private.log(me.id, 'moved ' || private.q(t.title) || ' to ' || private.task_label(t.status), lnk);
  else
    perform private.log(me.id, case when old.id is null then 'created ' else 'updated ' end || private.q(t.title), lnk);
  end if;
  return t.id;
end $$;

/* ---------- saving and sending posts ---------- */

-- as before, plus the link to the work; moving a post to "Ready for approval" here is sending it (lead or supervisor)
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
  s.link := case when old.id is null or p ? 'link' then trim(coalesce(p ->> 'link', '')) else old.link end;

  perform private.need(length(s.title) > 0, 'Give the post a working title or hook.');
  perform private.need(s.client_id is not null and s.date is not null, 'Pick the client and the day it goes out.');
  perform private.need(s.project_id is null or exists (select 1 from public.projects x where x.id = s.project_id and x.client_id = s.client_id),
    'Pick one of this client''s projects.');
  perform private.need(s.project_id is not distinct from old.project_id or private.sees_project(s.project_id, me),
    'You can only add posts to a project you work in.');
  perform private.need(s.link = '' or s.link ~* '^https?://', 'The link should start with https://');
  perform private.need(s.status <> 'ready' or old.status is not distinct from 'ready' or private.sends_post(s, me),
    'Only the project lead or a supervisor can send work to the client.');

  if old.id is null then
    insert into public.posts (id, client_id, project_id, date, time, platform, format, title, status, assignee_id, caption, brief, dept, link)
    values (s.id, s.client_id, s.project_id, s.date, s.time, s.platform, s.format, s.title, s.status, s.assignee_id, s.caption, s.brief, s.dept, s.link);
  else
    update public.posts set client_id = s.client_id, project_id = s.project_id, date = s.date, time = s.time, platform = s.platform,
      format = s.format, title = s.title, status = s.status, assignee_id = s.assignee_id, caption = s.caption, brief = s.brief, dept = s.dept,
      link = s.link
    where id = s.id;
  end if;
  if s.assignee_id is not null and (old.id is null or old.assignee_id is distinct from s.assignee_id) and not coalesce((p ->> 'quiet')::boolean, false) then
    perform private.notify(me.id, array[s.assignee_id], 'gave you the ' || s.format || ' ' || private.q(s.title) || ' (' || private.fmt_day(s.date) || ')', '#/content');
  end if;
  if s.status = 'ready' and old.status is distinct from 'ready' then
    perform private.notify(me.id, private.client_users(s.client_id), 'has a ' || s.format || ' ready for your approval: ' || private.q(s.title), '#/content/post/' || s.id);
  end if;
  perform private.log(me.id, case when old.id is null then 'planned' else 'updated' end || ' the ' || s.format || ' ' || private.q(s.title) || ' for '
    || coalesce((select name from public.clients where id = s.client_id), 'a client'), '#/content');
  return s.id;
end $$;

-- the lead or a supervisor sends a post to the client to approve: {id, link?, email}. With email, the client's logins
-- get it (or, with no login, the contact email on the client), and their reply comes back to whoever sent it.
create function public.send_post(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  s public.posts;
  c public.clients;
  who uuid[];
  lnk text;
  what text;
begin
  select * into s from public.posts where id = p ->> 'id' for update;
  perform private.need(s.id is not null and private.sends_post(s, me), 'Only the project lead or a supervisor can send work to the client.');
  perform private.need(s.status in ('idea', 'production', 'made'), 'This post has already gone to the client.');
  perform private.need(not p ? 'link' or trim(coalesce(p ->> 'link', '')) ~* '^(https?://.*)?$', 'The link should start with https://');
  update public.posts set status = 'ready',
    link = case when p ? 'link' then trim(coalesce(p ->> 'link', '')) else link end,
    notes = notes || jsonb_build_array(jsonb_build_object('userId', me.id, 'at', private.iso(), 'text', 'Sent to the client'))
  where id = s.id
  returning * into s;
  select * into c from public.clients where id = s.client_id;
  who := private.client_users(s.client_id);
  lnk := '#/content/post/' || s.id;
  what := s.format || ' ' || private.q(s.title);
  perform private.notify(me.id, who, 'has a ' || s.format || ' ready for your approval: ' || private.q(s.title), lnk);
  if coalesce((p ->> 'email')::boolean, false) then
    if cardinality(who) > 0 then
      perform private.mail(private.emails(who, me.id), 'Ready for your approval: ' || what,
        'YG Digitals has a ' || what || ' ready for your approval. It goes out ' || private.fmt_day(s.date) || '. Open it in YG Hub to approve it or ask for changes.',
        s.link, lnk, me.email);
    else
      perform private.mail(array[c.email], 'Ready for your approval: ' || what,
        'YG Digitals has a ' || what || ' ready for your approval. It goes out ' || private.fmt_day(s.date) || '. Reply to this email to approve it, or say what to change.',
        s.link, '', me.email);
    end if;
  end if;
  perform private.log(me.id, 'sent the ' || what || ' to ' || c.name, lnk);
end $$;

revoke execute on function private.mail(text[], text, text, text, text, text), private.emails(uuid[], uuid), private.senders(text)
  from public, anon, authenticated;
revoke all on private.outbox from public, anon, authenticated;
revoke execute on function public.claim_outbox() from public, anon, authenticated;
grant execute on function public.claim_outbox() to service_role;
revoke execute on function public.send_post(jsonb) from public, anon;
grant execute on function public.send_post(jsonb) to authenticated;
