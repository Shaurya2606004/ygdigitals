// npm test   (no server: the store runs on a fresh copy of the sample studio)
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { seed } from './seed.js'
import * as S from './store.js'
import { addDays, today } from './util.js'
import { postsFromSheet, toDay } from './xlsx.js'

const u = (id) => S.byId(S.getDb().users, id)
const unreadFor = (id) => S.getDb().notifications.filter((n) => n.userId === id && !n.read)
beforeEach(() => S.setData(seed()))

test('clients only ever see their own projects, plan, sent work and channels', () => {
  const rahul = u('rahul')
  const d = S.getDb()
  const projects = d.projects.filter((p) => S.can(rahul, 'project.view', p))
  assert.ok(projects.length > 0 && projects.every((p) => p.clientId === 'desi'))
  const plan = d.tasks.filter((t) => S.can(rahul, 'task.view', t))
  assert.ok(plan.length > 0 && plan.every((t) => S.byId(d.projects, t.projectId).clientId === 'desi'))
  assert.ok(!d.deliverables.filter((x) => S.can(rahul, 'deliverable.view', x)).some((x) => !x.sent))
  const chans = d.channels.filter((c) => S.can(rahul, 'channel.view', c))
  assert.ok(chans.every((c) => c.type === 'project' && S.byId(d.projects, c.projectId).clientId === 'desi'))
  assert.equal(S.can(rahul, 'task.edit'), false)
  assert.throws(() => S.saveTask(rahul, { projectId: 'p-diwali', title: 'x' }), /permission/)
})

test('handoff gives the task to a person, restarts it and tells them', () => {
  S.handoff(u('vikas'), 't3', 'ritika', 'Footage is on the drive')
  const t = S.byId(S.getDb().tasks, 't3')
  assert.equal(t.assigneeId, 'ritika')
  assert.equal(t.status, 'todo')
  assert.equal(t.comments.at(-1).handoff, 'Vikas → Ritika')
  assert.ok(unreadFor('ritika').some((n) => n.text.startsWith('handed you') && n.text.includes('Footage')))
  assert.throws(() => S.handoff(u('vikas'), 't3', 'ritika'), /Pick who/) // already theirs
})

test('work goes maker → admin check → client decision', () => {
  S.submitDeliverable(u('vikas'), { projectId: 'p-diwali', title: 'Reel 1 v1', type: 'Video', link: 'https://drive.google.com/x' })
  const x = S.getDb().deliverables.at(-1)
  assert.equal(x.status, 'internal')
  assert.ok(unreadFor('aman').some((n) => n.text.includes('for a check')))
  assert.throws(() => S.decideDeliverable(u('rahul'), x.id, true), /not waiting for the client/)
  assert.throws(() => S.reviewDeliverable(u('priya'), x.id, true), /permission/) // only the admin checks
  S.reviewDeliverable(u('aman'), x.id, true)
  assert.ok(unreadFor('rahul').some((n) => n.text.includes('for your approval')))
  assert.throws(() => S.decideDeliverable(u('sunita'), x.id, true), /permission/) // another client
  S.decideDeliverable(u('rahul'), x.id, false, 'Shorter intro')
  assert.equal(S.byId(S.getDb().deliverables, x.id).status, 'changes')
  S.submitDeliverable(u('vikas'), { id: x.id, link: 'https://drive.google.com/y' })
  assert.equal(S.byId(S.getDb().deliverables, x.id).version, 2)
})

test('calendar: weekday repeats skip weekends; clashes are flagged', () => {
  const T = today()
  const occ = S.occurrences(S.getDb(), addDays(T, -7), addDays(T, 7)).filter((o) => o.id === 'e1')
  assert.ok(occ.length >= 9 && occ.every((o) => ![0, 6].includes(new Date(`${o.date}T00:00`).getDay())))
  const clash = S.conflicts(S.getDb(), { date: addDays(T, 2), start: '10:00', end: '11:00', attendeeIds: ['vikas'] })
  assert.ok(clash.some((c) => c.userId === 'vikas' && c.what.startsWith('Shoot day')))
  assert.deepEqual(S.conflicts(S.getDb(), { date: addDays(T, 2), start: '20:00', end: '21:00', attendeeIds: ['vikas'] }), [])
})

