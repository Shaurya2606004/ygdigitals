// YG Hub data + rules. Everything the signed-in person may see is held in memory, so every screen is instant.
// Each action changes it straight away, then runs the same action on the server in the background
// (supabase/migrations/*_actions.sql, which re-checks every rule); realtime pushes everyone else's changes in.
// can() mirrors the server's read rules (*_access.sql). Without Supabase config (npm test) it runs on the
// in-memory sample studio that the tests hand it (setData).
import { supabase } from './supabase.js'
import { addDays, fmtDay, fmtTime, nowIso, overlaps, today, uid, weekday } from './util.js'

export const live = Boolean(supabase)
const empty = () => ({ users: [], clients: [], projects: [], tasks: [], deliverables: [], events: [], channels: [], messages: [], reads: {}, posts: [], activity: [], notifications: [] })

let db = empty()
const subs = new Set()
export const subscribe = (f) => (subs.add(f), () => subs.delete(f))
export const getDb = () => db
const emit = () => subs.forEach((f) => f())
const refresh = () => {
  db = { ...db } // new snapshot so React re-renders for state that lives outside db (session, notices)
  emit()
}
function commit(fn) {
  const next = structuredClone(db)
  const out = fn(next)
  db = next
  emit()
  return out
}
// tests: run on a given studio (the sample from seed.js) with no server
export function setData(data) {
  db = data
  emit()
}

/* ---------- vocabulary ---------- */

