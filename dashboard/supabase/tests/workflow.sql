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
  out := out || format(E'\n%s a post in a project, a week away, gets its task (due the day before): %s', case when s = 'p-diwali|todo|2|t|Reel: Navratri wishes' then '✓' else '✗' end, s);
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
  perform set_config('request.jwt.claims', json_build_object('sub', vikas, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_task(json_build_object('id', 'pt-imp1', 'status', 'done')::jsonb);
  perform set_config('role', 'none', true);
  select status into s from public.posts where id = 'imp1';
  select count(*) into n from public.notifications where user_id = md5('yg-sample:rahul')::uuid and text = 'has a Reel ready for your approval: “Navratri wishes”';
  out := out || format(E'\n%s finishing it makes the post ready, and the client is asked: %s, %s', case when s = 'ready' and n = 1 then '✓' else '✗' end, s, n);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:rahul')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.decide_post(json_build_object('id', 'imp1', 'approve', false, 'note', 'Brighter, please')::jsonb);
  perform set_config('role', 'none', true);
  select s2.status || '|' || k.status into s from public.posts s2, public.tasks k where s2.id = 'imp1' and k.id = 'pt-imp1';
  out := out || format(E'\n%s the client asks for changes: the task is back in To do: %s', case when s = 'production|todo' then '✓' else '✗' end, s);
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
  out := out || format(E'\n%s a post moved into the week gets its task; its new day and title carry over: %s', case when s = '5|Post: Diwali post' then '✓' else '✗' end, s);
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

  raise exception E'RESULTS (rolled back)%', out;
end $$;