test('role guard rails', () => {
  assert.throws(() => S.savePerson(u('priya'), { name: 'X', email: 'x@y.in', role: 'member' }), /permission/)
  assert.throws(() => S.savePerson(u('aman'), { ...u('aman'), role: 'member' }), /own role/)
  assert.throws(() => S.saveProject(u('priya'), { name: 'New', clientId: 'desi', memberIds: [] }), /permission/)
  assert.ok(S.can(u('priya'), 'project.edit', S.byId(S.getDb().projects, 'p-diwali'))) // she leads it
  assert.equal(S.can(u('vikas'), 'project.edit', S.byId(S.getDb().projects, 'p-diwali')), false)
  assert.equal(S.can(u('priya'), 'channel.post', S.byId(S.getDb().channels, 'ch-announce')), false)
})

test('group chats: team only, members run them, the admin reads them unseen', () => {
  const [priya, vikas, ritika, aman, rahul] = ['priya', 'vikas', 'ritika', 'aman', 'rahul'].map(u)
  assert.throws(() => S.saveGroup(rahul, { name: 'Clients', memberIds: ['priya'] }), /permission/)
  assert.throws(() => S.saveGroup(priya, { name: 'Solo', memberIds: ['rahul'] }), /at least one other/) // clients are dropped
  const id = S.saveGroup(priya, { name: 'Shoot crew', memberIds: ['vikas', 'rahul'] })
  const g = () => S.byId(S.getDb().channels, id)
  assert.deepEqual(g().memberIds, ['priya', 'vikas'])
  assert.ok(unreadFor('vikas').some((n) => n.text === 'added you to the group “Shoot crew”'))
  assert.equal(S.can(ritika, 'channel.view', g()), false)
  assert.equal(S.can(rahul, 'channel.view', g()), false)
  assert.equal(S.can(aman, 'channel.view', g()), true) // admin reads every group…
  assert.equal(S.can(aman, 'channel.post', g()), false) // …but can't post in one they aren't in
  assert.throws(() => S.saveGroup(ritika, { id, name: 'Mine' }), /permission/)

  S.sendMessage(priya, id, 'Call time 7am @Aman @Vikas')
  assert.equal(unreadFor('aman').filter((n) => n.text.includes('Shoot crew')).length, 0) // not in it, never pinged
  assert.ok(unreadFor('vikas').some((n) => n.text.startsWith('mentioned you in #Shoot crew')))
  assert.equal(S.unread(S.getDb(), vikas, g()), 1) // the "created the group" line doesn't count
  assert.equal(S.unread(S.getDb(), aman, g()), 0) // nothing nags the admin about groups they aren't in

  const msg = S.getDb().messages.findLast((m) => m.channelId === id)
  assert.deepEqual(S.seenBy(S.getDb(), g(), msg), [])
  S.markRead(aman, id) // the admin reading never shows as "Seen"
  S.markRead(vikas, id)
  assert.deepEqual(S.seenBy(S.getDb(), g(), msg).map((x) => x.id), ['vikas'])

  S.saveGroup(priya, { id, name: 'Shoot crew 2', memberIds: ['ritika'] })
  const lines = S.getDb().messages.filter((m) => m.channelId === id && m.system).map((m) => m.text)
  assert.deepEqual(lines, ['created the group', 'renamed the group to “Shoot crew 2”', 'added Ritika', 'removed Vikas'])
  assert.equal(S.can(vikas, 'channel.view', g()), false)
  S.leaveGroup(ritika, id)
  assert.deepEqual(g().memberIds, ['priya'])
})

test('messages: edit and delete your own; the admin can remove anyone’s; one message has a size limit', () => {
  const [priya, vikas, aman] = ['priya', 'vikas', 'aman'].map(u)
  S.sendMessage(priya, 'ch-general', 'Shoot is at 7')
  const id = S.getDb().messages.at(-1).id
  const m = () => S.byId(S.getDb().messages, id)
  assert.throws(() => S.editMessage(vikas, id, 'hacked'), /permission/)
  assert.throws(() => S.deleteMessage(vikas, id), /permission/)
  S.editMessage(priya, id, 'Shoot is at 8')
  assert.equal(m().text, 'Shoot is at 8')
  assert.ok(m().editedAt)
  assert.throws(() => S.editMessage(priya, id, '  '), /empty/)
  S.deleteMessage(aman, id)
  assert.equal(m().deleted, true)
  assert.equal(m().text, '')
  assert.throws(() => S.editMessage(priya, id, 'back'), /permission/)
  assert.throws(() => S.sendMessage(priya, 'ch-general', 'x'.repeat(S.MAX_MESSAGE + 1)), /too long/)
})

