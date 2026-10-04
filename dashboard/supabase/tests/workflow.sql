-- Workflow rules (overdue + more time, repeating tasks, ongoing projects, undelivered posts), checked as real
-- users against the sample data. Like access.sql: run it on a database loaded with scripts/seed-sql.mjs; it always
-- ends with an error listing every check, which rolls back everything it changed.
do $$
declare
  out text := '';
  n int;
  s text;
  ok boolean;
  vikas uuid := md5('yg-sample:vikas')::uuid;
  priya uuid := md5('yg-sample:priya')::uuid;
  as_ text;
begin
  /* ---------- overdue: the owner asks for more time, the lead decides ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.save_task(json_build_object('id', 't4', 'due', private.today() + 9)::jsonb);
    out := out || E'\n✗ owner moved their own deadline';
  exception when others then
    out := out || format(E'\n✓ an owner can''t move their own deadline (%s)', sqlerrm);
  end;
  begin
    perform public.ask_time(json_build_object('id', 't4', 'due', private.today() + 8)::jsonb);
    out := out || E'\n✗ asked without a reason';
  exception when others then
    out := out || format(E'\n✓ asking needs a reason (%s)', sqlerrm);
  end;
  perform public.ask_time(json_build_object('id', 't4', 'due', private.today() + 8, 'reason', 'Footage came in late')::jsonb);
  perform set_config('role', 'none', true);
  select count(*) into n from public.notifications where text like 'asked for more time on “Edit Reel 1%';
  out := out || format(E'\n%s the admin and the lead hear about it (2): %s', case when n = 2 then '✓' else '✗' end, n);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:ritika')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.decide_time('{"id":"t4","approve":true}');
    out := out || E'\n✗ an outsider gave more time';
  exception when others then
    out := out || format(E'\n✓ only the admin, lead or task giver decides (%s)', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  begin
    perform public.ask_time(json_build_object('id', 't4', 'due', private.today() + 8, 'reason', 'x')::jsonb);
    out := out || E'\n✗ someone else asked on the owner''s behalf';
  exception when others then
    out := out || format(E'\n✓ only the owner asks (%s)', sqlerrm);
  end;
  perform public.decide_time('{"id":"t4","approve":true,"note":"OK, but no later"}');
  perform set_config('role', 'none', true);
  select t.due = private.today() + 8 and x.ask is null and jsonb_array_length(x.extensions) = 1 and (x.extensions -> 0 ->> 'approved')::boolean
    and x.extensions -> 0 ->> 'reason' = 'Footage came in late' into ok
  from public.tasks t join public.task_private x on x.task_id = t.id where t.id = 't4';
  out := out || format(E'\n%s approved: new date, request cleared, extension kept with its reason', case when ok then '✓' else '✗' end);
  select count(*) into n from public.notifications where user_id = vikas and text like 'gave you until%Edit Reel 1%';
  out := out || format(E'\n%s the owner is told: %s', case when n = 1 then '✓' else '✗' end, n);

  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.ask_time(json_build_object('id', 't4', 'due', private.today() + 12, 'reason', 'Client wants a new hook')::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform public.decide_time('{"id":"t4","approve":false,"note":"Use the old hook"}');
  perform set_config('role', 'none', true);
  select t.due = private.today() + 8 and jsonb_array_length(x.extensions) = 2 and not (x.extensions -> 1 ->> 'approved')::boolean into ok
  from public.tasks t join public.task_private x on x.task_id = t.id where t.id = 't4';
  out := out || format(E'\n%s declined: the date stays, the request is kept as declined', case when ok then '✓' else '✗' end);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 't4', 'due', private.today() + 10)::jsonb);
  perform set_config('role', 'none', true);
  select count(*) into n from public.notifications where user_id = vikas and text like 'moved “Edit Reel 1%';
  out := out || format(E'\n%s the lead can move a date, and the owner is told: %s', case when n = 1 then '✓' else '✗' end, n);

  /* ---------- repeating tasks ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.save_task('{"projectId":"p-gv-month","title":"Weekly lead sheet","repeat":"weekly"}');
    out := out || E'\n✗ repeating task without a date';
  exception when others then
    out := out || format(E'\n✓ a repeating task needs a date (%s)', sqlerrm);
  end;
  perform public.save_task(json_build_object('id', 't-rep', 'projectId', 'p-gv-month', 'title', 'Weekly lead sheet', 'repeat', 'weekly',
    'due', private.today(), 'assigneeId', priya, 'dept', 'social',
    'checklist', json_build_array(json_build_object('id', 'c1', 'text', 'Export leads', 'done', false)))::jsonb);
  perform public.check_item('{"id":"t-rep","itemId":"c1","done":true}');
  perform public.save_task('{"id":"t-rep","status":"done","nextId":"t-rep-2"}');
  perform public.save_task('{"id":"t-rep","status":"todo"}');
  perform public.save_task('{"id":"t-rep","status":"done","nextId":"t-rep-3"}');
  perform set_config('role', 'none', true);
  select t.due = private.today() + 7 and t.status = 'todo' and t.repeat = 'weekly' and t.dept = 'social' and t.assignee_id = priya
    and (x.checklist -> 0 ->> 'done')::boolean = false into ok
  from public.tasks t join public.task_private x on x.task_id = t.id where t.id = 't-rep-2';
  out := out || format(E'\n%s finishing it makes next week''s, checklist unticked', case when ok then '✓' else '✗' end);
  select count(*) into n from public.tasks where id = 't-rep-3';
  out := out || format(E'\n%s reopening and finishing again makes no duplicate: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 't-mon', 'projectId', 'p-gv-month', 'title', 'Monthly report', 'repeat', 'monthly',
    'due', '2026-01-31')::jsonb);
  perform public.save_task('{"id":"t-mon","status":"done","nextId":"t-mon-2"}');
  perform set_config('role', 'none', true);
  select due::text into s from public.tasks where id = 't-mon-2';
  out := out || format(E'\n%s monthly keeps to the month''s end (31 Jan → 28 Feb): %s', case when s = '2026-02-28' then '✓' else '✗' end, s);

  /* ---------- ongoing projects, undelivered posts ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_project('{"id":"p-gv-month","ongoing":true}');
  perform public.save_post('{"id":"s4","status":"missed"}');
  perform set_config('role', 'none', true);
  select ongoing and due is null into ok from public.projects where id = 'p-gv-month';
  out := out || format(E'\n%s an ongoing project has no end date', case when ok then '✓' else '✗' end);
  select status into s from public.posts where id = 's4';
  out := out || format(E'\n%s a post can be marked undelivered: %s', case when s = 'missed' then '✓' else '✗' end, s);

  /* ---------- leave ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.apply_leave(json_build_object('start', private.today())::jsonb);
    out := out || E'\n✗ leave today with work still due today';
  exception when others then
    out := out || format(E'\n✓ leave today needs today''s work done first (%s)', sqlerrm);
  end;
  begin
    perform public.apply_leave(json_build_object('start', private.today() + 1)::jsonb);
    out := out || E'\n✗ leave tomorrow with a post still due tomorrow';
  exception when others then
    out := out || format(E'\n✓ …posts count too (%s)', sqlerrm);
  end;
  perform public.apply_leave(json_build_object('id', 'l1', 'start', private.today() + 3, 'end', private.today() + 4, 'note', 'Sister''s wedding')::jsonb);
  begin
    perform public.apply_leave(json_build_object('start', private.today() + 4, 'end', private.today() + 6)::jsonb);
    out := out || E'\n✗ overlapping leave';
  exception when others then
    out := out || format(E'\n✓ no overlapping leave (%s)', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  select count(*) into n from public.leaves where user_id = vikas;
  out := out || format(E'\n%s the team doesn''t see a pending request: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  select count(*) into n from public.leave_private where note = 'Sister''s wedding';
  out := out || format(E'\n%s the admin sees the request and its note: %s', case when n = 1 then '✓' else '✗' end, n);
  begin
    perform public.decide_leave('{"id":"l1","approve":true}');
    out := out || E'\n✗ approved with work still due';
  exception when others then
    out := out || format(E'\n✓ approving warns about work due while away (%s)', sqlerrm);
  end;
  perform public.decide_leave('{"id":"l1","approve":true,"force":true,"reply":"Enjoy"}');
  perform public.apply_leave(json_build_object('id', 'l2', 'start', private.today() + 20)::jsonb);
  begin
    perform public.decide_leave('{"id":"l2","approve":true}');
    out := out || E'\n✗ admin approved their own leave';
  exception when others then
    out := out || format(E'\n✓ another admin decides an admin''s leave (%s)', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  select (select count(*) from public.leaves where id = 'l1') * 10 + (select count(*) from public.leave_private) into n;
  out := out || format(E'\n%s the team sees approved leave, not its note: %s', case when n = 10 then '✓' else '✗' end, n);
  perform set_config('role', 'none', true);
  select private.away(vikas, private.today() + 3) and not private.away(vikas, private.today() + 5) into ok;
  out := out || format(E'\n%s away on the approved days only', case when ok then '✓' else '✗' end);
  select count(*) into n from public.notifications where user_id = vikas and text = 'approved your leave: ' || private.leave_days(private.today() + 3, private.today() + 4) || ' — Enjoy';
  out := out || format(E'\n%s they''re told, with the reply: %s', case when n = 1 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.cancel_leave('{"id":"l1"}');
  perform set_config('role', 'none', true);
  select count(*) into n from public.leaves where id = 'l1';
  out := out || format(E'\n%s approved leave can be cancelled before it starts: %s left', case when n = 0 then '✓' else '✗' end, n);

  /* ---------- compensation: what we owe a client for work never delivered ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.save_compensation(json_build_object('clientId', 'desi', 'missed', 'Reel — Ghar ki Mithaas', 'offer', '1 extra Reel', 'shared', true)::jsonb);
    out := out || E'\n✗ a member shared a make-up with the client';
  exception when others then
    out := out || format(E'\n✓ only an admin shares a make-up with the client (%s)', sqlerrm);
  end;
  perform public.save_compensation(json_build_object('id', 'k1', 'clientId', 'desi', 'postId', 's4', 'missed', 'Reel — Ghar ki Mithaas',
    'offer', '1 extra Reel', 'due', private.today() + 7, 'ownerId', vikas)::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  select count(*) into n from public.compensations where id = 'k1';
  out := out || format(E'\n%s the owner sees it: %s', case when n = 1 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:ritika')::uuid, 'role', 'authenticated')::text, true);
  select count(*) into n from public.compensations;
  out := out || format(E'\n%s the rest of the team doesn''t: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:rahul')::uuid, 'role', 'authenticated')::text, true);
  select count(*) into n from public.compensations where id = 'k1';
  out := out || format(E'\n%s the client doesn''t until it''s shared: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform public.save_compensation('{"id":"k1","shared":true}');
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:rahul')::uuid, 'role', 'authenticated')::text, true);
  select count(*) into n from public.compensations where id = 'k1';
  out := out || format(E'\n%s shared: the client sees it: %s', case when n = 1 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform public.give_compensation('{"id":"k1"}');
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_compensation('{"id":"k1"}');
    out := out || E'\n✗ a member removed a make-up';
  exception when others then
    out := out || format(E'\n✓ only an admin removes one (%s)', sqlerrm);
  end;
  perform set_config('role', 'none', true);
  select status = 'given' and given_at = private.today() into ok from public.compensations where id = 'k1';
  out := out || format(E'\n%s the owner marks it given', case when ok then '✓' else '✗' end);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:rahul')::uuid and (text like 'will make up for%' or text like 'delivered your make-up%');
  out := out || format(E'\n%s the client hears when it''s promised and when it''s given (2): %s', case when n = 2 then '✓' else '✗' end, n);

  /* ---------- the morning job ---------- */
  perform set_config('role', 'none', true);
  update public.posts set date = private.today() - 1, status = 'production' where id = 's5'; -- Priya's Reel, a day late, never marked
  update public.compensations set due = private.today() where id = 'k-navratri';
  insert into public.leaves (id, user_id, start, "end", status) values ('l-away', md5('yg-sample:arjun')::uuid, private.today(), private.today(), 'approved');
  delete from public.notifications;
  perform private.daily();
  select count(*) into n from public.notifications where user_id = vikas and text like '“Factory shoot%is overdue%';
  out := out || format(E'\n%s owners hear about their overdue work: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:arjun')::uuid and text like '%is overdue%';
  out := out || format(E'\n%s …but not while they''re on leave: %s', case when n = 0 then '✓' else '✗' end, n);
  select string_agg(text, ' | ') into s from public.notifications where user_id = md5('yg-sample:aman')::uuid and text like '“Send last week%';
  out := out || format(E'\n%s the admin hears about work 2+ days overdue with no request for time: %s',
    case when s like '“Send last week’s lead sheet to Sunita” (Priya) is 2 days overdue' then '✓' else '✗' end, s);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:aman')::uuid and text like '“Monthly report” (no owner) is % days overdue';
  out := out || format(E'\n%s …unowned work says so: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = priya and text like 'Reel “Office wala Diwali” for Desi Crunch Snacks was due%';
  out := out || format(E'\n%s a post nobody marked: whoever made it is asked to mark it: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = vikas and text = 'Make-up for Desi Crunch Snacks is due today: 1 extra Reel this week';
  out := out || format(E'\n%s a make-up due today reminds whoever''s on it: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where from_id is not null;
  out := out || format(E'\n%s the hub sends these itself (no sender): %s from a person', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications;
  perform private.daily();
  select count(*) - n into n from public.notifications;
  out := out || format(E'\n%s once a day, however often it runs: %s more', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform private.daily();
    out := out || E'\n✗ a signed-in person ran the morning job';
  exception when insufficient_privilege then
    out := out || E'\n✓ only the scheduler runs the morning job';
  end;
  perform set_config('role', 'none', true);

  raise exception E'RESULTS (rolled back)%', out;
end $$;
