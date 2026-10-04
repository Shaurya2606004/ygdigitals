import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, EVENT_TYPES, isOverdue, occurrences, PROJECT_STATUS, progress, staff } from '../store.js'
import { Avatar, Bar, Card, Empty, Icon, isUrl, RichText, Status, useDb, useMe } from '../ui.jsx'
import { addDays, ago, fmtDay, fmtLong, fmtTime, relDay, today } from '../util.js'
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

function Attention({ me }) {
  const d = useDb()
  const admin = me.role === 'admin'
  const rows = [
    ...d.deliverables.filter((x) => x.status === 'internal' && can(me, 'deliverable.review', x)).map((x) => ({ key: x.id, icon: 'eye', text: `Check “${x.title}” v${x.version}`, meta: `${byId(d.projects, x.projectId)?.name} · from ${S.userName(d, x.submittedBy)}`, href: `#/projects/${x.projectId}/deliverables` })),
    ...d.deliverables.filter((x) => x.status === 'changes' && x.submittedBy === me.id).map((x) => ({ key: `c${x.id}`, icon: 'edit', text: `Changes asked on “${x.title}”`, meta: x.history.at(-1).note || byId(d.projects, x.projectId)?.name, href: `#/projects/${x.projectId}/deliverables` })),
    ...d.tasks.filter((t) => admin && !t.assigneeId && t.status !== 'done').map((t) => ({ key: t.id, icon: 'swap', text: `Give “${t.title}” an owner`, meta: byId(d.projects, t.projectId)?.name, href: `#/tasks/${t.id}` })),
    ...d.tasks.filter((t) => t.status === 'review' && (admin || byId(d.projects, t.projectId)?.managerId === me.id)).map((t) => ({ key: `r${t.id}`, icon: 'check', text: `Review “${t.title}”`, meta: `${S.userName(d, t.assigneeId)} moved it to Review`, href: `#/tasks/${t.id}` })),
    ...d.tasks.filter((t) => isOverdue(t) && (admin || t.assigneeId === me.id)).map((t) => ({ key: `l${t.id}`, icon: 'clock', text: `Overdue: “${t.title}”`, meta: `${t.assigneeId ? S.userName(d, t.assigneeId) : 'No owner'} · was due ${fmtDay(t.due)}`, href: `#/tasks/${t.id}`, late: true })),
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
  const admin = me.role === 'admin'
  const free = me.role === 'freelancer' // no studio-wide feeds: they only see their own projects
  const mine = d.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))
  const open = d.tasks.filter((t) => t.status !== 'done')
  const kpis = admin
    ? [
        { label: 'Active projects', value: d.projects.filter((p) => ['active', 'review', 'planning'].includes(p.status)).length, href: '#/projects' },
        { label: 'Open tasks', value: open.length, note: `${open.filter((t) => t.due && t.due <= addDays(T, 7)).length} due this week`, href: '#/tasks' },
        { label: 'Overdue', value: open.filter(isOverdue).length, tone: open.some(isOverdue) ? 'late' : '' },
        { label: 'Waiting for your check', value: d.deliverables.filter((x) => x.status === 'internal').length, tone: d.deliverables.some((x) => x.status === 'internal') ? 'warn' : '' },
        { label: 'Waiting on clients', value: d.deliverables.filter((x) => x.status === 'client').length + d.posts.filter((p) => p.status === 'ready').length, note: 'work + posts to approve' },
      ]
    : [
        { label: 'My open tasks', value: mine.length, href: '#/tasks' },
        { label: 'Due today', value: mine.filter((t) => t.due === T).length },
        { label: 'Overdue', value: mine.filter(isOverdue).length, tone: mine.some(isOverdue) ? 'late' : '' },
      ]

  return (
    <div className="page">
      <div className="hello">
        <h1>
          {hello()}, {me.name.split(' ')[0]}
        </h1>
        <p className="sub">{fmtLong(T)}</p>
      </div>
      <div className="kpis">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>
      <div className="cols">
        <div className="col-main">
          <Card title="Needs your attention">
            <Attention me={me} />
          </Card>
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
          {!free && (
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