test('freelancers see and touch only the projects they’re on, and tasks handed to them', () => {
  S.byId(S.getDb().users, 'ritika').role = 'freelancer' // on Diwali, GV monthly, Glow and Desi packaging (lead); not Steel website
  const [saif, aman] = ['ritika', 'aman'].map(u)
  const d = S.getDb()
  const p = (id) => S.byId(d.projects, id)
  assert.equal(S.can(saif, 'project.view', p('p-diwali')), true)
  assert.equal(S.can(saif, 'project.view', p('p-steel-web')), false)
  const steelTask = d.tasks.find((t) => t.projectId === 'p-steel-web' && t.status !== 'done')
  assert.equal(S.can(saif, 'task.view', steelTask), false)
  assert.throws(() => S.saveTask(saif, { projectId: 'p-steel-web', title: 'Sneaky', assigneeId: 'ritika' }), /permission/)
  assert.throws(() => S.submitDeliverable(saif, { projectId: 'p-steel-web', title: 'x', link: 'https://x.co' }), /permission/)
  S.saveTask(saif, { projectId: 'p-desi-pack', title: 'Dieline v2' })
  S.handoff(aman, steelTask.id, 'ritika', 'Need the packaging-style icons') // handed to them: now theirs to see and work on
  assert.equal(S.can(saif, 'task.view', S.byId(S.getDb().tasks, steelTask.id)), true)
  S.commentTask(saif, steelTask.id, 'On it')
  assert.equal(S.can(saif, 'project.view', p('p-steel-web')), false) // …but not the rest of that project

  const ch = (id) => S.byId(S.getDb().channels, id)
  assert.equal(S.can(saif, 'channel.view', ch('ch-general')), false)
  assert.equal(S.can(saif, 'channel.view', ch('ch-announce')), false)
  assert.equal(S.can(saif, 'channel.view', ch('ch-p-diwali')), true)
  assert.equal(S.can(saif, 'channel.view', ch('ch-p-steel-web')), false)
  assert.equal(S.can(saif, 'content.manage'), false)
  assert.equal(S.can(saif, 'content.view', d.posts[0]), false)
  assert.equal(S.can(saif, 'event.view', S.byId(d.events, 'e1')), true) // invited
  assert.ok(d.events.some((e) => !e.attendeeIds.includes('ritika') && !S.can(saif, 'event.view', e)))
  S.sendMessage(aman, 'ch-announce', 'Office closed Friday')
  assert.equal(unreadFor('ritika').filter((n) => n.text.includes('announcement')).length, 0) // can't read it, isn't pinged
})

test('departments: a member sees their department’s work, their own and what they lead — nothing else', () => {
  const [vikas, priya, aman, arjun] = ['vikas', 'priya', 'aman', 'arjun'].map(u)
  const d = S.getDb()
  const t = (id) => S.byId(d.tasks, id)
  const seen = (who) => S.getDb().tasks.filter((x) => S.can(who, 'task.view', x)).length
  assert.equal(seen(vikas), 8) // video work + the Sector 7 project he leads (same as the server check)
  assert.equal(seen(priya), 16)
  assert.equal(seen(aman), d.tasks.length)
  assert.equal(S.can(vikas, 'task.view', t('t5')), false) // Ritika's design task
  assert.throws(() => S.handoff(vikas, 't5', 'vikas'), /permission/)
  assert.throws(() => S.saveTask(vikas, { projectId: 'p-glow-mkt', title: 'Sneaky' }), /permission/) // a project he isn't in
  const asked = S.saveTask(vikas, { projectId: 'p-diwali', title: 'End card for Reel 1', dept: 'design', assigneeId: 'ritika' })
  assert.equal(S.can(vikas, 'task.view', S.byId(S.getDb().tasks, asked)), true) // he made it, so he follows it
  assert.deepEqual(d.posts.filter((p) => S.can(vikas, 'content.view', p)).map((p) => p.id).sort(), ['s1', 's11', 's4', 's5', 's8'])
  assert.equal(d.posts.filter((p) => S.can(priya, 'content.view', p)).length, d.posts.length) // social media sees every post
  assert.deepEqual(d.deliverables.filter((x) => S.can(vikas, 'deliverable.view', x)).map((x) => x.id), ['d2'])
  assert.equal(S.can(vikas, 'activity.view'), false)
  assert.equal(S.can(vikas, 'channel.view', S.byId(d.channels, 'ch-p-glow-mkt')), false)
  arjun.dept = 'all' // the office sees the whole studio
  assert.equal(seen(arjun), S.getDb().tasks.length)
  assert.equal(S.can(arjun, 'activity.view'), true)
})

