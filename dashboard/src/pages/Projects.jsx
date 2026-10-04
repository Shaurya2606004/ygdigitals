import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, DELIV_STATUS, DELIV_TYPES, isOverdue, isStaff, occurrences, PRIORITY, PROJECT_STATUS, progress, projectTasks, staff } from '../store.js'
import { Avatar, Avatars, Bar, Card, Empty, Err, Field, Icon, Modal, PageHead, PeopleOptions, PeoplePicker, Status, Tabs, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, ago, fmtDay, fmtTime, relDay, today } from '../util.js'
import { EventForm } from './Calendar.jsx'
import { ChatPane } from './Chat.jsx'
import { Activity } from './Home.jsx'
import { Board, TaskForm } from './Tasks.jsx'

const OPEN = ['planning', 'active', 'review']

export default function Projects({ args }) {
  return args[0] ? <ProjectPage id={args[0]} tab={args[1] || 'overview'} /> : <ProjectList />
}

function ProjectList() {
  const me = useMe()
  const d = useDb()
  const [tab, setTab] = useState('open')
  const [f, setF] = useState({ client: '', q: '' })
  const [adding, setAdding] = useState(false)
  const staffer = isStaff(me)
  const visible = d.projects.filter((p) => can(me, 'project.view', p))
  const q = f.q.trim().toLowerCase()
  const list = visible.filter((p) => (tab === 'all' || (tab === 'open' ? OPEN.includes(p.status) : p.status === tab)) && (!f.client || p.clientId === f.client) && (!q || p.name.toLowerCase().includes(q)))
  const count = (s) => visible.filter((p) => (s === 'open' ? OPEN.includes(p.status) : p.status === s)).length
  return (
    <div className="page">
      <PageHead title="Projects" sub={staffer ? 'Every client project, who’s on it and how far along it is.' : 'Everything YG Digitals is doing for you.'}>
        {can(me, 'project.create') && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> New project
          </button>
        )}
      </PageHead>
      <div className="toolbar">
        <Tabs
          label="Project status"
          value={tab}
          onChange={setTab}
          tabs={[
            ['open', 'Open', count('open')],
            ['hold', 'On hold', count('hold')],
            ['done', 'Delivered', count('done')],
            ['all', 'All'],
          ]}
        />
        {staffer && (
          <div className="filters">
            <input type="search" placeholder="Filter by name" aria-label="Filter projects" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <select aria-label="Client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}>
              <option value="">All clients</option>
              {d.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {list.length ? (
        <div className="project-grid">
          {list.map((p) => {
            const ts = projectTasks(d, p.id)
            const late = ts.filter(isOverdue).length
            const waiting = d.deliverables.filter((x) => x.projectId === p.id && (x.status === 'client' || (staffer && x.status === 'internal'))).length
            return (
              <a key={p.id} href={`#/projects/${p.id}`} className="card project-card">
                <span className="pc-top">
                  <Status s={p.status} label={PROJECT_STATUS[p.status]} />
                  {p.priority !== 'normal' && <Status s={p.priority} label={PRIORITY[p.priority]} />}
                  <span className="grow" />
                  {p.due && <span className={`due ${p.status !== 'done' && p.due < today() ? 'late' : ''}`}>{p.status === 'done' ? `Delivered ${fmtDay(p.due)}` : relDay(p.due)}</span>}
                </span>
                <h3>{p.name}</h3>
                <p className="muted">{byId(d.clients, p.clientId)?.name}</p>
                <span className="prog">
                  <Bar pct={progress(d, p.id)} label={`${p.name} progress`} />
                  <small>{progress(d, p.id)}%</small>
                </span>
                <span className="pc-foot">
                  <Avatars ids={[p.managerId, ...p.memberIds]} max={5} size={24} />
                  <span className="grow" />
                  <small className="muted">{ts.filter((t) => t.status !== 'done').length} open</small>
                  {late > 0 && <small className="late">{late} late</small>}
                  {waiting > 0 && <small className="pill amber">{waiting} to approve</small>}
                </span>
              </a>
            )
          })}
        </div>
      ) : (
        <Empty icon="folder" title="No projects here" />
      )}
      {adding && <ProjectForm onClose={() => setAdding(false)} />}
    </div>
  )
}

function ProjectPage({ id, tab }) {
  const me = useMe()
  const d = useDb()
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const p = byId(d.projects, id)
  if (!p || !can(me, 'project.view', p))
    return (
      <div className="page">
        <Empty icon="lock" title="Project not found">
          Either it doesn’t exist or you don’t have access.
        </Empty>
      </div>
    )
  const staffer = isStaff(me)
  if (!staffer && tab === 'tasks') tab = 'plan' // clients get the read-only plan instead of the board
  const editable = can(me, 'project.edit', p)
  const delivs = d.deliverables.filter((x) => x.projectId === id && can(me, 'deliverable.view', x))
  const tabs = [
    ['overview', 'Overview'],
    staffer ? ['tasks', 'Tasks', projectTasks(d, id).filter((t) => t.status !== 'done').length] : ['plan', 'Plan'],
    ['deliverables', 'Approvals', delivs.filter((x) => (staffer ? ['internal', 'client'] : ['client']).includes(x.status)).length],
    ['discussion', 'Discussion'],
    ['meetings', 'Meetings'],
  ]
  return (
    <div className="page">
      <a href="#/projects" className="back">
        <Icon name="left" size={16} /> Projects
      </a>
      <PageHead
        title={p.name}
        sub={`${byId(d.clients, p.clientId)?.name} · ${p.start ? `${fmtDay(p.start)} → ` : ''}${fmtDay(p.due)} · Lead: ${S.userName(d, p.managerId)}`}
      >
        {editable ? (
          <select
            className="status-select"
            aria-label="Project status"
            value={p.status}
            onChange={(e) => {
              try {
                S.saveProject(me, { ...p, status: e.target.value })
                setErr('')
              } catch (x) {
                setErr(x.message)
              }
            }}
          >
            {Object.entries(PROJECT_STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        ) : (
          <Status s={p.status} label={PROJECT_STATUS[p.status]} />
        )}
        {editable && (
          <button className="btn" onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} /> Edit
          </button>
        )}
      </PageHead>
      <Err msg={err} />
      <Tabs label="Project sections" value={tab} onChange={(t) => (location.hash = `#/projects/${id}/${t}`)} tabs={tabs} />
      <div className="tab-body">
        {tab === 'overview' && <Overview p={p} />}
        {tab === 'tasks' && staffer && <ProjectTasks p={p} />}
        {tab === 'plan' && <Plan tasks={projectTasks(d, id)} />}
        {tab === 'deliverables' && <Deliverables p={p} />}
        {tab === 'discussion' && (
          <div className="card flush">
            <ChatPane channelId={`ch-${id}`} />
          </div>
        )}
        {tab === 'meetings' && <ProjectMeetings p={p} />}
      </div>
      {editing && <ProjectForm edit={p} onClose={() => setEditing(false)} />}
    </div>
  )
}

function Overview({ p }) {
  const me = useMe()
  const d = useDb()
  const staffer = isStaff(me)
  const ts = projectTasks(d, p.id)
  const taskIds = new Set(ts.map((t) => t.id))
  const mine = (a) => a.link?.includes(`/projects/${p.id}`) || taskIds.has(a.link?.split('/').pop())
  return (
    <div className="cols">
      <div className="col-main">
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">Progress</span>
            <span className="kpi-value">{progress(d, p.id)}%</span>
            <span className="kpi-note">
              {ts.filter((t) => t.status === 'done').length} of {ts.length} tasks done
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Overdue tasks</span>
            <span className={`kpi-value ${ts.some(isOverdue) ? 'late' : ''}`}>{ts.filter(isOverdue).length}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Due</span>
            <span className="kpi-value">{p.status === 'done' ? 'Done' : relDay(p.due)}</span>
          </div>
        </div>
        <Card title="Brief">
          <p className="prewrap">{p.brief || <span className="muted">No brief yet.</span>}</p>
        </Card>
        {staffer && (
          <Card title="Activity">
            <Activity filter={mine} limit={10} />
          </Card>
        )}
      </div>
      <div className="col-side">
        <Card title="People">
          <ul className="list">
            {[p.managerId, ...p.memberIds.filter((x) => x !== p.managerId)].map((uid) => {
              const u = byId(d.users, uid)
              return (
                u && (
                  <li key={uid} className="row">
                    <Avatar user={u} size={30} />
                    <span className="grow">
                      <b>{u.name}</b>
                      <small>{uid === p.managerId ? `Project lead · ${u.title}` : u.title}</small>
                    </span>
                  </li>
                )
              )
            })}
          </ul>
        </Card>
        {staffer && (
          <Card title="Client logins">
            <ul className="list">
              {S.clientUsers(d, p.clientId).map((u) => (
                <li key={u.id} className="row">
                  <Avatar user={u} size={30} />
                  <span className="grow">
                    <b>{u.name}</b>
                    <small>{u.title}</small>
                  </span>
                </li>
              ))}
              {!S.clientUsers(d, p.clientId).length && <li className="muted small">No client login yet — add one in Settings › Clients.</li>}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

// the client's read-only view of what's planned: no comments, no internal detail
const PLAN_GROUPS = [
  ['doing', 'In progress'],
  ['review', 'Being checked'],
  ['todo', 'Coming up'],
  ['done', 'Done'],
]
function Plan({ tasks }) {
  const d = useDb()
  if (!tasks.length) return <Empty icon="check" title="Nothing planned yet" />
  return (
    <div className="plan">
      {PLAN_GROUPS.map(([s, label]) => {
        const list = tasks.filter((t) => t.status === s).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))
        return (
          list.length > 0 && (
            <Card key={s} title={`${label} (${list.length})`}>
              <ul className="list">
                {list.map((t) => (
                  <li key={t.id} className="row">
                    <span className="grow">
                      <b>{t.title}</b>
                      {t.assigneeId && <small>{S.userName(d, t.assigneeId)}</small>}
                    </span>
                    {t.due && <span className={`due ${isOverdue(t) ? 'late' : ''}`}>{s === 'done' ? fmtDay(t.completedAt || t.due) : relDay(t.due)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )
        )
      })}
    </div>
  )
}

function ProjectTasks({ p }) {
  const me = useMe()
  const d = useDb()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <div className="toolbar">
        <p className="muted">Drag cards between columns. The client sees these titles, owners and dates (not comments) in their Plan tab.</p>
        {can(me, 'task.edit') && p.status !== 'done' && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add task
          </button>
        )}
      </div>
      <Board tasks={projectTasks(d, p.id)} />
      {adding && <TaskForm onClose={() => setAdding(false)} initial={{ projectId: p.id }} />}
    </>
  )
}

function ProjectMeetings({ p }) {
  const me = useMe()
  const d = useDb()
  const [adding, setAdding] = useState(false)
  const T = today()
  const all = occurrences(d, addDays(T, -60), addDays(T, 60)).filter((o) => o.projectId === p.id && can(me, 'event.view', o))
  const upcoming = all.filter((o) => o.date >= T)
  const past = all.filter((o) => o.date < T).reverse()
  const row = (o) => (
    <li key={o.id + o.date} className="row">
      <span className="time">
        <small>{relDay(o.date)}</small>
        {fmtTime(o.start)}
      </span>
      <span className={`type-bar t-${o.type}`} aria-hidden="true" />
      <span className="grow">
        <b>{o.title}</b>
        <small>{o.location}</small>
      </span>
      <Avatars ids={o.attendeeIds} max={4} size={22} />
    </li>
  )
  return (
    <div className="cols">
      <div className="col-main">
        <Card
          title="Upcoming"
          action={
            <button className="btn sm primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} /> Schedule
            </button>
          }
        >
          {upcoming.length ? <ul className="list">{upcoming.map(row)}</ul> : <Empty icon="calendar" title="Nothing scheduled" />}
        </Card>
        {past.length > 0 && (
          <Card title="Past">
            <ul className="list">{past.map(row)}</ul>
          </Card>
        )}
      </div>
      {adding && <EventForm onClose={() => setAdding(false)} initial={{ projectId: p.id, title: `${p.name} — `, type: isStaff(me) ? 'meeting' : 'client', attendeeIds: [p.managerId] }} />}
    </div>
  )
}

/* ---------- approvals ---------- */

function Deliverables({ p }) {
  const me = useMe()
  const d = useDb()
  const [submitting, setSubmitting] = useState(null) // {} new, {id} new version
  const [acting, setActing] = useState(null) // {x, kind}
  const list = d.deliverables.filter((x) => x.projectId === p.id && can(me, 'deliverable.view', x)).reverse()
  const staffer = isStaff(me)
  return (
    <>
      <div className="toolbar">
        <p className="muted">{staffer ? 'Work goes: submitted → Admin checks and sends it to the client → client approves or asks for changes.' : 'Open each file, then approve it or tell the team what to change.'}</p>
        {can(me, 'deliverable.submit') && (
          <button className="btn primary" onClick={() => setSubmitting({})}>
            <Icon name="plus" /> Submit work
          </button>
        )}
      </div>
      {!list.length && <Empty icon="eye" title="Nothing here yet">{staffer ? 'Submit the first file for a check.' : 'When the team sends you work it shows up here.'}</Empty>}
      <div className="deliv-list">
        {list.map((x) => {
          const reviewer = x.status === 'internal' && can(me, 'deliverable.review', x)
          const decider = x.status === 'client' && can(me, 'deliverable.decide', x)
          return (
            <article key={x.id} className={`card deliv ${x.status}`}>
              <header className="deliv-head">
                <span className="grow">
                  <h3>
                    {x.title} <span className="muted">v{x.version}</span>
                  </h3>
                  <small className="muted">
                    {x.type} · by {S.userName(d, x.submittedBy)} · {ago(x.history.at(-1).at)}
                  </small>
                </span>
                <Status s={x.status} label={me.role === 'client' && x.status === 'client' ? 'Waiting for you' : DELIV_STATUS[x.status]} />
              </header>
              <div className="deliv-actions">
                <a className="btn sm" href={x.link} target="_blank" rel="noreferrer">
                  <Icon name="link" size={14} /> Open file
                </a>
                {reviewer && (
                  <>
                    <button className="btn sm primary" onClick={() => setActing({ x, kind: 'send' })}>
                      Looks good — send to client
                    </button>
                    <button className="btn sm" onClick={() => setActing({ x, kind: 'rework' })}>
                      Needs changes
                    </button>
                  </>
                )}
                {decider && (
                  <>
                    <button className="btn sm primary" onClick={() => setActing({ x, kind: 'approve' })}>
                      {me.role === 'client' ? 'Approve' : 'Mark approved for client'}
                    </button>
                    <button className="btn sm" onClick={() => setActing({ x, kind: 'changes' })}>
                      Request changes
                    </button>
                  </>
                )}
                {x.status === 'changes' && staffer && (
                  <button className="btn sm primary" onClick={() => setSubmitting({ id: x.id, title: x.title })}>
                    Upload v{x.version + 1}
                  </button>
                )}
              </div>
              <details className="history">
                <summary>History ({x.history.length})</summary>
                <ol>
                  {x.history.map((h, i) => (
                    <li key={i}>
                      <Avatar user={byId(d.users, h.userId)} size={22} />
                      <span>
                        <b>{S.userName(d, h.userId)}</b> {h.action} <small className="muted">{ago(h.at)}</small>
                        {h.note && <q className="block">{h.note}</q>}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          )
        })}
      </div>
      {submitting && <SubmitForm p={p} again={submitting} onClose={() => setSubmitting(null)} />}
      {acting && <DecisionForm {...acting} onClose={() => setActing(null)} />}
    </>
  )
}

function SubmitForm({ p, again, onClose }) {
  const me = useMe()
  const { v, set, err, run } = useForm({ title: '', type: DELIV_TYPES[0], link: '', note: '' })
  return (
    <Modal title={again.id ? `New version of “${again.title}”` : 'Submit work for a check'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.submitDeliverable(me, { ...v, id: again.id, projectId: p.id }))) onClose()
        }}
      >
        {!again.id && (
          <>
            <Field label="What is it?" full>
              <input data-autofocus value={v.title} onChange={set('title')} placeholder="e.g. Reel 1 — Ghar ki Mithaas (30s)" />
            </Field>
            <Field label="Type">
              <select value={v.type} onChange={set('type')}>
                {DELIV_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label="Link to the file" hint="Google Drive, Frame.io, Figma, a staging site… anyone with the link must be able to view it." full>
          <input type="url" value={v.link} onChange={set('link')} placeholder="https://drive.google.com/…" data-autofocus={again.id ? '' : undefined} />
        </Field>
        <Field label="Note" full>
          <textarea rows={3} value={v.note} onChange={set('note')} placeholder={again.id ? 'What changed in this version?' : 'Anything to look at closely?'} />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Submit</button>
        </div>
      </form>
    </Modal>
  )
}

const DECISIONS = {
  send: ['Send to client', 'Optional note for the client', true],
  rework: ['Send back for changes', 'What needs to change before the client sees it?', false],
  approve: ['Approve', 'Optional — anything to add?', true],
  changes: ['Request changes', 'What should the team change?', false],
}
function DecisionForm({ x, kind, onClose }) {
  const me = useMe()
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [title, placeholder, ok] = DECISIONS[kind]
  const submit = (e) => {
    e.preventDefault()
    try {
      if (kind === 'send' || kind === 'rework') S.reviewDeliverable(me, x.id, ok, note.trim())
      else S.decideDeliverable(me, x.id, ok, note.trim())
      onClose()
    } catch (er) {
      setErr(er.message)
    }
  }
  return (
    <Modal title={`${title}: “${x.title}” v${x.version}`} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Note" full>
          <textarea data-autofocus rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${ok ? 'primary' : 'danger'}`}>{title}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- create / edit ---------- */

export function ProjectForm({ onClose, edit, initial = {} }) {
  const me = useMe()
  const d = useDb()
  const { v, set, setV, err, run } = useForm(edit || { name: '', clientId: d.clients[0]?.id ?? '', managerId: me.id, memberIds: [], status: 'planning', priority: 'normal', start: today(), due: addDays(today(), 30), brief: '', ...initial })
  const submit = (e) => {
    e.preventDefault()
    const ok = run(() => {
      const id = S.saveProject(me, v)
      if (!edit) location.hash = `#/projects/${id}`
    })
    if (ok) onClose()
  }
  return (
    <Modal title={edit ? 'Edit project' : 'New project'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <Field label="Project name" full>
          <input data-autofocus value={v.name} onChange={set('name')} placeholder="e.g. Holi Campaign 2027" />
        </Field>
        <Field label="Client">
          <select value={v.clientId} onChange={set('clientId')}>
            {d.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project lead" hint="The client’s point of contact. They can edit this project.">
          <select value={v.managerId || ''} onChange={set('managerId')}>
            <PeopleOptions users={staff(d)} />
          </select>
        </Field>
        <div className="field full">
          <span className="field-label">Also working on it</span>
          <PeoplePicker value={v.memberIds} onChange={(ids) => setV({ ...v, memberIds: ids.filter((id) => id !== v.managerId) })} options={staff(d).filter((u) => u.id !== v.managerId)} />
        </div>
        <Field label="Status">
          <select value={v.status} onChange={set('status')}>
            {Object.entries(PROJECT_STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={v.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start">
          <input type="date" value={v.start} onChange={set('start')} />
        </Field>
        <Field label="Due">
          <input type="date" value={v.due} onChange={set('due')} />
        </Field>
        <Field label="Brief" hint="The client can read this." full>
          <textarea rows={4} value={v.brief} onChange={set('brief')} placeholder="Goal, deliverables, tone, references, deadlines that can’t move…" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{edit ? 'Save' : 'Create project'}</button>
        </div>
      </form>
    </Modal>
  )
}
