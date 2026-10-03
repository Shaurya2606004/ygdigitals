import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, isOverdue, LEAVE_TYPES, occurrences, presence, ROLES, staff } from '../store.js'
import { Avatar, Card, Empty, Err, Field, go, Icon, Modal, PageHead, PRESENCE, Status, Tabs, TeamTag, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, daysBetween, fmtDay, fmtTime, relDay, startOfWeek, today } from '../util.js'
import { EventForm } from './Calendar.jsx'
import { TaskRow } from './Tasks.jsx'

export default function People({ args }) {
  const me = useMe()
  const d = useDb()
  const tab = args[0] || 'directory'
  if (!['directory', 'teams', 'leave'].includes(tab)) return <Person id={tab} />
  return (
    <div className="page">
      <PageHead title="People & teams" sub="Who does what at YG Digitals, who’s around today, and who’s on leave." />
      <Tabs
        label="People sections"
        value={tab}
        onChange={(t) => go(`#/people${t === 'directory' ? '' : `/${t}`}`)}
        tabs={[
          ['directory', 'Directory'],
          ['teams', 'Teams'],
          ['leave', 'Leave', d.leaves.filter((l) => l.status === 'pending' && can(me, 'leave.decide', l)).length],
        ]}
      />
      <div className="tab-body">
        {tab === 'directory' && <Directory />}
        {tab === 'teams' && <Teams />}
        {tab === 'leave' && <Leave />}
      </div>
    </div>
  )
}

const dm = (me, id) => go(`#/chat/${S.openDm(me, id)}`)

function Directory() {
  const me = useMe()
  const d = useDb()
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('')
  const [role, setRole] = useState('')
  const [showOff, setShowOff] = useState(false)
  const [adding, setAdding] = useState(false)
  const s = q.trim().toLowerCase()
  const people = d.users.filter(
    (u) =>
      u.role !== 'client' &&
      (showOff || u.active) &&
      (!team || u.teamId === team) &&
      (!role || u.role === role) &&
      (!s || `${u.name} ${u.title} ${u.skills.join(' ')}`.toLowerCase().includes(s)),
  )
  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <input type="search" placeholder="Name, title or skill" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {d.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {Object.entries(ROLES)
              .filter(([k]) => k !== 'client')
              .map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
          </select>
          {can(me, 'people.manage') && (
            <label className="check">
              <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Show deactivated
            </label>
          )}
        </div>
        {can(me, 'people.manage') && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add person
          </button>
        )}
      </div>
      <div className="people-grid">
        {people.map((u) => {
          const p = presence(d, u)
          return (
            <article key={u.id} className={`card person-card ${u.active ? '' : 'off'}`}>
              <a href={`#/people/${u.id}`} className="person-top">
                <Avatar user={u} size={44} dot />
                <span>
                  <b>{u.name}</b>
                  <small>{u.title}</small>
                </span>
              </a>
              <span className="tags">
                <TeamTag team={byId(d.teams, u.teamId)} />
                <span className="pill grey">{ROLES[u.role].label}</span>
                {!u.active && <span className="pill red">Deactivated</span>}
              </span>
              <span className={`presence ${p}`}>{PRESENCE[p]}</span>
              <span className="person-actions">
                <a href={`mailto:${u.email}`} className="icon-btn" aria-label={`Email ${u.name}`} title={u.email}>
                  <Icon name="mail" size={16} />
                </a>
                {u.phone && (
                  <a href={`tel:${u.phone.replace(/\s/g, '')}`} className="icon-btn" aria-label={`Call ${u.name}`} title={u.phone}>
                    <Icon name="phone" size={16} />
                  </a>
                )}
                {u.id !== me.id && u.active && (
                  <button className="btn sm" onClick={() => dm(me, u.id)}>
                    <Icon name="chat" size={14} /> Message
                  </button>
                )}
              </span>
            </article>
          )
        })}
      </div>
      {!people.length && <Empty icon="users" title="Nobody matches" />}
      {adding && <PersonForm onClose={() => setAdding(false)} />}
    </>
  )
}

