// npm run test:live — the real Supabase project from this machine, as real people: sign-in, what each role
// loads, an action, and its live update reaching someone else. Needs .env.local with the sample accounts
// (scripts/seed-sql.mjs). Safe to run any time: it only re-ticks an already-ticked checklist item.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, test } from 'node:test'
import { createClient } from '@supabase/supabase-js'

const env = (() => {
  try {
    return Object.fromEntries(
      readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^\w+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    )
  } catch {
    return {}
  }
})()
const skip = !env.VITE_SUPABASE_URL || !env.DEMO_PASSWORD ? 'needs .env.local with DEMO_PASSWORD' : false
const clients = []
const ms = (t0) => Math.round(performance.now() - t0)

async function as(who) {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  clients.push(sb)
  const t0 = performance.now()
  const { data, error } = await sb.auth.signInWithPassword({ email: `${who}@example.com`, password: env.DEMO_PASSWORD })
  assert.ifError(error)
  return { sb, id: data.user.id, signInMs: ms(t0) }
}
async function bootstrap(sb) {
  const t0 = performance.now()
  const { data, error } = await sb.rpc('bootstrap')
  assert.ifError(error)
  return { b: data, loadMs: ms(t0) }
}

after(() => Promise.all(clients.map((sb) => (sb.removeAllChannels(), sb.auth.signOut({ scope: 'local' })))))

test('each role loads only what it may see, fast', { skip }, async () => {
  const [aman, rahul] = await Promise.all([as('aman'), as('rahul')])
  const staff = await bootstrap(aman.sb)
  const client = await bootstrap(rahul.sb)
  const warm = await bootstrap(aman.sb) // connection already open, like every load after the first
  console.log(`  sign-in ${aman.signInMs} ms · team load ${staff.loadMs} ms (then ${warm.loadMs} ms warm) · client load ${client.loadMs} ms`)
  assert.equal(staff.b.tasks.length, staff.b.task_private.length)
  assert.ok(staff.b.projects.length >= 7)
  assert.ok(client.b.projects.every((p) => p.client_id === 'desi'))
  assert.equal(client.b.task_private.length, 0, 'clients never get task comments or checklists')
  assert.equal(client.b.client_private.length, 0, 'clients never get the studio’s notes')
  assert.equal(client.b.activity.length, 0)
  assert.ok(client.b.deliverables.every((x) => x.sent))
  assert.ok(staff.loadMs < 1500 && client.loadMs < 1500, 'a full load stays well under a second and a half')
})

test('an action saves and reaches someone else live', { skip }, async () => {
  const [priya, vikas] = await Promise.all([as('priya'), as('vikas')])
  const seen = new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('no live update within 5 s')), 5000)
    vikas.sb
      .channel('t')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_private' }, (e) => e.new.task_id === 't1' && resolve(performance.now()))
      .on('system', {}, (m) => m.extension === 'postgres_changes' && m.status === 'ok' && go()) // feed is really on
      .subscribe()
  })
  let t0
  async function go() {
    t0 = performance.now()
    const { error } = await priya.sb.rpc('check_item', { p: { id: 't1', itemId: 't1c2', done: true } })
    assert.ifError(error)
    console.log(`  action saved in ${ms(t0)} ms`)
  }
  const at = await seen
  console.log(`  …and showed up on Vikas's screen ${Math.round(at - t0)} ms after the click`)
})

test('the server refuses what a role may not do', { skip }, async () => {
  const rahul = await as('rahul')
  const { error } = await rahul.sb.rpc('save_task', { p: { projectId: 'p-diwali', title: 'nope' } })
  assert.match(error.message, /permission/)
  const direct = await rahul.sb.from('tasks').insert({ project_id: 'p-diwali', title: 'nope' })
  assert.ok(direct.error, 'tables can’t be written directly')
  const people = await rahul.sb.functions.invoke('people', { body: { action: 'save', person: { name: 'X', email: 'x@example.com', role: 'member', password: '12345678' } } })
  assert.equal(people.error?.context?.status, 403, 'only the admin manages logins')
})
