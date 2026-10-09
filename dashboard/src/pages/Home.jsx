import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, EVENT_TYPES, isOverdue, occurrences, POST_STATUS, postMark, PROJECT_STATUS, progress, staff, taskMark } from '../store.js'
import { Avatar, Bar, Card, Empty, Err, Icon, isUrl, Mark, RichText, Status, useDb, useMe } from '../ui.jsx'
import { addDays, ago, daysBetween, fmtDay, fmtLong, fmtTime, relDay, today } from '../util.js'
import { EventForm } from './Calendar.jsx'
import { CompensationForm, makeUpFor } from './Content.jsx'
import { HandoffForm, SendBackForm, TaskRow } from './Tasks.jsx'

const hello = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
const late = (day) => {
  const n = daysBetween(day, today())
  return n === 1 ? '1 day late' : `${n} days late`
}

export default function Home() {
  const me = useMe()
  return me.role === 'client' ? <ClientHome me={me} /> : me.owner ? <OwnerHome me={me} /> : <StaffHome me={me} />
}

// the owners' Home: only what matters — what's late, whether today's work went out, and what's coming this week.
// Every task, post and compensation with a date, across the studio.
function OwnerHome({ me }) {
  const d = useDb()
  const T = today()
  const [allWeek, setAllWeek] = useState(false)
  const away = d.users.filter((u) => u.active && S.isAway(d, u.id, T)).map((u) => u.name.split(' ')[0])
  const client = (id) => byId(d.clients, id)?.name ?? ''
  const work = [
    ...d.tasks.filter((t) => t.due).map((t) => ({ key: t.id, what: t.title, client: client(byId(d.projects, t.projectId)?.clientId), who: t.assigneeId, due: t.due, doneOn: t.completedAt, mark: taskMark(t), href: `#/tasks/${t.id}` })),
    ...d.posts.map((p) => ({ key: p.id, what: `${p.format}: ${p.title}`, client: client(p.clientId), who: p.assigneeId, due: p.date, mark: postMark(p), href: '#/content' })),
    ...d.compensations
      .filter((k) => k.due)
      .map((k) => ({ key: k.id, what: `Compensation: ${k.offer}`, client: client(k.clientId), who: k.ownerId, due: k.due, doneOn: k.givenAt, mark: k.status === 'given' ? 'delivered' : k.due < T ? 'overdue' : k.due === T ? 'today' : 'due', href: '#/content/owed' })),
  ]
  const byDue = (a, b) => a.due.localeCompare(b.due)
  const overdue = work.filter((w) => w.mark === 'overdue').sort(byDue)
  // due today, plus anything finished today; what's still not out comes first
  const todays = work.filter((w) => w.due === T || w.doneOn === T).sort((a, b) => (b.mark === 'today') - (a.mark === 'today'))
  const out = todays.filter((w) => w.mark !== 'today' && w.mark !== 'undelivered')
  const week = work.filter((w) => w.mark === 'due' && w.due <= addDays(T, 7)).sort(byDue)
  const meta = (w, when) => [w.client, w.who ? S.userName(d, w.who).split(' ')[0] : 'not given to anyone', when].filter(Boolean).join(' · ')
  const Row = ({ w, right, when }) => (
    <li>
      <a href={w.href} className="row">
        <span className="grow">
          <b>{w.what}</b>
          <small>{meta(w, when)}</small>
        </span>
        {right}
      </a>
    </li>
  )
  return (
    <div className="page">
      <div className="hello">
        <h1>
          {hello()}, {me.name.split(' ')[0]}
        </h1>
        <p className="sub">
          {fmtLong(T)}
          {away.length > 0 && ` · On leave today: ${away.join(', ')}`}
        </p>
      </div>
      <div className="kpis">
        <Kpi label="Late" value={overdue.length} tone={overdue.length ? 'late' : ''} note={overdue.length ? 'not done by their date' : 'nothing late'} />
        <Kpi label="Done today" value={`${out.length} of ${todays.length}`} tone={out.length < todays.length ? 'warn' : ''} note="due or finished today" />
        <Kpi label="Due this week" value={week.length} />
      </div>
      <Card title={`Late${overdue.length ? ` (${overdue.length})` : ''}`} className="urgent-card">
        {overdue.length ? (
          <ul className="list">
            {overdue.map((w) => (
              <Row key={w.key} w={w} right={<span className="due late">{late(w.due)}</span>} />
            ))}
          </ul>
        ) : (
          <Empty title="Nothing is late" />
        )}
      </Card>
      <Card title="Today — done or not">
        {todays.length ? (
          <ul className="list">
            {todays.map((w) => (
              <Row key={w.key} w={w} when={w.due !== T ? `was due ${fmtDay(w.due)}` : ''} right={w.mark === 'today' ? <Status s="today" label="Not done yet" /> : <Mark m={w.mark} />} />
            ))}
          </ul>
        ) : (
          <Empty icon="calendar" title="Nothing due today" />
        )}
      </Card>
      <Card title="Coming up this week">
        {week.length ? (
          <ul className="list">
            {(allWeek ? week : week.slice(0, 6)).map((w) => (
              <Row key={w.key} w={w} right={<span className="due">{relDay(w.due)}</span>} />
            ))}
          </ul>
        ) : (
          <Empty icon="calendar" title="Nothing else due this week" />
        )}
        {!allWeek && week.length > 6 && (
          <button className="link-btn more-btn" onClick={() => setAllWeek(true)}>
            Show {week.length - 6} more
          </button>
        )}
      </Card>
    </div>
  )
}

