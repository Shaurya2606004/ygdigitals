-- Leave: anyone at the studio applies for days off and an admin decides. Leave for today or tomorrow is only
-- accepted once the work due on those days is done or handed off; an admin approving leave is warned about any
-- work still due while the person is away. The team sees approved leave (who's away when); the note and the
-- admin's reply stay between the person and the admins.

create table public.leaves (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  user_id uuid not null references public.people on delete cascade,
  start date not null,
  "end" date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.people on delete set null,
  created_at timestamptz not null default now(),
  rev int not null default 0,
  check (start <= "end")
);
create index on public.leaves (user_id);
create index on public.leaves (decided_by);

create table public.leave_private (
  leave_id text primary key references public.leaves on delete cascade,
  note text not null default '' check (length(note) <= 2000),
  reply text not null default '' check (length(reply) <= 2000),
  rev int not null default 0
);

create trigger bump_rev before update on public.leaves for each row execute function private.bump_rev();
create trigger bump_rev before update on public.leave_private for each row execute function private.bump_rev();

alter table public.leaves enable row level security;
alter table public.leave_private enable row level security;
create policy read on public.leaves for select to authenticated using (
  (select private.sees_all()) or user_id = (select auth.uid())
  or (status = 'approved' and (select private.my_role()) in ('admin', 'member', 'freelancer'))
);
create policy read on public.leave_private for select to authenticated using (
  (select private.sees_all()) or leave_id in (select id from public.leaves where user_id = (select auth.uid()))
);
revoke all on public.leaves, public.leave_private from anon;
revoke insert, update, delete, truncate, references, trigger on public.leaves, public.leave_private from authenticated;
grant select on public.leaves, public.leave_private to authenticated;
alter publication supabase_realtime add table public.leaves, public.leave_private;

-- is this person on approved leave that day?
create function private.away(u uuid, d date) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leaves where user_id = u and status = 'approved' and d between start and "end")
$$;

-- their tasks and posts still to do that fall due between two days, by title
create function private.open_work(u uuid, s date, e date) returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(title order by due), '{}') from (
    select title, due from public.tasks where assignee_id = u and status <> 'done' and due between s and e
    union all
    select title, date from public.posts where assignee_id = u and status not in ('scheduled', 'posted', 'missed') and date between s and e
  ) w
$$;

create function private.leave_days(s date, e date) returns text language sql immutable set search_path = '' as $$
  select case when s = e then private.fmt_day(s) else private.fmt_day(s) || ' – ' || private.fmt_day(e) end
$$;

grant execute on all functions in schema private to authenticated;

create function public.apply_leave(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  s date := nullif(p ->> 'start', '')::date;
  e date := coalesce(nullif(p ->> 'end', '')::date, nullif(p ->> 'start', '')::date);
  note text := trim(coalesce(p ->> 'note', ''));
  lid text := coalesce(nullif(p ->> 'id', ''), gen_random_uuid()::text);
  due text[];
begin
  perform private.need(me.role in ('admin', 'member', 'freelancer'), 'You don''t have permission to apply for leave.');
  perform private.need(s is not null and s >= private.today(), 'Pick the first day (today or later).');
  perform private.need(e >= s and e - s <= 60, 'Pick the last day (on or after the first, at most two months).');
  perform private.need(length(note) <= 2000, 'Keep the note shorter.');
  perform private.need(not exists (select 1 from public.leaves where user_id = me.id and status <> 'declined' and start <= e and "end" >= s),
    'You already have leave on some of those days.');
  -- short notice: the work for those days has to be done (or handed on) before you go
  if s <= private.today() + 1 then
    due := private.open_work(me.id, s, e);
    perform private.need(cardinality(due) = 0, 'Leave from today or tomorrow needs the work due on those days done or handed over first: '
      || (select string_agg(private.q(x), ', ') from unnest(due[1:3]) x) || case when cardinality(due) > 3 then ' and ' || cardinality(due) - 3 || ' more' else '' end || '.');
  end if;
  insert into public.leaves (id, user_id, start, "end") values (lid, me.id, s, e);
  insert into public.leave_private (leave_id, note) values (lid, note);
  perform private.notify(me.id, private.admins(), 'asked for leave: ' || private.leave_days(s, e) || case when note <> '' then ' — ' || left(note, 90) else '' end, '#/leave');
  return lid;
end $$;

create function public.decide_leave(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  l public.leaves;
  ok boolean := coalesce((p ->> 'approve')::boolean, false);
  answer text := trim(coalesce(p ->> 'reply', ''));
  due text[];
begin
  perform private.need(me.role = 'admin', 'Only a supervisor can approve leave.');
  select * into l from public.leaves where id = p ->> 'id' for update;
  perform private.need(l.id is not null, 'This leave request no longer exists.');
  perform private.need(l.user_id <> me.id, 'Another supervisor has to decide your own leave.');
  perform private.need(l.status = 'pending', 'This leave has already been decided.');
  if ok and not coalesce((p ->> 'force')::boolean, false) then
    due := private.open_work(l.user_id, l.start, l."end");
    perform private.need(cardinality(due) = 0, cardinality(due) || ' of their tasks or posts are due while they''re away. Hand them on first, or approve anyway.');
  end if;
  update public.leaves set status = case when ok then 'approved' else 'declined' end, decided_by = me.id where id = l.id;
  update public.leave_private set reply = answer where leave_id = l.id;
  perform private.notify(me.id, array[l.user_id], case when ok then 'approved your leave: ' else 'declined your leave: ' end
    || private.leave_days(l.start, l."end") || case when answer <> '' then ' — ' || left(answer, 90) else '' end, '#/leave');
  perform private.log(me.id, case when ok then 'approved ' else 'declined ' end || private.first_name(l.user_id) || '''s leave ('
    || private.leave_days(l.start, l."end") || ')', '#/leave');
end $$;

-- take back a request, or approved leave that hasn't started; an admin can remove any
create function public.cancel_leave(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  l public.leaves;
begin
  select * into l from public.leaves where id = p ->> 'id' for update;
  perform private.need(l.id is not null, 'This leave no longer exists.');
  perform private.need(me.role = 'admin' or (l.user_id = me.id and (l.status <> 'approved' or l.start > private.today())),
    'You can only cancel your own leave before it starts.');
  delete from public.leaves where id = l.id;
  if l.status = 'approved' then
    perform private.notify(me.id, private.admins() || l.user_id, 'cancelled the leave ' || private.leave_days(l.start, l."end")
      || case when l.user_id <> me.id then ' for ' || private.first_name(l.user_id) else '' end, '#/leave');
  end if;
end $$;

create or replace function public.bootstrap() returns jsonb language sql stable security invoker set search_path = '' as $$
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
    'leaves', (select coalesce(jsonb_agg(t order by t.start), '[]') from public.leaves t),
    'leave_private', (select coalesce(jsonb_agg(t), '[]') from public.leave_private t),
    'activity', (select coalesce(jsonb_agg(a order by a.at desc), '[]') from (select * from public.activity order by at desc limit 100) a),
    'notifications', (select coalesce(jsonb_agg(n order by n.at desc), '[]') from (select * from public.notifications order by at desc limit 100) n)
  )
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
