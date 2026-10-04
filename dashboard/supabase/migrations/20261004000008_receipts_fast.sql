-- Read receipts, same rule as before but worked out once per query instead of once per row (the bootstrap went
-- from ~18 ms to ~9). receipts() lists what you may see: an open conversation's id (company and project
-- channels you can read: everyone's receipts) or "<conversation id> <member id>" for each member of a DM or group
-- you can read (only members' receipts, so an admin reading a group they aren't in never shows up).
create function private.receipts() returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(case when c.type in ('dm', 'group') then c.id || ' ' || m::text else c.id end), '{}')
  from (select private.me() u) me
  cross join public.channels c
  left join lateral unnest(case when c.type in ('dm', 'group') then c.member_ids end) m on true
  where private.sees_channel(c, me.u)
$$;
grant execute on function private.receipts() to authenticated;

drop policy read on public.reads;
create policy read on public.reads for select to authenticated using (
  user_id = (select auth.uid())
  or channel_id = any ((select private.receipts())::text[])
  or channel_id || ' ' || user_id = any ((select private.receipts())::text[])
);
drop function private.sees_read(text, uuid, public.people);
