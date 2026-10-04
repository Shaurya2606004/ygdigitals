// Prints SQL that loads the sample studio (src/seed.js) into an empty YG Hub database, with a login for every
// sample person: <id>@example.com (aman@, priya@, rahul@ …), password = DEMO_PASSWORD from .env.local.
// Dates are written relative to the day it runs, so the demo always looks current.
// For a dev/demo project only — never run it against the studio's real data.
//   node scripts/seed-sql.mjs > seed.sql   → paste into Supabase › SQL editor
import { readFileSync } from 'node:fs'
import { seed } from '../src/seed.js'
import { daysBetween, today } from '../src/util.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\w+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const pw = env.DEMO_PASSWORD
if (!pw) throw new Error('Set DEMO_PASSWORD in .env.local first')

const d = seed()
const T = today()
const now = Date.now()
const str = (v) => `'${String(v ?? '').replaceAll("'", "''")}'`
const day = (s) => (s ? `pg_temp.d(${daysBetween(T, s)})` : 'null') // d(n) = n days from today (IST)
const at = (iso) => `pg_temp.m(${Math.round((now - Date.parse(iso)) / 6e4)})` // m(n) = n minutes ago
const u = (k) => (k ? `pg_temp.u('${k}')` : 'null') // sample person key → their uuid
const us = (ks = []) => `pg_temp.us('{${ks.join(',')}}')`
const dms = new Map(d.channels.filter((c) => c.type === 'dm').map((c) => [c.id, `pg_temp.dm('${c.memberIds[0]}', '${c.memberIds[1]}')`]))
const ch = (id) => dms.get(id) ?? str(id)
const link = (l) => (dms.has(l.split('/').pop()) ? `'#/chat/' || ${ch(l.split('/').pop())}` : str(l))
// jsonb lists whose items carry userId (comments, history, notes): times become relative, keys become uuids
const people = (list = []) => `pg_temp.fix(${str(JSON.stringify(list.map((x) => ({ ...x, at: Math.round((now - Date.parse(x.at)) / 6e4) }))))})`
const rows = (table, cols, list) =>
  `insert into public.${table} (${cols.join(', ')}) values\n${list.map((r) => `  (${r.join(', ')})`).join(',\n')};\n`