function Person({ id }) {
  const me = useMe()
  const d = useDb()
  const [editing, setEditing] = useState(false)
  const [meeting, setMeeting] = useState(false)
  const [err, setErr] = useState('')
  const u = byId(d.users, id)
  if (!u || u.role === 'client') return <div className="page"><Empty icon="users" title="Person not found" /></div>
  const T = today()
  const tasks = d.tasks.filter((t) => t.assigneeId === id && t.status !== 'done').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))
  const meetings = occurrences(d, T, addDays(T, 7)).filter((o) => o.attendeeIds.includes(id) && o.rsvp?.[id] !== 'no')
  const projects = d.projects.filter((p) => p.status !== 'done' && (p.managerId === id || p.memberIds.includes(id)))
  const week = d.tasks.flatMap((t) => t.time).filter((x) => x.userId === id && x.date >= startOfWeek(T)).reduce((s, x) => s + x.hours, 0)
  const leave = d.leaves.filter((l) => l.userId === id && l.to >= T && l.status !== 'declined')
  const p = presence(d, u)
  return (
    <div className="page">
      <a href="#/people" className="back">
        <Icon name="left" size={16} /> People
      </a>
      <div className="profile-head card">
        <Avatar user={u} size={72} dot />
        <div className="grow">
          <h1>{u.name}</h1>
          <p className="sub">{u.title}</p>
          <span className="tags">
            <TeamTag team={byId(d.teams, u.teamId)} />
            <span className="pill grey">{ROLES[u.role].label}</span>
            <span className={`presence ${p}`}>{PRESENCE[p]}</span>
            {!u.active && <span className="pill red">Deactivated</span>}
          </span>
        </div>
        <div className="actions">
          {u.id !== me.id && u.active && (
            <>
              <button className="btn" onClick={() => dm(me, u.id)}>
                <Icon name="chat" size={16} /> Message
              </button>
              <button className="btn" onClick={() => setMeeting(true)}>
                <Icon name="calendar" size={16} /> Meet
              </button>
            </>
          )}
          {can(me, 'people.manage', u) && (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} /> Edit
              </button>
              {u.id !== me.id && (
                <button
                  className={`btn ${u.active ? 'danger' : ''}`}
                  onClick={() => {
                    if (!u.active || confirm(`Deactivate ${u.name}? They can’t sign in any more; their tasks stay assigned so you can reassign them.`))
                      try {
                        S.setActive(me, u.id, !u.active)
                      } catch (x) {
                        setErr(x.message)
                      }
                  }}
                >
                  {u.active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <Err msg={err} />
      <div className="cols">
        <div className="col-main">
          <Card title={`Open tasks (${tasks.length})`}>
            {tasks.length ? (
              <ul className="list">
                {tasks.map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </ul>
            ) : (
              <Empty title="No open tasks" />
            )}
          </Card>
          <Card title="Next 7 days">
            {meetings.length ? (
              <ul className="list">
                {meetings.map((o) => (
                  <li key={o.id + o.date} className="row">
                    <span className="time">
                      <small>{relDay(o.date)}</small>
                      {fmtTime(o.start)}
                    </span>
                    <span className={`type-bar t-${o.type}`} aria-hidden="true" />
                    <span className="grow">
                      <b>{o.title}</b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="calendar" title="No meetings booked" />
            )}
          </Card>
        </div>
        <div className="col-side">
          <Card title="About">
            <dl className="props">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${u.email}`}>{u.email}</a>
              </dd>
              <dt>Phone</dt>
              <dd>{u.phone ? <a href={`tel:${u.phone.replace(/\s/g, '')}`}>{u.phone}</a> : '—'}</dd>
              <dt>Joined</dt>
              <dd>{fmtDay(u.joined)}</dd>
              <dt>This week</dt>
              <dd>
                {week}h logged · {tasks.filter(isOverdue).length} overdue
              </dd>
            </dl>
            {u.about && <p className="prewrap">{u.about}</p>}
            {u.skills.length > 0 && (
              <p className="tags">
                {u.skills.map((s) => (
                  <span key={s} className="pill grey">
                    {s}
                  </span>
                ))}
              </p>
            )}
          </Card>
          <Card title="Projects">
            <ul className="list">
              {projects.map((pr) => (
                <li key={pr.id}>
                  <a href={`#/projects/${pr.id}`} className="row">
                    <span className="grow">
                      <b>{pr.name}</b>
                      <small>{pr.managerId === id ? 'Managing' : byId(d.clients, pr.clientId)?.name}</small>
                    </span>
                  </a>
                </li>
              ))}
              {!projects.length && <li className="muted small">Not on any open project.</li>}
            </ul>
          </Card>
          {leave.length > 0 && (
            <Card title="Upcoming leave">
              <ul className="list">
                {leave.map((l) => (
                  <li key={l.id} className="row">
                    <span className="grow">
                      <b>{LEAVE_TYPES[l.type]}</b>
                      <small>
                        {fmtDay(l.from)}
                        {l.to !== l.from && ` – ${fmtDay(l.to)}`}
                      </small>
                    </span>
                    <Status s={l.status} label={l.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {editing && <PersonForm edit={u} onClose={() => setEditing(false)} />}
      {meeting && <EventForm onClose={() => setMeeting(false)} initial={{ attendeeIds: [u.id], title: `${me.name.split(' ')[0]} / ${u.name.split(' ')[0]}` }} />}
    </div>
  )
}

function Teams() {
  const me = useMe()
  const d = useDb()
  const [form, setForm] = useState(null)
  return (
    <>
      <div className="toolbar">
        <p className="muted">Each team has a lead who assigns and signs off its work, a shared queue, and its own channel.</p>
        {can(me, 'org.settings') && (
          <button className="btn primary" onClick={() => setForm({})}>
            <Icon name="plus" /> New team
          </button>
        )}
      </div>
      <div className="team-grid">
        {d.teams.map((t) => {
          const people = staff(d).filter((u) => u.teamId === t.id)
          const leads = people.filter((u) => ['lead', 'admin', 'manager'].includes(u.role))
          const open = d.tasks.filter((x) => x.teamId === t.id && x.status !== 'done')
          const projects = d.projects.filter((p) => p.status !== 'done' && p.teamIds.includes(t.id)).length
          return (
            <article key={t.id} className="card team-card" style={{ '--c': t.color }}>
              <header>
                <h3>{t.name}</h3>
                {can(me, 'org.settings') && (
                  <button className="icon-btn sm" aria-label={`Edit ${t.name}`} onClick={() => setForm(t)}>
                    <Icon name="edit" size={15} />
                  </button>
                )}
              </header>
              <p className="muted small">{t.desc}</p>
              <p className="team-stats">
                <span>
                  <b>{people.length}</b> people
                </span>
                <span>
                  <b>{open.length}</b> open tasks
                </span>
                {open.some(isOverdue) && (
                  <span className="late">
                    <b>{open.filter(isOverdue).length}</b> late
                  </span>
                )}
                <span>
                  <b>{projects}</b> projects
                </span>
              </p>
              <ul className="list">
                {[...leads, ...people.filter((u) => !leads.includes(u))].map((u) => (
                  <li key={u.id}>
                    <a href={`#/people/${u.id}`} className="row">
                      <Avatar user={u} size={28} dot />
                      <span className="grow">
                        <b>{u.name}</b>
                        <small>{u.title}</small>
                      </span>
                      {leads.includes(u) && <span className="pill grey">{u.role === 'lead' ? 'Lead' : ROLES[u.role].label}</span>}
                    </a>
                  </li>
                ))}
                {!people.length && <li className="muted small">No one in this team yet.</li>}
              </ul>
              {can(me, 'channel.view', byId(d.channels, `ch-${t.id}`) || {}) && (
                <a className="btn sm ghost" href={`#/chat/ch-${t.id}`}>
                  <Icon name="hash" size={14} /> Team channel
                </a>
              )}
            </article>
          )
        })}
      </div>
      {form && <TeamForm edit={form.id ? form : null} onClose={() => setForm(null)} />}
    </>
  )
}

function TeamForm({ edit, onClose }) {
  const me = useMe()
  const { v, set, err, run } = useForm(edit || { name: '', desc: '', color: '#e04c5c' })
  return (
    <Modal title={edit ? `Edit ${edit.name}` : 'New team'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.saveTeam(me, v))) onClose()
        }}
      >
        <Field label="Name">
          <input data-autofocus value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Colour">
          <input type="color" value={v.color} onChange={set('color')} />
        </Field>
        <Field label="What this team does" full>
          <textarea rows={3} value={v.desc} onChange={set('desc')} />
        </Field>
        <p className="full muted small">To make someone the lead, edit their profile and set their role to Team lead.</p>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save team</button>
        </div>
      </form>
    </Modal>
  )
}

export function PersonForm({ onClose, edit, clientId }) {
  const me = useMe()
  const d = useDb()
  const { v, set, setV, err, run } = useForm(
    edit
      ? { ...edit, skills: edit.skills.join(', ') }
      : { name: '', email: '', role: clientId ? 'client' : 'member', teamId: d.teams[1]?.id ?? '', clientId: clientId || '', title: '', phone: '', skills: '' },
  )
  const roles = Object.entries(ROLES).filter(([k]) => (k !== 'admin' || me.role === 'admin') && (clientId ? k === 'client' : true))
  const submit = (e) => {
    e.preventDefault()
    const ok = run(() =>
      S.savePerson(me, {
        ...v,
        skills: v.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    )
    if (ok) onClose()
  }
  return (
    <Modal title={edit ? `Edit ${edit.name}` : clientId ? 'Give the client a login' : 'Add a person'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Full name">
          <input data-autofocus value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Email (their login)">
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Role" hint={ROLES[v.role]?.blurb}>
          <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} disabled={edit?.id === me.id || !!clientId}>
            {roles.map(([k, r]) => (
              <option key={k} value={k}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        {v.role === 'client' ? (
          <Field label="Client">
            <select value={v.clientId || ''} onChange={set('clientId')} disabled={!!clientId}>
              <option value="">Pick…</option>
              {d.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Team">
            <select value={v.teamId || ''} onChange={set('teamId')}>
              <option value="">Pick…</option>
              {d.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Job title">
          <input value={v.title} onChange={set('title')} placeholder={v.role === 'client' ? 'e.g. Marketing Head' : 'e.g. Video Editor — Reels'} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={v.phone} onChange={set('phone')} placeholder="+91 …" />
        </Field>
        {v.role !== 'client' && (
          <Field label="Skills" hint="Comma separated — they show up in search." full>
            <input value={v.skills} onChange={set('skills')} placeholder="Premiere Pro, Colour, Sound" />
          </Field>
        )}
        {!edit && <p className="full muted small">Demo mode: new logins use the demo password. With Supabase connected they get an email invite to set their own.</p>}
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{edit ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Leave() {
  const me = useMe()
  const d = useDb()
  const [asking, setAsking] = useState(false)
  const [err, setErr] = useState('')
  const T = today()
  const run = (fn) => {
    try {
      fn()
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  const mine = d.leaves.filter((l) => l.userId === me.id).sort((a, b) => b.from.localeCompare(a.from))
  const toDecide = d.leaves.filter((l) => l.status === 'pending' && can(me, 'leave.decide', l))
  const upcoming = d.leaves.filter((l) => l.status === 'approved' && l.to >= T).sort((a, b) => a.from.localeCompare(b.from))
  const span = (l) => `${fmtDay(l.from)}${l.to !== l.from ? ` – ${fmtDay(l.to)}` : ''} · ${daysBetween(l.from, l.to) + 1} day${l.to !== l.from ? 's' : ''}`
  return (
    <>
      <div className="toolbar">
        <p className="muted">Leads approve their own team; leadership can approve anyone. Approved leave shows on the calendar and blocks meeting invites.</p>
        <button className="btn primary" onClick={() => setAsking(true)}>
          <Icon name="plus" /> Request leave
        </button>
      </div>
      <Err msg={err} />
      <div className="cols">
        <div className="col-main">
          {toDecide.length > 0 && (
            <Card title="Waiting for your decision">
              <ul className="list">
                {toDecide.map((l) => (
                  <li key={l.id} className="row">
                    <Avatar user={byId(d.users, l.userId)} size={30} />
                    <span className="grow">
                      <b>
                        {S.userName(d, l.userId)} — {LEAVE_TYPES[l.type]}
                      </b>
                      <small>
                        {span(l)} · “{l.reason}”
                      </small>
                    </span>
                    <button className="btn sm" onClick={() => run(() => S.decideLeave(me, l.id, false))}>
                      Decline
                    </button>
                    <button className="btn sm primary" onClick={() => run(() => S.decideLeave(me, l.id, true))}>
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="My requests">
            {mine.length ? (
              <ul className="list">
                {mine.map((l) => (
                  <li key={l.id} className="row">
                    <span className="grow">
                      <b>{LEAVE_TYPES[l.type]}</b>
                      <small>
                        {span(l)}
                        {l.decidedBy && ` · ${l.status} by ${S.userName(d, l.decidedBy)}`}
                      </small>
                    </span>
                    <Status s={l.status} label={l.status[0].toUpperCase() + l.status.slice(1)} />
                    {l.status === 'pending' && (
                      <button className="btn sm ghost" onClick={() => run(() => S.cancelLeave(me, l.id))}>
                        Withdraw
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="sun" title="No leave requests yet" />
            )}
          </Card>
        </div>
        <div className="col-side">
          <Card title="Who’s away">
            {upcoming.length ? (
              <ul className="list">
                {upcoming.map((l) => (
                  <li key={l.id} className="row">
                    <Avatar user={byId(d.users, l.userId)} size={28} />
                    <span className="grow">
                      <b>{S.userName(d, l.userId)}</b>
                      <small>
                        {LEAVE_TYPES[l.type]} · {l.from <= T ? `till ${fmtDay(l.to)}` : relDay(l.from)}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="sun" title="Nobody is away" />
            )}
          </Card>
        </div>
      </div>
      {asking && <LeaveForm onClose={() => setAsking(false)} />}
    </>
  )
}

export function LeaveForm({ onClose }) {
  const me = useMe()
  const d = useDb()
  const { v, set, err, run } = useForm({ type: 'casual', from: addDays(today(), 1), to: addDays(today(), 1), reason: '' })
  // who else from the same team is already away then — so people can see the crunch before asking
  const overlap = d.leaves.filter((l) => l.userId !== me.id && l.status !== 'declined' && l.from <= v.to && v.from <= l.to && byId(d.users, l.userId)?.teamId === me.teamId)
  return (
    <Modal title="Request leave" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.requestLeave(me, v))) onClose()
        }}
      >
        <Field label="Type" full>
          <select value={v.type} onChange={set('type')}>
            {Object.entries(LEAVE_TYPES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={v.from} onChange={set('from')} />
        </Field>
        <Field label="To">
          <input type="date" value={v.to} min={v.from} onChange={set('to')} />
        </Field>
        <Field label="Reason" full>
          <input value={v.reason} onChange={set('reason')} placeholder="Short and simple is fine" />
        </Field>
        {overlap.length > 0 && (
          <div className="warn-box full" role="status">
            Also away from your team then:{' '}
            {overlap.map((l) => `${S.userName(d, l.userId)} (${fmtDay(l.from)}${l.to !== l.from ? `–${fmtDay(l.to)}` : ''}, ${l.status})`).join(', ')}
          </div>
        )}
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Send request</button>
        </div>
      </form>
    </Modal>
  )
}
