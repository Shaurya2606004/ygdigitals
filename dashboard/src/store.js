// YG Hub data + rules. Demo mode: the whole organisation lives in this browser (localStorage) and syncs live
// across tabs, so two people can be signed in side by side. Going live = swap read/persist/commit for Supabase
// calls; can() maps 1:1 onto row-level-security policies.
import { seed } from './seed.js'
import { addDays, clockNow, fmtDay, fmtTime, nowIso, overlaps, today, uid, weekday } from './util.js'

const KEY = 'yg-hub-v1'
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
  admin: { label: 'Admin', blurb: 'Founder / director. Full control: people, roles, teams, clients, billing and settings.' },
  manager: { label: 'Manager', blurb: 'Runs operations and client servicing: clients, projects, invoices and every team.' },
  lead: { label: 'Team lead', blurb: "Runs one team: assigns and reviews its work, sends it to clients, approves the team's leave." },
  member: { label: 'Member', blurb: 'Does the work: their tasks, time, files for review, chat and leave requests.' },
  client: { label: 'Client', blurb: 'A brand YG works for: sees only its own projects, approves work, chats with its team, sees its invoices.' },
}
export const TASK_STATUS = { todo: 'To do', doing: 'In progress', review: 'Review', done: 'Done' }
export const PRIORITY = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
export const PROJECT_STATUS = { planning: 'Planning', active: 'In progress', review: 'Client review', hold: 'On hold', done: 'Delivered' }
export const DELIV_STATUS = { internal: 'Internal review', changes: 'Changes requested', client: 'Awaiting client', approved: 'Approved' }
export const DELIV_TYPES = ['Video', 'Design', 'Website', 'Copy', 'Listing', 'Photos', 'Other']
export const EVENT_TYPES = { meeting: 'Team meeting', client: 'Client call', shoot: 'Shoot', review: 'Creative review' }
export const REPEAT = { none: 'Does not repeat', weekdays: 'Every weekday', weekly: 'Every week' }
export const POST_STATUS = { idea: 'Idea', production: 'In production', ready: 'Ready for approval', scheduled: 'Scheduled', posted: 'Posted' }
export const PLATFORMS = ['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'Google']
export const FORMATS = ['Reel', 'Post', 'Carousel', 'Story', 'Ad', 'Short']
export const LEAVE_TYPES = { casual: 'Casual leave', sick: 'Sick leave', earned: 'Earned leave', wfh: 'Work from home' }
export const INVOICE_STATUS = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue' }
export const COLORS = ['#e04c5c', '#d97706', '#2563eb', '#0d9488', '#7c3aed', '#16a34a', '#db2777', '#475569', '#0891b2', '#ca8a04']

// what each role can do, in words (Settings › Roles). Keep in step with can() below.
export const PERMISSIONS = [
  ['See every project, task and team calendar', ['admin', 'manager', 'lead', 'member']],
  ['Create tasks and hand work to another team', ['admin', 'manager', 'lead', 'member']],
  ['Update tasks they own or are assigned', ['admin', 'manager', 'lead', 'member']],
  ['Assign and edit any task in their own team', ['admin', 'manager', 'lead']],
  ['Assign tasks in any team', ['admin', 'manager']],
  ['Create projects', ['admin', 'manager', 'lead']],
  ['Sign off work and send it to the client', ['admin', 'manager', 'lead']],
  ['Approve leave (leads: their own team)', ['admin', 'manager', 'lead']],
  ['See reports and timesheets', ['admin', 'manager', 'lead']],
  ['Add clients and give them logins', ['admin', 'manager']],
  ['Create and send invoices (also the Management team)', ['admin', 'manager']],
  ['Post announcements', ['admin', 'manager']],
  ['Add people, change roles and teams', ['admin', 'manager']],
  ['Make someone an admin, edit teams and company details', ['admin']],
  ['See their own projects, approve work and posts, see their invoices', ['client']],
  ['Book meetings and chat with their project team', ['admin', 'manager', 'lead', 'member', 'client']],
]

/* ---------- lookups ---------- */

export const byId = (list, id) => list.find((x) => x.id === id)
export const userName = (d, id) => byId(d.users, id)?.name ?? 'Someone'
export const firstName = (u) => u.name.split(' ')[0]
export const isStaff = (u) => u.role !== 'client'
export const staff = (d) => d.users.filter((u) => u.active && isStaff(u))
export const leadsOf = (d, teamIds) => d.users.filter((u) => u.active && u.role === 'lead' && teamIds.includes(u.teamId)).map((u) => u.id)
const bosses = (d) => d.users.filter((u) => u.active && (u.role === 'admin' || u.role === 'manager')).map((u) => u.id)
export const clientUsers = (d, clientId) => d.users.filter((u) => u.active && u.role === 'client' && u.clientId === clientId)
export const mentions = (d, text) => d.users.filter((u) => u.active && new RegExp(`@${firstName(u)}\\b`, 'i').test(text)).map((u) => u.id)
export const projectTasks = (d, pid) => d.tasks.filter((t) => t.projectId === pid)
export function progress(d, pid) {
  const ts = projectTasks(d, pid)
  return ts.length ? Math.round((ts.filter((t) => t.status === 'done').length / ts.length) * 100) : 0
}
export const isOverdue = (t) => t.status !== 'done' && t.due && t.due < today()

export function channelName(d, ch, me) {
  if (ch.type === 'team') return byId(d.teams, ch.teamId)?.name ?? 'team'
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

export const onLeave = (d, userId, day) => d.leaves.find((l) => l.userId === userId && l.status === 'approved' && l.from <= day && day <= l.to)

// who is double-booked or away if this event goes ahead. ponytail: a repeating event is only checked on its first day
export function conflicts(d, e) {
  const out = []
  for (const o of occurrences(d, e.date, e.date)) {
    if (o.id === e.id || !overlaps(e.start, e.end, o.start, o.end)) continue
    for (const id of e.attendeeIds) if (o.attendeeIds.includes(id) && o.rsvp?.[id] !== 'no') out.push({ userId: id, what: `${o.title} (${fmtTime(o.start)}–${fmtTime(o.end)})` })
  }
  for (const id of e.attendeeIds) {
    const l = onLeave(d, id, e.date)
    if (l && l.type !== 'wfh') out.push({ userId: id, what: LEAVE_TYPES[l.type] })
  }
  return out
}

// 'leave' | 'wfh' | 'meeting' | 'available', worked out from leave and the calendar
export function presence(d, u) {
  const day = today()
  const l = onLeave(d, u.id, day)
  if (l) return l.type === 'wfh' ? 'wfh' : 'leave'
  const now = clockNow()
  const busy = occurrences(d, day, day).some((o) => o.attendeeIds.includes(u.id) && o.rsvp?.[u.id] !== 'no' && o.start <= now && now < o.end)
  return busy ? 'meeting' : 'available'
}

/* ---------- invoices ---------- */

export function invoiceTotals(inv) {
  const sub = inv.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0)
  const gst = Math.round((sub * (Number(inv.gst) || 0)) / 100)
  return { sub, gst, total: sub + gst }
}
export const invoiceState = (inv) => (inv.status === 'sent' && inv.due < today() ? 'overdue' : inv.status)
// Indian financial year numbering: YG/26-27/044
export function nextInvoiceNo(d) {
  const t = new Date()
  const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1
  const n = Math.max(0, ...d.invoices.map((i) => Number(i.no.split('/').pop()) || 0)) + 1
  return `YG/${String(y).slice(2)}-${String(y + 1).slice(2)}/${String(n).padStart(3, '0')}`
}

/* ---------- permissions ---------- */

export function can(u, action, x = {}) {
  if (!u?.active) return false
  const boss = u.role === 'admin' || u.role === 'manager'
  const isStaffer = u.role !== 'client'
  const leads = (teamId) => u.role === 'lead' && u.teamId === teamId
  const proj = (id) => byId(db.projects, id) || { teamIds: [] }
  switch (action) {
    case 'org.settings':
      return u.role === 'admin'
    case 'people.manage':
      return u.role === 'admin' || (u.role === 'manager' && x.role !== 'admin')
    case 'clients.manage':
      return boss
    case 'invoices.manage':
      return boss || u.teamId === 'mgmt'
    case 'invoice.view':
      return can(u, 'invoices.manage') || (u.clientId === x.clientId && x.status !== 'draft')
    case 'reports.view':
      return boss || u.role === 'lead'
    case 'announce':
      return boss
    case 'project.view':
      return isStaffer || x.clientId === u.clientId
    case 'project.create':
      return boss || u.role === 'lead'
    case 'project.edit':
      return boss || x.managerId === u.id || (u.role === 'lead' && x.teamIds.includes(u.teamId))
    case 'task.create':
      return isStaffer
    case 'task.edit':
      return boss || leads(x.teamId) || (isStaffer && (x.assigneeId === u.id || x.createdBy === u.id))
    case 'task.assign':
      return boss || leads(x.teamId)
    case 'task.delete':
      return boss || leads(x.teamId) || (isStaffer && x.createdBy === u.id)
    case 'deliverable.submit':
      return isStaffer
    case 'deliverable.view':
      return isStaffer || (x.sent && proj(x.projectId).clientId === u.clientId)
    case 'deliverable.review': {
      const p = proj(x.projectId)
      return boss || p.managerId === u.id || (u.role === 'lead' && p.teamIds.includes(u.teamId))
    }
    case 'deliverable.decide':
      return boss || (u.role === 'client' && proj(x.projectId).clientId === u.clientId)
    case 'event.view':
      return isStaffer || x.attendeeIds.includes(u.id)
    case 'event.edit':
      return boss || x.createdBy === u.id
    case 'leave.request':
      return isStaffer
    case 'leave.decide': {
      const who = byId(db.users, x.userId)
      return !!who && who.id !== u.id && (boss || leads(who.teamId))
    }
    case 'content.manage':
      return boss || (isStaffer && u.teamId === 'social')
    case 'content.view':
      return isStaffer || x.clientId === u.clientId
    case 'content.decide':
      return can(u, 'content.manage') || (u.role === 'client' && x.clientId === u.clientId)
    case 'channel.view':
      if (x.type === 'dm') return x.memberIds.includes(u.id)
      if (x.type === 'project') return isStaffer || (x.clientVisible && proj(x.projectId).clientId === u.clientId)
      if (x.type === 'team') return boss || u.teamId === x.teamId
      return isStaffer
    case 'channel.post':
      return can(u, 'channel.view', x) && (!x.readOnly || boss)
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

/* ---------- people, teams, clients, company ---------- */

export function savePerson(me, p) {
  const old = p.id && byId(db.users, p.id)
  must(me.role === 'admin' || p.role !== 'admin', 'make someone an admin')
  must(can(me, 'people.manage', old || p), old ? `edit ${old.name}` : 'add people')
  const email = (p.email || '').trim().toLowerCase()
  need(p.name?.trim(), 'Add their name.')
  need(/^\S+@\S+\.\S+$/.test(email), 'Add a valid email — it is their login.')
  need(!db.users.some((u) => u.email === email && u.id !== p.id), 'Someone already uses that email.')
  need(p.role !== 'client' || p.clientId, 'Pick which client this login belongs to.')
  need(p.role === 'client' || p.teamId, 'Pick their team.')
  need(!old || old.id !== me.id || p.role === old.role, 'You cannot change your own role.')
  return commit((d) => {
    const clean = { ...p, email, name: p.name.trim(), teamId: p.role === 'client' ? null : p.teamId, clientId: p.role === 'client' ? p.clientId : null }
    if (old) {
      Object.assign(byId(d.users, p.id), clean)
      if (old.role !== clean.role) notify(d, me, [old.id], `changed your role to ${ROLES[clean.role].label}`, '#/settings')
      log(d, me, `updated ${clean.name}'s profile`, `#/people/${p.id}`)
      return p.id
    }
    const id = uid()
    d.users.push({ title: '', phone: '', about: '', skills: [], joined: today(), color: COLORS[d.users.length % COLORS.length], ...clean, id, active: true })
    notify(d, me, [id], 'added you to YG Hub — welcome!', '#/')
    const where = clean.role === 'client' ? `as a client login for ${byId(d.clients, clean.clientId)?.name}` : `to ${byId(d.teams, clean.teamId)?.name} as ${ROLES[clean.role].label}`
    log(d, me, `added ${clean.name} ${where}`, clean.role === 'client' ? `#/clients/${clean.clientId}` : `#/people/${id}`)
    return id
  })
}

export function setActive(me, id, active) {
  const u = byId(db.users, id)
  must(can(me, 'people.manage', u), `change ${u.name}'s access`)
  need(id !== me.id, 'You cannot deactivate yourself.')
  commit((d) => {
    byId(d.users, id).active = active
    log(d, me, `${active ? 'reactivated' : 'deactivated'} ${u.name}'s login`, `#/people/${id}`)
  })
}

export function updateProfile(me, f) {
  need(f.name?.trim(), 'Your name cannot be empty.')
  commit((d) => Object.assign(byId(d.users, me.id), { name: f.name.trim(), phone: f.phone, title: f.title, about: f.about, skills: f.skills }))
}

export function saveTeam(me, t) {
  must(can(me, 'org.settings'), 'edit teams')
  need(t.name?.trim(), 'Give the team a name.')
  commit((d) => {
    const old = t.id && byId(d.teams, t.id)
    if (old) Object.assign(old, t)
    else {
      const id = uid()
      d.teams.push({ ...t, id })
      d.channels.push({ id: `ch-${id}`, type: 'team', teamId: id })
    }
    log(d, me, `${old ? 'updated' : 'created'} the ${t.name} team`, '#/people/teams')
  })
}

export function saveOrg(me, org) {
  must(can(me, 'org.settings'), 'edit company details')
  commit((d) => Object.assign(d.org, org))
}

export function saveClient(me, c) {
  must(can(me, 'clients.manage'), 'manage clients')
  need(c.name?.trim(), 'Add the client’s business name.')
  return commit((d) => {
    const old = c.id && byId(d.clients, c.id)
    if (old) Object.assign(old, c)
    else d.clients.push({ since: today(), notes: '', ...c, id: uid() })
    const id = old ? old.id : d.clients.at(-1).id
    log(d, me, `${old ? 'updated' : 'added the client'} ${c.name}`, `#/clients/${id}`)
    return id
  })
}

/* ---------- projects ---------- */

export function saveProject(me, p) {
  const old = p.id && byId(db.projects, p.id)
  must(old ? can(me, 'project.edit', old) : can(me, 'project.create'), old ? 'edit this project' : 'create projects')
  need(p.name?.trim(), 'Give the project a name.')
  need(p.clientId, 'Pick the client.')
  need(p.teamIds?.length, 'Pick at least one team.')
  need(!p.start || !p.due || p.start <= p.due, 'The due date is before the start date.')
  return commit((d) => {
    const link = (id) => `#/projects/${id}`
    if (old) {
      const t = byId(d.projects, p.id)
      const added = p.memberIds.filter((id) => !t.memberIds.includes(id))
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
    d.projects.push({ status: 'planning', memberIds: [], brief: '', budget: 0, priority: 'normal', ...p, id, createdAt: today() })
    d.channels.push({ id: `ch-${id}`, type: 'project', projectId: id, clientVisible: true })
    notify(d, me, [...p.memberIds, ...leadsOf(d, p.teamIds), p.managerId], `added you to the new project “${p.name}”`, link(id))
    log(d, me, `started the project “${p.name}” for ${byId(d.clients, p.clientId)?.name}`, link(id))
    return id
  })
}

/* ---------- tasks ---------- */

export function saveTask(me, t) {
  const old = t.id && byId(db.tasks, t.id)
  must(old ? can(me, 'task.edit', old) : can(me, 'task.create'), old ? 'edit this task' : 'create tasks')
  need(t.title?.trim(), 'Give the task a title.')
  need(t.projectId, 'Pick the project.')
  need(t.teamId, 'Pick the team doing it.')
  const reassigned = !old || old.assigneeId !== t.assigneeId || old.teamId !== t.teamId
  if (reassigned && t.assigneeId && t.assigneeId !== me.id) must(can(me, 'task.assign', t), `assign work to people in ${byId(db.teams, t.teamId)?.name} — leave it unassigned and their lead will pick it up`)
  return commit((d) => {
    let task
    if (old) Object.assign((task = byId(d.tasks, t.id)), t, { title: t.title.trim() })
    else d.tasks.push((task = { status: 'todo', priority: 'normal', desc: '', checklist: [], comments: [], time: [], ...t, title: t.title.trim(), id: uid(), createdBy: me.id, createdAt: nowIso() }))
    if (task.status === 'done') task.completedAt ||= today()
    else task.completedAt = null
    const link = `#/tasks/${task.id}`
    const q = `“${task.title}”`
    if (reassigned && task.assigneeId) notify(d, me, [task.assigneeId], `assigned you ${q}`, link)
    if (reassigned && !task.assigneeId) notify(d, me, leadsOf(d, [task.teamId]), `added ${q} to ${byId(d.teams, task.teamId)?.name}'s queue — needs an owner`, link)
    if (old && old.status !== task.status) {
      if (task.status === 'review') notify(d, me, [...leadsOf(d, [task.teamId]), byId(d.projects, task.projectId)?.managerId], `${q} is ready for review`, link)
      if (task.status === 'done') notify(d, me, [task.createdBy], `finished ${q}`, link)
      log(d, me, `moved ${q} to ${TASK_STATUS[task.status]}`, link)
    } else log(d, me, old ? `updated ${q}` : `created ${q}`, link)
    return task.id
  })
}

export const moveTask = (me, id, status) => saveTask(me, { ...byId(db.tasks, id), status })

// cross-team handover: the task moves to the other team's queue (or straight to a person if you may assign there)
export function handoff(me, id, teamId, assigneeId, note) {
  const t = byId(db.tasks, id)
  must(can(me, 'task.edit', t), 'hand off this task')
  if (assigneeId && assigneeId !== me.id) must(can(me, 'task.assign', { ...t, teamId }), 'pick a person in that team')
  commit((d) => {
    const task = byId(d.tasks, id)
    const from = byId(d.teams, task.teamId)?.name
    const to = byId(d.teams, teamId)?.name
    Object.assign(task, { teamId, assigneeId: assigneeId || null, status: 'todo', completedAt: null })
    task.comments.push({ id: uid(), userId: me.id, at: nowIso(), text: note || '', handoff: `${from} → ${to}` })
    const link = `#/tasks/${id}`
    notify(d, me, assigneeId ? [assigneeId] : leadsOf(d, [teamId]), `handed “${task.title}” to ${to}${note ? `: ${note}` : ''}`, link)
    log(d, me, `handed “${task.title}” from ${from} to ${to}`, link)
  })
}

// anyone in the team can pick up an unassigned task from its queue
export function claimTask(me, id) {
  const t = byId(db.tasks, id)
  need(!t.assigneeId && me.teamId === t.teamId, 'Only unassigned tasks in your own team can be picked up.')
  commit((d) => {
    byId(d.tasks, id).assigneeId = me.id
    notify(d, me, leadsOf(d, [t.teamId]), `picked up “${t.title}”`, `#/tasks/${id}`)
    log(d, me, `picked up “${t.title}”`, `#/tasks/${id}`)
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
  const t = byId(db.tasks, id)
  must(can(me, 'task.edit', t), 'tick this checklist')
  commit((d) => {
    const item = byId(byId(d.tasks, id).checklist, itemId)
    item.done = !item.done
  })
}

export function logTime(me, taskId, hours, date, note) {
  must(isStaff(me), 'log time')
  hours = Number(hours)
  need(hours > 0 && hours <= 16, 'Hours must be between 0 and 16.')
  need(date && date <= today(), 'Pick a day that is not in the future.')
  commit((d) => byId(d.tasks, taskId).time.push({ id: uid(), userId: me.id, hours, date, note: note || '' }))
}

export function deleteTask(me, id) {
  const t = byId(db.tasks, id)
  must(can(me, 'task.delete', t), 'delete this task')
  commit((d) => {
    d.tasks = d.tasks.filter((x) => x.id !== id)
    log(d, me, `deleted the task “${t.title}”`)
  })
}

/* ---------- deliverables: maker → lead sign-off → client approval ---------- */

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
      x = { id: uid(), projectId, title: title.trim(), type, link, version: 1, status: 'internal', sent: false, submittedBy: me.id, history: [{ userId: me.id, at, action: 'submitted v1 for review', note }] }
      d.deliverables.push(x)
    }
    const p = byId(d.projects, x.projectId)
    const url = `#/projects/${p.id}/deliverables`
    notify(d, me, [p.managerId, ...leadsOf(d, p.teamIds)], `submitted “${x.title}” v${x.version} for review`, url)
    log(d, me, `submitted “${x.title}” v${x.version} for review`, url)
  })
}

export function reviewDeliverable(me, id, approve, note) {
  const x = byId(db.deliverables, id)
  must(can(me, 'deliverable.review', x), 'sign off this work')
  need(x.status === 'internal', 'This is not waiting for an internal review.')
  need(approve || note?.trim(), 'Say what needs to change.')
  commit((d) => {
    const t = byId(d.deliverables, id)
    const p = byId(d.projects, t.projectId)
    const url = `#/projects/${p.id}/deliverables`
    if (approve) {
      Object.assign(t, { status: 'client', sent: true })
      t.history.push({ userId: me.id, at: nowIso(), action: `sent v${t.version} to the client`, note })
      notify(d, me, clientUsers(d, p.clientId).map((u) => u.id), `sent “${t.title}” v${t.version} for your approval`, url)
      notify(d, me, [t.submittedBy], `signed off your “${t.title}” and sent it to the client`, url)
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
    notify(d, me, [t.submittedBy, p.managerId, ...leadsOf(d, p.teamIds)], approve ? `approved “${t.title}” v${t.version}` : `requested changes on “${t.title}”: ${note}`, url)
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
    if (ch.type === 'project' && me.role === 'client') notify(d, me, [byId(d.projects, ch.projectId)?.managerId], `wrote in #${where}: ${short}`, link)
    if (ch.readOnly) notify(d, me, staff(d).map((u) => u.id), `posted an announcement: ${short}`, link)
  })
}

export function markRead(me, channelId) {
  const ch = byId(db.channels, channelId)
  if (!ch || !unread(db, me, ch)) return
  commit((d) => (d.reads[me.id] = { ...d.reads[me.id], [channelId]: nowIso() }))
}

/* ---------- leave ---------- */

export function requestLeave(me, l) {
  must(can(me, 'leave.request'), 'request leave')
  need(l.from && l.to && l.from <= l.to, 'Pick a start and end date (end on or after start).')
  commit((d) => {
    d.leaves.push({ ...l, id: uid(), userId: me.id, status: 'pending', at: nowIso() })
    const approvers = [...(me.role === 'lead' ? [] : leadsOf(d, [me.teamId])), ...bosses(d)]
    notify(d, me, approvers, `requested ${LEAVE_TYPES[l.type].toLowerCase()}: ${fmtDay(l.from)}${l.to !== l.from ? ` – ${fmtDay(l.to)}` : ''}`, '#/people/leave')
    log(d, me, `requested ${LEAVE_TYPES[l.type].toLowerCase()}`, '#/people/leave')
  })
}

export function decideLeave(me, id, approve) {
  const l = byId(db.leaves, id)
  must(can(me, 'leave.decide', l), 'decide this leave request')
  commit((d) => {
    Object.assign(byId(d.leaves, id), { status: approve ? 'approved' : 'declined', decidedBy: me.id })
    notify(d, me, [l.userId], `${approve ? 'approved' : 'declined'} your ${LEAVE_TYPES[l.type].toLowerCase()} (${fmtDay(l.from)})`, '#/people/leave')
    log(d, me, `${approve ? 'approved' : 'declined'} ${userName(d, l.userId)}'s leave`, '#/people/leave')
  })
}

export function cancelLeave(me, id) {
  const l = byId(db.leaves, id)
  need(l.userId === me.id && l.status === 'pending', 'Only your own pending requests can be withdrawn.')
  commit((d) => (d.leaves = d.leaves.filter((x) => x.id !== id)))
}

/* ---------- content calendar ---------- */

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
    notify(d, me, [t.assigneeId, ...leadsOf(d, ['social'])], approve ? `approved the ${t.format} “${t.title}”` : `asked for changes on “${t.title}”: ${note}`, '#/content')
    log(d, me, approve ? `approved the ${t.format} “${t.title}”` : `asked for changes on “${t.title}”`, '#/content')
  })
}