test('deleting a client takes their projects, tasks, posts, chats and logins; meetings stay unlinked', () => {
  const aman = u('aman')
  assert.throws(() => S.deleteClient(u('priya'), 'glow', 'Glow Herbals'), /permission/)
  assert.throws(() => S.deleteClient(aman, 'glow', 'Glow'), /exactly/)
  S.deleteClient(aman, 'glow', ' glow herbals ')
  const d = S.getDb()
  assert.equal(S.byId(d.clients, 'glow'), undefined)
  assert.equal(d.projects.some((p) => p.clientId === 'glow'), false)
  assert.equal(d.tasks.some((t) => t.projectId === 'p-glow-mkt'), false)
  assert.equal(d.posts.some((p) => p.clientId === 'glow'), false)
  assert.equal(S.byId(d.channels, 'ch-p-glow-mkt'), undefined)
  assert.equal(S.byId(d.users, 'ishita'), undefined)
  assert.equal(S.byId(d.events, 'e10').projectId, '')
})

test('overdue: only a supervisor, the project lead or whoever gave the task moves its date', () => {
  const [vikas, priya, aman] = ['vikas', 'priya', 'aman'].map(u)
  const t = () => S.byId(S.getDb().tasks, 't4') // Vikas's edit, given by Priya (who leads the project)
  const T = today()
  assert.equal(S.setsDue(vikas, t()), false)
  assert.throws(() => S.saveTask(vikas, { ...t(), due: addDays(T, 9) }), /Tell them if you need more time/)
  S.saveTask(vikas, { ...t(), status: 'doing' }) // the rest of it is still his to change
  S.saveTask(priya, { ...t(), due: addDays(T, 10) }) // the lead can
  assert.equal(t().due, addDays(T, 10))
  assert.ok(unreadFor('vikas').some((n) => n.text.startsWith('moved “Edit Reel 1')))
  S.saveTask(aman, { ...t(), due: addDays(T, 11) }) // and so can a supervisor
  assert.equal(t().due, addDays(T, 11))
})

test('owner: a supervisor with the owner flag, picked from the role list like any role', () => {
  const aman = u('aman')
  assert.equal(S.level(aman), 'owner')
  assert.ok(S.can(aman, 'org.manage') && S.can(aman, 'deliverable.review', {}))
  S.savePerson(aman, { ...u('vikas'), role: 'owner' })
  assert.deepEqual([u('vikas').role, u('vikas').owner, S.level(u('vikas'))], ['admin', true, 'owner'])
  assert.ok(unreadFor('vikas').some((n) => n.text === 'changed your role to Owner'))
  S.savePerson(aman, { ...u('vikas'), role: 'member' })
  assert.deepEqual([u('vikas').role, u('vikas').owner], ['member', false])
  assert.throws(() => S.savePerson(aman, { ...aman, role: 'admin' }), /own role/) // owner → supervisor is a change too
})

test('repeating tasks: finishing one makes the next (weekly, or monthly kept to the month’s end)', () => {
  const priya = u('priya')
  const id = S.saveTask(priya, { projectId: 'p-gv-month', title: 'Monthly report', repeat: 'monthly', due: '2026-01-31', checklist: [{ id: 'c1', text: 'Numbers', done: true }] })
  S.moveTask(priya, id, 'done')
  const next = S.getDb().tasks.at(-1)
  assert.deepEqual([next.title, next.due, next.status, next.repeat, next.checklist[0].done], ['Monthly report', '2026-02-28', 'todo', 'monthly', false])
  assert.equal(S.byId(S.getDb().tasks, id).repeat, 'none')
  S.moveTask(priya, id, 'todo')
  S.moveTask(priya, id, 'done')
  assert.equal(S.getDb().tasks.filter((x) => x.title === 'Monthly report').length, 2) // no duplicate
  assert.throws(() => S.saveTask(priya, { projectId: 'p-gv-month', title: 'x', repeat: 'weekly' }), /needs a due date/)
})

test('marks: due, due today, overdue, done, done late; delivered and undelivered posts', () => {
  const T = today()
  assert.equal(S.taskMark({ status: 'todo', due: addDays(T, -1) }), 'overdue')
  assert.equal(S.taskMark({ status: 'doing', due: T }), 'today')
  assert.equal(S.taskMark({ status: 'todo', due: addDays(T, 3) }), 'due')
  assert.equal(S.taskMark({ status: 'done', due: addDays(T, -3), completedAt: addDays(T, -1) }), 'late')
  assert.equal(S.taskMark({ status: 'done', due: T, completedAt: T }), 'done')
  assert.equal(S.postMark({ status: 'posted', date: addDays(T, -1) }), 'delivered')
  assert.equal(S.postMark({ status: 'missed', date: addDays(T, -1) }), 'undelivered')
  assert.equal(S.postMark({ status: 'scheduled', date: addDays(T, -1) }), 'overdue')
})

