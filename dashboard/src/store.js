// YG Hub data + rules. Demo mode: the whole studio lives in this browser (localStorage) and syncs live across tabs,
// so two people can be signed in side by side. Going live = swap read/persist/commit for Supabase calls; can() maps
// 1:1 onto row-level-security policies.
import { seed } from './seed.js'
import { addDays, fmtDay, fmtTime, nowIso, overlaps, today, uid, weekday } from './util.js'

const KEY = 'yg-hub-v2'
const hasLS = typeof localStorage !== 'undefined'
function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

let db = (hasLS && read()) || seed()
if (hasLS && !read()) localStorage.setItem(KEY, JSON.stringify(db))
const subs = new Set()
export const subscribe = (f) => (subs.add(f), () => subs.delete(f))
export const getDb = () => db
const emit = () => subs.forEach((f) => f())
function persist() {
  if (hasLS) localStorage.setItem(KEY, JSON.stringify(db))
  emit()
}
function commit(fn) {
  const next = structuredClone(db)
  const out = fn(next)
  db = next
  persist()
  return out
}
export function resetDemo() {
  db = seed()
  persist()
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    db = read() || seed()
    emit()
  })

/* ---------- vocabulary ---------- */

export const ROLES = {
  admin: { label: 'Admin', blurb: 'Runs the studio: adds people and clients, creates projects, and checks work before it goes to a client.' },
  member: { label: 'Team member', blurb: 'Does the work: tasks, handing work to each other, submitting work for a check, planning content, meetings and chat.' },
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
  ['Create, edit and hand off tasks', ['admin', 'member']],
  ['Submit work for a check, plan content posts', ['admin', 'member']],
  ['Check work and send it to the client', ['admin']],
  ['Create projects (a project’s lead can edit it)', ['admin']],
  ['Add people and clients, give client logins', ['admin']],
  ['Post announcements', ['admin']],
  ['See their own projects and plan, approve work and posts', ['client']],
  ['Book meetings and chat with their project team', ['admin', 'member', 'client']],
]

/* ---------- lookups ---------- */

