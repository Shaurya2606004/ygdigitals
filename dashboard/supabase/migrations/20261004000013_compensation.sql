-- Compensation: what the studio owes a client for work that was promised and not delivered (a missed Reel, a
-- post that never went out). Each one says what was missed, what we'll give instead, by when and who's on it,
-- and stays open until it's given. The team records them; only an admin shares one with the client.

create table public.compensations (
  id text primary key default gen_random_uuid()::text check (length(id) <= 64),
  client_id text not null references public.clients on delete cascade,
  post_id text references public.posts on delete set null,
  missed text not null check (length(trim(missed)) between 1 and 300),
  offer text not null check (length(trim(offer)) between 1 and 300),
  due date,
  owner_id uuid references public.people on delete set null,
  status text not null default 'open' check (status in ('open', 'given')),
  shared boolean not null default false,
  created_by uuid references public.people on delete set null,
  created_at timestamptz not null default now(),
  given_at date,
  rev int not null default 0
);
create index on public.compensations (client_id);
create index on public.compensations (post_id);
create index on public.compensations (owner_id);
create index on public.compensations (created_by);
create trigger bump_rev before update on public.compensations for each row execute function private.bump_rev();

alter table public.compensations enable row level security;
create policy read on public.compensations for select to authenticated using (
  (select private.sees_all()) or owner_id = (select auth.uid()) or created_by = (select auth.uid())
  or (shared and client_id = (select private.my_client()))
);
revoke all on public.compensations from anon;
revoke insert, update, delete, truncate, references, trigger on public.compensations from authenticated;
grant select on public.compensations to authenticated;
alter publication supabase_realtime add table public.compensations;

create function public.save_compensation(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  cid text := nullif(p ->> 'id', '');
  old public.compensations;
  c public.compensations;
begin
  select * into old from public.compensations where id = cid for update;
  perform private.need(case when old.id is null then me.role in ('admin', 'member') else me.role = 'admin' or old.created_by = me.id end,
    'You don''t have permission to change this.');
  c.id := coalesce(old.id, cid, gen_random_uuid()::text);
  c.client_id := case when old.id is null or p ? 'clientId' then nullif(p ->> 'clientId', '') else old.client_id end;
  c.post_id := case when old.id is null or p ? 'postId' then nullif(p ->> 'postId', '') else old.post_id end;
  c.missed := case when old.id is null or p ? 'missed' then trim(coalesce(p ->> 'missed', '')) else old.missed end;
  c.offer := case when old.id is null or p ? 'offer' then trim(coalesce(p ->> 'offer', '')) else old.offer end;
  c.due := case when old.id is null or p ? 'due' then nullif(p ->> 'due', '')::date else old.due end;
  c.owner_id := case when old.id is null or p ? 'ownerId' then nullif(p ->> 'ownerId', '')::uuid else old.owner_id end;
  c.shared := case when p ? 'shared' then coalesce((p ->> 'shared')::boolean, false) else coalesce(old.shared, false) end;

  perform private.need(c.client_id is not null and exists (select 1 from public.clients where id = c.client_id), 'Pick the client.');
  perform private.need(length(c.missed) between 1 and 300, 'Say what was missed.');
  perform private.need(length(c.offer) between 1 and 300, 'Say what we’ll give instead.');
  perform private.need(c.owner_id is null or exists (select 1 from public.people where id = c.owner_id and role <> 'client' and active), 'Pick someone from the team.');
  perform private.need(c.post_id is null or exists (select 1 from public.posts where id = c.post_id and client_id = c.client_id), 'That post isn''t this client''s.');
  perform private.need(c.shared is not distinct from coalesce(old.shared, false) or me.role = 'admin', 'Only a supervisor shares this with the client.');

  if old.id is null then
    insert into public.compensations (id, client_id, post_id, missed, offer, due, owner_id, shared, created_by)
    values (c.id, c.client_id, c.post_id, c.missed, c.offer, c.due, c.owner_id, c.shared, me.id);
  else
    update public.compensations set client_id = c.client_id, post_id = c.post_id, missed = c.missed, offer = c.offer, due = c.due,
      owner_id = c.owner_id, shared = c.shared
    where id = c.id;
  end if;
  if c.owner_id is not null and c.owner_id is distinct from old.owner_id then
    perform private.notify(me.id, array[c.owner_id], 'gave you the compensation for ' || (select name from public.clients where id = c.client_id)
      || ': ' || c.offer || coalesce(' by ' || private.fmt_day(c.due), ''), '#/content/owed');
  end if;
  if c.shared and not coalesce(old.shared, false) then
    perform private.notify(me.id, private.client_users(c.client_id), 'will make up for ' || c.missed || ': ' || c.offer
      || coalesce(' by ' || private.fmt_day(c.due), ''), '#/');
  end if;
  perform private.log(me.id, case when old.id is null then 'noted compensation owed to ' else 'updated compensation owed to ' end
    || (select name from public.clients where id = c.client_id) || ': ' || c.offer, '#/content/owed');
  return c.id;
end $$;

create function public.give_compensation(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  c public.compensations;
begin
  select * into c from public.compensations where id = p ->> 'id' for update;
  perform private.need(c.id is not null, 'This no longer exists.');
  perform private.need(me.role = 'admin' or c.owner_id = me.id or c.created_by = me.id, 'You don''t have permission to change this.');
  perform private.need(c.status = 'open', 'This has already been given.');
  update public.compensations set status = 'given', given_at = private.today() where id = c.id;
  perform private.notify(me.id, private.admins() || c.created_by, 'gave ' || (select name from public.clients where id = c.client_id)
    || ' their compensation: ' || c.offer, '#/content/owed');
  if c.shared then
    perform private.notify(me.id, private.client_users(c.client_id), 'delivered your compensation: ' || c.offer, '#/');
  end if;
  perform private.log(me.id, 'gave ' || (select name from public.clients where id = c.client_id) || ' their compensation: ' || c.offer, '#/content/owed');
end $$;

create function public.delete_compensation(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
begin
  perform private.need(me.role = 'admin', 'Only a supervisor can remove this.');
  delete from public.compensations where id = p ->> 'id';
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
    'compensations', (select coalesce(jsonb_agg(t order by t.created_at), '[]') from public.compensations t),
    'activity', (select coalesce(jsonb_agg(a order by a.at desc), '[]') from (select * from public.activity order by at desc limit 100) a),
    'notifications', (select coalesce(jsonb_agg(n order by n.at desc), '[]') from (select * from public.notifications order by at desc limit 100) n)
  )
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
