import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, EVENT_TYPES, invoiceState, invoiceTotals, isOverdue, LEAVE_TYPES, occurrences, onLeave, PROJECT_STATUS, progress } from '../store.js'
import { Avatar, Bar, Card, Empty, Icon, isUrl, RichText, Status, TeamTag, useDb, useMe } from '../ui.jsx'
import { addDays, ago, fmtDay, fmtLong, fmtTime, inr, relDay, startOfWeek, today } from '../util.js'
import { EventForm } from './Calendar.jsx'
import { TaskRow } from './Tasks.jsx'

const hello = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const me = useMe()
  return me.role === 'client' ? <ClientHome me={me} /> : <StaffHome me={me} />
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

function Agenda({ me, days = 1 }) {
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

function Activity({ filter = () => true, limit = 12 }) {
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

function WhoIsOut() {
  const d = useDb()
  const T = today()
  const now = d.leaves.filter((l) => l.status === 'approved' && l.from <= T && T <= l.to)
  const soon = d.leaves.filter((l) => l.status === 'approved' && l.from > T && l.from <= addDays(T, 7))
  if (!now.length && !soon.length) return <Empty icon="sun" title="Everyone’s in this week" />
  return (
    <ul className="list">
      {[...now, ...soon].map((l) => (
        <li key={l.id} className="row">
          <Avatar user={byId(d.users, l.userId)} size={26} />
          <span className="grow">
            <b>{S.userName(d, l.userId)}</b>
            <small>{LEAVE_TYPES[l.type]}</small>
          </span>
          <span className="muted small">{l.from <= T ? (l.to === T ? 'Today' : `Till ${fmtDay(l.to)}`) : relDay(l.from)}</span>
        </li>
      ))}
    </ul>
  )
}

function Workload() {
  const d = useDb()
  const rows = d.teams
    .filter((t) => t.id !== 'mgmt')
    .map((t) => {
      const open = d.tasks.filter((x) => x.teamId === t.id && x.status !== 'done')
      return { t, open, by: ['todo', 'doing', 'review'].map((s) => open.filter((x) => x.status === s).length), late: open.filter(isOverdue).length, queue: open.filter((x) => !x.assigneeId).length }
    })
  const max = Math.max(1, ...rows.map((r) => r.open.length))
  return (
    <>
      <ul className="workload">
        {rows.map(({ t, open, by, late, queue }) => (
          <li key={t.id}>
            <a href="#/tasks" className="wl-name">
              <TeamTag team={t} />
            </a>
            <span className="wl-bar" role="img" aria-label={`${t.name}: ${by[0]} to do, ${by[1]} in progress, ${by[2]} in review`}>
              {by.map((n, i) => n > 0 && <i key={i} className={`s${i}`} style={{ width: `${(n / max) * 100}%` }} />)}
            </span>
            <span className="wl-num">
              <b>{open.length}</b> open
              {late > 0 && <span className="late"> · {late} late</span>}
              {queue > 0 && <span className="muted"> · {queue} unassigned</span>}
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

function Attention({ me }) {
  const d = useDb()
  const reviews = d.deliverables.filter((x) => x.status === 'internal' && can(me, 'deliverable.review', x))
  const leaves = d.leaves.filter((l) => l.status === 'pending' && can(me, 'leave.decide', l))
  const queue = d.tasks.filter((t) => !t.assigneeId && t.status !== 'done' && can(me, 'task.assign', t))
  const inReview = d.tasks.filter((t) => t.status === 'review' && me.role === 'lead' && t.teamId === me.teamId)
  const late = d.tasks.filter((t) => isOverdue(t) && (me.role === 'lead' ? t.teamId === me.teamId : me.role !== 'member'))
  const rows = [
    ...reviews.map((x) => ({ key: x.id, icon: 'eye', text: `Sign off “${x.title}” v${x.version}`, meta: `${byId(d.projects, x.projectId)?.name} · from ${S.userName(d, x.submittedBy)}`, href: `#/projects/${x.projectId}/deliverables` })),
    ...leaves.map((l) => ({ key: l.id, icon: 'sun', text: `${S.userName(d, l.userId)} — ${LEAVE_TYPES[l.type]}`, meta: `${fmtDay(l.from)}${l.to !== l.from ? ` – ${fmtDay(l.to)}` : ''} · ${l.reason}`, href: '#/people/leave' })),
    ...queue.map((t) => ({ key: t.id, icon: 'swap', text: `Assign “${t.title}”`, meta: `${byId(d.teams, t.teamId)?.name} queue · ${byId(d.projects, t.projectId)?.name}`, href: `#/tasks/${t.id}` })),
    ...inReview.map((t) => ({ key: `r${t.id}`, icon: 'check', text: `Review “${t.title}”`, meta: `${S.userName(d, t.assigneeId)} moved it to Review`, href: `#/tasks/${t.id}` })),
    ...late.map((t) => ({ key: `l${t.id}`, icon: 'clock', text: `Overdue: “${t.title}”`, meta: `${t.assigneeId ? S.userName(d, t.assigneeId) : 'Unassigned'} · was due ${fmtDay(t.due)}`, href: `#/tasks/${t.id}`, late: true })),
  ]
  if (!rows.length) return <Empty title="Nothing waiting on you" />
  return (
    <ul className="list">
      {rows.slice(0, 10).map((r) => (
        <li key={r.key}>
          <a href={r.href} className="row">
            <span className={`row-icon ${r.late ? 'late' : ''}`}>
              <Icon name={r.icon} size={16} />
            </span>
            <span className="grow">
              <b>{r.text}</b>
              <small>{r.meta}</small>
            </span>
            <Icon name="right" size={16} />
          </a>
        </li>
      ))}
      {rows.length > 10 && <li className="muted small">and {rows.length - 10} more</li>}
    </ul>
  )
}

function StaffHome({ me }) {
  const d = useDb()
  const T = today()
  const boss = me.role === 'admin' || me.role === 'manager'
  const lead = me.role === 'lead'
  const mine = d.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))
  const team = d.tasks.filter((t) => t.teamId === me.teamId && t.status !== 'done')
  const open = d.tasks.filter((t) => t.status !== 'done')
  const weekHours = d.tasks.flatMap((t) => t.time).filter((x) => x.userId === me.id && x.date >= startOfWeek(T)).reduce((s, x) => s + x.hours, 0)
  const outstanding = d.invoices.filter((i) => ['sent', 'overdue'].includes(invoiceState(i)))
  const out = onLeave(d, me.id, T)

  const kpis = boss
    ? [
        { label: 'Active projects', value: d.projects.filter((p) => ['active', 'review', 'planning'].includes(p.status)).length, href: '#/projects' },
        { label: 'Open tasks', value: open.length, note: `${open.filter((t) => t.due && t.due <= addDays(T, 7)).length} due this week`, href: '#/tasks' },
        { label: 'Overdue', value: open.filter(isOverdue).length, tone: open.some(isOverdue) ? 'late' : '', href: '#/tasks' },
        { label: 'Waiting on clients', value: d.deliverables.filter((x) => x.status === 'client').length + d.posts.filter((p) => p.status === 'ready').length, note: 'work + posts to approve' },
        can(me, 'invoices.manage') && { label: 'Outstanding', value: inr(outstanding.reduce((s, i) => s + invoiceTotals(i).total, 0)), note: `${outstanding.filter((i) => invoiceState(i) === 'overdue').length} overdue`, href: '#/invoices' },
      ]
    : lead
      ? [
          { label: 'Team open tasks', value: team.length, href: '#/tasks' },
          { label: 'Team overdue', value: team.filter(isOverdue).length, tone: team.some(isOverdue) ? 'late' : '' },
          { label: 'Unassigned in queue', value: team.filter((t) => !t.assigneeId).length, tone: team.some((t) => !t.assigneeId) ? 'warn' : '' },
          { label: 'My open tasks', value: mine.length },
          { label: 'My hours this week', value: `${weekHours}h` },
        ]
      : [
          { label: 'My open tasks', value: mine.length, href: '#/tasks' },
          { label: 'Due today', value: mine.filter((t) => t.due === T).length },
          { label: 'Overdue', value: mine.filter(isOverdue).length, tone: mine.some(isOverdue) ? 'late' : '' },
          { label: 'Hours this week', value: `${weekHours}h`, note: 'from your time logs' },
        ]

  return (
    <div className="page">
      <div className="hello">
        <h1>
          {hello()}, {me.name.split(' ')[0]}
        </h1>
        <p className="sub">
          {fmtLong(T)}
          {out ? ` · You’re marked ${LEAVE_TYPES[out.type].toLowerCase()} today` : ''}
        </p>
      </div>
      <div className="kpis">
        {kpis.filter(Boolean).map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>
      <div className="cols">
        <div className="col-main">
          {(boss || lead) && (
            <Card title="Needs your attention">
              <Attention me={me} />
            </Card>
          )}
          <Card title="My tasks" action={<a href="#/tasks">All tasks</a>}>
            {mine.length ? (
              <ul className="list">
                {mine.slice(0, 8).map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </ul>
            ) : (
              <Empty title="Nothing assigned to you">Pick something up from your team’s queue on the Tasks board.</Empty>
            )}
          </Card>
          {boss && (
            <Card title="Team workload" action={<a href="#/reports">Reports</a>}>
              <Workload />
            </Card>
          )}
          <Card title="Recent activity">
            <Activity />
          </Card>
        </div>
        <div className="col-side">
          <Card title="Today" action={<a href="#/calendar">Calendar</a>}>
            <Agenda me={me} />
          </Card>
          <Card title="Announcements" action={<a href="#/chat/ch-announce">Open</a>}>
            <Announcements />
          </Card>
          <Card title="Who’s out" action={<a href="#/people/leave">Leave</a>}>
            <WhoIsOut />
          </Card>
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
  const waiting = d.deliverables.filter((x) => x.status === 'client' && can(me, 'deliverable.decide', x))
  const posts = d.posts.filter((p) => p.clientId === me.clientId && p.status === 'ready')
  const invoices = d.invoices.filter((i) => i.clientId === me.clientId && ['sent', 'overdue'].includes(invoiceState(i)))
  const due = invoices.reduce((s, i) => s + invoiceTotals(i).total, 0)
  const meetings = occurrences(d, T, addDays(T, 30)).filter((o) => o.attendeeIds.includes(me.id))
  const teamIds = [...new Set(projects.filter((p) => p.status !== 'done').flatMap((p) => [p.managerId, ...p.memberIds]))]
  const chans = d.channels.filter((c) => c.type === 'project' && can(me, 'channel.view', c)).map((c) => c.id)
  const msgs = d.messages.filter((m) => chans.includes(m.channelId)).slice(-4).reverse()
  const manager = byId(d.users, client?.managerId)

  return (
    <div className="page">
      <div className="hello">
        <h1>
          {hello()}, {me.name.split(' ')[0]}
        </h1>
        <p className="sub">
          {client?.name} · your workspace with YG Digitals{manager ? ` · Account manager: ${manager.name}` : ''}
        </p>
      </div>
      <div className="kpis">
        <Kpi label="Active projects" value={projects.filter((p) => p.status !== 'done').length} href="#/projects" />
        <Kpi label="Waiting for your approval" value={waiting.length + posts.length} tone={waiting.length + posts.length ? 'warn' : ''} />
        <Kpi label="Meetings (next 30 days)" value={meetings.length} href="#/calendar" />
        <Kpi label="Amount due" value={inr(due)} tone={invoices.some((i) => invoiceState(i) === 'overdue') ? 'late' : ''} href="#/invoices" />
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
                    <a href="#/content" className="row">
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
                        <small>{u.title}</small>
                      </span>
                    </li>
                  )
                )
              })}
            </ul>
          </Card>
          {invoices.length > 0 && (
            <Card title="Invoices due" action={<a href="#/invoices">All</a>}>
              <ul className="list">
                {invoices.map((i) => (
                  <li key={i.id}>
                    <a href={`#/invoices/${i.id}`} className="row">
                      <span className="grow">
                        <b>{i.no}</b>
                        <small>Due {fmtDay(i.due)}</small>
                      </span>
                      <Status s={invoiceState(i)} label={inr(invoiceTotals(i).total)} />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {booking && <EventForm onClose={() => setBooking(false)} initial={{ type: 'client', title: `${client?.name} — catch-up`, attendeeIds: client?.managerId ? [client.managerId] : [] }} />}
    </div>
  )
}

export { Activity, Agenda, Workload }
