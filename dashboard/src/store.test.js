// npm test   (no browser: the store falls back to a fresh in-memory seed)
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as S from './store.js'
import { addDays, today } from './util.js'

const u = (id) => S.byId(S.getDb().users, id)
const unreadFor = (id) => S.getDb().notifications.filter((n) => n.userId === id && !n.read)
beforeEach(() => S.resetDemo())

test('clients only ever see their own projects, sent work and their own channels', () => {
  const rahul = u('rahul')
  const d = S.getDb()
  const projects = d.projects.filter((p) => S.can(rahul, 'project.view', p))
  assert.ok(projects.length > 0 && projects.every((p) => p.clientId === 'desi'))
  assert.ok(!d.deliverables.filter((x) => S.can(rahul, 'deliverable.view', x)).some((x) => !x.sent))
  const chans = d.channels.filter((c) => S.can(rahul, 'channel.view', c))
  assert.ok(chans.every((c) => c.type === 'project' && S.byId(d.projects, c.projectId).clientId === 'desi'))
  assert.equal(S.can(rahul, 'task.create'), false)
  assert.equal(S.can(rahul, 'invoice.view', S.byId(d.invoices, 'i6')), false) // a draft for someone else
})

test('members assign only themselves; leads assign inside their team; nobody else’s queue', () => {
  const base = { projectId: 'p-diwali', title: 'Cut a 15s teaser', teamId: 'edit' }
  assert.throws(() => S.saveTask(u('simran'), { ...base, assigneeId: 'muskan' }), /permission/)
  assert.ok(S.saveTask(u('simran'), { ...base, assigneeId: null })) // unassigned into Editing's queue is fine
  assert.ok(unreadFor('ankit').some((n) => n.text.includes('needs an owner')))
  assert.ok(S.saveTask(u('ankit'), { ...base, assigneeId: 'muskan' }))
  assert.throws(() => S.saveTask(u('priya'), { ...base, assigneeId: 'muskan' }), /permission/)
})

test('handoff moves a task to another team’s queue and pings that lead', () => {
  S.handoff(u('vikas'), 't3', 'edit', null, 'Footage is on the drive')
  const t = S.byId(S.getDb().tasks, 't3')
  assert.equal(t.teamId, 'edit')
  assert.equal(t.assigneeId, null)
  assert.equal(t.status, 'todo')
  assert.equal(t.comments.at(-1).handoff, 'Production → Video Editing')
  assert.ok(unreadFor('ankit').some((n) => n.text.includes('handed')))
})

test('deliverable: maker → lead sign-off → client decision', () => {
  S.submitDeliverable(u('muskan'), { projectId: 'p-diwali', title: 'Reel 1 v1', type: 'Video', link: 'https://drive.google.com/x' })
  const x = S.getDb().deliverables.at(-1)
  assert.equal(x.status, 'internal')
  assert.throws(() => S.decideDeliverable(u('rahul'), x.id, true), /not waiting for the client/)
  assert.throws(() => S.reviewDeliverable(u('muskan'), x.id, true), /permission/)
  S.reviewDeliverable(u('ankit'), x.id, true)
  assert.ok(unreadFor('rahul').some((n) => n.text.includes('for your approval')))
  assert.throws(() => S.decideDeliverable(u('sunita'), x.id, true), /permission/) // another client
  S.decideDeliverable(u('rahul'), x.id, false, 'Shorter intro')
  assert.equal(S.byId(S.getDb().deliverables, x.id).status, 'changes')
  S.submitDeliverable(u('muskan'), { id: x.id, link: 'https://drive.google.com/y' })
  assert.equal(S.byId(S.getDb().deliverables, x.id).version, 2)
})

test('calendar: weekday repeats skip weekends; clashes and leave are flagged', () => {
  const T = today()
  const occ = S.occurrences(S.getDb(), addDays(T, -7), addDays(T, 7)).filter((o) => o.id === 'e1')
  assert.ok(occ.length >= 9 && occ.every((o) => ![0, 6].includes(new Date(`${o.date}T00:00`).getDay())))
  const clash = S.conflicts(S.getDb(), { date: addDays(T, 2), start: '10:00', end: '11:00', attendeeIds: ['sahil'] })
  assert.ok(clash.some((c) => c.userId === 'sahil' && c.what.startsWith('Shoot day')))
  const away = S.conflicts(S.getDb(), { date: addDays(T, 9), start: '20:00', end: '21:00', attendeeIds: ['muskan'] })
  assert.deepEqual(away.map((c) => c.what), ['Casual leave'])
})

test('role guard rails', () => {
  assert.throws(() => S.savePerson(u('neha'), { name: 'X', email: 'x@y.in', role: 'admin', teamId: 'mgmt' }), /admin/)
  assert.throws(() => S.savePerson(u('aman'), { ...u('aman'), role: 'member' }), /own role/)
  assert.equal(S.can(u('priya'), 'leave.decide', S.byId(S.getDb().leaves, 'l2')), false) // Sahil is not in her team
  assert.equal(S.can(u('vikas'), 'leave.decide', S.byId(S.getDb().leaves, 'l2')), true)
  assert.equal(S.can(u('rohit'), 'invoices.manage'), true) // accounts sits in Management
  assert.equal(S.can(u('karan'), 'reports.view'), false)
})

test('invoice totals and numbering', () => {
  const t = S.invoiceTotals({ items: [{ qty: 2, rate: 1000 }, { qty: 1, rate: 500 }], gst: 18 })
  assert.deepEqual(t, { sub: 2500, gst: 450, total: 2950 })
  assert.match(S.nextInvoiceNo(S.getDb()), /^YG\/\d\d-\d\d\/044$/)
})

test('rupees in words, Indian numbering', async () => {
  const { inWords } = await import('./util.js')
  assert.equal(inWords(110330), 'one lakh ten thousand three hundred thirty')
  assert.equal(inWords(12500000), 'one crore twenty-five lakh')
  assert.equal(inWords(999), 'nine hundred ninety-nine')
  assert.equal(inWords(0), 'zero')
})
