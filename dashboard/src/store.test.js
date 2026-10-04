// npm test   (no server: the store runs on a fresh copy of the sample studio)
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { seed } from './seed.js'
import * as S from './store.js'
import { addDays, today } from './util.js'

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
  const [saif, priya, aman] = ['ritika', 'priya', 'aman'].map(u)
  const d = S.getDb()
  const p = (id) => S.byId(d.projects, id)
  assert.equal(S.can(saif, 'project.view', p('p-diwali')), true)
  assert.equal(S.can(saif, 'project.view', p('p-steel-web')), false)
  const steelTask = d.tasks.find((t) => t.projectId === 'p-steel-web')
  assert.equal(S.can(saif, 'task.view', steelTask), false)
  assert.throws(() => S.saveTask(saif, { projectId: 'p-steel-web', title: 'Sneaky', assigneeId: 'ritika' }), /permission/)
  assert.throws(() => S.submitDeliverable(saif, { projectId: 'p-steel-web', title: 'x', link: 'https://x.co' }), /permission/)
  S.saveTask(saif, { projectId: 'p-desi-pack', title: 'Dieline v2' })
  S.handoff(priya, steelTask.id, 'ritika', 'Need the packaging-style icons') // handed to them: now theirs to see and work on
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
