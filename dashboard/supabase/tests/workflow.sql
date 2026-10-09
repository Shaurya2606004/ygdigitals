-- Workflow rules (overdue dates, owners, repeating tasks, ongoing projects, undelivered posts), checked as real
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
  /* ---------- overdue: only a supervisor, the lead or whoever gave the task moves its date ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.save_task(json_build_object('id', 't4', 'due', private.today() + 9)::jsonb);
    out := out || E'\n✗ the person doing it moved their own deadline';
  exception when others then
    out := out || format(E'\n✓ the person doing a task can''t move its date (%s)', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform public.save_task(json_build_object('id', 't4', 'due', private.today() + 10)::jsonb);
  perform set_config('role', 'none', true);
  select count(*) into n from public.notifications where user_id = vikas and text like 'moved “Edit Reel 1%';
  out := out || format(E'\n%s the lead can move a date, and the person doing it is told: %s', case when n = 1 then '✓' else '✗' end, n);

  /* ---------- owner: a supervisor with the owner flag ---------- */
  begin
    update public.people set owner = true where id = vikas;
    out := out || E'\n✗ a team member was made an owner';
  exception when others then
    out := out || E'\n✓ only a supervisor can be an owner';
  end;
  select owner and role = 'admin' into ok from public.people where id = md5('yg-sample:aman')::uuid;
  out := out || format(E'\n%s the sample owner is a supervisor with the flag', case when ok then '✓' else '✗' end);

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
  -- an imported post: its brief (what to make) is kept, and a later edit without it leaves it alone
  perform public.save_post('{"id":"s-imp","clientId":"desi","date":"2026-11-02","format":"Reel","title":"Missing you","brief":"Festival: Diwali"}');
  perform public.save_post('{"id":"s-imp","title":"Missing you (v2)"}');
  perform set_config('role', 'none', true);
  select brief into s from public.posts where id = 's-imp';
  out := out || format(E'\n%s a post keeps its brief: %s', case when s = 'Festival: Diwali' then '✓' else '✗' end, s);
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
  select count(*) into n from public.notifications where user_id = md5('yg-sample:rahul')::uuid and (text like 'will make up for%' or text like 'delivered your compensation%');
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
  select count(*) into n from public.notifications where user_id = md5('yg-sample:aman')::uuid and text like '“Monthly report” (not given to anyone) is % days overdue';
  out := out || format(E'\n%s …work not given to anyone says so: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = priya and text like 'Reel “Office wala Diwali” for Desi Crunch Snacks was due%';
  out := out || format(E'\n%s a post nobody marked: whoever made it is asked to mark it: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = vikas and text = 'Compensation for Desi Crunch Snacks is due today: 1 extra Reel this week';
  out := out || format(E'\n%s compensation due today reminds whoever''s on it: %s', case when n = 1 then '✓' else '✗' end, n);
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

  /* ---------- the content plan and the tasks, in step ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'imp1', 'clientId', 'desi', 'projectId', 'p-diwali', 'date', private.today() + 3, 'format', 'Reel',
    'title', 'Navratri wishes', 'dept', 'video', 'assigneeId', vikas, 'brief', 'Festival: Navratri', 'quiet', true)::jsonb);
  perform public.save_post(json_build_object('id', 'imp2', 'clientId', 'desi', 'projectId', 'p-diwali', 'date', private.today() + 20, 'format', 'Post',
    'title', 'Later post', 'dept', 'design', 'quiet', true)::jsonb);
  perform set_config('role', 'none', true);
  select format('%s|%s|%s|%s|%s', k.project_id, k.status, k.due - private.today(), k.assignee_id = vikas, k.title) into s from public.tasks k where k.post_id = 'imp1';
  out := out || format(E'\n%s a post in a project, a week away, gets its task (due the day it goes out): %s', case when s = 'p-diwali|todo|3|t|Reel: Navratri wishes' then '✓' else '✗' end, s);
  select "desc" into s from public.task_private where task_id = 'pt-imp1';
  out := out || format(E'\n%s …with the post''s brief as its details: %s', case when s = 'Festival: Navratri' then '✓' else '✗' end, s);
  select count(*) into n from public.tasks where post_id = 'imp2';
  out := out || format(E'\n%s a post three weeks away has no task yet: %s', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = vikas and text like 'gave you “Reel: Navratri wishes” — it goes out %';
  select n = 1 and not exists (select 1 from public.notifications where user_id = vikas and text like 'gave you the Reel “Navratri%') into ok;
  out := out || format(E'\n%s an import tells the maker once, when the task lands in their To do: %s', case when ok then '✓' else '✗' end, n);

  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 'pt-imp1', 'status', 'doing')::jsonb);
  perform set_config('role', 'none', true);
  select s2.status || '|' || (k.status_by = vikas) into s from public.posts s2, public.tasks k where s2.id = 'imp1' and k.id = 'pt-imp1';
  out := out || format(E'\n%s starting the task puts the post in production, and marks who moved it: %s', case when s = 'production|true' then '✓' else '✗' end, s);
  -- made → the lead checks it and sends it (emails queue once the mail function's address is set)
  insert into private.settings values ('mail_url', 'http://mail.test') on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 'pt-imp1', 'status', 'done')::jsonb);
  perform set_config('role', 'none', true);
  select status into s from public.posts where id = 'imp1';
  select count(*) into n from public.notifications where user_id = md5('yg-sample:rahul')::uuid and text like 'has a Reel%';
  out := out || format(E'\n%s finishing it makes the post "Made, to send" — the client hears nothing yet: %s, %s', case when s = 'made' and n = 0 then '✓' else '✗' end, s, n);
  select format('%s|%s', count(*) filter (where text = 'made the Reel “Navratri wishes” for Desi Crunch Snacks — check it and send it to the client' and link = '#/content/post/imp1'),
    count(*) filter (where text = 'finished “Reel: Navratri wishes”')) into s from public.notifications where user_id = priya;
  out := out || format(E'\n%s the lead is told to check it and send it (not just "finished"): %s', case when s = '1|0' then '✓' else '✗' end, s);
  select string_agg(email || ' ' || subject, ', ') into s from private.outbox;
  out := out || format(E'\n%s …and emailed: %s', case when s = 'priya@example.com To check and send: Reel “Navratri wishes” for Desi Crunch Snacks' then '✓' else '✗' end, s);
  delete from private.outbox;
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.send_post(json_build_object('id', 'imp1')::jsonb);
    out := out || E'\n✗ the maker sent it to the client';
  exception when others then
    out := out || format(E'\n✓ the maker can''t send it to the client (%s)', sqlerrm);
  end;
  begin
    perform public.save_post(json_build_object('id', 'imp1', 'status', 'ready')::jsonb);
    out := out || E'\n✗ the maker marked it ready for approval';
  exception when others then
    out := out || E'\n✓ …nor mark it "Ready for approval" by hand';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform public.send_post(json_build_object('id', 'imp1', 'link', 'https://drive.google.com/navratri', 'email', true)::jsonb);
  perform set_config('role', 'none', true);
  select format('%s|%s|%s', status, link, notes -> -1 ->> 'text') into s from public.posts where id = 'imp1';
  select count(*) into n from public.notifications where user_id = md5('yg-sample:rahul')::uuid and text = 'has a Reel ready for your approval: “Navratri wishes”' and link = '#/content/post/imp1';
  out := out || format(E'\n%s the lead sends it: ready for approval, with the link, and the client is asked: %s, %s', case when s = 'ready|https://drive.google.com/navratri|Sent to the client' and n = 1 then '✓' else '✗' end, s, n);
  select string_agg(format('%s %s %s %s', email, reply_to, work, link), ', ') into s from private.outbox;
  out := out || format(E'\n%s …and the client''s login is emailed, replies going to the lead: %s', case when s = 'rahul@example.com priya@example.com https://drive.google.com/navratri #/content/post/imp1' then '✓' else '✗' end, s);
  delete from private.outbox;
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:rahul')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.decide_post(json_build_object('id', 'imp1', 'approve', false, 'note', 'Brighter, please')::jsonb);
  perform set_config('role', 'none', true);
  select s2.status || '|' || k.status into s from public.posts s2, public.tasks k where s2.id = 'imp1' and k.id = 'pt-imp1';
  out := out || format(E'\n%s the client asks for changes: the task is back in To do: %s', case when s = 'production|todo' then '✓' else '✗' end, s);
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 'pt-imp1', 'status', 'done')::jsonb);
  perform public.save_task(json_build_object('id', 'pt-imp1', 'status', 'doing')::jsonb);
  perform set_config('role', 'none', true);
  select status into s from public.posts where id = 'imp1';
  out := out || format(E'\n%s reopening a made task puts its post back in production: %s', case when s = 'production' then '✓' else '✗' end, s);

  delete from private.outbox; -- (reopening and finishing it again emailed the lead again)
  -- a client with no login: the contact email on the client; a lead from another department sees and sends their posts
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'imp5', 'clientId', 'shreeram', 'date', private.today() + 4, 'format', 'Post', 'title', 'Sofa sale', 'status', 'made')::jsonb);
  perform public.send_post(json_build_object('id', 'imp5', 'email', true)::jsonb);
  perform public.save_post(json_build_object('id', 'imp6', 'clientId', 'steel', 'projectId', 'p-steel-web', 'date', private.today() + 4, 'format', 'Post',
    'title', 'Machine of the month', 'dept', 'design', 'status', 'made')::jsonb);
  perform set_config('role', 'none', true);
  select string_agg(format('%s %s %s', email, reply_to, link = ''), ', ') into s from private.outbox;
  out := out || format(E'\n%s a client with no login gets it at their contact email: %s', case when s = 'shreeram@example.com aman@example.com t' then '✓' else '✗' end, s);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:arjun')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.posts where id = 'imp6';
  perform public.send_post(json_build_object('id', 'imp6')::jsonb);
  perform set_config('role', 'none', true);
  select status into s from public.posts where id = 'imp6';
  out := out || format(E'\n%s the project lead (websites) sees a design post in their project and sends it: %s, %s', case when n = 1 and s = 'ready' then '✓' else '✗' end, n, s);
  -- nobody signed in can queue, read or take the email
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  n := 0;
  begin
    perform private.mail(array['someone@example.com'], 'Hi', 'Hi', '', '');
  exception when others then
    n := n + 1;
  end;
  begin
    perform count(*) from private.outbox;
  exception when others then
    n := n + 1;
  end;
  begin
    perform public.claim_outbox();
  exception when others then
    n := n + 1;
  end;
  perform set_config('role', 'none', true);
  out := out || format(E'\n%s a signed-in person can''t queue, read or take emails: %s of 3 refused', case when n = 3 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'imp1', 'status', 'posted')::jsonb);
  perform set_config('role', 'none', true);
  select k.status || '|' || (k.status_by = priya) || '|' || (k.completed_at is not null) into s from public.tasks k where k.id = 'pt-imp1';
  out := out || format(E'\n%s marking the post posted closes its task, marked as Priya''s: %s', case when s = 'done|true|true' then '✓' else '✗' end, s);

  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'imp2', 'date', private.today() + 5)::jsonb);
  perform public.save_post(json_build_object('id', 'imp2', 'date', private.today() + 6, 'title', 'Diwali post')::jsonb);
  perform set_config('role', 'none', true);
  select (k.due - private.today()) || '|' || k.title into s from public.tasks k where k.post_id = 'imp2';
  out := out || format(E'\n%s a post moved into the week gets its task; its new day and title carry over: %s', case when s = '6|Post: Diwali post' then '✓' else '✗' end, s);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.delete_task(json_build_object('id', 'pt-imp2')::jsonb);
  begin
    perform public.save_post(json_build_object('id', 'imp4', 'clientId', 'desi', 'projectId', 'p-gv-month', 'date', private.today() + 2, 'title', 'Wrong one')::jsonb);
    out := out || E'\n✗ a post went into another client''s project';
  exception when others then
    out := out || format(E'\n✓ a post only goes into its own client''s project (%s)', sqlerrm);
  end;
  perform set_config('role', 'none', true);

  -- the morning job: next week's posts get their tasks; a deleted one doesn't come back
  alter table public.posts disable trigger post_saved;
  insert into public.posts (id, client_id, project_id, date, format, title, dept, assignee_id) values ('imp3', 'desi', 'p-diwali', private.today() + 6, 'Carousel', 'Box reveal', 'design', md5('yg-sample:ritika')::uuid);
  alter table public.posts enable trigger post_saved;
  delete from private.daily_runs where day = private.today();
  perform private.daily();
  select format('%s|%s', (k.created_by = priya), (select count(*) from public.tasks where post_id = 'imp2')) into s from public.tasks k where k.post_id = 'imp3';
  out := out || format(E'\n%s the 9 am job puts next week''s posts in To do (given by the project lead); a deleted task stays deleted: %s', case when s = 't|0' then '✓' else '✗' end, s);

  /* ---------- Video and Design make it, Social media uploads it ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task('{"id":"t4","status":"done"}');
  perform set_config('role', 'none', true);
  select format('%s|%s|%s|%s|%s|%s', k.title, k.dept, k.assignee_id = priya, k.status, k.due = private.today(), k.upload_of) into s from public.tasks k where k.id = 'up-t4';
  out := out || format(E'\n%s a Video task done makes a Social media task to upload it, given to the one person in Social media, due today: %s',
    case when s = 'Upload: Edit Reel 1 — Ghar ki Mithaas (30s)|social|t|todo|t|t4' then '✓' else '✗' end, s);
  select count(*) into n from public.notifications where user_id = priya and text = 'finished “Edit Reel 1 — Ghar ki Mithaas (30s)” — upload it' and link = '#/tasks/up-t4';
  out := out || format(E'\n%s …and Social media is told: %s', case when n = 1 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task('{"id":"t4","status":"doing"}');
  select count(*) into n from public.tasks where upload_of = 't4';
  perform public.save_task('{"id":"t4","status":"done"}');
  perform set_config('role', 'none', true);
  select format('%s|%s', n, count(*)) into s from public.tasks where upload_of = 't4';
  out := out || format(E'\n%s reopened before it''s uploaded, the upload task goes; done again, it''s back once: %s', case when s = '0|1' then '✓' else '✗' end, s);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.save_task('{"id":"up-t4","status":"review"}');
    out := out || E'\n✗ a Social media task went to Ready to check';
  exception when others then
    out := out || E'\n✓ Social media tasks have no Ready to check';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:arjun')::uuid, 'role', 'authenticated')::text, true);
  perform public.save_task('{"id":"t8","status":"done"}');
  perform set_config('role', 'none', true);
  select count(*) into n from public.tasks where upload_of = 't8';
  out := out || format(E'\n%s a Websites task done: nothing to upload: %s', case when n = 0 then '✓' else '✗' end, n);
  -- a post's task: due the day it goes out; uploading it marks the post posted; a post marked posted closes its upload
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'upl1', 'clientId', 'desi', 'projectId', 'p-diwali', 'date', private.today() + 3, 'format', 'Reel',
    'title', 'Hamper reveal', 'dept', 'video', 'assigneeId', vikas)::jsonb);
  perform public.save_post(json_build_object('id', 'upl2', 'clientId', 'desi', 'projectId', 'p-diwali', 'date', private.today() + 3, 'format', 'Reel',
    'title', 'Sweets close-up', 'dept', 'video', 'assigneeId', vikas)::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform public.save_task('{"id":"pt-upl1","status":"done"}');
  perform public.save_task('{"id":"pt-upl2","status":"done"}');
  perform set_config('role', 'none', true);
  select format('%s|%s', s2.status, k.due - private.today()) into s from public.posts s2, public.tasks k where s2.id = 'upl1' and k.id = 'up-pt-upl1';
  out := out || format(E'\n%s a post''s task done: the post is made, its upload due the day it goes out: %s', case when s = 'made|3' then '✓' else '✗' end, s);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task('{"id":"up-pt-upl1","status":"done"}');
  perform public.save_post('{"id":"upl2","status":"posted"}');
  perform set_config('role', 'none', true);
  select format('%s|%s', (select status from public.posts where id = 'upl1'), (select status from public.tasks where id = 'up-pt-upl2')) into s;
  out := out || format(E'\n%s uploading marks the post posted; a post marked posted closes its upload: %s', case when s = 'posted|done' then '✓' else '✗' end, s);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.delete_post('{"id":"upl2"}');
  perform set_config('role', 'none', true);
  select count(*) into n from public.tasks where id = 'up-pt-upl2';
  out := out || format(E'\n%s deleting the post takes its task and that task''s upload: %s', case when n = 0 then '✓' else '✗' end, n);

  /* ---------- finished work isn't handed over; the upload waits for the team when Social media has several people ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.handoff(json_build_object('id', 't4', 'toId', priya)::jsonb);
    out := out || E'\n✗ finished work was handed over';
  exception when others then
    out := out || format(E'\n✓ finished work isn''t handed over (%s)', sqlerrm);
  end;
  perform set_config('role', 'none', true);
  update public.people set dept = 'social' where id = md5('yg-sample:arjun')::uuid;
  perform set_config('role', 'authenticated', true);
  perform public.save_task('{"id":"t4","status":"doing"}');
  perform public.save_task('{"id":"t4","status":"done"}');
  perform set_config('role', 'none', true);
  update public.people set dept = 'website' where id = md5('yg-sample:arjun')::uuid;
  select format('%s|%s', count(*), bool_and(assignee_id is null)) into s from public.tasks where upload_of = 't4';
  out := out || format(E'\n%s two people in Social media: the upload is given to no one, so the whole team sees it: %s', case when s = '1|t' then '✓' else '✗' end, s);

  /* ---------- work pushed past the day its post goes out moves the post; earlier never does; its upload follows the post ---------- */
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'push1', 'clientId', 'desi', 'projectId', 'p-diwali', 'date', private.today() + 3, 'format', 'Reel',
    'title', 'Hamper unboxing', 'dept', 'video', 'assigneeId', vikas)::jsonb);
  select rev into n from public.tasks where id = 'pt-push1';
  perform public.save_task(json_build_object('id', 'pt-push1', 'due', private.today() + 5)::jsonb);
  select format('%s|%s|%s', k.due - private.today(), s2.date - private.today(), k.rev - n) into s from public.tasks k, public.posts s2 where k.id = 'pt-push1' and s2.id = 'push1';
  perform public.save_task(json_build_object('id', 'pt-push1', 'due', private.today())::jsonb);
  select s || format(' then %s|%s', k.due - private.today(), s2.date - private.today()) into s from public.tasks k, public.posts s2 where k.id = 'pt-push1' and s2.id = 'push1';
  out := out || format(E'\n%s work pushed past its post''s day takes the post with it; brought earlier, the post stays: %s',
    case when s = '5|5|1 then 0|5' then '✓' else '✗' end, s);
  perform public.save_task('{"id":"pt-push1","status":"done"}');
  select s || format(' then %s', due - private.today()) into s from public.tasks where id = 'up-pt-push1';
  perform public.save_post(json_build_object('id', 'push1', 'date', private.today() + 6)::jsonb);
  perform set_config('role', 'none', true);
  select format('%s|%s', (select due - private.today() from public.tasks where id = 'pt-push1'), (select due - private.today() from public.tasks where id = 'up-pt-push1')) into s;
  out := out || format(E'\n%s the work and its upload are due the day the post goes out, and follow the post to a new day: %s', case when s = '6|6' then '✓' else '✗' end, s);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 'up-pt-push1', 'due', private.today() + 8)::jsonb);
  select format('%s|%s|%s', (select date - private.today() from public.posts where id = 'push1'), (select due - private.today() from public.tasks where id = 'up-pt-push1'),
    (select due - private.today() from public.tasks where id = 'pt-push1')) into s;
  perform public.save_post(json_build_object('id', 'push1', 'date', private.today() + 9, 'status', 'posted')::jsonb);
  perform set_config('role', 'none', true);
  select s || format(' then %s|%s', status, due - private.today()) into s from public.tasks where id = 'up-pt-push1';
  out := out || format(E'\n%s the upload put off past the day takes the post with it; posted and moved at once, the closed upload keeps its day: %s',
    case when s = '8|8|8 then done|8' then '✓' else '✗' end, s);

  /* ---------- deleting a project: a supervisor, typing its name; its posts stay, unlinked ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_post(json_build_object('id', 'del1', 'clientId', 'desi', 'projectId', 'p-desi-pack', 'date', private.today() + 3, 'format', 'Post',
    'title', 'Pouch reveal', 'dept', 'design')::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', priya, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_project('{"id":"p-desi-pack","confirm":"Masala Range Pouch Packaging"}');
    out := out || E'\n✗ a team member deleted a project';
  exception when others then
    out := out || format(E'\n✓ only a supervisor deletes a project (%s)', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_project('{"id":"p-desi-pack","confirm":"Masala"}');
    out := out || E'\n✗ a project was deleted without its name typed';
  exception when others then
    out := out || format(E'\n✓ …typing its name exactly (%s)', sqlerrm);
  end;
  perform public.delete_project('{"id":"p-desi-pack","confirm":" masala range pouch packaging "}');
  perform set_config('role', 'none', true);
  select format('%s|%s|%s|%s', (select count(*) from public.projects where id = 'p-desi-pack'), (select count(*) from public.tasks where project_id = 'p-desi-pack'),
    (select count(*) from public.deliverables where project_id = 'p-desi-pack'), (select count(*) from public.channels where id = 'ch-p-desi-pack')) into s;
  out := out || format(E'\n%s the project goes with its tasks, work and discussion: %s', case when s = '0|0|0|0' then '✓' else '✗' end, s);
  select format('%s|%s', project_id is null, task_made) into s from public.posts where id = 'del1';
  out := out || format(E'\n%s its posts stay in the content plan, unlinked, ready for a fresh task: %s', case when s = 't|f' then '✓' else '✗' end, s);

  raise exception E'RESULTS (rolled back)%', out;
end $$;