test('leave: short notice needs that work done first; the admin is warned about work due while away', () => {
  const [vikas, priya, aman, ritika] = ['vikas', 'priya', 'aman', 'ritika'].map(u)
  const T = today()
  assert.throws(() => S.applyLeave(vikas, { start: T }), /Edit walkthrough Reel/) // due today, not done
  assert.throws(() => S.applyLeave(vikas, { start: addDays(T, 1) }), /Villa 12 walkthrough/) // a post due tomorrow counts too
  const id = S.applyLeave(vikas, { start: addDays(T, 3), end: addDays(T, 4), note: 'Sister’s wedding' })
  assert.throws(() => S.applyLeave(vikas, { start: addDays(T, 4) }), /already have leave/)
  assert.ok(unreadFor('aman').some((n) => n.text.startsWith('asked for leave')))
  const l = () => S.byId(S.getDb().leaves, id)
  assert.equal(S.can(priya, 'leave.view', l()), false) // a pending request isn't the team's business
  assert.throws(() => S.decideLeave(priya, id, true), /permission/)
  assert.throws(() => S.decideLeave(aman, id, true), /due while they’re away/)
  S.decideLeave(aman, id, true, 'Enjoy', true)
  assert.equal(l().status, 'approved')
  assert.equal(S.can(priya, 'leave.view', l()), true)
  assert.equal(S.isAway(S.getDb(), 'vikas', addDays(T, 3)), true)
  assert.equal(S.canCancelLeave(ritika, l()), false)
  S.cancelLeave(vikas, id)
  assert.equal(l(), undefined)
})

test('compensation: the team notes what’s owed; only a supervisor tells the client; whoever’s on it marks it given', () => {
  const [priya, vikas, ritika, aman, rahul] = ['priya', 'vikas', 'ritika', 'aman', 'rahul'].map(u)
  S.savePost(priya, { ...S.byId(S.getDb().posts, 's4'), status: 'missed' })
  assert.equal(S.postMark(S.byId(S.getDb().posts, 's4')), 'undelivered')
  const base = { clientId: 'desi', postId: 's4', missed: 'Reel — Ghar ki Mithaas', offer: '1 extra Reel', ownerId: 'vikas' }
  assert.throws(() => S.saveCompensation(priya, { ...base, shared: true }), /Only a supervisor/)
  assert.throws(() => S.saveCompensation(rahul, base), /permission/)
  const id = S.saveCompensation(priya, base)
  const k = () => S.byId(S.getDb().compensations, id)
  assert.ok(unreadFor('vikas').some((n) => n.text.startsWith('gave you the compensation for Desi Crunch')))
  assert.equal(S.can(ritika, 'comp.view', k()), false)
  assert.equal(S.can(rahul, 'comp.view', k()), false)
  S.saveCompensation(aman, { ...k(), shared: true })
  assert.equal(S.can(rahul, 'comp.view', k()), true)
  assert.ok(unreadFor('rahul').some((n) => n.text.startsWith('will make up for')))
  S.giveCompensation(vikas, id)
  assert.equal(k().status, 'given')
  assert.throws(() => S.deleteCompensation(priya, id), /permission/)
})

test('content calendar import: the header row finds the columns; days with nothing planned and notes are left out', () => {
  const rows = [
    ['Zoe’s | Content Calendar | Oct'],
    [],
    ['Date', 'Day', 'Festival', 'Content Type', 'Topic', 'Basic Script / Reference', 'Status'],
    [46300, 'Monday', '-', 'Single Post', 'Location post', 'https://instagram.com/p/x', 'Planned'],
    [46301, 'Tuesday', '-'], // no post that day
    [46306, 'Sunday', 'Navratri · Day 1', 'Reel', 'Rock paper scissors', '', 'Posted'],
    ['12/10/2026', '', '', 'Carousel', '', '', 'Ready for approval'], // a text date, day first; no topic → the type
    ['Deliverables check'],
    ['Single Posts', '', '', 10],
  ]
  assert.deepEqual(postsFromSheet(rows), [
    { date: '2026-10-05', format: 'Post', title: 'Location post', brief: 'https://instagram.com/p/x', status: 'idea' },
    { date: '2026-10-11', format: 'Reel', title: 'Rock paper scissors', brief: 'Festival: Navratri · Day 1', status: 'posted' },
    { date: '2026-10-12', format: 'Carousel', title: 'Carousel', brief: '', status: 'ready' },
  ])
  assert.equal(toDay('5 Oct 2026'), '2026-10-05')
  assert.equal(toDay('31/02/2026'), '') // no such day
  assert.throws(() => postsFromSheet([['Topic', 'Type']]), /Date/)
})

