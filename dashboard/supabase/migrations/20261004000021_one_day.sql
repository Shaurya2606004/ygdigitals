-- One day per post (asked for 2026-10-09): a post's work is due the day the post goes out, not the day before. The
-- calendar showed each post's work a day ahead of the post itself.
--  * a post's task is made due on the post's day, and a post moved to another day takes its task there
--  * open work due the day before its post (the old rule) moves to the post's day
--  * work pushed past its post's day before the post followed it (two pushes on 2026-10-09, before
--    *_upload_handover.sql went live): the post goes out that day, as the push meant

-- as in *_content_tasks.sql, due the day the post goes out
create or replace function private.post_task(s public.posts, by uuid) returns void language plpgsql security definer set search_path = '' as $$
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
    s.date, s.format || ': ' || s.title, s.dept, giver)
  on conflict do nothing;
  insert into public.task_private (task_id, "desc") values (tid, s.brief) on conflict do nothing;
  update public.posts set task_made = true where id = s.id;
  if s.assignee_id is not null and giver is not null then
    perform private.notify(giver, array[s.assignee_id], 'gave you ' || private.q(s.format || ': ' || s.title) || ' — it goes out '
      || private.fmt_day(s.date), '#/tasks/' || tid);
  end if;
end $$;

-- as in *_upload_handover.sql, and a post moved to another day takes its task to that day
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
  du := case when new.date is distinct from old.date then new.date else k.due end;
  who := case when new.assignee_id is distinct from old.assignee_id then new.assignee_id else k.assignee_id end;
  if (st, ti, du, who) is distinct from (k.status, k.title, k.due, k.assignee_id) then
    update public.tasks set status = st, title = ti, due = du, assignee_id = who,
      completed_at = case when st = 'done' then coalesce(k.completed_at, private.today()) end
    where id = k.id;
  end if;
  if new.date is distinct from old.date then
    update public.tasks set due = new.date where upload_of = k.id and status <> 'done' and due is distinct from new.date;
  end if;
  return null;
end $$;

drop function private.post_due(date);

update public.tasks k set due = s.date
from public.posts s
where k.post_id = s.id and k.status <> 'done' and k.due = s.date - 1;

update public.posts s set date = k.due
from public.tasks k
where k.post_id = s.id and k.status <> 'done' and k.due > s.date and s.status not in ('posted', 'missed');
