// npm test   (no browser: the store falls back to a fresh in-memory seed)
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as S from './store.js'
import { addDays, today } from './util.js'

const u = (id) => S.byId(S.getDb().users, id)
const unreadFor = (id) => S.getDb().notifications.filter((n) => n.userId === id && !n.read)
beforeEach(() => S.resetDemo())

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