test('content plan ↔ tasks: an import makes the project first; this week’s posts land in its To do; each moves the other', () => {
  const [aman, vikas, priya, rahul] = ['aman', 'vikas', 'priya', 'rahul'].map(u)
  const posts = [
    { date: addDays(today(), 3), format: 'Reel', title: 'Navratri wishes', brief: 'Festival: Navratri', status: 'idea', dept: 'video', assigneeId: 'vikas', platform: 'Instagram' },
    { date: addDays(today(), 20), format: 'Post', title: 'Later post', brief: '', status: 'idea', dept: 'design', assigneeId: 'ritika', platform: 'Instagram' },
  ]
  const project = { name: 'Desi — Content', clientId: 'desi', status: 'active', start: posts[0].date, due: posts[1].date, managerId: 'priya', memberIds: ['vikas', 'ritika'] }
  assert.throws(() => S.importPlan(priya, project, posts), /create projects/)
  const pid = S.importPlan(aman, project, posts)
  const [a, b] = S.getDb().posts.filter((p) => p.projectId === pid).map((p) => p.id)
  const post = (id) => S.byId(S.getDb().posts, id)
  const task = (id) => S.getDb().tasks.find((t) => t.postId === id)
  const k = task(a)
  assert.deepEqual([k.projectId, k.title, k.due, k.status, k.assigneeId, k.desc], [pid, 'Reel: Navratri wishes', addDays(today(), 3), 'todo', 'vikas', 'Festival: Navratri'])
  assert.equal(task(b), undefined) // three weeks away: not yet
  assert.equal(unreadFor('vikas').filter((n) => n.text.startsWith('gave you “Reel: Navratri wishes” — it goes out')).length, 1)
  assert.ok(!unreadFor('vikas').some((n) => n.text.startsWith('gave you the Reel'))) // told once, when it's in their To do

  S.moveTask(vikas, k.id, 'doing')
  assert.deepEqual([post(a).status, task(a).statusBy], ['production', 'vikas'])
  S.moveTask(vikas, k.id, 'done')
  // made: the lead is asked to check it and send it; the client hears nothing yet, and whoever gave the task isn't told twice
  assert.equal(post(a).status, 'made')
  assert.ok(unreadFor('priya').some((n) => n.text === 'made the Reel “Navratri wishes” for Desi Crunch Snacks — check it and send it to the client' && n.link === `#/content/post/${a}`))
  assert.ok(!unreadFor('rahul').some((n) => n.text.startsWith('has a Reel')))
  assert.ok(!unreadFor('aman').some((n) => n.text.startsWith('finished')))
  assert.throws(() => S.sendPost(vikas, a), /permission/) // the maker doesn't send it
  assert.throws(() => S.savePost(vikas, { ...post(a), status: 'ready' }), /project lead or a supervisor/)
  assert.throws(() => S.sendPost(priya, a, { link: 'drive.google.com/x' }), /https/)
  S.sendPost(priya, a, { link: 'https://drive.google.com/navratri', email: true })
  assert.deepEqual([post(a).status, post(a).link, post(a).notes.at(-1).text], ['ready', 'https://drive.google.com/navratri', 'Sent to the client'])
  assert.ok(unreadFor('rahul').some((n) => n.text === 'has a Reel ready for your approval: “Navratri wishes”' && n.link === `#/content/post/${a}`))
  assert.throws(() => S.sendPost(priya, a), /already gone/)
  S.decidePost(rahul, a, false, 'Brighter, please')
  assert.deepEqual([post(a).status, task(a).status], ['production', 'todo'])
  S.moveTask(vikas, k.id, 'done')
  S.moveTask(vikas, k.id, 'doing') // reopened before it went out: back in production
  assert.equal(post(a).status, 'production')
  S.savePost(priya, { ...post(a), status: 'posted' })
  assert.deepEqual([task(a).status, task(a).statusBy], ['done', 'priya'])

  S.savePost(priya, { ...post(b), date: addDays(today(), 6), title: 'Diwali post' })
  assert.deepEqual([task(b).due, task(b).title], [addDays(today(), 6), 'Post: Diwali post'])
  assert.throws(() => S.savePost(priya, { ...post(b), projectId: 'p-gv-month' }), /this client’s projects/)
  S.deletePost(priya, b)
  assert.equal(task(b), undefined)
})

