-- Group chats, editing and deleting messages, read receipts ("Seen"), and the typing and online signals.
-- Groups are for the team only (no client logins). An admin can read every group, including ones they aren't
-- in, and members aren't told. So an admin who isn't in a group can't post, edit or delete there, never
-- appears as having read anything, and leaves no trace.

/* ---------- tables ---------- */

alter table public.channels drop constraint channels_type_check,
  add constraint channels_type_check check (type in ('public', 'project', 'dm', 'group'));

alter table public.messages
  add column system boolean not null default false, -- "Priya added Rahul": written by the server, never edited
  add column edited_at timestamptz,
  add column deleted boolean not null default false, -- the text is wiped; a "message deleted" line stays
  add column rev int not null default 0,
  drop constraint messages_text_check,
  add constraint messages_text_check check (case when deleted then text = '' else length(text) between 1 and 4000 end);
create trigger bump_rev before update on public.messages for each row execute function private.bump_rev();

/* ---------- who sees and who posts ---------- */

create or replace function private.sees_channel(c public.channels, u public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.active, false) and case c.type
    when 'dm' then u.id = any (c.member_ids)
    when 'group' then u.role = 'admin' or (u.role = 'member' and u.id = any (c.member_ids))
    when 'project' then u.role <> 'client'
      or (c.client_visible and exists (select 1 from public.projects p where p.id = c.project_id and p.client_id = u.client_id))
    else u.role <> 'client'
  end
$$;

-- posting takes more than seeing: an admin reading a group they aren't in can't post, and only the admin
-- posts announcements
create function private.can_post(c public.channels, u public.people) returns boolean language sql stable set search_path = '' as $$
  select private.sees_channel(c, u) and (c.type <> 'group' or u.id = any (c.member_ids)) and (not c.read_only or u.role = 'admin')
$$;

-- read receipts: you see when the others in a conversation last read it. In DMs and groups only the members
-- count, so an admin reading a group they aren't in never shows up
create function private.sees_read(cid text, uid uuid, me public.people) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.channels c where c.id = cid and private.sees_channel(c, me)
    and (c.type not in ('dm', 'group') or uid = any (c.member_ids)))
$$;

drop policy read on public.reads;
create policy read on public.reads for select to authenticated
  using (user_id = (select auth.uid()) or private.sees_read(channel_id, user_id, (select private.me())));

/* ---------- groups ---------- */

-- first names for a system line: "Priya", "Priya and Rahul", "Priya, Rahul and Vikas"
create function private.names(ids uuid[]) returns text language plpgsql stable set search_path = '' as $$
declare
  ns text[] := array(select split_part(name, ' ', 1) from public.people where id = any (ids) order by name);
  n int := cardinality(ns);
begin
  return case when n <= 1 then coalesce(ns[1], 'someone') else array_to_string(ns[1:n - 1], ', ') || ' and ' || ns[n] end;
end $$;

create function private.system_line(cid text, who uuid, txt text) returns void language sql set search_path = '' as $$
  insert into public.messages (channel_id, user_id, text, system, at) values (cid, who, txt, true, clock_timestamp())
$$;