export function deletePost(me, id) {
  must(can(me, 'content.manage'), 'delete posts')
  commit((d) => (d.posts = d.posts.filter((x) => x.id !== id)))
}

/* ---------- invoices ---------- */

export function saveInvoice(me, inv) {
  must(can(me, 'invoices.manage'), 'manage invoices')
  need(inv.clientId, 'Pick the client.')
  need(inv.items.length && inv.items.every((i) => i.desc.trim() && Number(i.qty) > 0 && Number(i.rate) >= 0), 'Every line needs a description, a quantity and a rate.')
  need(inv.date && inv.due && inv.date <= inv.due, 'The due date must be on or after the invoice date.')
  return commit((d) => {
    const old = inv.id && byId(d.invoices, inv.id)
    if (old) Object.assign(old, inv)
    else d.invoices.push({ status: 'draft', notes: '', ...inv, id: uid(), no: nextInvoiceNo(d) })
    const saved = old || d.invoices.at(-1)
    log(d, me, `${old ? 'updated' : 'drafted'} invoice ${saved.no}`, `#/invoices/${saved.id}`)
    return saved.id
  })
}

export function setInvoiceStatus(me, id, status) {
  must(can(me, 'invoices.manage'), 'change invoices')
  commit((d) => {
    const inv = byId(d.invoices, id)
    inv.status = status
    if (status === 'paid') inv.paidOn = today()
    const link = `#/invoices/${id}`
    const amount = invoiceTotals(inv).total.toLocaleString('en-IN')
    if (status === 'sent') notify(d, me, clientUsers(d, inv.clientId).map((u) => u.id), `sent invoice ${inv.no} for ₹${amount}, due ${fmtDay(inv.due)}`, link)
    log(d, me, `marked invoice ${inv.no} (₹${amount}) ${INVOICE_STATUS[status].toLowerCase()}`, link)
  })
}

/* ---------- notifications ---------- */

export function readNotifications(me, ids) {
  const mine = db.notifications.filter((n) => n.userId === me.id && !n.read && (!ids || ids.includes(n.id)))
  if (!mine.length) return
  commit((d) => d.notifications.forEach((n) => n.userId === me.id && (!ids || ids.includes(n.id)) && (n.read = true)))
}
