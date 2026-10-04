-- Owner: one level above supervisor (role 'admin'). Owners can do everything a supervisor can; the app gives them a
-- simpler Home (what's late, and whether today's work went out). A flag rather than a new role, so every
-- supervisor rule already covers them.
alter table public.people add column owner boolean not null default false,
  add constraint people_owner_is_admin check (not owner or role = 'admin');

-- plainer words for the activity log, like TASK_STATUS in the app
create or replace function private.task_label(s text) returns text language sql immutable set search_path = '' as $$
  select '{"todo":"To do","doing":"In progress","review":"Ready to check","done":"Done"}'::jsonb ->> s
$$;