test('video and design finish, social media uploads: a task at once, gone if reopened; uploading marks the post out', () => {
  const [aman, vikas, priya, arjun] = ['aman', 'vikas', 'priya', 'arjun'].map(u)
  const task = (id) => S.byId(S.getDb().tasks, id)
  const up = S.uploadTaskId('t4')
  S.moveTask(vikas, 't4', 'done')
  assert.deepEqual([task(up).title, task(up).dept, task(up).assigneeId, task(up).status, task(up).due, task(up).projectId, task(up).uploadOf],
    ['Upload: Edit Reel 1 — Ghar ki Mithaas (30s)', 'social', 'priya', 'todo', today(), 'p-diwali', 't4'])
  assert.ok(unreadFor('priya').some((n) => n.text === 'finished “Edit Reel 1 — Ghar ki Mithaas (30s)” — upload it' && n.link === `#/tasks/${up}`))
  assert.ok(S.can(priya, 'task.edit', task(up)))
  S.moveTask(vikas, 't4', 'doing') // reopened before it was uploaded: nothing to upload yet
  assert.equal(task(up), undefined)
  S.moveTask(vikas, 't4', 'done')
  assert.equal(S.getDb().tasks.filter((t) => t.uploadOf === 't4').length, 1)
  // social media work has no check
  assert.throws(() => S.moveTask(priya, up, 'review'), /don’t need a check/)
  S.moveTask(priya, up, 'done')
  S.moveTask(vikas, 't4', 'doing') // an upload already done stays
  assert.equal(task(up).status, 'done')
  S.moveTask(arjun, 't8', 'done') // websites: nothing to upload
  assert.equal(task(S.uploadTaskId('t8')), undefined)

  // a post's task: the upload is due the day it goes out, and uploading it marks the post Posted
  const post = (id) => S.byId(S.getDb().posts, id)
  const plan = (title) => S.savePost(aman, { clientId: 'desi', projectId: 'p-diwali', date: addDays(today(), 3), format: 'Reel', platform: 'Instagram', title, assigneeId: 'vikas' })
  const a = plan('Hamper reveal')
  S.moveTask(vikas, S.postTaskId(a), 'done')
  const upA = S.uploadTaskId(S.postTaskId(a))
  assert.deepEqual([post(a).status, task(upA).due, task(upA).title], ['made', addDays(today(), 3), 'Upload: Reel: Hamper reveal'])
  S.decidePost(priya, a, false, 'Brighter') // sent back for changes: the maker's task reopens, so the upload goes
  assert.equal(task(upA), undefined)
  S.moveTask(vikas, S.postTaskId(a), 'done')
  S.moveTask(priya, upA, 'done')
  assert.equal(post(a).status, 'posted')
  // a post marked Posted in the content plan closes its upload
  const b = plan('Sweets close-up')
  S.moveTask(vikas, S.postTaskId(b), 'done')
  S.savePost(priya, { ...post(b), status: 'posted' })
  assert.equal(task(S.uploadTaskId(S.postTaskId(b))).status, 'done')
  // deleting the post takes its task and that task's upload
  S.deletePost(aman, b)
  assert.equal(task(S.uploadTaskId(S.postTaskId(b))), undefined)
})

test('checked work: sent back with a note, or approved and straight to its uploader; finished work isn’t handed over', () => {
  const [aman, vikas] = ['aman', 'vikas'].map(u)
  const task = (id) => S.byId(S.getDb().tasks, id)
  S.moveTask(vikas, 't4', 'review')
  assert.throws(() => S.sendBack(aman, 't4', ' '), /what to change/)
  S.sendBack(aman, 't4', 'Brighter thumbnail')
  assert.deepEqual([task('t4').status, task('t4').comments.at(-1).text], ['doing', 'Brighter thumbnail'])
  assert.ok(unreadFor('vikas').some((n) => n.text === 'commented on “Edit Reel 1 — Ghar ki Mithaas (30s)”: Brighter thumbnail'))
  S.moveTask(vikas, 't4', 'review')
  S.moveTask(aman, 't4', 'done') // approved: the upload is the Social media person's at once
  assert.equal(task(S.uploadTaskId('t4')).assigneeId, 'priya')
  assert.throws(() => S.handoff(aman, 't4', 'priya'), /finished/)
  S.moveTask(aman, 't4', 'doing')
  S.byId(S.getDb().users, 'arjun').dept = 'social' // two people in Social media: the upload waits for the team
  S.moveTask(aman, 't4', 'done')
  assert.equal(task(S.uploadTaskId('t4')).assigneeId, null)
})

