-- Access rules, checked as real users against the sample data (scripts/seed-sql.mjs).
-- Run it in the SQL editor: it always ends with an error that lists every check (✓ / ✗) — the error is on
-- purpose, it rolls back everything the test changed.
do $$
declare
  out text := '';
  n int;
  s text;
  ok boolean;
  g text := 'grp-00000000-0000-0000-0000-000000000001';
  fl uuid := md5('yg-sample:ritika')::uuid;
  fl_projects text[] := array['p-desi-pack', 'p-diwali', 'p-glow-mkt', 'p-gv-month'];
  steel text;
begin
  -- each block signs in as someone: request.jwt.claims sets auth.uid(), the role switch applies the policies

  /* ---------- Rahul: client of Desi Crunch ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:rahul')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select string_agg(id, ',' order by id collate "C") into s from public.projects;
  out := out || format(E'\n%s client sees only own projects: %s', case when s = 'p-desi-pack,p-diwali' then '✓' else '✗' end, s);
  select count(*) into n from public.tasks;
  out := out || format(E'\n%s client sees own plan (12 tasks): %s', case when n = 12 then '✓' else '✗' end, n);
  select count(*) into n from public.task_private;
  out := out || format(E'\n%s client never sees task comments/checklists: %s', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.client_private;
  out := out || format(E'\n%s client never sees studio notes about clients: %s', case when n = 0 then '✓' else '✗' end, n);
  select string_agg(id, ',') into s from public.clients;
  out := out || format(E'\n%s client sees only own company: %s', case when s = 'desi' then '✓' else '✗' end, s);
  select count(*) into n from public.people where role = 'client' and client_id <> 'desi';
  out := out || format(E'\n%s client never sees other clients'' people: %s', case when n = 0 then '✓' else '✗' end, n);
  select string_agg(id, ',' order by id) into s from public.deliverables;
  out := out || format(E'\n%s client sees only checked + sent work: %s', case when s = 'd1,d4' then '✓' else '✗' end, s);
  select string_agg(id, ',') into s from public.events;
  out := out || format(E'\n%s client sees only meetings they''re invited to: %s', case when s = 'e3' then '✓' else '✗' end, s);
  select string_agg(id, ',' order by id) into s from public.channels;
  out := out || format(E'\n%s client sees only own project channels: %s', case when s = 'ch-p-desi-pack,ch-p-diwali' then '✓' else '✗' end, s);
  select count(*) into n from public.messages;
  out := out || format(E'\n%s client sees only own channels'' messages (4): %s', case when n = 4 then '✓' else '✗' end, n);
  select count(*) into n from public.activity;
  out := out || format(E'\n%s client never sees the studio activity log: %s', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id <> md5('yg-sample:rahul')::uuid;
  out := out || format(E'\n%s client sees only own notifications: %s', case when n = 0 then '✓' else '✗' end, n);
  select jsonb_array_length(b -> 'projects') + jsonb_array_length(b -> 'task_private') into n from public.bootstrap() b;
  out := out || format(E'\n%s bootstrap obeys the same rules: %s', case when n = 2 then '✓' else '✗' end, n);

  begin
    insert into public.tasks (project_id, title) values ('p-diwali', 'sneaky');
    out := out || E'\n✗ client wrote a table directly';
  exception when insufficient_privilege then
    out := out || E'\n✓ nobody can write tables directly';
  end;
  begin
    perform public.save_task('{"projectId":"p-diwali","title":"x"}');
    out := out || E'\n✗ client created a task';
  exception when others then
    out := out || format(E'\n✓ client can''t create tasks (%s)', sqlerrm);
  end;
  begin
    perform public.review_deliverable('{"id":"d1","approve":true}');
    out := out || E'\n✗ client did the admin check';
  exception when others then
    out := out || format(E'\n✓ client can''t do the admin check (%s)', sqlerrm);
  end;
  begin
    perform public.send_message('{"channelId":"ch-general","text":"hi"}');
    out := out || E'\n✗ client posted in #general';
  exception when others then
    out := out || format(E'\n✓ client can''t post in team channels (%s)', sqlerrm);
  end;
  begin
    perform public.open_dm(json_build_object('otherId', md5('yg-sample:sunita')::uuid)::jsonb);
    out := out || E'\n✗ client opened a DM with another client';
  exception when others then
    out := out || format(E'\n✓ client can''t DM another client (%s)', sqlerrm);
  end;
  perform public.decide_deliverable('{"id":"d1","approve":true,"note":"Looks great"}');
  perform public.send_message('{"id":"t-msg","channelId":"ch-p-diwali","text":"Can we see Reel 1 by Friday?"}');
  perform set_config('role', 'none', true);
  select status into s from public.deliverables where id = 'd1';
  out := out || format(E'\n%s client approves sent work: %s', case when s = 'approved' then '✓' else '✗' end, s);
  select count(*) into n from public.notifications where text like 'wrote in #Diwali Festive Campaign%';
  out := out || format(E'\n%s client message pings the lead + admin (2): %s', case when n = 2 then '✓' else '✗' end, n);

  /* ---------- Priya: social media, leads the Diwali and GV monthly projects ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:priya')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.tasks;
  out := out || format(E'\n%s member sees the projects they lead, plus their department''s work elsewhere (16): %s', case when n = 16 then '✓' else '✗' end, n);
  select count(*) into n from public.channels;
  out := out || format(E'\n%s member sees team channels + their projects'' channels + own DM (7): %s', case when n = 7 then '✓' else '✗' end, n);
  select count(*) into n from public.posts;
  out := out || format(E'\n%s social media sees every post (12): %s', case when n = 12 then '✓' else '✗' end, n);
  begin
    perform public.save_project('{"name":"New","clientId":"desi"}');
    out := out || E'\n✗ member created a project';
  exception when others then
    out := out || format(E'\n✓ member can''t create projects (%s)', sqlerrm);
  end;
  begin
    perform public.save_project('{"id":"p-steel-web","name":"Renamed"}');
    out := out || E'\n✗ member edited a project they don''t lead';
  exception when others then
    out := out || format(E'\n✓ member can''t edit others'' projects (%s)', sqlerrm);
  end;
  perform public.save_project('{"id":"p-diwali","brief":"Updated brief"}');
  begin
    perform public.review_deliverable('{"id":"d2","approve":true}');
    out := out || E'\n✗ member did the admin check';
  exception when others then
    out := out || format(E'\n✓ only the admin checks work (%s)', sqlerrm);
  end;
  begin
    perform public.send_message('{"channelId":"ch-announce","text":"hi"}');
    out := out || E'\n✗ member posted an announcement';
  exception when others then
    out := out || format(E'\n✓ only the admin posts announcements (%s)', sqlerrm);
  end;
  perform public.handoff(json_build_object('id', 't3', 'toId', md5('yg-sample:ritika')::uuid, 'note', 'Footage is on the drive')::jsonb);
  perform public.check_item('{"id":"t1","itemId":"t1c0","done":false}');
  perform public.save_task('{"id":"t4","status":"review"}');
  perform set_config('role', 'none', true);
  select brief into s from public.projects where id = 'p-diwali';
  out := out || format(E'\n%s lead edits own project, other fields untouched: %s', case when s = 'Updated brief' and (select name from public.projects where id = 'p-diwali') = 'Diwali Festive Campaign' then '✓' else '✗' end, s);
  select t.assignee_id = md5('yg-sample:ritika')::uuid and t.status = 'todo' and p.comments -> -1 ->> 'handoff' = 'Vikas → Ritika' into ok
  from public.tasks t join public.task_private p on p.task_id = t.id where t.id = 't3';
  out := out || format(E'\n%s handoff: new owner, back to To do, note kept', case when ok then '✓' else '✗' end);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:ritika')::uuid and text like 'handed you%Footage is on the drive';
  out := out || format(E'\n%s handoff notifies the new owner: %s', case when n = 1 then '✓' else '✗' end, n);
  select (checklist -> 0 ->> 'done')::boolean = false and (checklist -> 1 ->> 'done')::boolean into ok from public.task_private where task_id = 't1';
  out := out || format(E'\n%s checklist item set without touching the others', case when ok then '✓' else '✗' end);
  select count(*) into n from public.notifications where text like '“Edit Reel 1%is ready for review';
  out := out || format(E'\n%s moving to Review pings admin + lead (1, lead is the mover): %s', case when n = 1 then '✓' else '✗' end, n);
  select rev into n from public.tasks where id = 't4';
  out := out || format(E'\n%s every update bumps rev: %s', case when n = 1 then '✓' else '✗' end, n);

  /* ---------- Vikas: no access to someone else's DM ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:vikas')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.channels where type = 'dm';
  out := out || format(E'\n%s DMs stay between the two people: %s', case when n = 0 then '✓' else '✗' end, n);

  /* ---------- departments: Vikas does video ---------- */
  select count(*) into n from public.tasks;
  out := out || format(E'\n%s video sees video work, their own and the project they lead (8 tasks): %s', case when n = 8 then '✓' else '✗' end, n);
  select count(*) into n from public.tasks t where t.dept <> 'video' and t.assignee_id is distinct from md5('yg-sample:vikas')::uuid
    and t.project_id <> 'p-gv-reels';
  out := out || format(E'\n%s …and no other department''s tasks: %s', case when n = 0 then '✓' else '✗' end, n);
  select string_agg(id, ',' order by id) into s from public.projects;
  out := out || format(E'\n%s sees only the projects they work in: %s', case when s = 'p-diwali,p-gv-month,p-gv-reels,p-steel-web' then '✓' else '✗' end, s);
  select string_agg(id, ',' order by id) into s from public.posts;
  out := out || format(E'\n%s sees video posts and their own: %s', case when s = 's1,s11,s4,s5,s8' then '✓' else '✗' end, s);
  select string_agg(id, ',' order by id) into s from public.deliverables;
  out := out || format(E'\n%s sees only video work for approval: %s', case when s = 'd2' then '✓' else '✗' end, s);
  select (select count(*) from public.activity) + (select count(*) from public.events
    where not (md5('yg-sample:vikas')::uuid = any (attendee_ids) or created_by = md5('yg-sample:vikas')::uuid)) into n;
  out := out || format(E'\n%s no studio activity log, only meetings they''re in: %s', case when n = 0 then '✓' else '✗' end, n);
  select string_agg(id, ',' order by id) into s from public.clients;
  out := out || format(E'\n%s sees only the clients they work for: %s', case when s = 'desi,glow,greenvalley,steel' then '✓' else '✗' end, s);
  select count(*) into n from public.channels where type = 'project' and project_id = 'p-glow-mkt';
  out := out || format(E'\n%s no discussions of projects they don''t work in: %s', case when n = 0 then '✓' else '✗' end, n);
  begin
    perform public.handoff(json_build_object('id', 't5', 'toId', md5('yg-sample:vikas')::uuid)::jsonb);
    out := out || E'\n✗ video took over a design task';
  exception when others then
    out := out || format(E'\n✓ can''t touch another department''s task (%s)', sqlerrm);
  end;
  begin
    perform public.comment_task('{"id":"t5","text":"hi"}');
    out := out || E'\n✗ video commented on a design task';
  exception when others then
    out := out || format(E'\n✓ …nor comment on it (%s)', sqlerrm);
  end;
  begin
    perform public.save_task('{"projectId":"p-glow-mkt","title":"Sneaky"}');
    out := out || E'\n✗ video added a task to a project they don''t work in';
  exception when others then
    out := out || format(E'\n✓ can''t add tasks to projects they don''t work in (%s)', sqlerrm);
  end;
  perform public.save_task(json_build_object('id', 't-dept', 'projectId', 'p-diwali', 'title', 'End card for Reel 1', 'dept', 'design',
    'assigneeId', md5('yg-sample:ritika')::uuid)::jsonb);
  select count(*) into n from public.tasks where id = 't-dept';
  out := out || format(E'\n%s can ask another department for work and still follow it: %s', case when n = 1 then '✓' else '✗' end, n);
  perform set_config('role', 'none', true);

  /* ---------- the "All" department (the PA) sees the whole studio ---------- */
  update public.people set dept = 'all' where id = md5('yg-sample:arjun')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:arjun')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select (select count(*) from public.tasks) * 100 + (select count(*) from public.posts) into n;
  out := out || format(E'\n%s "All" sees every task and post (34 tasks, 12 posts): %s', case when n = 3412 then '✓' else '✗' end, n);
  perform set_config('role', 'none', true);
  update public.people set dept = 'website' where id = md5('yg-sample:arjun')::uuid;

  /* ---------- Aman: admin ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.review_deliverable('{"id":"d2","approve":true,"note":"Nice"}');
  perform public.save_event(json_build_object('id', 't-ev', 'title', 'Clash test', 'date', private.today() + 2, 'start', '10:00', 'end', '11:00',
    'attendeeIds', json_build_array(md5('yg-sample:vikas')::uuid))::jsonb);
  perform set_config('role', 'none', true);
  select status = 'client' and sent into ok from public.deliverables where id = 'd2';
  out := out || format(E'\n%s admin check sends work to the client', case when ok then '✓' else '✗' end);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:sunita')::uuid and text like 'sent “Villa 12%for your approval';
  out := out || format(E'\n%s client is asked to approve: %s', case when n = 1 then '✓' else '✗' end, n);
  select rsvp ->> md5('yg-sample:aman')::uuid::text = 'yes' and attendee_ids @> array[md5('yg-sample:aman')::uuid] into ok from public.events where id = 't-ev';
  out := out || format(E'\n%s organiser is attending and has said yes', case when ok then '✓' else '✗' end);

  /* ---------- group chats: Priya starts one with Vikas ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:priya')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_group(json_build_object('id', g, 'name', 'Shoot crew',
    'memberIds', json_build_array(md5('yg-sample:vikas')::uuid, md5('yg-sample:rahul')::uuid))::jsonb);
  perform public.send_message(json_build_object('id', 't-grp-1', 'channelId', g, 'text', 'Call time is 7am @Aman')::jsonb);
  perform set_config('role', 'none', true);
  select cardinality(member_ids) into n from public.channels where id = g;
  out := out || format(E'\n%s clients are never added to groups (2 members): %s', case when n = 2 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:vikas')::uuid and text = 'added you to the group “Shoot crew”';
  out := out || format(E'\n%s new members are told they were added: %s', case when n = 1 then '✓' else '✗' end, n);
  select count(*) into n from public.notifications where user_id = md5('yg-sample:aman')::uuid and text like 'mentioned you in #Shoot crew%';
  out := out || format(E'\n%s @mentioning someone outside a group doesn''t notify them: %s', case when n = 0 then '✓' else '✗' end, n);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:vikas')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.reads where channel_id = g and user_id = md5('yg-sample:priya')::uuid;
  out := out || format(E'\n%s members see each other''s read receipts: %s', case when n = 1 then '✓' else '✗' end, n);
  perform public.send_message(json_build_object('id', 't-grp-2', 'channelId', g, 'text', 'On it')::jsonb);
  perform public.edit_message('{"id":"t-grp-2","text":"On it 👍"}');
  begin
    perform public.edit_message('{"id":"t-grp-1","text":"changed"}');
    out := out || E'\n✗ member edited someone else''s message';
  exception when others then
    out := out || format(E'\n✓ only your own messages can be edited (%s)', sqlerrm);
  end;
  begin
    perform public.delete_message('{"id":"t-grp-1"}');
    out := out || E'\n✗ member deleted someone else''s message';
  exception when others then
    out := out || format(E'\n✓ members can''t delete others'' messages (%s)', sqlerrm);
  end;
  perform public.delete_message('{"id":"t-grp-2"}');
  perform set_config('role', 'none', true);
  select deleted and text = '' and edited_at is not null into ok from public.messages where id = 't-grp-2';
  out := out || format(E'\n%s edit, then delete wipes the text', case when ok then '✓' else '✗' end);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:ritika')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select (select count(*) from public.channels where id = g) + (select count(*) from public.messages where channel_id = g) into n;
  out := out || format(E'\n%s team members outside a group can''t see it: %s', case when n = 0 then '✓' else '✗' end, n);
  out := out || format(E'\n%s …nor listen to its typing', case when not private.topic_ok('typing:' || g, false) then '✓' else '✗' end);
  begin
    perform public.save_group(json_build_object('id', g, 'name', 'Mine now')::jsonb);
    out := out || E'\n✗ outsider changed a group';
  exception when others then
    out := out || format(E'\n✓ only members can change a group (%s)', sqlerrm);
  end;
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:rahul')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.save_group(json_build_object('id', 'grp-00000000-0000-0000-0000-000000000002', 'name', 'Client group',
      'memberIds', json_build_array(md5('yg-sample:priya')::uuid))::jsonb);
    out := out || E'\n✗ client created a group';
  exception when others then
    out := out || format(E'\n✓ clients can''t create groups (%s)', sqlerrm);
  end;
  select count(*) into n from public.channels where type = 'group';
  out := out || format(E'\n%s clients never see groups: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.messages where channel_id = g;
  out := out || format(E'\n%s admin reads groups they''re not in (3 lines): %s', case when n = 3 then '✓' else '✗' end, n);
  out := out || format(E'\n%s …and can listen to their typing, but not send it',
    case when private.topic_ok('typing:' || g, false) and not private.topic_ok('typing:' || g, true) then '✓' else '✗' end);
  begin
    perform public.send_message(json_build_object('channelId', g, 'text', 'hello')::jsonb);
    out := out || E'\n✗ admin posted in a group they''re not in';
  exception when others then
    out := out || format(E'\n✓ admin can''t post in a group they''re not in (%s)', sqlerrm);
  end;
  perform public.mark_read(json_build_object('channelId', g)::jsonb);
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:priya')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.reads where channel_id = g and user_id = md5('yg-sample:aman')::uuid;
  out := out || format(E'\n%s members never see that the admin read their group: %s', case when n = 0 then '✓' else '✗' end, n);
  perform public.save_group(json_build_object('id', g, 'name', 'Shoot crew 2', 'memberIds', json_build_array(md5('yg-sample:ritika')::uuid))::jsonb);
  perform set_config('role', 'none', true);
  select string_agg(text, ' | ' order by at) into s from public.messages where channel_id = g and system;
  out := out || format(E'\n%s system lines for every change: %s',
    case when s = 'created the group | renamed the group to “Shoot crew 2” | added Ritika | removed Vikas' then '✓' else '✗' end, s);

  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:vikas')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.channels where id = g;
  out := out || format(E'\n%s removed members lose access: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:ritika')::uuid, 'role', 'authenticated')::text, true);
  perform public.leave_group(json_build_object('id', g)::jsonb);
  perform set_config('role', 'none', true);
  select member_ids = array[md5('yg-sample:priya')::uuid] into ok from public.channels where id = g;
  out := out || format(E'\n%s leaving a group takes you out', case when ok then '✓' else '✗' end);

  /* ---------- Ritika as a freelancer: on Diwali, GV monthly, Glow and Desi packaging only ---------- */
  update public.people set role = 'freelancer' where id = fl;
  select id into steel from public.tasks where project_id = 'p-steel-web' and assignee_id is distinct from fl limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', fl, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select string_agg(id, ',' order by id) into s from public.projects;
  out := out || format(E'\n%s freelancer sees only their projects: %s', case when s = array_to_string(fl_projects, ',') then '✓' else '✗' end, s);
  select count(*) into n from public.tasks where not (project_id = any (fl_projects) or assignee_id = fl);
  out := out || format(E'\n%s …and only those projects'' tasks (or ones handed to them): %s outside', case when n = 0 then '✓' else '✗' end, n);
  select (select count(*) from public.task_private) - (select count(*) from public.tasks) into n;
  out := out || format(E'\n%s task comments/checklists only for tasks they see: %s extra', case when n = 0 then '✓' else '✗' end, n);
  select string_agg(id, ',' order by id) into s from public.clients;
  out := out || format(E'\n%s sees only those projects'' clients: %s', case when s = 'desi,glow,greenvalley' then '✓' else '✗' end, s);
  select (select count(*) from public.client_private) + (select count(*) from public.people where role = 'client' and client_id not in ('desi', 'glow', 'greenvalley')) into n;
  out := out || format(E'\n%s no studio notes about clients, no other clients'' people: %s', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.channels where type = 'public' or (type = 'project' and project_id <> all (fl_projects));
  out := out || format(E'\n%s no company channels, no other projects'' discussions: %s', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.deliverables where project_id <> all (fl_projects);
  out := out || format(E'\n%s approvals only for their projects: %s outside', case when n = 0 then '✓' else '✗' end, n);
  select count(*) into n from public.events where not (fl = any (attendee_ids) or created_by = fl);
  out := out || format(E'\n%s only meetings they''re invited to: %s others', case when n = 0 then '✓' else '✗' end, n);
  select (select count(*) from public.posts) + (select count(*) from public.activity) into n;
  out := out || format(E'\n%s no content plan, no studio activity log: %s', case when n = 0 then '✓' else '✗' end, n);
  out := out || format(E'\n%s typing: only in their project discussions',
    case when private.topic_ok('typing:ch-p-diwali', true) and not private.topic_ok('typing:ch-p-steel-web', false) and not private.topic_ok('typing:ch-general', false) then '✓' else '✗' end);
  begin
    perform public.save_task('{"projectId":"p-steel-web","title":"Sneaky"}');
    out := out || E'\n✗ freelancer added a task to someone else''s project';
  exception when others then
    out := out || format(E'\n✓ freelancers can''t add tasks to other projects (%s)', sqlerrm);
  end;
  begin
    perform public.submit_deliverable('{"projectId":"p-steel-web","title":"x","link":"https://x.co"}');
    out := out || E'\n✗ freelancer submitted work to another project';
  exception when others then
    out := out || format(E'\n✓ …nor submit work to them (%s)', sqlerrm);
  end;
  perform public.save_task('{"id":"t-free","projectId":"p-desi-pack","title":"Dieline v2"}');
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  perform public.handoff(json_build_object('id', steel, 'toId', fl, 'note', 'Need icons')::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', fl, 'role', 'authenticated')::text, true);
  perform public.comment_task(json_build_object('id', steel, 'text', 'On it')::jsonb);
  select (select count(*) from public.tasks where id in (steel, 't-free')) * 10 + (select count(*) from public.projects where id = 'p-steel-web') into n;
  out := out || format(E'\n%s works in own projects + on a task handed to them, without seeing that other project: %s', case when n = 20 then '✓' else '✗' end, n);
  perform set_config('role', 'none', true);
  update public.people set role = 'member' where id = fl;

  /* ---------- deleting a client takes everything of theirs with it ---------- */
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:priya')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.delete_client('{"id":"glow","confirm":"Glow Herbals"}');
    out := out || E'\n✗ member deleted a client';
  exception when others then
    out := out || format(E'\n✓ only the admin deletes clients (%s)', sqlerrm);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:aman')::uuid, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_client('{"id":"glow","confirm":"Glow"}');
    out := out || E'\n✗ deleted without the exact name';
  exception when others then
    out := out || format(E'\n✓ needs the client''s exact name (%s)', sqlerrm);
  end;
  perform public.delete_client('{"id":"glow","confirm":"  glow herbals "}');
  perform set_config('role', 'none', true);
  select (select count(*) from public.clients where id = 'glow') + (select count(*) from public.projects where client_id = 'glow')
    + (select count(*) from public.tasks where project_id = 'p-glow-mkt') + (select count(*) from public.posts where client_id = 'glow')
    + (select count(*) from public.channels where id = 'ch-p-glow-mkt') + (select count(*) from public.people where client_id = 'glow')
    + (select count(*) from auth.users where id = md5('yg-sample:ishita')::uuid) into n;
  out := out || format(E'\n%s client, projects, tasks, posts, chat and logins all gone: %s left', case when n = 0 then '✓' else '✗' end, n);
  select project_id is null into ok from public.events where id = 'e10';
  out := out || format(E'\n%s their meetings stay on the calendar, unlinked', case when ok then '✓' else '✗' end);

  /* ---------- logged out / deactivated ---------- */
  perform set_config('role', 'anon', true);
  begin
    select count(*) into n from public.projects;
    out := out || E'\n✗ logged-out visitor read projects';
  exception when insufficient_privilege then
    out := out || E'\n✓ logged-out visitors can''t read anything';
  end;
  perform set_config('role', 'none', true);
  update public.people set active = false where id = md5('yg-sample:priya')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', md5('yg-sample:priya')::uuid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select (select count(*) from public.projects) + (select count(*) from public.people) into n;
  out := out || format(E'\n%s deactivated login sees nothing, even with a live session: %s', case when n = 0 then '✓' else '✗' end, n);
  perform set_config('role', 'none', true);

  raise exception E'RESULTS (rolled back)%', out;
end $$;
