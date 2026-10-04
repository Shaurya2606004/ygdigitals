-- People taken out of a group are told. Their app needs the nudge too: once they can't see the group, the
-- change itself never reaches them, so this notice is what makes it drop the group straight away.
create or replace function public.save_group(p jsonb) returns text language plpgsql security definer set search_path = '' as $$
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
    perform private.notify(me.id, gone, 'removed you from the group ' || private.q(nm), '#/chat/' || gid);
  end if;
  return gid;
end $$;