const sql = `begin;
create function pg_temp.u(k text) returns uuid language sql immutable as $$ select md5('yg-sample:' || k)::uuid $$;
create function pg_temp.us(ks text[]) returns uuid[] language sql immutable as $$ select coalesce(array(select pg_temp.u(k) from unnest(ks) k), '{}') $$;
create function pg_temp.d(n int) returns date language sql stable as $$ select private.today() + n $$;
create function pg_temp.m(n int) returns timestamptz language sql stable as $$ select now() - make_interval(mins => n) $$;
create function pg_temp.dm(a text, b text) returns text language sql immutable as $$
  select 'dm-' || least(pg_temp.u(a)::text collate "C", pg_temp.u(b)::text collate "C") || '-' || greatest(pg_temp.u(a)::text collate "C", pg_temp.u(b)::text collate "C") $$;
create function pg_temp.fix(j jsonb) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(x || jsonb_build_object('userId', pg_temp.u(x ->> 'userId'), 'at', private.iso(pg_temp.m((x ->> 'at')::int))) order by n), '[]')
  from jsonb_array_elements(j) with ordinality as e(x, n) $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', pg_temp.u(k), 'authenticated', 'authenticated', k || '@example.com', extensions.crypt(${str(pw)}, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from unnest('{${d.users.map((x) => x.id).join(',')}}'::text[]) k;
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now() from auth.users;

${rows('clients', ['id', 'name', 'industry', 'city', 'contact', 'email', 'created_at'],
  d.clients.map((c, i) => [str(c.id), str(c.name), str(c.industry), str(c.city), str(c.contact), str(`${c.id}@example.com`), `pg_temp.m(${60 * 24 * 30 - i})`]))}
${rows('client_private', ['client_id', 'notes'], d.clients.map((c) => [str(c.id), str(c.notes)]))}
${rows('people', ['id', 'name', 'email', 'role', 'client_id', 'title', 'phone', 'color', 'created_at'],
  d.users.map((x, i) => [u(x.id), str(x.name), str(`${x.id}@example.com`), str(x.role), x.clientId ? str(x.clientId) : 'null', str(x.title), str(x.phone), str(x.color), `pg_temp.m(${60 * 24 * 30 - i})`]))}
${rows('projects', ['id', 'client_id', 'name', 'status', 'priority', 'start', 'due', 'manager_id', 'member_ids', 'brief', 'created_at'],
  d.projects.map((p) => [str(p.id), str(p.clientId), str(p.name), str(p.status), str(p.priority), day(p.start), day(p.due), u(p.managerId), us(p.memberIds), str(p.brief), day(p.createdAt)]))}
${rows('tasks', ['id', 'project_id', 'assignee_id', 'status', 'priority', 'due', 'title', 'created_by', 'created_at', 'completed_at'],
  d.tasks.map((t, i) => [str(t.id), str(t.projectId), u(t.assigneeId), str(t.status), str(t.priority), day(t.due), str(t.title), u(t.createdBy), `pg_temp.m(${60 * 24 * 12 - i})`, day(t.completedAt)]))}
${rows('task_private', ['task_id', '"desc"', 'checklist', 'comments'], d.tasks.map((t) => [str(t.id), str(t.desc), `${str(JSON.stringify(t.checklist))}::jsonb`, people(t.comments)]))}
${rows('deliverables', ['id', 'project_id', 'title', 'type', 'link', 'version', 'status', 'sent', 'submitted_by', 'history', 'created_at'],
  d.deliverables.map((x) => [str(x.id), str(x.projectId), str(x.title), str(x.type), str(x.link), x.version, str(x.status), x.sent, u(x.submittedBy), people(x.history), at(x.history[0].at)]))}
${rows('events', ['id', 'title', 'type', 'date', 'start', '"end"', 'repeat', 'attendee_ids', 'location', 'agenda', 'project_id', 'created_by', 'rsvp'],
  d.events.map((e) => [str(e.id), str(e.title), str(e.type), day(e.date), str(e.start), str(e.end), str(e.repeat), us(e.attendeeIds), str(e.location), str(e.agenda),
    e.projectId ? str(e.projectId) : 'null', u(e.createdBy), `(select coalesce(jsonb_object_agg(pg_temp.u(k), 'yes'), '{}') from unnest('{${Object.keys(e.rsvp).join(',')}}'::text[]) k)`]))}
${rows('channels', ['id', 'type', 'name', 'project_id', 'member_ids', 'read_only', 'created_at'],
  d.channels.map((c, i) => [ch(c.id), str(c.type), str(c.name), c.projectId ? str(c.projectId) : 'null', us(c.memberIds), Boolean(c.readOnly), `pg_temp.m(${60 * 24 * 30 - i})`]))}
${rows('messages', ['id', 'channel_id', 'user_id', 'text', 'at'], d.messages.map((m) => [str(m.id), ch(m.channelId), u(m.userId), str(m.text), at(m.at)]))}
-- everyone has read everything older than six hours
insert into public.reads (user_id, channel_id, at) select p.id, c.id, pg_temp.m(360) from public.people p cross join public.channels c;
${rows('posts', ['id', 'client_id', 'date', 'time', 'platform', 'format', 'title', 'status', 'assignee_id', 'caption'],
  d.posts.map((s) => [str(s.id), str(s.clientId), day(s.date), str(s.time), str(s.platform), str(s.format), str(s.title), str(s.status), u(s.assigneeId), str(s.caption)]))}
${rows('activity', ['id', 'user_id', 'text', 'link', 'at'], d.activity.map((a) => [str(a.id), u(a.userId), str(a.text), link(a.link), at(a.at)]))}
${rows('notifications', ['id', 'user_id', 'from_id', 'text', 'link', 'at', 'read'],
  d.notifications.map((n) => [str(n.id), u(n.userId), u(n.fromId), str(n.text), link(n.link), at(n.at), n.read]))}
commit;
`
process.stdout.write(sql)