-- create a group, or rename it and change who's in it. Anyone on the team can create one; only its members can
-- change it. Members are active team people, always including you (leaving is leave_group).
create function public.save_group(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  gid text := nullif(p ->> 'id', '');
  g public.channels;
  nm text;
  ids uuid[];
  added uuid[];
  gone uuid[];
begin
  perform private.need(me.role in ('admin', 'member'), 'You don''t have permission to create groups.');
  select * into g from public.channels where id = gid and type = 'group';
  perform private.need(g.id is null or me.id = any (g.member_ids), 'Only the people in a group can change it.');
  nm := case when p ? 'name' or g.id is null then trim(coalesce(p ->> 'name', '')) else g.name end;
  perform private.need(length(nm) between 1 and 80, 'Give the group a name (up to 80 characters).');
  ids := case when p ? 'memberIds' or g.id is null
    then array(select id from public.people where id = any (private.ids(p -> 'memberIds') || me.id) and role <> 'client' and active)
    else g.member_ids end;
  perform private.need(cardinality(ids) >= 2, 'Add at least one other person.');

  if g.id is null then
    perform private.need(gid ~ '^grp-[0-9a-f-]{36}$', 'That group id is not valid.');
    insert into public.channels (id, type, name, member_ids) values (gid, 'group', nm, ids);
    perform private.system_line(gid, me.id, 'created the group');
    perform private.notify(me.id, ids, 'added you to the group ' || private.q(nm), '#/chat/' || gid);
    return gid;
  end if;

  added := array(select unnest(ids) except select unnest(g.member_ids));
  gone := array(select unnest(g.member_ids) except select unnest(ids));
  update public.channels set name = nm, member_ids = ids where id = gid;
  if nm <> g.name then
    perform private.system_line(gid, me.id, 'renamed the group to ' || private.q(nm));
  end if;
  if cardinality(added) > 0 then
    perform private.system_line(gid, me.id, 'added ' || private.names(added));
    perform private.notify(me.id, added, 'added you to the group ' || private.q(nm), '#/chat/' || gid);
  end if;
  if cardinality(gone) > 0 then
    perform private.system_line(gid, me.id, 'removed ' || private.names(gone));
  end if;
  return gid;
end $$;

create function public.leave_group(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  g public.channels;
begin
  select * into g from public.channels where id = p ->> 'id' and type = 'group';
  perform private.need(g.id is not null and me.id = any (g.member_ids), 'You are not in this group.');
  update public.channels set member_ids = array_remove(member_ids, me.id) where id = g.id;
  perform private.system_line(g.id, me.id, 'left the group');
end $$;

/* ---------- messages ---------- */

create or replace function public.send_message(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  c public.channels;
  txt text := trim(coalesce(p ->> 'text', ''));
  short text;
  lnk text;
  place text;
begin
  select * into c from public.channels where id = p ->> 'channelId';
  perform private.need(c.id is not null and private.can_post(c, me), 'You don''t have permission to post here.');
  perform private.need(length(txt) between 1 and 4000, 'Write a message first (up to 4,000 characters).');
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
  -- only people who are really in the conversation (never an admin reading a group they aren't in)
  perform private.notify(me.id, array(select u.id from public.people u where u.id = any (private.mentions(txt)) and private.can_post(c, u)),
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

-- your own messages, while you can still post in that conversation. No new notifications on an edit.
create function public.edit_message(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  m public.messages;
  c public.channels;
  txt text := trim(coalesce(p ->> 'text', ''));
begin
  select * into m from public.messages where id = p ->> 'id';
  select * into c from public.channels where id = m.channel_id;
  perform private.need(m.id is not null and m.user_id = me.id and not m.system and not m.deleted and private.can_post(c, me),
    'You can only edit your own messages.');
  perform private.need(length(txt) between 1 and 4000, 'A message can''t be empty (or over 4,000 characters).');
  if txt <> m.text then
    update public.messages set text = txt, edited_at = now() where id = m.id;
  end if;
end $$;

-- your own messages; the admin can also remove anyone's, in conversations they post in
create function public.delete_message(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.people := private.me();
  m public.messages;
  c public.channels;
begin
  select * into m from public.messages where id = p ->> 'id';
  select * into c from public.channels where id = m.channel_id;
  perform private.need(m.id is not null and not m.system and private.can_post(c, me) and (m.user_id = me.id or me.role = 'admin'),
    'You can only delete your own messages.');
  update public.messages set deleted = true, text = '' where id = m.id and not deleted;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

/* ---------- typing and online (Realtime private channels) ---------- */

-- "Priya is typing…" is a broadcast on the topic 'typing:<conversation id>': anyone who can read the
-- conversation may listen, only people who can post in it may send
create function private.topic_ok(topic text, post boolean) returns boolean language sql stable security definer set search_path = '' as $$
  select topic like 'typing:%' and exists (select 1 from public.channels c where c.id = substr(topic, 8)
    and case when post then private.can_post(c, private.me()) else private.sees_channel(c, private.me()) end)
$$;
grant execute on function private.topic_ok(text, boolean) to authenticated;

create policy "typing: listen" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and (select private.topic_ok(realtime.topic(), false)));
create policy "typing: send" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and (select private.topic_ok(realtime.topic(), true)));

-- who's online: presence on the topic 'online', for anyone with an active login
create policy "online: see" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'presence' and (select realtime.topic()) = 'online' and (select private.my_role()) is not null);
create policy "online: show" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'presence' and (select realtime.topic()) = 'online' and (select private.my_role()) is not null);