test('work pushed past the day its post goes out moves the post; earlier never does; its upload follows the post', () => {
  const [aman, vikas] = ['aman', 'vikas'].map(u)
  const task = (id) => S.byId(S.getDb().tasks, id)
  const post = (id) => S.byId(S.getDb().posts, id)
  const a = S.savePost(aman, { clientId: 'desi', projectId: 'p-diwali', date: addDays(today(), 3), format: 'Reel', platform: 'Instagram', title: 'Hamper reveal', assigneeId: 'vikas' })
  const k = S.postTaskId(a)
  S.saveTask(aman, { ...task(k), due: addDays(today(), 5) })
  assert.deepEqual([task(k).due, post(a).date], [addDays(today(), 5), addDays(today(), 5)])
  S.saveTask(aman, { ...task(k), due: today() })
  assert.deepEqual([task(k).due, post(a).date], [today(), addDays(today(), 5)])
  S.moveTask(vikas, k, 'done')
  assert.equal(task(S.uploadTaskId(k)).due, addDays(today(), 5))
  S.savePost(aman, { ...post(a), date: addDays(today(), 6) })
  assert.deepEqual([task(k).due, task(S.uploadTaskId(k)).due], [addDays(today(), 6), addDays(today(), 6)])
  // the upload put off past the day: the post goes out that day too, and the work's own date follows the post
  S.saveTask(aman, { ...task(S.uploadTaskId(k)), due: addDays(today(), 8) })
  assert.deepEqual([post(a).date, task(S.uploadTaskId(k)).due, task(k).due], [addDays(today(), 8), addDays(today(), 8), addDays(today(), 8)])
  // marked Posted and moved in one save: the upload it closes keeps its day (as on the server)
  S.savePost(aman, { ...post(a), date: addDays(today(), 9), status: 'posted' })
  assert.deepEqual([task(S.uploadTaskId(k)).status, task(S.uploadTaskId(k)).due], ['done', addDays(today(), 8)])
})

test('deleting a project: a supervisor, typing its name; its tasks, work and chat go; its posts stay, unlinked', () => {
  const [aman, priya] = ['aman', 'priya'].map(u)
  const d = () => S.getDb()
  const s = S.savePost(aman, { clientId: 'desi', projectId: 'p-diwali', date: addDays(today(), 3), format: 'Reel', platform: 'Instagram', title: 'Hamper reveal', assigneeId: 'vikas' })
  assert.ok(S.byId(d().tasks, S.postTaskId(s)))
  const event = d().events.find((e) => e.projectId === 'p-diwali')
  assert.throws(() => S.deleteProject(priya, 'p-diwali', 'Diwali Festive Campaign'), /permission/) // the lead can't
  assert.throws(() => S.deleteProject(aman, 'p-diwali', 'Diwali'), /name exactly/)
  S.deleteProject(aman, 'p-diwali', ' diwali festive campaign ')
  assert.equal(S.byId(d().projects, 'p-diwali'), undefined)
  assert.deepEqual([d().tasks, d().deliverables, d().channels].map((l) => l.filter((x) => x.projectId === 'p-diwali').length), [0, 0, 0])
  assert.equal(d().messages.filter((m) => m.channelId === 'ch-p-diwali').length, 0)
  assert.deepEqual([S.byId(d().posts, s).projectId, S.byId(d().posts, s).taskMade], [null, false])
  assert.equal(S.byId(d().events, event.id).projectId, null)
  S.savePost(aman, { ...S.byId(d().posts, s), projectId: 'p-desi-pack' }) // into another project: a fresh task there
  assert.equal(S.byId(d().tasks, S.postTaskId(s)).projectId, 'p-desi-pack')
})

test('free days: what else of the same project falls on a day, each post counted once', () => {
  const [aman, ritika] = ['aman', 'ritika'].map(u)
  const task = (id) => S.byId(S.getDb().tasks, id)
  const plan = (date, format, title, assigneeId) => S.savePost(aman, { clientId: 'desi', projectId: 'p-diwali', date: addDays(today(), date), format, platform: 'Instagram', title, assigneeId })
  const a = S.postTaskId(plan(3, 'Reel', 'Hamper reveal', 'vikas'))
  const b = S.postTaskId(plan(3, 'Post', 'Gift guide', 'ritika'))
  plan(10, 'Carousel', 'Thank you') // too far off for a task yet
  const busy = (k, n) => S.busyOn(S.getDb(), task(k), addDays(today(), n))
  assert.deepEqual(busy(a, 3), ['Post: Gift guide']) // not itself, nor another project's work due that day
  assert.deepEqual(busy(a, 2), ['Shoot day: family Reels + product macros at the Sonipat unit'])
  assert.deepEqual(busy(a, 9), [])
  assert.deepEqual(busy(a, 10), ['Carousel: Thank you'])
  S.moveTask(ritika, b, 'done') // made: its upload is what's left of it that day
  assert.deepEqual(busy(a, 3), ['Upload: Post: Gift guide'])
  assert.deepEqual(busy(S.uploadTaskId(b), 3), ['Reel: Hamper reveal'])
})
