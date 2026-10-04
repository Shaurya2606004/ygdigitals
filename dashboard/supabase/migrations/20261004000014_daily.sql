-- Every morning (9 am IST) the hub nudges people about what's slipping, in the app — and by email once the mail
-- function is set up (private.settings 'mail_url', see functions/daily-mail):
--   * your overdue tasks: finish them or hand them over (not while you're on leave)
--   * the supervisors and owners: anything 2+ days overdue
--   * posts whose day has passed that nobody marked posted or undelivered
--   * compensation owed to clients that is due today or late
-- Runs at most once a day, however often it's called.

create table private.daily_runs (
  day date primary key,
  mailed boolean not null default false
);
create table private.settings (
  key text primary key,
  value text not null
);

-- a notice from the hub itself (no person sent it)
create function private.nudge(who uuid, txt text, lnk text) returns void language sql set search_path = '' as $$
  insert into public.notifications (user_id, text, link)
  select p.id, txt, lnk from public.people p where p.id = who and p.active
$$;

create function private.daily() returns void language plpgsql security definer set search_path = '' as $$
declare
  t date := private.today();
  r record;
begin
  insert into private.daily_runs (day) values (t) on conflict do nothing;
  if not found then
    return;
  end if;

  for r in select k.id, k.title, k.due, k.assignee_id from public.tasks k
    where k.status <> 'done' and k.due < t and k.assignee_id is not null and not private.away(k.assignee_id, t)
  loop
    perform private.nudge(r.assignee_id, private.q(r.title) || ' is overdue (was due ' || private.fmt_day(r.due)
      || ') — finish it today, or hand it over', '#/tasks/' || r.id);
  end loop;

  for r in select k.id, k.title, k.due, k.assignee_id, a from public.tasks k
    cross join unnest(private.admins()) a
    where k.status <> 'done' and k.due <= t - 2 and a is distinct from k.assignee_id
  loop
    perform private.nudge(r.a, private.q(r.title) || ' (' || case when r.assignee_id is null then 'not given to anyone' else private.first_name(r.assignee_id) end || ') is '
      || (t - r.due) || ' days overdue', '#/tasks/' || r.id);
  end loop;

  for r in select s.id, s.title, s.format, s.date, s.assignee_id, c.name from public.posts s join public.clients c on c.id = s.client_id
    where s.date < t and s.status not in ('posted', 'missed')
  loop
    perform private.nudge(x, r.format || ' ' || private.q(r.title) || ' for ' || r.name || ' was due ' || private.fmt_day(r.date)
      || ' — mark it posted, or undelivered and note the compensation', '#/content')
    from unnest(case when r.assignee_id is null or private.away(r.assignee_id, t) then private.admins() else array[r.assignee_id] end) x;
  end loop;

  for r in select k.offer, k.due, k.owner_id, c.name from public.compensations k join public.clients c on c.id = k.client_id
    where k.status = 'open' and k.due <= t
  loop
    perform private.nudge(x, 'Compensation for ' || r.name || ' ' || case when r.due = t then 'is due today' else 'is late' end || ': ' || r.offer, '#/content/owed')
    from unnest(case when r.owner_id is null or r.due < t then private.admins() || r.owner_id else array[r.owner_id] end) x
    where x is not null;
  end loop;

  -- the morning email, once the mail function's address is set
  if exists (select 1 from pg_extension where extname = 'pg_net') and exists (select 1 from private.settings where key = 'mail_url') then
    perform net.http_post(url := (select value from private.settings where key = 'mail_url'), body := jsonb_build_object('day', t));
  end if;
end $$;

-- the mail function claims the day's email once (the service role only)
create function public.claim_daily_mail() returns boolean language sql security definer set search_path = '' as $$
  update private.daily_runs set mailed = true where day = private.today() and not mailed returning true
$$;
revoke execute on function public.claim_daily_mail() from public, anon, authenticated;
grant execute on function public.claim_daily_mail() to service_role;
revoke all on private.daily_runs, private.settings from public, anon, authenticated;
revoke execute on function private.daily() from public, anon, authenticated;
revoke execute on function private.nudge(uuid, text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('yg-hub-daily', '30 3 * * *', 'select private.daily()'); -- 03:30 UTC = 9:00 am IST
  end if;
end $$;