export const ROLES = {
  admin: { label: 'Admin', blurb: 'Runs the studio: adds people and clients, creates projects, and checks work before it goes to a client.' },
  member: { label: 'Team member', blurb: 'Does the work: tasks, handing work to each other, submitting work for a check, planning content, meetings and chat.' },
  freelancer: { label: 'Freelancer', blurb: 'Works on the projects they’re put on and sees only those: their tasks, work, discussions and chats — not the rest of the studio.' },
  client: { label: 'Client', blurb: 'Sees only their own projects and plan, approves work and posts, chats with the team and books meetings.' },
}
export const TASK_STATUS = { todo: 'To do', doing: 'In progress', review: 'Review', done: 'Done' }
export const PRIORITY = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
export const PROJECT_STATUS = { planning: 'Planning', active: 'In progress', review: 'Client review', hold: 'On hold', done: 'Delivered' }
export const DELIV_STATUS = { internal: 'Waiting for check', changes: 'Changes requested', client: 'Awaiting client', approved: 'Approved' }
export const DELIV_TYPES = ['Video', 'Design', 'Website', 'Copy', 'Listing', 'Photos', 'Other']
export const EVENT_TYPES = { meeting: 'Team meeting', client: 'Client call', shoot: 'Shoot', review: 'Creative review' }
export const REPEAT = { none: 'Does not repeat', weekdays: 'Every weekday', weekly: 'Every week' }
export const POST_STATUS = { idea: 'Idea', production: 'In production', ready: 'Ready for approval', scheduled: 'Scheduled', posted: 'Posted' }
export const PLATFORMS = ['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'Google']
export const FORMATS = ['Reel', 'Post', 'Carousel', 'Story', 'Ad', 'Short']
export const COLORS = ['#e04c5c', '#d97706', '#2563eb', '#0d9488', '#7c3aed', '#16a34a', '#db2777', '#475569', '#0891b2', '#ca8a04']

// what each role can do, in words (Settings › Roles). Keep in step with can() below.
export const PERMISSIONS = [
  ['See every project, task and the whole calendar', ['admin', 'member']],
  ['See only the projects they’re on, and tasks handed to them', ['freelancer']],
  ['Create, edit and hand off tasks, submit work for a check', ['admin', 'member', 'freelancer']],
  ['Plan content posts', ['admin', 'member']],
  ['Check work and send it to the client', ['admin']],
  ['Create projects (a project’s lead can edit it)', ['admin']],
  ['Add people and clients, give client logins', ['admin']],
  ['Post announcements', ['admin']],
  ['Start team group chats', ['admin', 'member', 'freelancer']],
  ['See their own projects and plan, approve work and posts', ['client']],
  ['Book meetings and chat with their project team', ['admin', 'member', 'freelancer', 'client']],
]

/* ---------- lookups ---------- */

export const byId = (list, id) => list.find((x) => x.id === id)
export const userName = (d, id) => byId(d.users, id)?.name ?? 'Someone'
export const firstName = (u) => u.name.split(' ')[0]
export const isStaff = (u) => u.role !== 'client' // works for the studio: the team and freelancers
export const staff = (d) => d.users.filter((u) => u.active && isStaff(u))
// the studio's own team, who see everything (not freelancers or clients)
export const isTeam = (u) => u.role === 'admin' || u.role === 'member'
export const team = (d) => d.users.filter((u) => u.active && isTeam(u))
const admins = (d) => d.users.filter((u) => u.active && u.role === 'admin').map((u) => u.id)
export const clientUsers = (d, clientId) => d.users.filter((u) => u.active && u.role === 'client' && u.clientId === clientId)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const mentions = (d, text) => d.users.filter((u) => u.active && new RegExp(`@${escapeRe(firstName(u))}\\b`, 'i').test(text)).map((u) => u.id)
export const projectTasks = (d, pid) => d.tasks.filter((t) => t.projectId === pid)
export function progress(d, pid) {
  const ts = projectTasks(d, pid)
  return ts.length ? Math.round((ts.filter((t) => t.status === 'done').length / ts.length) * 100) : 0
}
export const isOverdue = (t) => t.status !== 'done' && t.due && t.due < today()

export function channelName(d, ch, me) {
  if (ch.type === 'project') return byId(d.projects, ch.projectId)?.name ?? 'project'
  if (ch.type === 'dm') return userName(d, ch.memberIds.find((id) => id !== me.id) ?? me.id)
  return ch.name
}
export const dmId = (a, b) => `dm-${[a, b].sort().join('-')}`
// a group the admin reads without being in it never counts as unread, so it can't nag (or give them away)
export function unread(d, me, ch) {
  if (ch.type === 'group' && !ch.memberIds.includes(me.id)) return 0
  const seen = d.reads[me.id]?.[ch.id] ?? ''
  return d.messages.filter((m) => m.channelId === ch.id && m.userId !== me.id && !m.system && !m.deleted && m.at > seen).length
}
// the people really in a conversation: the members of a DM or group, else everyone who can read it
export const audience = (d, ch) =>
  d.users.filter((u) => u.active && can(u, 'channel.view', ch) && (!['dm', 'group'].includes(ch.type) || ch.memberIds.includes(u.id)))
// "Seen by …": who else in the conversation has read up to a message
export const seenBy = (d, ch, m) => audience(d, ch).filter((u) => u.id !== m.userId && (d.reads[u.id]?.[ch.id] ?? '') >= m.at)

/* ---------- calendar maths ---------- */

// every event occurrence between two days (inclusive); repeating events expand into one item per day they fall on
export function occurrences(d, from, to) {
  const out = []
  for (const e of d.events) {
    if (!e.repeat || e.repeat === 'none') {
      if (e.date >= from && e.date <= to) out.push(e)
      continue
    }
    const wd0 = weekday(e.date)
    for (let day = e.date > from ? e.date : from; day <= to; day = addDays(day, 1)) {
      const wd = weekday(day)
      if (e.repeat === 'weekdays' ? wd > 0 && wd < 6 : wd === wd0) out.push({ ...e, date: day })
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}

// who is double-booked if this event goes ahead. ponytail: a repeating event is only checked on its first day
export function conflicts(d, e) {
  const out = []
  for (const o of occurrences(d, e.date, e.date)) {
    if (o.id === e.id || !overlaps(e.start, e.end, o.start, o.end)) continue
    for (const id of e.attendeeIds) if (o.attendeeIds.includes(id) && o.rsvp?.[id] !== 'no') out.push({ userId: id, what: `${o.title} (${fmtTime(o.start)}–${fmtTime(o.end)})` })
  }
  return out
}

/* ---------- permissions ---------- */

export function can(u, action, x = {}) {
  if (!u?.active) return false
  const admin = u.role === 'admin'
  const team = isTeam(u)
  const isStaffer = u.role !== 'client'
  const free = u.role === 'freelancer'
  const ownProject = (pid) => u.role === 'client' && byId(db.projects, pid)?.clientId === u.clientId
  // a freelancer works only in projects they lead or are on, and on tasks handed to them
  const leads = (p) => Boolean(p && (p.managerId === u.id || p.memberIds.includes(u.id)))
  const onProject = (pid) => team || (free && leads(byId(db.projects, pid)))
  const onTask = (t) => team || (free && (t.assigneeId === u.id || leads(byId(db.projects, t.projectId))))
  switch (action) {
    case 'org.manage': // people, clients, announcements
      return admin
    case 'project.view':
      return team || (free && leads(x)) || x.clientId === u.clientId
    case 'project.create':
      return admin
    case 'project.edit':
      return admin || x.managerId === u.id
    case 'task.view':
      return onTask(x) || ownProject(x.projectId)
    case 'task.edit': // small team: anyone can create, edit, reassign and hand off any task (a freelancer: in their projects)
      return team || (free && (!x.projectId || onTask(x)))
    case 'task.delete':
      return admin || (x.createdBy === u.id && onTask(x))
    case 'deliverable.submit':
      return team || (free && (!x.projectId || onProject(x.projectId)))
    case 'deliverable.view':
      return onProject(x.projectId) || (x.sent && ownProject(x.projectId))
    case 'deliverable.review':
      return admin
    case 'deliverable.decide':
      return admin || ownProject(x.projectId)
    case 'event.view':
      return team || x.attendeeIds.includes(u.id) || x.createdBy === u.id
    case 'event.edit':
      return admin || x.createdBy === u.id
    case 'content.manage':
      return team
    case 'content.view':
    case 'content.decide':
      return team || (u.role === 'client' && x.clientId === u.clientId)
    case 'channel.view':
      if (x.type === 'dm') return x.memberIds.includes(u.id)
      // an admin can read every group, even ones they aren't in (members aren't told)
      if (x.type === 'group') return admin || (isStaffer && x.memberIds.includes(u.id))
      if (x.type === 'project') return onProject(x.projectId) || (x.clientVisible && ownProject(x.projectId))
      return team
    case 'channel.post': // reading a group you aren't in is read-only
      return can(u, 'channel.view', x) && (x.type !== 'group' || x.memberIds.includes(u.id)) && (!x.readOnly || admin)
    case 'group.manage':
      return x.type === 'group' && isStaffer && x.memberIds.includes(u.id)
    default:
      return false
  }
}

function must(ok, what) {
  if (!ok) throw new Error(`You don't have permission to ${what}.`)
}
function need(ok, msg) {
  if (!ok) throw new Error(msg)
}

/* ---------- side effects every action shares ---------- */

// live, the server writes these (with the real ids) and realtime brings them back in a blink
function log(d, me, text, link = '') {
  if (live) return
  d.activity.unshift({ id: uid(), userId: me.id, text, link, at: nowIso() })
  d.activity.splice(400)
}
function notify(d, me, ids, text, link = '') {
  if (live) return
  for (const id of new Set(ids)) if (id && id !== me.id) d.notifications.unshift({ id: uid(), userId: id, fromId: me.id, text, link, at: nowIso(), read: false })
  d.notifications.splice(1500)
}

// the fields an edit really changed — only these go to the server, so two people editing different fields of
// the same thing never overwrite each other
const changes = (old, next) => Object.fromEntries(Object.entries(next).filter(([k, v]) => k !== '_r' && JSON.stringify(v) !== JSON.stringify(old[k])))

/* ---------- people & clients ---------- */

export function savePerson(me, p) {
  must(can(me, 'org.manage'), 'manage people')
  const old = p.id && byId(db.users, p.id)
  const email = (p.email || '').trim().toLowerCase()
  need(p.name?.trim(), 'Add their name.')
  need(/^\S+@\S+\.\S+$/.test(email), 'Add a valid email — it is their login.')
  need(!db.users.some((u) => u.email === email && u.id !== p.id), 'Someone already uses that email.')
  need(p.role !== 'client' || p.clientId, 'Pick which client this login belongs to.')
  need(!old || old.id !== me.id || p.role === old.role, 'You cannot change your own role.')
  need(!p.password || p.password.length >= 8, 'Passwords need at least 8 characters.')
  need(!live || old || p.password, 'Set a temporary password (8+ characters) and share it with them.')
  // logins live in Supabase Auth, which only the server may touch: wait for it (the new row arrives by realtime)
  if (live) return callPeople({ action: 'save', person: { ...p, email } })
  return commit((d) => {
    const { password: _, ...rest } = p
    const clean = { ...rest, email, name: p.name.trim(), clientId: p.role === 'client' ? p.clientId : null }
    if (old) {
      Object.assign(byId(d.users, p.id), clean)
      if (old.role !== clean.role) notify(d, me, [old.id], `changed your role to ${ROLES[clean.role].label}`, '#/settings')
      log(d, me, `updated ${clean.name}'s details`, '#/settings/team')
      return p.id
    }
    const id = uid()
    d.users.push({ title: '', phone: '', color: COLORS[d.users.length % COLORS.length], ...clean, id, active: true })
    notify(d, me, [id], 'added you to YG Hub — welcome!', '#/')
    log(d, me, clean.role === 'client' ? `gave ${clean.name} a login for ${byId(d.clients, clean.clientId)?.name}` : `added ${clean.name} to the team`, clean.role === 'client' ? '#/settings/clients' : '#/settings/team')
    return id
  })
}

export function setActive(me, id, active) {
  const u = byId(db.users, id)
  must(can(me, 'org.manage'), `change ${u.name}'s access`)
  need(id !== me.id, 'You cannot deactivate yourself.')
  if (live) return callPeople({ action: 'active', id, active })
  commit((d) => {
    byId(d.users, id).active = active
    log(d, me, `${active ? 'reactivated' : 'deactivated'} ${u.name}'s login`, '#/settings/team')
  })
}

export function updateProfile(me, f) {
  need(f.name?.trim(), 'Your name cannot be empty.')
  commit((d) => Object.assign(byId(d.users, me.id), { name: f.name.trim(), phone: f.phone, title: f.title }))
  send('update_profile', { name: f.name.trim(), phone: f.phone, title: f.title }, [['people', me.id]])
}

export function saveClient(me, c) {
  must(can(me, 'org.manage'), 'manage clients')
  need(c.name?.trim(), 'Add the client’s business name.')
  const old = c.id && byId(db.clients, c.id)
  const id = commit((d) => {
    const cur = old && byId(d.clients, c.id)
    if (cur) Object.assign(cur, c)
    else d.clients.push({ notes: '', ...c, id: uid() })
    log(d, me, `${old ? 'updated' : 'added the client'} ${c.name}`, '#/settings/clients')
    return old ? old.id : d.clients.at(-1).id
  })
  const diff = old && changes(old, c)
  send('save_client', old ? { id, ...diff } : { ...c, id }, old ? [['clients', id], ...('notes' in diff ? [['client_private', id]] : [])] : [])
  return id
}

/* ---------- projects ---------- */

export function saveProject(me, p) {
  const old = p.id && byId(db.projects, p.id)
  must(old ? can(me, 'project.edit', old) : can(me, 'project.create'), old ? 'edit this project' : 'create projects')
  need(p.name?.trim(), 'Give the project a name.')
  need(p.clientId, 'Pick the client.')
  need(!p.start || !p.due || p.start <= p.due, 'The due date is before the start date.')
  const id = commit((d) => {
    const link = (id) => `#/projects/${id}`
    if (old) {
      const t = byId(d.projects, p.id)
      const added = [p.managerId, ...p.memberIds].filter((id) => id !== t.managerId && !t.memberIds.includes(id))
      const statusChanged = t.status !== p.status
      Object.assign(t, p)
      notify(d, me, added, `added you to the project “${p.name}”`, link(p.id))
      if (statusChanged) {
        notify(d, me, [...p.memberIds, p.managerId], `marked “${p.name}” ${PROJECT_STATUS[p.status]}`, link(p.id))
        if (p.status === 'done') notify(d, me, clientUsers(d, p.clientId).map((u) => u.id), `marked “${p.name}” as delivered`, link(p.id))
      }
      log(d, me, statusChanged ? `marked “${p.name}” ${PROJECT_STATUS[p.status]}` : `updated the project “${p.name}”`, link(p.id))
      return p.id
    }
    const id = uid()
    d.projects.push({ status: 'planning', memberIds: [], brief: '', priority: 'normal', ...p, id, createdAt: today() })
    d.channels.push({ id: `ch-${id}`, type: 'project', projectId: id, clientVisible: true, memberIds: [] })
    notify(d, me, [...p.memberIds, p.managerId], `added you to the new project “${p.name}”`, link(id))
    log(d, me, `started the project “${p.name}” for ${byId(d.clients, p.clientId)?.name}`, link(id))
    return id
  })
  send('save_project', old ? { id, ...changes(old, p) } : { ...p, id }, old ? [['projects', id]] : [])
  return id
}

/* ---------- tasks ---------- */

export function saveTask(me, t) {
  const old = t.id && byId(db.tasks, t.id)
  must(can(me, 'task.edit', old || t), old ? 'edit this task' : 'create tasks')
  // a freelancer only adds tasks to (or moves them into) projects they're on
  const projectId = t.projectId ?? old?.projectId
  must(can(me, 'task.edit', { projectId, assigneeId: old?.projectId === projectId ? old.assigneeId : null }), 'add tasks to this project')
  need(t.title?.trim(), 'Give the task a title.')
  need(t.projectId, 'Pick the project.')
  const id = commit((d) => {
    let task
    if (old) Object.assign((task = byId(d.tasks, t.id)), t, { title: t.title.trim() })
    else d.tasks.push((task = { status: 'todo', priority: 'normal', desc: '', checklist: [], comments: [], ...t, title: t.title.trim(), id: uid(), createdBy: me.id, createdAt: nowIso() }))
    if (task.status === 'done') task.completedAt ||= today()
    else task.completedAt = null
    const link = `#/tasks/${task.id}`
    const q = `“${task.title}”`
    if (task.assigneeId && (!old || old.assigneeId !== task.assigneeId)) notify(d, me, [task.assigneeId], `gave you ${q}`, link)
    if (old && old.status !== task.status) {
      if (task.status === 'review') notify(d, me, [...admins(d), byId(d.projects, task.projectId)?.managerId], `${q} is ready for review`, link)
      if (task.status === 'done') notify(d, me, [task.createdBy], `finished ${q}`, link)
      log(d, me, `moved ${q} to ${TASK_STATUS[task.status]}`, link)
    } else log(d, me, old ? `updated ${q}` : `created ${q}`, link)
    return task.id
  })
  const diff = old && changes(old, t)
  send('save_task', old ? { id, ...diff } : { ...t, id }, old ? [['tasks', id], ...('desc' in diff || 'checklist' in diff ? [['task_private', id]] : [])] : [])
  return id
}

export const moveTask = (me, id, status) => saveTask(me, { ...byId(db.tasks, id), status })

// pass work to someone else with a note: they own it now, it starts again at To do, and the note stays on the task
export function handoff(me, id, toId, note) {
  const t = byId(db.tasks, id)
  must(can(me, 'task.edit', t), 'hand off this task')
  need(byId(db.users, toId)?.active && toId !== t.assigneeId, 'Pick who to hand it to.')
  const commentId = uid()
  commit((d) => {
    const task = byId(d.tasks, id)
    const from = task.assigneeId ? userName(d, task.assigneeId).split(' ')[0] : 'Unassigned'
    const to = userName(d, toId).split(' ')[0]
    Object.assign(task, { assigneeId: toId, status: 'todo', completedAt: null })
    task.comments.push({ id: commentId, userId: me.id, at: nowIso(), text: note || '', handoff: `${from} → ${to}` })
    const link = `#/tasks/${id}`
    notify(d, me, [toId], `handed you “${task.title}”${note ? `: ${note}` : ''}`, link)
    log(d, me, `handed “${task.title}” to ${to}`, link)
  })
  send('handoff', { id, toId, note: note || '', commentId }, [['tasks', id], ['task_private', id]])
}

export function commentTask(me, id, text) {
  must(can(me, 'task.edit', byId(db.tasks, id)), 'comment on tasks')
  text = text.trim()
  if (!text) return
  const commentId = uid()
  commit((d) => {
    const t = byId(d.tasks, id)
    t.comments.push({ id: commentId, userId: me.id, text, at: nowIso() })
    const link = `#/tasks/${id}`
    const tagged = mentions(d, text)
    notify(d, me, tagged, `mentioned you on “${t.title}”: ${text.slice(0, 90)}`, link)
    notify(d, me, [t.assigneeId, t.createdBy].filter((x) => !tagged.includes(x)), `commented on “${t.title}”: ${text.slice(0, 90)}`, link)
  })
  send('comment_task', { id, commentId, text }, [['task_private', id]])
}

export function toggleCheck(me, id, itemId) {
  must(can(me, 'task.edit', byId(db.tasks, id)), 'tick this checklist')
  let done
  commit((d) => {
    const item = byId(byId(d.tasks, id).checklist, itemId)
    done = item.done = !item.done
  })
  send('check_item', { id, itemId, done }, [['task_private', id]])
}

export function deleteTask(me, id) {
  const t = byId(db.tasks, id)
  must(can(me, 'task.delete', t), 'delete this task')
  commit((d) => {
    d.tasks = d.tasks.filter((x) => x.id !== id)
    log(d, me, `deleted the task “${t.title}”`)
  })
  send('delete_task', { id })
}

/* ---------- deliverables: maker → admin check → client approval ---------- */

export function submitDeliverable(me, { id, projectId, title, type, link, note }) {
  must(can(me, 'deliverable.submit', { projectId: byId(db.deliverables, id)?.projectId ?? projectId }), 'submit work')
  need(id || title?.trim(), 'Name what you are submitting.')
  need(/^https?:\/\/\S+$/.test(link || ''), 'Paste a link to the file (Google Drive, Frame.io, Figma, the live site…).')
  const again = id && byId(db.deliverables, id)
  const xid = commit((d) => {
    let x = again && byId(d.deliverables, id)
    const at = nowIso()
    if (x) {
      x.version += 1
      Object.assign(x, { link, status: 'internal', submittedBy: me.id })
      x.history.push({ userId: me.id, at, action: `uploaded v${x.version}`, note })
    } else {
      x = { id: uid(), projectId, title: title.trim(), type, link, version: 1, status: 'internal', sent: false, submittedBy: me.id, history: [{ userId: me.id, at, action: 'submitted v1 for a check', note }] }
      d.deliverables.push(x)
    }
    const url = `#/projects/${x.projectId}/deliverables`
    notify(d, me, admins(d), `submitted “${x.title}” v${x.version} for a check`, url)
    log(d, me, `submitted “${x.title}” v${x.version} for a check`, url)
    return x.id
  })
  send('submit_deliverable', { id: xid, projectId, title, type, link, note: note || '' }, again ? [['deliverables', xid]] : [])
}

export function reviewDeliverable(me, id, approve, note) {
  const x = byId(db.deliverables, id)
  must(can(me, 'deliverable.review', x), 'check work before it goes to the client')
  need(x.status === 'internal', 'This is not waiting for a check.')
  need(approve || note?.trim(), 'Say what needs to change.')
  commit((d) => {
    const t = byId(d.deliverables, id)
    const p = byId(d.projects, t.projectId)
    const url = `#/projects/${p.id}/deliverables`
    if (approve) {
      Object.assign(t, { status: 'client', sent: true })
      t.history.push({ userId: me.id, at: nowIso(), action: `sent v${t.version} to the client`, note })
      notify(d, me, clientUsers(d, p.clientId).map((u) => u.id), `sent “${t.title}” v${t.version} for your approval`, url)
      notify(d, me, [t.submittedBy], `checked your “${t.title}” and sent it to the client`, url)
      log(d, me, `sent “${t.title}” v${t.version} to ${byId(d.clients, p.clientId)?.name}`, url)
    } else {
      t.status = 'changes'
      t.history.push({ userId: me.id, at: nowIso(), action: 'asked for changes before it goes to the client', note })
      notify(d, me, [t.submittedBy], `asked for changes on “${t.title}”: ${note}`, url)
    }
  })
  send('review_deliverable', { id, approve, note: note || '' }, [['deliverables', id]])
}

export function decideDeliverable(me, id, approve, note) {
  const x = byId(db.deliverables, id)
  must(can(me, 'deliverable.decide', x), 'approve this work')
  need(x.status === 'client', 'This is not waiting for the client.')
  need(approve || note?.trim(), 'Tell the team what to change.')
  commit((d) => {
    const t = byId(d.deliverables, id)
    const p = byId(d.projects, t.projectId)
    const url = `#/projects/${p.id}/deliverables`
    const proxy = me.role !== 'client' ? ' on the client’s behalf' : ''
    t.status = approve ? 'approved' : 'changes'
    t.history.push({ userId: me.id, at: nowIso(), action: approve ? `approved v${t.version}${proxy}` : `requested changes${proxy}`, note })
    notify(d, me, [t.submittedBy, p.managerId, ...admins(d)], approve ? `approved “${t.title}” v${t.version}` : `requested changes on “${t.title}”: ${note}`, url)
    log(d, me, approve ? `approved “${t.title}” v${t.version}${proxy}` : `requested changes on “${t.title}”${proxy}`, url)
  })
  send('decide_deliverable', { id, approve, note: note || '' }, [['deliverables', id]])
}

/* ---------- calendar ---------- */

export function saveEvent(me, e) {
  const old = e.id && byId(db.events, e.id)
  if (old) must(can(me, 'event.edit', old), 'edit this meeting')
  need(e.title?.trim(), 'Give it a title.')
  need(e.date, 'Pick a date.')
  need(e.start < e.end, 'The end time must be after the start time.')
  const attendeeIds = [...new Set([me.id, ...e.attendeeIds])]
  const id = commit((d) => {
    const when = `${fmtDay(e.date)}, ${fmtTime(e.start)}`
    const link = '#/calendar'
    if (old) {
      const t = byId(d.events, e.id)
      const moved = t.date !== e.date || t.start !== e.start || t.end !== e.end
      const added = attendeeIds.filter((id) => !t.attendeeIds.includes(id))
      Object.assign(t, e, { attendeeIds })
      notify(d, me, added, `invited you to “${e.title}” on ${when}`, link)
      if (moved) notify(d, me, attendeeIds.filter((id) => !added.includes(id)), `moved “${e.title}” to ${when}`, link)
      log(d, me, `updated “${e.title}”`, link)
      return e.id
    }
    const id = uid()
    d.events.push({ repeat: 'none', location: '', agenda: '', projectId: '', ...e, attendeeIds, id, createdBy: me.id, rsvp: { [me.id]: 'yes' } })
    notify(d, me, attendeeIds, `invited you to “${e.title}” on ${when}`, link)
    log(d, me, `scheduled “${e.title}” for ${when}`, link)
    return id
  })
  send('save_event', old ? { id, ...changes(old, { ...e, attendeeIds }) } : { ...e, attendeeIds, id }, old ? [['events', id]] : [])
  return id
}

export function deleteEvent(me, id) {
  const e = byId(db.events, id)
  must(can(me, 'event.edit', e), 'cancel this meeting')
  commit((d) => {
    d.events = d.events.filter((x) => x.id !== id)
    notify(d, me, e.attendeeIds, `cancelled “${e.title}” (${fmtDay(e.date)}, ${fmtTime(e.start)})`, '#/calendar')
    log(d, me, `cancelled “${e.title}”`, '#/calendar')
  })
  send('delete_event', { id })
}

export function rsvp(me, id, answer) {
  const e = byId(db.events, id)
  need(e.attendeeIds.includes(me.id), 'You are not invited to this.')
  commit((d) => {
    byId(d.events, id).rsvp[me.id] = answer
    if (answer === 'no') notify(d, me, [e.createdBy], `can’t make “${e.title}” (${fmtDay(e.date)})`, '#/calendar')
  })
  send('rsvp', { id, answer }, [['events', id]])
}

/* ---------- chat ---------- */

export function openDm(me, otherId) {
  const id = dmId(me.id, otherId)
  if (!byId(db.channels, id)) {
    commit((d) => d.channels.push({ id, type: 'dm', memberIds: [me.id, otherId] }))
    send('open_dm', { otherId })
  }
  return id
}

export const MAX_MESSAGE = 4000

export function sendMessage(me, channelId, text) {
  const ch = byId(db.channels, channelId)
  must(can(me, 'channel.post', ch), 'post here')
  text = text.trim()
  if (!text) return
  if (text.length > MAX_MESSAGE) throw new Error(`That’s too long for one message (${text.length.toLocaleString('en-IN')} of ${MAX_MESSAGE.toLocaleString('en-IN')} characters).`)
  const id = uid()
  commit((d) => {
    const at = nowIso()
    d.messages.push({ id, channelId, userId: me.id, text, at })
    d.reads[me.id] = { ...d.reads[me.id], [channelId]: at }
    const link = `#/chat/${channelId}`
    const short = text.length > 90 ? `${text.slice(0, 90)}…` : text
    if (ch.type === 'dm') return notify(d, me, ch.memberIds, `messaged you: ${short}`, link)
    const where = channelName(d, ch, me)
    notify(d, me, mentions(d, text).filter((id) => can(byId(d.users, id), 'channel.post', ch)), `mentioned you in #${where}: ${short}`, link)
    // a client writing in their project channel should never go unseen
    if (ch.type === 'project' && me.role === 'client') notify(d, me, [byId(d.projects, ch.projectId)?.managerId, ...admins(d)], `wrote in #${where}: ${short}`, link)
    if (ch.readOnly) notify(d, me, team(d).map((u) => u.id), `posted an announcement: ${short}`, link)
  })
  send('send_message', { id, channelId, text })
}

export function markRead(me, channelId) {
  const ch = byId(db.channels, channelId)
  if (!ch || !unread(db, me, ch)) return
  commit((d) => (d.reads[me.id] = { ...d.reads[me.id], [channelId]: nowIso() }))
  send('mark_read', { channelId })
}

export function editMessage(me, id, text) {
  const m = byId(db.messages, id)
  must(m && m.userId === me.id && !m.system && !m.deleted && can(me, 'channel.post', byId(db.channels, m.channelId)), 'edit this message')
  text = text.trim()
  if (!text) throw new Error('A message can’t be empty — delete it instead.')
  if (text.length > MAX_MESSAGE) throw new Error(`That’s too long for one message (${MAX_MESSAGE.toLocaleString('en-IN')} characters at most).`)
  if (text === m.text) return
  commit((d) => Object.assign(byId(d.messages, id), { text, editedAt: nowIso() }))
  send('edit_message', { id, text }, [['messages', id]])
}

// your own messages; the admin can also remove anyone's in conversations they post in
export const canDeleteMessage = (me, m, ch) => !m.system && !m.deleted && can(me, 'channel.post', ch) && (m.userId === me.id || me.role === 'admin')
export function deleteMessage(me, id) {
  const m = byId(db.messages, id)
  must(m && canDeleteMessage(me, m, byId(db.channels, m.channelId)), 'delete this message')
  commit((d) => Object.assign(byId(d.messages, id), { text: '', deleted: true }))
  send('delete_message', { id }, [['messages', id]])
}

/* ---------- group chats (team only) ---------- */

// a line in the conversation like "Priya added Rahul". The server writes these itself when live.
function sys(d, me, channelId, text) {
  if (live) return
  d.messages.push({ id: uid(), channelId, userId: me.id, text, at: nowIso(), system: true })
}
const names = (d, ids) => {
  const ns = ids.map((id) => byId(d.users, id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map(firstName)
  return ns.length > 1 ? `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}` : (ns[0] ?? 'someone')
}

// create a group, or rename it and change who's in it (its members can). Members are active team people and
// always include you; leaving is leaveGroup.
export function saveGroup(me, v) {
  const old = v.id ? byId(db.channels, v.id) : null
  must(old ? can(me, 'group.manage', old) : isStaff(me), old ? 'change this group' : 'create groups')
  const name = (v.name ?? old?.name ?? '').trim()
  if (!name || name.length > 80) throw new Error('Give the group a name (up to 80 characters).')
  const memberIds = [...new Set([me.id, ...(v.memberIds ?? old.memberIds)])].filter((id) => {
    const u = byId(db.users, id)
    return u?.active && isStaff(u)
  })
  if (memberIds.length < 2) throw new Error('Add at least one other person.')
  const id = old?.id ?? `grp-${uid()}`
  const link = `#/chat/${id}`
  commit((d) => {
    if (!old) {
      d.channels.push({ id, type: 'group', name, memberIds })
      sys(d, me, id, 'created the group')
      return notify(d, me, memberIds, `added you to the group “${name}”`, link)
    }
    const added = memberIds.filter((x) => !old.memberIds.includes(x))
    const gone = old.memberIds.filter((x) => !memberIds.includes(x))
    Object.assign(byId(d.channels, id), { name, memberIds })
    if (name !== old.name) sys(d, me, id, `renamed the group to “${name}”`)
    if (added.length) sys(d, me, id, `added ${names(d, added)}`)
    if (gone.length) sys(d, me, id, `removed ${names(d, gone)}`)
    notify(d, me, added, `added you to the group “${name}”`, link)
    notify(d, me, gone, `removed you from the group “${name}”`, link)
  })
  send('save_group', { id, name, memberIds }, old ? [['channels', id]] : [])
  return id
}

export function leaveGroup(me, id) {
  const ch = byId(db.channels, id)
  must(ch && can(me, 'group.manage', ch), 'leave this group')
  commit((d) => {
    const c = byId(d.channels, id)
    c.memberIds = c.memberIds.filter((x) => x !== me.id)
    sys(d, me, id, 'left the group')
  })
  send('leave_group', { id }, [['channels', id]])
}

/* ---------- content plan ---------- */

export function savePost(me, p) {
  must(can(me, 'content.manage'), 'plan content')
  need(p.title?.trim(), 'Give the post a working title or hook.')
  need(p.clientId && p.date, 'Pick the client and the day it goes out.')
  const old = p.id && byId(db.posts, p.id)
  const id = commit((d) => {
    const cur = old && byId(d.posts, p.id)
    if (cur) Object.assign(cur, p)
    else d.posts.push({ status: 'idea', caption: '', notes: [], ...p, id: uid() })
    const link = '#/content'
    if (p.assigneeId && (!old || old.assigneeId !== p.assigneeId)) notify(d, me, [p.assigneeId], `gave you the ${p.format} “${p.title}” (${fmtDay(p.date)})`, link)
    if (p.status === 'ready' && old?.status !== 'ready') notify(d, me, clientUsers(d, p.clientId).map((u) => u.id), `has a ${p.format} ready for your approval: “${p.title}”`, link)
    log(d, me, `${old ? 'updated' : 'planned'} the ${p.format} “${p.title}” for ${byId(d.clients, p.clientId)?.name}`, link)
    return old ? old.id : d.posts.at(-1).id
  })
  send('save_post', old ? { id, ...changes(old, p) } : { ...p, id }, old ? [['posts', id]] : [])
  return id
}

export function decidePost(me, id, approve, note) {
  const p = byId(db.posts, id)
  must(can(me, 'content.decide', p), 'approve this post')
  need(approve || note?.trim(), 'Say what to change.')
  commit((d) => {
    const t = byId(d.posts, id)
    t.status = approve ? 'scheduled' : 'production'
    t.notes = [...(t.notes || []), { userId: me.id, at: nowIso(), text: approve ? `Approved${note ? `: ${note}` : ''}` : `Changes: ${note}` }]
    notify(d, me, [t.assigneeId, ...admins(d)], approve ? `approved the ${t.format} “${t.title}”` : `asked for changes on “${t.title}”: ${note}`, '#/content')
    log(d, me, approve ? `approved the ${t.format} “${t.title}”` : `asked for changes on “${t.title}”`, '#/content')
  })
  send('decide_post', { id, approve, note: note || '' }, [['posts', id]])
}

export function deletePost(me, id) {
  must(can(me, 'content.manage'), 'delete posts')
  commit((d) => (d.posts = d.posts.filter((x) => x.id !== id)))
  send('delete_post', { id })
}

/* ---------- notifications ---------- */

export function readNotifications(me, ids) {
  const mine = db.notifications.filter((n) => n.userId === me.id && !n.read && (!ids || ids.includes(n.id)))
  if (!mine.length) return
  commit((d) => d.notifications.forEach((n) => n.userId === me.id && (!ids || ids.includes(n.id)) && (n.read = true)))
  send('read_notifications', { ids: ids ?? null }, mine.map((n) => ['notifications', n.id]))
}

/* ---------- live: sign-in, loading, saving, realtime ---------- */

// where each table lives in memory. The *_private tables are the studio-only half of a task or client (clients
// can't read them) and merge into the same object.
const COLL = { people: 'users' }
const PRIVATE = { task_private: ['tasks', 'taskId'], client_private: ['clients', 'clientId'] }
const DEFAULTS = { tasks: { desc: '', checklist: [], comments: [] }, clients: { notes: '' } }
const NEWEST_FIRST = new Set(['activity', 'notifications'])
const camel = (k) => k.replace(/_(\w)/g, (_, c) => c.toUpperCase())
const ISO = /^\d{4}-\d\d-\d\dT/
// a server row in the app's shape: camelCase keys, every timestamp written like toISOString so they compare as text
function fromRow(raw) {
  const o = {}
  for (const [k, v] of Object.entries(raw)) o[camel(k)] = typeof v === 'string' && ISO.test(v) ? new Date(v).toISOString() : v
  return o
}

function toLocal(table, raw) {
  const { rev = 0, ...x } = fromRow(raw)
  return { ...DEFAULTS[COLL[table] || table], ...x, _r: { [table]: rev } }
}

// the bootstrap snapshot → a fresh db
function fromServer(b) {
  const d = empty()
  for (const [table, rows] of Object.entries(b)) {
    if (table === 'reads' || PRIVATE[table]) continue
    d[COLL[table] || table] = rows.map((raw) => toLocal(table, raw))
  }
  for (const [table, [coll, key]] of Object.entries(PRIVATE)) {
    const byKey = new Map(d[coll].map((x) => [x.id, x]))
    for (const raw of b[table]) {
      const { rev = 0, [key]: id, ...x } = fromRow(raw)
      const target = byKey.get(id)
      if (target) Object.assign(target, x, { _r: { ...target._r, [table]: rev } })
    }
  }
  for (const r of b.reads) (d.reads[r.user_id] ??= {})[r.channel_id] = new Date(r.at).toISOString()
  return d
}

// one realtime change onto d, a shallow copy of db (each list is copied the first time it changes)
function put(d, copied, { table, eventType, new: raw, old }) {
  if (table === 'reads') {
    const r = fromRow(raw)
    if ((d.reads[r.userId]?.[r.channelId] ?? '') <= r.at) d.reads = { ...d.reads, [r.userId]: { ...d.reads[r.userId], [r.channelId]: r.at } }
    return
  }
  const priv = PRIVATE[table]
  const coll = priv ? priv[0] : COLL[table] || table
  if (!d[coll]) return
  if (!copied.has(coll)) {
    d[coll] = [...d[coll]]
    copied.add(coll)
  }
  const list = d[coll]
  if (eventType === 'DELETE') {
    const i = priv ? -1 : list.findIndex((x) => x.id === old.id)
    if (i >= 0) list.splice(i, 1)
    return
  }
  const { rev = 0, ...x } = fromRow(raw)
  const id = priv ? x[priv[1]] : x.id
  if (priv) delete x[priv[1]]
  const i = list.findIndex((y) => y.id === id)
  const cur = list[i]
  if (cur && rev < (cur._r?.[table] ?? -1)) return // a late echo of an earlier write — the screen already shows newer
  if (priv && !cur) return // its task/client isn't here; the next full load fills it in
  const next = { ...DEFAULTS[coll], ...cur, ...x, id, _r: { ...cur?._r, [table]: rev } }
  if (i >= 0) list[i] = next
  else if (NEWEST_FIRST.has(coll)) list.unshift(next)
  else list.push(next)
}

// my own edit raises a row's rev by one on the server; expect it, so the echo of an older edit can't flicker back
function bump(table, id) {
  const priv = PRIVATE[table]
  const x = byId(db[priv ? priv[0] : COLL[table] || table], id)
  if (x) x._r = { ...x._r, [table]: (x._r?.[table] ?? 0) + 1 }
}

let session = live ? undefined : null // undefined = still checking for a saved sign-in
let loaded = !live
let loading = false
let notice = ''
let channel = null
let inbox = []
let flushTimer = 0
let queue = Promise.resolve()
export const getSession = () => session
export const isLoaded = () => loaded
export const getNotice = () => notice
export function dismissNotice() {
  notice = ''
  refresh()
}
const friendly = (e) => (/fetch|network|offline/i.test(e?.message ?? '') ? 'You look offline — that didn’t save. Check the connection and try again.' : e?.message || 'Something went wrong — please try again.')
function say(e) {
  notice = friendly(e)
  refresh()
}

// actions run in order, one after another, so the server sees them in the order you made them
function send(fn, p, touched = []) {
  if (!live) return
  for (const [table, id] of touched) bump(table, id)
  queue = queue.then(() => supabase.rpc(fn, { p })).then(({ error }) => error && failed(error), failed)
}
function failed(error) {
  say(error)
  load().catch(() => {}) // put the screen back to what the server really has
}

async function callPeople(body) {
  const { data, error } = await supabase.functions.invoke('people', { body })
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || friendly(error))
  return data.id
}

async function load() {
  loading = true
  try {
    const { data, error } = await supabase.rpc('bootstrap')
    if (error) throw error
    db = fromServer(data)
    loaded = true
  } finally {
    loading = false
  }
  flush() // changes that arrived while the snapshot was loading
  emit()
}
export const retry = () => load().then(dismissNotice, say)

function receive(change) {
  inbox.push(change)
  if (loaded && !loading && !flushTimer) flushTimer = setTimeout(flush, 30) // one re-render per burst of changes
}
function flush() {
  clearTimeout(flushTimer)
  flushTimer = 0
  if (!inbox.length || !loaded) return
  const d = { ...db }
  const copied = new Set()
  const groups = new Set()
  let reload = false
  const freelancer = byId(db.users, session?.userId)?.role === 'freelancer'
  for (const change of inbox.splice(0)) {
    // the admin changed my role: what I may see changed with it, so load afresh
    if (change.table === 'people' && change.new?.id === session?.userId && change.new.role !== byId(db.users, session.userId)?.role) reload = true
    put(d, copied, change)
    const link = change.table === 'notifications' && change.eventType === 'INSERT' ? change.new.link : ''
    if (link.startsWith('#/chat/grp-')) groups.add(link.slice(7))
    // a freelancer put on a project: everything in it was out of sight until now, so load afresh
    if (freelancer && /^#\/projects\/[^/]+$/.test(link)) reload = true
  }
  db = d
  emit()
  if (reload) return load().catch(say)
  for (const id of groups) refetchGroup(id).catch(say)
}

// chat loads the latest PAGE messages of each conversation; older ones come a page at a time
const PAGE = 200
const allLoaded = new Set()
const messagesOf = (id) => supabase.from('messages').select('*').eq('channel_id', id).order('at', { ascending: false }).limit(PAGE)
export const hasEarlier = (channelId) => live && !allLoaded.has(channelId) && db.messages.filter((m) => m.channelId === channelId).length >= PAGE
export async function loadEarlier(channelId) {
  const oldest = db.messages.find((m) => m.channelId === channelId)?.at
  const { data, error } = await messagesOf(channelId).lt('at', oldest)
  if (error) throw new Error(friendly(error))
  if (data.length < PAGE) allLoaded.add(channelId)
  db = { ...db, messages: [...data.reverse().map((r) => toLocal('messages', r)), ...db.messages] }
  emit()
}

// being added to a group or taken out of one: the history you couldn't see isn't in memory, and a removal never
// reaches you as a change (you can't see the row any more). The notice about it does, so fetch the group afresh.
// ponytail: any notice linking to a group (an @mention too) refetches it — three small queries
async function refetchGroup(id) {
  const [ch, msgs, reads] = await Promise.all([supabase.from('channels').select('*').eq('id', id), messagesOf(id), supabase.from('reads').select('*').eq('channel_id', id)])
  const error = ch.error || msgs.error || reads.error
  if (error) throw error
  const fresh = ch.data.length ? msgs.data.reverse().map((r) => toLocal('messages', r)) : []
  const newest = fresh.at(-1)?.at ?? ''
  const ids = new Set(fresh.map((m) => m.id))
  const d = { ...db, reads: { ...db.reads } }
  d.channels = [...db.channels.filter((c) => c.id !== id), ...ch.data.map((r) => toLocal('channels', r))]
  // keep anything newer that arrived live while this was loading
  d.messages = [...db.messages.filter((m) => m.channelId !== id || (ch.data.length && m.at > newest && !ids.has(m.id))), ...fresh]
  for (const r of reads.data) d.reads[r.user_id] = { ...d.reads[r.user_id], [id]: new Date(r.at).toISOString() }
  db = d
  emit()
}

/* typing and who's online: Realtime private channels, checked by the policies in *_chat.sql */
let presence = null
let online = new Set()
export const isOnline = (id) => online.has(id)

// "Priya is typing…" in one conversation. onChange gets the ids of whoever is typing there now.
export function watchTyping(channelId, onChange) {
  if (!live || !session?.userId) return { typing() {}, done() {}, stop() {} }
  const timers = new Map()
  const drop = (id) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    onChange([...timers.keys()])
  }
  const ch = supabase
    .channel(`typing:${channelId}`, { config: { private: true } })
    .on('broadcast', { event: 'typing' }, ({ payload: { userId, done } }) => {
      if (done) return drop(userId)
      clearTimeout(timers.get(userId))
      timers.set(userId, setTimeout(() => drop(userId), 4000)) // gone quiet without sending
      onChange([...timers.keys()])
    })
    .subscribe()
  let last = 0
  const tell = (done) => ch.send({ type: 'broadcast', event: 'typing', payload: { userId: session.userId, done } })
  return {
    typing() {
      if (Date.now() - last < 2500) return // at most one signal every 2.5 s
      last = Date.now()
      tell(false)
    },
    done() {
      if (!last) return
      last = 0
      tell(true)
    },
    stop() {
      timers.forEach(clearTimeout)
      supabase.removeChannel(ch)
    },
  }
}

function connect(userId) {
  session = { userId }
  channel = supabase
    .channel('hub')
    .on('postgres_changes', { event: '*', schema: 'public' }, receive)
    // the live feed is only really on once the server says so (a moment after the channel itself joins), and again
    // after every reconnect — load once more then, so nothing that changed in between is missed
    .on('system', {}, (m) => m.extension === 'postgres_changes' && m.status === 'ok' && load().catch(say))
    .subscribe()
  presence = supabase
    .channel('online', { config: { private: true, presence: { key: userId } } })
    .on('presence', { event: 'sync' }, () => {
      online = new Set(Object.keys(presence.presenceState()))
      refresh()
    })
    .subscribe((status) => status === 'SUBSCRIBED' && presence.track({}))
  refresh()
  load().catch(say) // don't wait for the feed: show the studio straight away
}
function disconnect() {
  if (channel) supabase.removeChannel(channel)
  if (presence) supabase.removeChannel(presence)
  channel = presence = null
  online = new Set()
  inbox = []
  session = null
  loaded = false
  db = empty()
  emit()
}

if (live)
  supabase.auth.onAuthStateChange((event, s) => {
    const id = s?.user?.id ?? null
    // supabase-js can deadlock if this callback waits on another Supabase call, so step out of it first
    setTimeout(() => {
      if (session !== undefined && id === (session?.userId ?? null)) return // token refresh — same person
      disconnect()
      if (id) connect(id)
    })
  })

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (!error) return
  if (/banned/i.test(error.message)) throw new Error('This login has been switched off. Ask your admin.')
  if (/invalid/i.test(error.message)) throw new Error('That email and password don’t match an account.')
  throw new Error(friendly(error))
}
export const signOut = () => supabase.auth.signOut({ scope: 'local' }) // this device only
export async function changePassword(password) {
  need((password || '').length >= 8, 'Use at least 8 characters.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(friendly(error))
}