const Kpi = ({ label, value, note, tone, href }) => {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${tone || ''}`}>{value}</span>
      {note && <span className="kpi-note">{note}</span>}
    </>
  )
  return href ? (
    <a className="kpi" href={href}>
      {body}
    </a>
  ) : (
    <div className="kpi">{body}</div>
  )
}

export function Agenda({ me, days = 1 }) {
  const d = useDb()
  const from = today()
  const items = occurrences(d, from, addDays(from, days - 1)).filter((o) => o.attendeeIds.includes(me.id) && o.rsvp?.[me.id] !== 'no')
  if (!items.length) return <Empty icon="calendar" title={days === 1 ? 'No meetings today' : 'Nothing booked'} />
  return (
    <ul className="list">
      {items.map((o) => (
        <li key={o.id + o.date} className="row agenda-row">
          <span className="time">
            {days > 1 && <small>{relDay(o.date)}</small>}
            {fmtTime(o.start)}
          </span>
          <span className={`type-bar t-${o.type}`} aria-hidden="true" />
          <span className="grow">
            <b>{o.title}</b>
            <small>
              {EVENT_TYPES[o.type]} · {fmtTime(o.start)}–{fmtTime(o.end)}
              {o.location && !isUrl(o.location) ? ` · ${o.location}` : ''}
            </small>
          </span>
          {isUrl(o.location) && (
            <a className="btn sm" href={o.location} target="_blank" rel="noreferrer">
              <Icon name="video" size={14} /> Join
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

export function Activity({ filter = () => true, limit = 12 }) {
  const d = useDb()
  const items = d.activity.filter(filter).slice(0, limit)
  if (!items.length) return <Empty icon="clock" title="No activity yet" />
  return (
    <ul className="feed">
      {items.map((a) => (
        <li key={a.id}>
          <Avatar user={byId(d.users, a.userId)} size={26} />
          <p>
            <b>{S.userName(d, a.userId)}</b> {a.link ? <a href={a.link}>{a.text}</a> : a.text}
            <small>{ago(a.at)}</small>
          </p>
        </li>
      ))}
    </ul>
  )
}

function Announcements() {
  const d = useDb()
  const items = d.messages.filter((m) => m.channelId === 'ch-announce').slice(-3).reverse()
  if (!items.length) return <Empty icon="chat" title="No announcements" />
  return (
    <ul className="feed">
      {items.map((m) => (
        <li key={m.id}>
          <Avatar user={byId(d.users, m.userId)} size={26} />
          <p>
            <b>{S.userName(d, m.userId)}</b> <small>{ago(m.at)}</small>
            <span className="block">
              <RichText text={m.text} />
            </span>
          </p>
        </li>
      ))}
    </ul>
  )
}

// open work per person, so the admin can see who's overloaded before handing more over
function Workload() {
  const d = useDb()
  const rows = staff(d).map((u) => {
    const open = d.tasks.filter((t) => t.assigneeId === u.id && t.status !== 'done')
    return { u, open, by: ['todo', 'doing', 'review'].map((s) => open.filter((t) => t.status === s).length), late: open.filter(isOverdue).length }
  })
  const max = Math.max(1, ...rows.map((r) => r.open.length))
  return (
    <>
      <ul className="workload">
        {rows.map(({ u, open, by, late }) => (
          <li key={u.id}>
            <span className="who">
              <Avatar user={u} size={24} /> {u.name.split(' ')[0]}
            </span>
            <span className="wl-bar" role="img" aria-label={`${u.name}: ${by[0]} to do, ${by[1]} in progress, ${by[2]} in review`}>
              {by.map((n, i) => n > 0 && <i key={i} className={`s${i}`} style={{ width: `${(n / max) * 100}%` }} />)}
            </span>
            <span className="wl-num">
              <b>{open.length}</b> open
              {late > 0 && <span className="late"> · {late} late</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="legend">
        <i className="s0" /> To do <i className="s1" /> In progress <i className="s2" /> Review
      </p>
    </>
  )
}

// everything waiting on you, most urgent first: your overdue work, then what only you can decide, then work running
// late around you, then today, the rest of the week, and the rest of your work
const GROUPS = { overdue: 'Overdue — finish these first', decide: 'Waiting on you', late: 'Late in the team', today: 'Due today', week: 'Later this week', later: 'After that' }

function Urgent({ me }) {
  const d = useDb()
  const T = today()
  const admin = me.role === 'admin'
  const [form, setForm] = useState(null) // {kind: 'handoff' or 'back', t} or {kind: 'makeup', initial}
  const [err, setErr] = useState('')
  const [more, setMore] = useState(false)
  const run = (fn) => {
    try {
      fn()
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  const proj = (id) => byId(d.projects, id)?.name ?? ''
  const first = (id) => S.userName(d, id).split(' ')[0]
  const leads = (pid) => byId(d.projects, pid)?.managerId === me.id
  const openTask = (t) => t.status !== 'done'
  const rows = [
    // compensation owed to clients: the person on it, by their date; the supervisors once it's late
    ...d.compensations
      .filter((k) => k.status === 'open' && k.due && (k.ownerId === me.id ? k.due <= addDays(T, 7) : admin && k.due < T))
      .map((k) => ({
        g: k.ownerId !== me.id ? 'late' : k.due < T ? 'overdue' : k.due === T ? 'today' : 'week',
        at: k.due,
        key: `k${k.id}`,
        icon: 'clock',
        late: k.due < T,
        text: `Compensation for ${byId(d.clients, k.clientId)?.name}: ${k.offer}`,
        meta: `for ${k.missed} · ${k.due < T ? late(k.due) : relDay(k.due)}${k.ownerId && k.ownerId !== me.id ? ` · ${first(k.ownerId)}` : ''}`,
        href: '#/content/owed',
        comp: k,
      })),
    ...d.tasks.filter((t) => isOverdue(t) && t.assigneeId === me.id).map((t) => ({ g: 'overdue', at: t.due, key: t.id, icon: 'clock', late: true, text: t.title, meta: `${proj(t.projectId)} · ${late(t.due)}`, href: `#/tasks/${t.id}`, task: t })),
    ...d.posts.filter((p) => postMark(p) === 'overdue' && p.assigneeId === me.id).map((p) => ({ g: 'overdue', at: p.date, key: p.id, icon: 'grid', late: true, text: `${p.format}: ${p.title}`, meta: `${byId(d.clients, p.clientId)?.name} · was going out ${fmtDay(p.date)}, still ${POST_STATUS[p.status]}`, href: '#/content', post: p })),

    ...d.leaves
      .filter((l) => admin && l.status === 'pending' && l.userId !== me.id)
      .map((l) => {
        const due = S.openWork(d, l.userId, l.start, l.end).length
        const meta = [l.note, due ? `${due} of their tasks or posts are due then` : 'nothing of theirs is due then'].filter(Boolean).join(' · ')
        return { g: 'decide', at: l.start, key: `v${l.id}`, icon: 'sun', text: `${first(l.userId)} asks for leave: ${S.leaveDays(l)}`, meta, href: '#/leave' }
      }),
    ...d.deliverables.filter((x) => x.status === 'internal' && can(me, 'deliverable.review', x)).map((x) => ({ g: 'decide', at: '', key: x.id, icon: 'eye', text: `Check “${x.title}” v${x.version}`, meta: `${proj(x.projectId)} · from ${S.userName(d, x.submittedBy)}`, href: `#/projects/${x.projectId}/deliverables` })),
    ...d.tasks.filter((t) => t.status === 'review' && (admin || leads(t.projectId))).map((t) => ({ g: 'decide', at: t.due || '', key: `r${t.id}`, icon: 'check', text: `Check “${t.title}”`, meta: `${first(t.assigneeId)} says it’s ready`, href: `#/tasks/${t.id}`, check: t })),
    ...d.posts.filter((p) => p.status === 'made' && can(me, 'content.send', p)).map((p) => ({ g: 'decide', at: p.date, key: `m${p.id}`, icon: 'send', text: `Check and send “${p.format}: ${p.title}”`, meta: `${byId(d.clients, p.clientId)?.name} · ${p.assigneeId ? `${first(p.assigneeId)} made it` : 'made'} · goes out ${relDay(p.date)}`, href: `#/content/post/${p.id}` })),
    ...d.deliverables.filter((x) => x.status === 'changes' && x.submittedBy === me.id).map((x) => ({ g: 'decide', at: '', key: `c${x.id}`, icon: 'edit', text: `Changes asked on “${x.title}”`, meta: x.history.at(-1)?.note || proj(x.projectId), href: `#/projects/${x.projectId}/deliverables` })),
    ...d.tasks.filter((t) => admin && !t.assigneeId && openTask(t)).map((t) => ({ g: 'decide', at: t.due || '9', key: `o${t.id}`, icon: 'swap', text: `Give “${t.title}” to someone`, meta: proj(t.projectId), href: `#/tasks/${t.id}` })),

    ...d.tasks.filter((t) => isOverdue(t) && t.assigneeId && t.assigneeId !== me.id && (admin || leads(t.projectId))).map((t) => ({ g: 'late', at: t.due, key: `l${t.id}`, icon: 'clock', late: true, text: `${first(t.assigneeId)}: “${t.title}”`, meta: `${proj(t.projectId)} · ${late(t.due)}`, href: `#/tasks/${t.id}` })),
    ...d.posts.filter((p) => postMark(p) === 'overdue' && p.assigneeId !== me.id && S.seesAll(me)).map((p) => ({ g: 'late', at: p.date, key: `p${p.id}`, icon: 'grid', late: true, text: `${p.format}: ${p.title}`, meta: `${byId(d.clients, p.clientId)?.name} · was going out ${fmtDay(p.date)} · ${p.assigneeId ? first(p.assigneeId) : 'no one on it'}`, href: '#/content', post: p })),

    ...d.tasks.filter((t) => openTask(t) && t.due === T && t.assigneeId === me.id).map((t) => ({ g: 'today', at: t.due, key: `t${t.id}`, icon: 'check', text: t.title, meta: proj(t.projectId), href: `#/tasks/${t.id}`, task: t })),
    ...d.posts.filter((p) => p.date === T && p.assigneeId === me.id && !['scheduled', 'posted', 'missed'].includes(p.status)).map((p) => ({ g: 'today', at: p.date, key: `d${p.id}`, icon: 'grid', text: `${p.format} goes out today: ${p.title}`, meta: `${byId(d.clients, p.clientId)?.name} · still ${POST_STATUS[p.status]}`, href: '#/content' })),

    ...d.tasks.filter((t) => openTask(t) && t.assigneeId === me.id && t.due > T && t.due <= addDays(T, 7)).map((t) => ({ g: 'week', at: t.due, key: `w${t.id}`, icon: 'calendar', text: t.title, meta: `${proj(t.projectId)} · ${relDay(t.due)}`, href: `#/tasks/${t.id}`, task: t })),
    ...d.tasks.filter((t) => openTask(t) && t.assigneeId === me.id && (!t.due || t.due > addDays(T, 7))).map((t) => ({ g: 'later', at: t.due || '9', key: `n${t.id}`, icon: 'calendar', text: t.title, meta: [proj(t.projectId), t.due && relDay(t.due)].filter(Boolean).join(' · '), href: `#/tasks/${t.id}`, task: t })),
  ]
  const order = Object.keys(GROUPS)
  rows.sort((a, b) => order.indexOf(a.g) - order.indexOf(b.g) || a.at.localeCompare(b.at))
  if (!rows.length) return <Empty title="Nothing to do right now — you’re all caught up" />
  // overdue and decisions always show in full; the rest fold away after a few
  const shown = more ? rows : rows.filter((r, i) => ['overdue', 'decide'].includes(r.g) || i < 8)
  return (
    <>
      <Err msg={err} />
      <ul className="list urgent">
        {shown.map((r, i) => (
          <li key={r.key}>
            {shown[i - 1]?.g !== r.g && (
              <h3 className={`urgent-head ${r.g === 'overdue' ? 'is-late' : ''}`}>
                {GROUPS[r.g]} · {rows.filter((x) => x.g === r.g).length}
              </h3>
            )}
            <div className="row">
              <span className={`row-icon ${r.late ? 'late' : ''}`}>
                <Icon name={r.icon} size={16} />
              </span>
              <a href={r.href} className="grow urgent-text">
                <b>{r.text}</b>
                <small>{r.meta}</small>
              </a>
              <span className="row-actions end">
                {r.check && (
                  <>
                    <button className="btn sm" onClick={() => run(() => S.moveTask(me, r.check.id, 'done'))}>
                      <Icon name="check" size={14} /> Approve
                    </button>
                    <button className="btn sm ghost" onClick={() => setForm({ kind: 'back', t: r.check })}>
                      Send back
                    </button>
                  </>
                )}
                {r.task && r.g === 'overdue' && (
                  <>
                    <button className="btn sm" onClick={() => run(() => S.moveTask(me, r.task.id, 'done'))}>
                      <Icon name="check" size={14} /> Done
                    </button>
                    <button className="btn sm ghost" onClick={() => setForm({ kind: 'handoff', t: r.task })}>
                      <Icon name="swap" size={14} /> Hand over
                    </button>
                  </>
                )}
                {r.post && (
                  <>
                    <button className="btn sm" onClick={() => run(() => S.savePost(me, { ...r.post, status: 'posted' }))}>
                      Posted
                    </button>
                    <button
                      className="btn sm ghost"
                      onClick={() => {
                        run(() => S.savePost(me, { ...r.post, status: 'missed' }))
                        if (can(me, 'content.manage')) setForm({ kind: 'makeup', initial: makeUpFor(r.post) })
                      }}
                    >
                      Undelivered
                    </button>
                  </>
                )}
                {r.comp && (me.role === 'admin' || r.comp.ownerId === me.id) && (
                  <button className="btn sm" onClick={() => run(() => S.giveCompensation(me, r.comp.id))}>
                    <Icon name="check" size={14} /> Given
                  </button>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {shown.length < rows.length && (
        <button className="link-btn more-btn" onClick={() => setMore(true)}>
          Show {rows.length - shown.length} more
        </button>
      )}
      {form?.kind === 'handoff' && <HandoffForm t={form.t} onClose={() => setForm(null)} />}
      {form?.kind === 'back' && <SendBackForm t={form.t} onClose={() => setForm(null)} />}
      {form?.kind === 'makeup' && <CompensationForm initial={form.initial} onClose={() => setForm(null)} />}
    </>
  )
}

function StaffHome({ me }) {
  const d = useDb()
  const T = today()
  const admin = me.role === 'admin'
  const free = me.role === 'freelancer' // no studio-wide feeds: they only see their own projects
  const away = d.users.filter((u) => u.active && S.isAway(d, u.id, T)).map((u) => u.name.split(' ')[0])
  const mine = d.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))
  const open = d.tasks.filter((t) => t.status !== 'done')
  const checks = d.deliverables.filter((x) => x.status === 'internal').length + d.tasks.filter((t) => t.status === 'review').length
  const kpis = admin
    ? [
        { label: 'Active projects', value: d.projects.filter((p) => ['active', 'review', 'planning'].includes(p.status)).length, href: '#/projects' },
        { label: 'Open tasks', value: open.length, note: `${open.filter((t) => t.due && t.due <= addDays(T, 7)).length} due this week`, href: '#/tasks' },
        { label: 'Overdue', value: open.filter(isOverdue).length, tone: open.some(isOverdue) ? 'late' : '' },
        { label: 'Waiting for your check', value: checks, tone: checks ? 'warn' : '' },
        { label: 'Waiting on clients', value: d.deliverables.filter((x) => x.status === 'client').length + d.posts.filter((p) => p.status === 'ready').length, note: 'work + posts to approve' },
      ]
    : [
        { label: 'My open tasks', value: mine.length, href: '#/tasks' },
        { label: 'Due today', value: mine.filter((t) => t.due === T).length },
        { label: 'Overdue', value: mine.filter(isOverdue).length, tone: mine.some(isOverdue) ? 'late' : '' },
      ]

  // the team and freelancers: just their work, most urgent first, and today's meetings
  if (!admin)
    return (
      <div className="page">
        <div className="hello">
          <h1>
            {hello()}, {me.name.split(' ')[0]}
          </h1>
          <p className="sub">
            {fmtLong(T)}
            {away.length > 0 && ` · On leave today: ${away.join(', ')}`}
          </p>
        </div>
        <div className="cols">
          <div className="col-main">
            <Card title="Your work — most urgent first" className="urgent-card">
              <Urgent me={me} />
            </Card>
          </div>
          <div className="col-side">
            <Card title="Today’s meetings" action={<a href="#/calendar">Calendar</a>}>
              <Agenda me={me} />
            </Card>
            {!free && (
              <Card title="Announcements" action={<a href="#/chat/ch-announce">Open</a>}>
                <Announcements />
              </Card>
            )}
          </div>
        </div>
      </div>
    )

  return (
    <div className="page">
      <div className="hello">
        <h1>
          {hello()}, {me.name.split(' ')[0]}
        </h1>
        <p className="sub">
          {fmtLong(T)}
          {away.length > 0 && ` · Away today: ${away.join(', ')}`}
        </p>
      </div>
      <Card title="Most urgent first" className="urgent-card">
        <Urgent me={me} />
      </Card>
      <div className="kpis">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>
      <div className="cols">
        <div className="col-main">
          <Card title="My tasks" action={<a href="#/tasks">All tasks</a>}>
            {mine.length ? (
              <ul className="list">
                {mine.slice(0, 8).map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </ul>
            ) : (
              <Empty title="Nothing on your plate">Tasks handed to you show up here.</Empty>
            )}
          </Card>
          {admin && (
            <Card title="Who’s got what">
              <Workload />
            </Card>
          )}
          {can(me, 'activity.view') && (
            <Card title="Recent activity">
              <Activity />
            </Card>
          )}
        </div>
        <div className="col-side">
          <Card title="Today" action={<a href="#/calendar">Calendar</a>}>
            <Agenda me={me} />
          </Card>
          {!free && (
            <Card title="Announcements" action={<a href="#/chat/ch-announce">Open</a>}>
              <Announcements />
            </Card>
          )}
          <Card title="Upcoming deadlines">
            <ul className="list">
              {d.projects
                .filter((p) => p.status !== 'done' && p.due)
                .sort((a, b) => a.due.localeCompare(b.due))
                .slice(0, 5)
                .map((p) => (
                  <li key={p.id}>
                    <a href={`#/projects/${p.id}`} className="row">
                      <span className="grow">
                        <b>{p.name}</b>
                        <small>{byId(d.clients, p.clientId)?.name}</small>
                      </span>
                      <span className={`due ${p.due < T ? 'late' : ''}`}>{relDay(p.due)}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ClientHome({ me }) {
  const d = useDb()
  const T = today()
  const [booking, setBooking] = useState(false)
  const client = byId(d.clients, me.clientId)
  const projects = d.projects.filter((p) => p.clientId === me.clientId)
  const ids = projects.map((p) => p.id)
  const waiting = d.deliverables.filter((x) => x.status === 'client' && can(me, 'deliverable.decide', x))
  const posts = d.posts.filter((p) => p.clientId === me.clientId && p.status === 'ready')
  const comingUp = d.tasks.filter((t) => ids.includes(t.projectId) && t.status !== 'done' && t.due && t.due <= addDays(T, 7)).sort((a, b) => a.due.localeCompare(b.due))
  const meetings = occurrences(d, T, addDays(T, 30)).filter((o) => o.attendeeIds.includes(me.id))
  const teamIds = [...new Set(projects.filter((p) => p.status !== 'done').flatMap((p) => [p.managerId, ...p.memberIds]))]
  const chans = d.channels.filter((c) => c.type === 'project' && can(me, 'channel.view', c)).map((c) => c.id)
  const msgs = d.messages.filter((m) => chans.includes(m.channelId) && !m.deleted).slice(-4).reverse()
  const leads = [...new Set(projects.filter((p) => p.status !== 'done').map((p) => p.managerId))]
  const makeUps = d.compensations.filter((k) => k.clientId === me.clientId && k.shared).sort((a, b) => (a.status === 'given') - (b.status === 'given'))

  return (
    <div className="page">
      <div className="hello">
        <h1>
          {hello()}, {me.name.split(' ')[0]}
        </h1>
        <p className="sub">{client?.name} · your workspace with YG Digitals</p>
      </div>
      <div className="kpis">
        <Kpi label="Active projects" value={projects.filter((p) => p.status !== 'done').length} href="#/projects" />
        <Kpi label="Waiting for your approval" value={waiting.length + posts.length} tone={waiting.length + posts.length ? 'warn' : ''} />
        <Kpi label="Due this week" value={comingUp.length} note="across your projects" />
        <Kpi label="Meetings (next 30 days)" value={meetings.length} href="#/calendar" />
      </div>
      <div className="cols">
        <div className="col-main">
          <Card title="Waiting for your approval">
            {waiting.length + posts.length ? (
              <ul className="list">
                {waiting.map((x) => (
                  <li key={x.id}>
                    <a href={`#/projects/${x.projectId}/deliverables`} className="row">
                      <span className="row-icon">
                        <Icon name="eye" size={16} />
                      </span>
                      <span className="grow">
                        <b>
                          {x.title} <span className="muted">v{x.version}</span>
                        </b>
                        <small>
                          {x.type} · {byId(d.projects, x.projectId)?.name}
                        </small>
                      </span>
                      <span className="btn sm primary">Review</span>
                    </a>
                  </li>
                ))}
                {posts.map((p) => (
                  <li key={p.id}>
                    <a href={`#/content/post/${p.id}`} className="row">
                      <span className="row-icon">
                        <Icon name="grid" size={16} />
                      </span>
                      <span className="grow">
                        <b>{p.title}</b>
                        <small>
                          {p.platform} {p.format} · goes out {relDay(p.date)}
                        </small>
                      </span>
                      <span className="btn sm primary">Review</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="You’re all caught up">New work for you to approve will show up here.</Empty>
            )}
          </Card>
          {makeUps.length > 0 && (
            <Card title="Making it up to you">
              <ul className="list">
                {makeUps.map((k) => (
                  <li key={k.id} className="row">
                    <span className="row-icon">
                      <Icon name={k.status === 'given' ? 'check' : 'clock'} size={16} />
                    </span>
                    <span className="grow">
                      <b>{k.offer}</b>
                      <small>
                        For {k.missed}
                        {k.status === 'given' ? ` · delivered ${fmtDay(k.givenAt)}` : k.due ? ` · by ${fmtDay(k.due)}` : ''}
                      </small>
                    </span>
                    <Status s={k.status === 'given' ? 'done' : 'pending'} label={k.status === 'given' ? 'Delivered' : 'Coming'} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Your projects">
            <ul className="list">
              {projects.map((p) => (
                <li key={p.id}>
                  <a href={`#/projects/${p.id}`} className="row project-row">
                    <span className="grow">
                      <b>{p.name}</b>
                      <small>{p.status === 'done' ? 'Delivered' : `Due ${fmtDay(p.due)}`}</small>
                    </span>
                    <Status s={p.status} label={PROJECT_STATUS[p.status]} />
                    <span className="prog">
                      <Bar pct={progress(d, p.id)} label={`${p.name} progress`} />
                      <small>{progress(d, p.id)}%</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Coming up this week">
            {comingUp.length ? (
              <ul className="list">
                {comingUp.map((t) => (
                  <li key={t.id}>
                    <a href={`#/projects/${t.projectId}/plan`} className="row">
                      <span className="grow">
                        <b>{t.title}</b>
                        <small>
                          {byId(d.projects, t.projectId)?.name}
                          {t.assigneeId ? ` · ${S.userName(d, t.assigneeId).split(' ')[0]}` : ''}
                        </small>
                      </span>
                      <span className={`due ${isOverdue(t) ? 'late' : ''}`}>{relDay(t.due)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="calendar" title="Nothing due this week" />
            )}
          </Card>
          <Card title="Latest messages" action={<a href="#/chat">Messages</a>}>
            {msgs.length ? (
              <ul className="feed">
                {msgs.map((m) => (
                  <li key={m.id}>
                    <Avatar user={byId(d.users, m.userId)} size={26} />
                    <p>
                      <b>{S.userName(d, m.userId)}</b> <small>{ago(m.at)}</small>
                      <a className="block" href={`#/chat/${m.channelId}`}>
                        {m.text}
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="chat" title="No messages yet" />
            )}
          </Card>
        </div>
        <div className="col-side">
          <Card
            title="Upcoming meetings"
            action={
              <button className="btn sm" onClick={() => setBooking(true)}>
                <Icon name="plus" size={14} /> Book
              </button>
            }
          >
            <Agenda me={me} days={30} />
          </Card>
          <Card title="Your team at YG">
            <ul className="list">
              {teamIds.map((id) => {
                const u = byId(d.users, id)
                return (
                  u && (
                    <li key={id} className="row">
                      <Avatar user={u} size={30} />
                      <span className="grow">
                        <b>{u.name}</b>
                        <small>{leads.includes(id) ? `Your contact · ${u.title}` : u.title}</small>
                      </span>
                    </li>
                  )
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
      {booking && <EventForm onClose={() => setBooking(false)} initial={{ type: 'client', title: `${client?.name} — catch-up`, attendeeIds: leads.slice(0, 1) }} />}
    </div>
  )
}