export const byId = (list, id) => list.find((x) => x.id === id)
export const userName = (d, id) => byId(d.users, id)?.name ?? 'Someone'
export const firstName = (u) => u.name.split(' ')[0]
export const isStaff = (u) => u.role !== 'client'
export const staff = (d) => d.users.filter((u) => u.active && isStaff(u))
const admins = (d) => d.users.filter((u) => u.active && u.role === 'admin').map((u) => u.id)
export const clientUsers = (d, clientId) => d.users.filter((u) => u.active && u.role === 'client' && u.clientId === clientId)
export const mentions = (d, text) => d.users.filter((u) => u.active && new RegExp(`@${firstName(u)}\\b`, 'i').test(text)).map((u) => u.id)
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
export function unread(d, me, ch) {
  const seen = d.reads[me.id]?.[ch.id] ?? ''
  return d.messages.filter((m) => m.channelId === ch.id && m.userId !== me.id && m.at > seen).length
}

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
  const isStaffer = u.role !== 'client'
  const ownProject = (pid) => u.role === 'client' && byId(db.projects, pid)?.clientId === u.clientId
  switch (action) {
    case 'org.manage': // people, clients, announcements
      return admin
    case 'project.view':
      return isStaffer || x.clientId === u.clientId
    case 'project.create':
      return admin
    case 'project.edit':
      return admin || x.managerId === u.id
    case 'task.view':
      return isStaffer || ownProject(x.projectId)
    case 'task.edit': // small team: anyone can create, edit, reassign and hand off any task
      return isStaffer
    case 'task.delete':
      return admin || (isStaffer && x.createdBy === u.id)
    case 'deliverable.submit':
      return isStaffer
    case 'deliverable.view':
      return isStaffer || (x.sent && ownProject(x.projectId))
    case 'deliverable.review':
      return admin
    case 'deliverable.decide':
      return admin || ownProject(x.projectId)
    case 'event.view':
      return isStaffer || x.attendeeIds.includes(u.id)
    case 'event.edit':
      return admin || x.createdBy === u.id
    case 'content.manage':
      return isStaffer
    case 'content.view':
    case 'content.decide':
      return isStaffer || x.clientId === u.clientId
    case 'channel.view':
      if (x.type === 'dm') return x.memberIds.includes(u.id)
      if (x.type === 'project') return isStaffer || (x.clientVisible && ownProject(x.projectId))
      return isStaffer
    case 'channel.post':
      return can(u, 'channel.view', x) && (!x.readOnly || admin)
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

function log(d, me, text, link = '') {
  d.activity.unshift({ id: uid(), userId: me.id, text, link, at: nowIso() })
  d.activity.splice(400)
}
function notify(d, me, ids, text, link = '') {
  for (const id of new Set(ids)) if (id && id !== me.id) d.notifications.unshift({ id: uid(), userId: id, fromId: me.id, text, link, at: nowIso(), read: false })
  d.notifications.splice(1500)
}

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
  return commit((d) => {
    const clean = { ...p, email, name: p.name.trim(), clientId: p.role === 'client' ? p.clientId : null }
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
  commit((d) => {
    byId(d.users, id).active = active
    log(d, me, `${active ? 'reactivated' : 'deactivated'} ${u.name}'s login`, '#/settings/team')
  })
}

export function updateProfile(me, f) {
  need(f.name?.trim(), 'Your name cannot be empty.')
  commit((d) => Object.assign(byId(d.users, me.id), { name: f.name.trim(), phone: f.phone, title: f.title }))
}

export function saveClient(me, c) {
  must(can(me, 'org.manage'), 'manage clients')
  need(c.name?.trim(), 'Add the client’s business name.')
  return commit((d) => {
    const old = c.id && byId(d.clients, c.id)
    if (old) Object.assign(old, c)
    else d.clients.push({ notes: '', ...c, id: uid() })
    log(d, me, `${old ? 'updated' : 'added the client'} ${c.name}`, '#/settings/clients')
    return old ? old.id : d.clients.at(-1).id
  })
}

/* ---------- projects ---------- */

export function saveProject(me, p) {
  const old = p.id && byId(db.projects, p.id)
  must(old ? can(me, 'project.edit', old) : can(me, 'project.create'), old ? 'edit this project' : 'create projects')
  need(p.name?.trim(), 'Give the project a name.')
  need(p.clientId, 'Pick the client.')
  need(!p.start || !p.due || p.start <= p.due, 'The due date is before the start date.')
  return commit((d) => {
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
    d.channels.push({ id: `ch-${id}`, type: 'project', projectId: id, clientVisible: true })
    notify(d, me, [...p.memberIds, p.managerId], `added you to the new project “${p.name}”`, link(id))
    log(d, me, `started the project “${p.name}” for ${byId(d.clients, p.clientId)?.name}`, link(id))
    return id
  })
}

/* ---------- tasks ---------- */

export function saveTask(me, t) {
  const old = t.id && byId(db.tasks, t.id)
  must(can(me, 'task.edit', old || t), old ? 'edit this task' : 'create tasks')
  need(t.title?.trim(), 'Give the task a title.')
  need(t.projectId, 'Pick the project.')
  return commit((d) => {
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
}

export const moveTask = (me, id, status) => saveTask(me, { ...byId(db.tasks, id), status })

// pass work to someone else with a note: they own it now, it starts again at To do, and the note stays on the task
export function handoff(me, id, toId, note) {
  const t = byId(db.tasks, id)
  must(can(me, 'task.edit', t), 'hand off this task')
  need(byId(db.users, toId)?.active && toId !== t.assigneeId, 'Pick who to hand it to.')
  commit((d) => {
    const task = byId(d.tasks, id)
    const from = task.assigneeId ? userName(d, task.assigneeId).split(' ')[0] : 'Unassigned'
    const to = userName(d, toId).split(' ')[0]
    Object.assign(task, { assigneeId: toId, status: 'todo', completedAt: null })
    task.comments.push({ id: uid(), userId: me.id, at: nowIso(), text: note || '', handoff: `${from} → ${to}` })
    const link = `#/tasks/${id}`
    notify(d, me, [toId], `handed you “${task.title}”${note ? `: ${note}` : ''}`, link)
    log(d, me, `handed “${task.title}” to ${to}`, link)
  })
}

export function commentTask(me, id, text) {
  must(isStaff(me), 'comment on tasks')
  text = text.trim()
  if (!text) return
  commit((d) => {
    const t = byId(d.tasks, id)
    t.comments.push({ id: uid(), userId: me.id, text, at: nowIso() })
    const link = `#/tasks/${id}`
    const tagged = mentions(d, text)
    notify(d, me, tagged, `mentioned you on “${t.title}”: ${text.slice(0, 90)}`, link)
    notify(d, me, [t.assigneeId, t.createdBy].filter((x) => !tagged.includes(x)), `commented on “${t.title}”: ${text.slice(0, 90)}`, link)
  })
}

export function toggleCheck(me, id, itemId) {
  must(can(me, 'task.edit'), 'tick this checklist')
  commit((d) => {
    const item = byId(byId(d.tasks, id).checklist, itemId)
    item.done = !item.done
  })
}

export function deleteTask(me, id) {
  const t = byId(db.tasks, id)
  must(can(me, 'task.delete', t), 'delete this task')
  commit((d) => {
    d.tasks = d.tasks.filter((x) => x.id !== id)
    log(d, me, `deleted the task “${t.title}”`)
  })
}

/* ---------- deliverables: maker → admin check → client approval ---------- */

export function submitDeliverable(me, { id, projectId, title, type, link, note }) {
  must(can(me, 'deliverable.submit'), 'submit work')
  need(id || title?.trim(), 'Name what you are submitting.')
  need(/^https?:\/\/\S+$/.test(link || ''), 'Paste a link to the file (Google Drive, Frame.io, Figma, the live site…).')
  commit((d) => {
    let x = id && byId(d.deliverables, id)
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
  })
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
}

/* ---------- calendar ---------- */

export function saveEvent(me, e) {
  const old = e.id && byId(db.events, e.id)
  if (old) must(can(me, 'event.edit', old), 'edit this meeting')
  need(e.title?.trim(), 'Give it a title.')
  need(e.date, 'Pick a date.')
  need(e.start < e.end, 'The end time must be after the start time.')
  const attendeeIds = [...new Set([me.id, ...e.attendeeIds])]
  return commit((d) => {
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
}

export function deleteEvent(me, id) {
  const e = byId(db.events, id)
  must(can(me, 'event.edit', e), 'cancel this meeting')
  commit((d) => {
    d.events = d.events.filter((x) => x.id !== id)
    notify(d, me, e.attendeeIds, `cancelled “${e.title}” (${fmtDay(e.date)}, ${fmtTime(e.start)})`, '#/calendar')
    log(d, me, `cancelled “${e.title}”`, '#/calendar')
  })
}

export function rsvp(me, id, answer) {
  const e = byId(db.events, id)
  need(e.attendeeIds.includes(me.id), 'You are not invited to this.')
  commit((d) => {
    byId(d.events, id).rsvp[me.id] = answer
    if (answer === 'no') notify(d, me, [e.createdBy], `can’t make “${e.title}” (${fmtDay(e.date)})`, '#/calendar')
  })
}

/* ---------- chat ---------- */

export function openDm(me, otherId) {
  const id = dmId(me.id, otherId)
  if (!byId(db.channels, id)) commit((d) => d.channels.push({ id, type: 'dm', memberIds: [me.id, otherId] }))
  return id
}

export function sendMessage(me, channelId, text) {
  const ch = byId(db.channels, channelId)
  must(can(me, 'channel.post', ch), 'post here')
  text = text.trim()
  if (!text) return
  commit((d) => {
    const at = nowIso()
    d.messages.push({ id: uid(), channelId, userId: me.id, text, at })
    d.reads[me.id] = { ...d.reads[me.id], [channelId]: at }
    const link = `#/chat/${channelId}`
    const short = text.length > 90 ? `${text.slice(0, 90)}…` : text
    if (ch.type === 'dm') return notify(d, me, ch.memberIds, `messaged you: ${short}`, link)
    const where = channelName(d, ch, me)
    notify(d, me, mentions(d, text).filter((id) => can(byId(d.users, id), 'channel.view', ch)), `mentioned you in #${where}: ${short}`, link)
    // a client writing in their project channel should never go unseen
    if (ch.type === 'project' && me.role === 'client') notify(d, me, [byId(d.projects, ch.projectId)?.managerId, ...admins(d)], `wrote in #${where}: ${short}`, link)
    if (ch.readOnly) notify(d, me, staff(d).map((u) => u.id), `posted an announcement: ${short}`, link)
  })
}

export function markRead(me, channelId) {
  const ch = byId(db.channels, channelId)
  if (!ch || !unread(db, me, ch)) return
  commit((d) => (d.reads[me.id] = { ...d.reads[me.id], [channelId]: nowIso() }))
}

/* ---------- content plan ---------- */

export function savePost(me, p) {
  must(can(me, 'content.manage'), 'plan content')
  need(p.title?.trim(), 'Give the post a working title or hook.')
  need(p.clientId && p.date, 'Pick the client and the day it goes out.')
  commit((d) => {
    const old = p.id && byId(d.posts, p.id)
    if (old) Object.assign(old, p)
    else d.posts.push({ status: 'idea', caption: '', notes: [], ...p, id: uid() })
    const link = '#/content'
    if (p.assigneeId && (!old || old.assigneeId !== p.assigneeId)) notify(d, me, [p.assigneeId], `gave you the ${p.format} “${p.title}” (${fmtDay(p.date)})`, link)
    if (p.status === 'ready' && old?.status !== 'ready') notify(d, me, clientUsers(d, p.clientId).map((u) => u.id), `has a ${p.format} ready for your approval: “${p.title}”`, link)
    log(d, me, `${old ? 'updated' : 'planned'} the ${p.format} “${p.title}” for ${byId(d.clients, p.clientId)?.name}`, link)
  })
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
}

export function deletePost(me, id) {
  must(can(me, 'content.manage'), 'delete posts')
  commit((d) => (d.posts = d.posts.filter((x) => x.id !== id)))
}

/* ---------- notifications ---------- */

export function readNotifications(me, ids) {
  const mine = db.notifications.filter((n) => n.userId === me.id && !n.read && (!ids || ids.includes(n.id)))
  if (!mine.length) return
  commit((d) => d.notifications.forEach((n) => n.userId === me.id && (!ids || ids.includes(n.id)) && (n.read = true)))
}
