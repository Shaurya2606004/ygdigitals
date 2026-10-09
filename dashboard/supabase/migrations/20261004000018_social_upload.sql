-- Video and Design make it, Social media uploads it (asked for 2026-10-08):
--  * any Video or Design task marked Done makes a Social media task at once: "Upload: <title>", in the same project,
--    given to no one (everyone in Social media sees it and is told), due the day its post goes out (no post: today).
--    Reopened before it's uploaded (sent back for changes, say) → that upload task goes; Done again → it's made again.
--  * finishing the upload task marks its post Posted; a post marked Posted or Undelivered closes its upload task
--  * Social media tasks have no "Ready to check": they go straight to Done
-- The app shows finished tasks for a day after they're done; that is the screen's rule, nothing is deleted.

alter table public.tasks add column upload_of text unique references public.tasks on delete cascade;

update public.tasks set status = 'doing' where dept = 'social' and status = 'review';
alter table public.tasks add constraint tasks_social_no_check check (dept <> 'social' or status <> 'review');

-- a Video or Design task finished or reopened: its upload task follows
create function private.upload_task() returns trigger language plpgsql security definer set search_path = '' as $$
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
  insert into public.tasks (id, project_id, upload_of, status, priority, due, title, dept, created_by)
  values (tid, new.project_id, new.id, 'todo', new.priority, goes, left('Upload: ' || new.title, 300), 'social', who)
  on conflict do nothing;
  if found then
    insert into public.task_private (task_id) values (tid);
    perform private.notify(who, array(select p.id from public.people p, public.tasks k where k.id = tid and p.dept = 'social' and private.sees_task(k, p)),
      'finished ' || private.q(new.title) || ' — upload it', '#/tasks/' || tid);
  end if;
  return null;
end $$;
create trigger upload_task after update of status on public.tasks for each row
  when (new.dept in ('video', 'design') and (new.status = 'done') <> (old.status = 'done'))
  execute function private.upload_task();

-- uploaded: its post is out
create function private.uploaded() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set status = 'posted'
  where id = (select post_id from public.tasks where id = new.upload_of) and status not in ('posted', 'missed');
  return null;
end $$;
create trigger uploaded after update of status on public.tasks for each row
  when (new.upload_of is not null and new.status = 'done' and old.status <> 'done')
  execute function private.uploaded();

-- a post marked Posted or Undelivered: nothing left to upload
create function private.post_out() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set status = 'done', completed_at = coalesce(completed_at, private.today())
  where upload_of = (select id from public.tasks where post_id = new.id) and status <> 'done';
  return null;
end $$;
create trigger post_out after update of status on public.posts for each row
  when (new.status in ('posted', 'missed') and old.status not in ('posted', 'missed'))
  execute function private.post_out();

revoke execute on function private.upload_task(), private.uploaded(), private.post_out() from public, anon, authenticated;
