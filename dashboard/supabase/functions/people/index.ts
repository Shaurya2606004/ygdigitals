// Admin-only: add people and client logins, edit them, switch logins off and on.
// Lives here (not in a database function) because creating, renaming and banning logins needs the auth admin
// API, which only the service role may use. Same checks and messages as savePerson / setActive in src/store.js.
// A new login gets a welcome email with the sign-in link and its temporary password (when RESEND_API_KEY is set;
// otherwise, and if sending fails, the admin shares the password themselves — the app tells them).
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const ROLES: Record<string, string> = { admin: 'Admin', member: 'Team member', freelancer: 'Freelancer', client: 'Client' }
const DEPTS = ['video', 'design', 'social', 'website', 'packaging'] // + 'all' (the office) for team members
const COLORS = ['#e04c5c', '#d97706', '#2563eb', '#0d9488', '#7c3aed', '#16a34a', '#db2777', '#475569', '#0891b2', '#ca8a04']
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (error: string, status = 400) => reply({ error }, status)

const HUB = Deno.env.get('HUB_URL') ?? 'https://team.ygdigitals.com'
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// one email through Resend, from the hub's own address. false = not sent (no key, or Resend said no)
async function mail(to: string, subject: string, lines: string[], replyTo?: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM') ?? 'YG Hub <hub@ygdigitals.com>',
      to,
      reply_to: replyTo,
      subject,
      text: lines.join('\n'),
      html: `<div style="font:15px/1.6 system-ui,sans-serif;color:#111">${lines.map((l) => `<p style="margin:0 0 10px">${esc(l).replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join('')}</div>`,
    }),
  })
  return res.ok
}

const log = (who: string, text: string, link: string) => admin.from('activity').insert({ user_id: who, text, link })
const notify = (who: string, to: string, text: string, link: string) => admin.from('notifications').insert({ user_id: to, from_id: who, text, link })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
    const { data: auth } = await admin.auth.getUser(token)
    if (!auth.user) return fail('Please sign in again.', 401)
    const { data: me } = await admin.from('people').select('id, role, name, email').eq('id', auth.user.id).eq('active', true).maybeSingle()
    if (me?.role !== 'admin') return fail('You don’t have permission to manage people.', 403)

    const body = await req.json()

    if (body.action === 'active') {
      const { id, active } = body
      if (id === me.id) return fail('You cannot deactivate yourself.')
      const { data: who } = await admin.from('people').select('name').eq('id', id).maybeSingle()
      if (!who) return fail('That person no longer exists.')
      // the ban stops new sign-ins; active = false makes every database rule refuse them straight away
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' })
      if (error) return fail(error.message)
      await admin.from('people').update({ active: Boolean(active) }).eq('id', id)
      await log(me.id, `${active ? 'reactivated' : 'deactivated'} ${who.name}'s login`, '#/settings/team')
      return reply({ id })
    }

    if (body.action !== 'save') return fail('Unknown action.')
    const p = body.person ?? {}
    const name = String(p.name ?? '').trim()
    const email = String(p.email ?? '').trim().toLowerCase()
    const role = String(p.role ?? '')
    const clientId = role === 'client' ? p.clientId || null : null
    const password = p.password ? String(p.password) : ''
    const dept = role === 'client' ? '' : String(p.dept ?? '')
    if (!name) return fail('Add their name.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Add a valid email — it is their login.')
    if (!ROLES[role]) return fail('Pick a role.')
    if (role === 'client' && !clientId) return fail('Pick which client this login belongs to.')
    if (password && password.length < 8) return fail('Passwords need at least 8 characters.')
    if (dept && !DEPTS.includes(dept) && !(dept === 'all' && role === 'member')) return fail('Pick a department from the list.')
    const { data: taken } = await admin.from('people').select('id').eq('email', email).maybeSingle()
    if (taken && taken.id !== p.id) return fail('Someone already uses that email.')
    const fields = { name, email, role, client_id: clientId, dept, title: String(p.title ?? ''), phone: String(p.phone ?? '') }

    if (p.id) {
      const { data: old } = await admin.from('people').select('id, email, role').eq('id', p.id).maybeSingle()
      if (!old) return fail('That person no longer exists.')
      if (old.id === me.id && role !== old.role) return fail('You cannot change your own role.')
      const login: Record<string, unknown> = {}
      if (email !== old.email) Object.assign(login, { email, email_confirm: true })
      if (password) login.password = password
      if (Object.keys(login).length) {
        const { error } = await admin.auth.admin.updateUserById(p.id, login)
        if (error) return fail(error.message)
      }
      const { error } = await admin.from('people').update(fields).eq('id', p.id)
      if (error) return fail(error.message)
      if (old.role !== role) await notify(me.id, p.id, `changed your role to ${ROLES[role]}`, '#/settings')
      await log(me.id, `updated ${name}'s details`, '#/settings/team')
      return reply({ id: p.id })
    }

    if (!password) return fail('Set a temporary password (8+ characters) and share it with them.')
    const { data: made, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) return fail(error.message.includes('already') ? 'Someone already uses that email.' : error.message)
    const { count } = await admin.from('people').select('id', { count: 'exact', head: true })
    const { error: saveError } = await admin.from('people').insert({ id: made.user.id, ...fields, color: COLORS[(count ?? 0) % COLORS.length] })
    if (saveError) {
      await admin.auth.admin.deleteUser(made.user.id) // don't leave a login with no profile behind
      return fail(saveError.message)
    }
    await notify(me.id, made.user.id, 'added you to YG Hub — welcome!', '#/')
    const { data: client } = clientId ? await admin.from('clients').select('name').eq('id', clientId).maybeSingle() : { data: null }
    await log(me.id, role === 'client' ? `gave ${name} a login for ${client?.name ?? 'a client'}` : `added ${name} to the team`,
      role === 'client' ? '#/settings/clients' : '#/settings/team')
    const mailed = p.sendEmail === false ? null : await mail(email, 'Your YG Hub login', [
      `Hi ${name.split(' ')[0]},`,
      `${me.name} has added you to YG Hub, ${role === 'client' ? `where you can follow and approve ${client?.name ?? 'your'} work with YG Digitals` : 'the YG Digitals team workspace'}.`,
      `Sign in at ${HUB}`,
      `Email: ${email}`,
      `Temporary password: ${password}`,
      'Please change the password after you sign in (Settings › Profile).',
    ], me.email).catch(() => false)
    return reply({ id: made.user.id, mailed })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Something went wrong.', 500)
  }
})
