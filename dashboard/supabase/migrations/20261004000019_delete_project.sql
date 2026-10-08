-- Delete a project (asked for 2026-10-08): a supervisor, typing the project's name to confirm. Its tasks (with their
-- upload tasks), work for approval and project chat go with it. Its posts stay in the client's content plan with no
-- project, ready to get a fresh task if they're put into another one. Meetings stay on the calendar, unlinked.

create function public.delete_project(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  x public.projects;
begin
  perform private.need(me.role = 'admin', 'You don''t have permission to delete projects.');
  select * into x from public.projects where id = p ->> 'id' for update;
  perform private.need(x.id is not null, 'This project no longer exists.');
  perform private.need(lower(trim(coalesce(p ->> 'confirm', ''))) = lower(x.name), 'Type the project’s name exactly to confirm.');
  update public.posts set project_id = null, task_made = false where project_id = x.id;
  delete from public.projects where id = x.id;
  perform private.log(me.id, 'deleted the project ' || private.q(x.name) || ' with its tasks, work and discussion', '#/projects');
end $$;

revoke execute on function public.delete_project(jsonb) from public, anon;
grant execute on function public.delete_project(jsonb) to authenticated;
