// The morning email: one per person, only when something needs them — overdue work, what's due today, and (for
// supervisors) checks and leave waiting on them. Owners get just what's late and what's due. Called by the morning
// job (private.daily in *_daily.sql, through pg_net); claim_daily_mail() lets it send at most once a day.
// Called with {outbox: true}, it sends the emails the database queued instead (private.mail in *_made_to_send.sql:
// work made and waiting to be sent, work sent to a client).
// ponytail: no caller secret — the once-a-day claim caps any misuse at sending that day's email early, and the outbox
// only holds what the database queued. Add a shared secret (vault + function secret) if that ever matters.
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const HUB = Deno.env.get('HUB_URL') ?? 'https://team.ygdigitals.com'
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// days are 'YYYY-MM-DD' in India, like private.today()
const ist = (ms = Date.now()) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 10)
const day = (s: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${s}T00:00Z`))
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`

type Line = { text: string; link: string }

async function send(to: string, subject: string, intro: string, sections: [string, Line[]][]) {
  const blocks = sections.filter(([, l]) => l.length)
  const text = [intro, ...blocks.map(([h, l]) => `${h}\n${l.map((x) => `• ${x.text} — ${HUB}/${x.link}`).join('\n')}`), `Open YG Hub: ${HUB}`].join('\n\n')
  const html = `<div style="font:15px/1.6 system-ui,sans-serif;color:#111;max-width:560px">
<p>${esc(intro)}</p>
${blocks.map(([h, l]) => `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#666;margin:18px 0 6px">${esc(h)}</h3>
<ul style="padding-left:18px;margin:0">${l.map((x) => `<li><a href="${HUB}/${x.link}" style="color:#c2334a">${esc(x.text)}</a></li>`).join('')}</ul>`).join('')}
<p style="margin-top:22px"><a href="${HUB}" style="color:#c2334a">Open YG Hub</a></p></div>`
  return resend({ to, subject, text, html })
}

const resend = async (msg: Record<string, string>) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') ?? 'YG Hub <hub@ygdigitals.com>', ...msg }),
  })
  return res.ok
}

type Queued = { email: string; reply_to: string; subject: string; intro: string; work: string; link: string }

// one email the database queued: a line, the work's link, and where it is in the hub
async function sendQueued(m: Queued) {
  const text = [m.intro, m.work && `See the work: ${m.work}`, m.link && `Open it in YG Hub: ${HUB}/${m.link}`].filter(Boolean).join('\n\n')
  const html = `<div style="font:15px/1.6 system-ui,sans-serif;color:#111;max-width:560px">
<p>${esc(m.intro)}</p>
${m.work ? `<p><a href="${esc(m.work)}" style="color:#c2334a">See the work</a></p>` : ''}
${m.link ? `<p style="margin-top:22px"><a href="${HUB}/${esc(m.link)}" style="color:#c2334a">Open it in YG Hub</a></p>` : ''}</div>`
  return resend({ to: m.email, subject: m.subject, text, html, ...(m.reply_to ? { reply_to: m.reply_to } : {}) })
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    if (body.outbox) {
      // always take the queue, so nothing waits to go out late (without a key, these are dropped)
      const { data, error } = await db.rpc('claim_outbox')
      if (error) throw error
      if (!Deno.env.get('RESEND_API_KEY')) return reply({ skipped: 'RESEND_API_KEY is not set', dropped: data.length })
      let sent = 0
      for (const m of data as Queued[]) if (await sendQueued(m)) sent++
      return reply({ sent })
    }
    if (!Deno.env.get('RESEND_API_KEY')) return reply({ skipped: 'RESEND_API_KEY is not set' })
    const T = ist()
    if (body.day !== T) return reply({ skipped: 'not today’s run' }, 400)
    const { data: claimed, error: claimError } = await db.rpc('claim_daily_mail')
    if (claimError) throw claimError
    if (!claimed) return reply({ skipped: 'already sent today' })

    const [people, tasks, checks, leaves, posts, comps] = await Promise.all([
      db.from('people').select('id, name, email, role, owner').eq('active', true).neq('role', 'client'),
      db.from('tasks').select('id, title, due, assignee_id, created_by, project_id, status').neq('status', 'done'),
      db.from('deliverables').select('id, title, version, project_id').eq('status', 'internal'),
      db.from('leaves').select('id, user_id, start, end, status').in('status', ['pending', 'approved']),
      db.from('posts').select('id, title, format, date, assignee_id').lt('date', T).not('status', 'in', '(posted,missed)'),
      db.from('compensations').select('id, offer, due, owner_id, client_id').eq('status', 'open').lte('due', T),
    ])
    for (const r of [people, tasks, checks, leaves, posts, comps]) if (r.error) throw r.error
    const first = (id: string) => people.data!.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone'
    const away = (id: string) => leaves.data!.some((l) => l.user_id === id && l.status === 'approved' && l.start <= T && T <= l.end)

    let sent = 0
    for (const p of people.data!) {
      if (away(p.id)) continue
      const admin = p.role === 'admin'
      const mine = tasks.data!.filter((t) => t.assignee_id === p.id && t.due)
      const overdue = mine.filter((t) => t.due < T).map((t) => ({ text: `${t.title} (was due ${day(t.due)})`, link: `#/tasks/${t.id}` }))
      overdue.push(...posts.data!.filter((s) => s.assignee_id === p.id).map((s) => ({ text: `${s.format} “${s.title}” (was going out ${day(s.date)}) — mark it posted or undelivered`, link: '#/content' })))
      overdue.push(...comps.data!.filter((k) => k.owner_id === p.id && k.due < T).map((k) => ({ text: `Compensation: ${k.offer} (was due ${day(k.due)})`, link: '#/content/owed' })))
      const today = mine.filter((t) => t.due === T).map((t) => ({ text: t.title, link: `#/tasks/${t.id}` }))
      today.push(...comps.data!.filter((k) => k.owner_id === p.id && k.due === T).map((k) => ({ text: `Compensation: ${k.offer}`, link: '#/content/owed' })))
      const decide: Line[] = []
      if (admin && !p.owner) {
        decide.push(...checks.data!.map((x) => ({ text: `Check “${x.title}” v${x.version}`, link: `#/projects/${x.project_id}/deliverables` })))
        decide.push(...leaves.data!.filter((l) => l.status === 'pending' && l.user_id !== p.id).map((l) => ({ text: `${first(l.user_id)} asks for leave: ${day(l.start)}${l.end !== l.start ? ` – ${day(l.end)}` : ''}`, link: '#/leave' })))
      }
      const late = admin
        ? tasks.data!.filter((t) => t.due && t.due <= ist(Date.now() - 2 * 864e5) && t.assignee_id !== p.id).map((t) => ({ text: `${t.assignee_id ? first(t.assignee_id) : 'Not given to anyone'}: “${t.title}” (was due ${day(t.due)})`, link: `#/tasks/${t.id}` }))
        : []
      if (!overdue.length && !today.length && !decide.length && !late.length) continue
      const subject = [overdue.length && `${overdue.length} overdue`, today.length && `${today.length} due today`, decide.length && `${n(decide.length, 'thing')} to decide`].filter(Boolean).join(', ') || `${n(late.length, 'task')} running late`
      const ok = await send(p.email, `YG Hub: ${subject}`, `Good morning ${p.name.split(' ')[0]} — here’s what needs you today.`, [
        ['Overdue — finish these first', overdue],
        ['Waiting on you', decide],
        ['Due today', today],
        ['Running late in the studio', late],
      ])
      if (ok) sent++
    }
    return reply({ sent })
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
