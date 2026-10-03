import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, isOverdue, PRIORITY, staff, TASK_STATUS } from '../store.js'
import { Avatar, Empty, Err, Field, go, Icon, Modal, PageHead, PeopleOptions, RichText, Status, Tabs, TeamTag, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, ago, fmtDay, relDay, today } from '../util.js'

export const DueChip = ({ t }) =>
  t.due ? (
    <span className={`due ${isOverdue(t) ? 'late' : t.due === today() && t.status !== 'done' ? 'soon' : ''}`}>
      <Icon name="clock" size={13} />
      {isOverdue(t) ? `Overdue · ${fmtDay(t.due)}` : relDay(t.due)}
    </span>
  ) : null

export function TaskRow({ t, project = true }) {
  const d = useDb()
  const p = byId(d.projects, t.projectId)
  return (
    <li>
      <a href={`#/tasks/${t.id}`} className="row task-row">
        <Status s={t.status} label={TASK_STATUS[t.status]} />
        <span className="grow">
          <b>{t.title}</b>
          {project && <small>{p?.name}</small>}
        </span>
        <DueChip t={t} />
        {t.assigneeId ? <Avatar user={byId(d.users, t.assigneeId)} size={24} /> : <span className="pill grey">Unassigned</span>}
      </a>
    </li>
  )
}

export function Board({ tasks }) {
  const me = useMe()
  const d = useDb()
  const [open, setOpen] = useState(null)
  const [over, setOver] = useState(null)
  const [err, setErr] = useState('')
  const recent = addDays(today(), -14)
  const drop = (e, status) => {
    e.preventDefault()
    setOver(null)
    try {
      S.moveTask(me, e.dataTransfer.getData('text/plain'), status)
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  return (
    <>
      <Err msg={err} />
      <div className="board">
        {Object.entries(TASK_STATUS).map(([s, label]) => {
          const col = tasks.filter((t) => t.status === s && (s !== 'done' || (t.completedAt || '') >= recent))
          return (
            <section
              key={s}
              className={`col ${over === s ? 'over' : ''}`}
              aria-label={label}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(s)
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
              onDrop={(e) => drop(e, s)}
            >
              <header className="col-head">
                <Status s={s} label={label} />
                <span className="muted">{col.length}</span>
              </header>
              <div className="cards">
                {col.map((t) => {
                  const p = byId(d.projects, t.projectId)
                  const done = t.checklist.filter((c) => c.done).length
                  return (
                    <button key={t.id} type="button" className="tcard" draggable={can(me, 'task.edit', t)} onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => setOpen(t.id)}>
                      <span className="tcard-top">
                        <TeamTag team={byId(d.teams, t.teamId)} />
                        {t.priority !== 'normal' && <Status s={t.priority} label={PRIORITY[t.priority]} />}
                      </span>
                      <b>{t.title}</b>
                      <small className="muted">{p?.name}</small>
                      <span className="tcard-foot">
                        <DueChip t={t} />
                        {t.checklist.length > 0 && (
                          <span className="meta">
                            <Icon name="check" size={13} />
                            {done}/{t.checklist.length}
                          </span>
                        )}
                        {t.comments.length > 0 && (
                          <span className="meta">
                            <Icon name="chat" size={13} />
                            {t.comments.length}
                          </span>
                        )}
                        <span className="grow" />
                        {t.assigneeId ? <Avatar user={byId(d.users, t.assigneeId)} size={22} /> : <span className="pill grey">Queue</span>}
                      </span>
                    </button>
                  )
                })}
                {!col.length && <p className="col-empty">{s === 'done' ? 'Nothing finished in the last 2 weeks' : 'Drop tasks here'}</p>}
              </div>
            </section>
          )
        })}
      </div>
      {open && <TaskModal id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

export default function Tasks({ args }) {
  const me = useMe()
  const d = useDb()
  const boss = me.role === 'admin' || me.role === 'manager'
  const [scope, setScope] = useState(boss ? 'all' : me.role === 'lead' ? 'team' : 'mine')
  const [view, setView] = useState('board')
  const [f, setF] = useState({ project: '', team: '', person: '', priority: '', q: '' })
  const [adding, setAdding] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const q = f.q.trim().toLowerCase()
  const tasks = d.tasks.filter(
    (t) =>
      (scope === 'all' || (scope === 'mine' ? t.assigneeId === me.id || (!t.assigneeId && t.createdBy === me.id) : t.teamId === me.teamId)) &&
      (!f.project || t.projectId === f.project) &&
      (!f.team || t.teamId === f.team) &&
      (!f.person || (f.person === 'none' ? !t.assigneeId : t.assigneeId === f.person)) &&
      (!f.priority || t.priority === f.priority) &&
      (!q || t.title.toLowerCase().includes(q)),
  )
  const mine = d.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').length
  const teamQueue = d.tasks.filter((t) => t.teamId === me.teamId && !t.assigneeId && t.status !== 'done').length
  const sorted = [...tasks].sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.due || '9').localeCompare(b.due || '9'))
  return (
    <div className="page">
      <PageHead title="Tasks" sub="Everything every team is working on. Drag a card to change its status.">
        <button className="btn primary" onClick={() => setAdding(true)}>
          <Icon name="plus" /> New task
        </button>
      </PageHead>
      <div className="toolbar">
        <Tabs
          label="Whose tasks"
          value={scope}
          onChange={setScope}
          tabs={[
            ['mine', 'My tasks', mine],
            ['team', `My team${teamQueue ? ` · ${teamQueue} in queue` : ''}`],
            ['all', 'Everyone'],
          ]}
        />
        <div className="filters">
          <input type="search" placeholder="Filter by title" aria-label="Filter tasks by title" value={f.q} onChange={set('q')} />
          <select aria-label="Project" value={f.project} onChange={set('project')}>
            <option value="">All projects</option>
            {d.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {scope === 'all' && (
            <select aria-label="Team" value={f.team} onChange={set('team')}>
              <option value="">All teams</option>
              {d.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {scope !== 'mine' && (
            <select aria-label="Assignee" value={f.person} onChange={set('person')}>
              <option value="">Anyone</option>
              <option value="none">Unassigned (queue)</option>
              <PeopleOptions users={staff(d).filter((u) => scope === 'all' || u.teamId === me.teamId)} />
            </select>
          )}
          <select aria-label="Priority" value={f.priority} onChange={set('priority')}>
            <option value="">Any priority</option>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="seg" role="group" aria-label="View">
            <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')} aria-pressed={view === 'board'}>
              Board
            </button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}>
              List
            </button>
          </div>
        </div>
      </div>
      {view === 'board' ? (
        <Board tasks={tasks} />
      ) : sorted.length ? (
        <TaskTable tasks={sorted} />
      ) : (
        <Empty title="No tasks match">Try another filter, or create a task.</Empty>
      )}
      {adding && <TaskForm onClose={() => setAdding(false)} />}
      {args[0] && byId(d.tasks, args[0]) && <TaskModal id={args[0]} onClose={() => go('#/tasks')} />}
    </div>
  )
}

function TaskTable({ tasks }) {
  const d = useDb()
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Project</th>
            <th>Team</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
            <th className="num">Logged</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <a href={`#/tasks/${t.id}`}>
                  <b>{t.title}</b>
                </a>
              </td>
              <td className="muted">{byId(d.projects, t.projectId)?.name}</td>
              <td>
                <TeamTag team={byId(d.teams, t.teamId)} />
              </td>
              <td>{t.assigneeId ? S.userName(d, t.assigneeId) : <span className="muted">Queue</span>}</td>
              <td>
                <Status s={t.status} label={TASK_STATUS[t.status]} />
              </td>
              <td>
                <Status s={t.priority} label={PRIORITY[t.priority]} />
              </td>
              <td>
                <DueChip t={t} />
              </td>
              <td className="num">{t.time.reduce((s, x) => s + x.hours, 0)}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TaskForm({ onClose, initial = {} }) {
  const me = useMe()
  const d = useDb()
  const projects = d.projects.filter((p) => p.status !== 'done')
  const p0 = byId(d.projects, initial.projectId) || projects[0]
  const { v, set, setV, err, run } = useForm({
    title: '',
    projectId: p0?.id ?? '',
    teamId: p0?.teamIds.includes(me.teamId) ? me.teamId : (p0?.teamIds[0] ?? me.teamId),
    assigneeId: '',
    priority: 'normal',
    due: '',
    estimate: '',
    desc: '',
    checklist: '',
    status: 'todo',
    ...initial,
  })
  const canAssign = can(me, 'task.assign', { teamId: v.teamId })
  const options = canAssign ? staff(d).filter((u) => u.teamId === v.teamId) : me.teamId === v.teamId ? [me] : []
  const submit = (e) => {
    e.preventDefault()
    const ok = run(() =>
      S.saveTask(me, {
        ...v,
        assigneeId: v.assigneeId || null,
        estimate: Number(v.estimate) || 0,
        checklist: v.checklist
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((text, i) => ({ id: `c${Date.now()}${i}`, text, done: false })),
      }),
    )
    if (ok) onClose()
  }
  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="What needs doing?" full>
          <input data-autofocus value={v.title} onChange={set('title')} placeholder="e.g. Edit Reel 3 — gift box unboxing (30s)" />
        </Field>
        <Field label="Project">
          <select
            value={v.projectId}
            onChange={(e) => {
              const p = byId(d.projects, e.target.value)
              setV({ ...v, projectId: p.id, teamId: p.teamIds.includes(v.teamId) ? v.teamId : p.teamIds[0], assigneeId: '' })
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {byId(d.clients, p.clientId)?.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team doing it" hint={canAssign ? '' : v.teamId !== me.teamId ? 'Goes into this team’s queue — their lead assigns it.' : ''}>
          <select value={v.teamId} onChange={(e) => setV({ ...v, teamId: e.target.value, assigneeId: '' })}>
            {d.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <select value={v.assigneeId} onChange={set('assigneeId')}>
            <option value="">Unassigned (team queue)</option>
            {options.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === me.id ? `Me (${u.name})` : u.name}
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
        <Field label="Due">
          <input type="date" value={v.due} onChange={set('due')} />
        </Field>
        <Field label="Estimate (hours)">
          <input type="number" min="0" step="0.5" value={v.estimate} onChange={set('estimate')} />
        </Field>
        <Field label="Details" full>
          <textarea rows={3} value={v.desc} onChange={set('desc')} placeholder="Brief, links, references…" />
        </Field>
        <Field label="Checklist" hint="One step per line." full>
          <textarea rows={3} value={v.checklist} onChange={set('checklist')} placeholder={'Rough cut\nCaptions\nSound & colour'} />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Create task</button>
        </div>
      </form>
    </Modal>
  )
}

export function TaskModal({ id, onClose }) {
  const me = useMe()
  const d = useDb()
  const t = byId(d.tasks, id)
  const [err, setErr] = useState('')
  const [handing, setHanding] = useState(false)
  const [comment, setComment] = useState('')
  const [item, setItem] = useState('')
  const [time, setTime] = useState({ hours: '', date: today(), note: '' })
  if (!t) return null
  const p = byId(d.projects, t.projectId)
  const editable = can(me, 'task.edit', t)
  const assignable = can(me, 'task.assign', t)
  const run = (fn) => {
    try {
      fn()
      setErr('')
      return true
    } catch (x) {
      setErr(x.message)
      return false
    }
  }
  const save = (patch) => run(() => S.saveTask(me, { ...t, ...patch }))
  const logged = t.time.reduce((s, x) => s + x.hours, 0)
  return (
    <Modal title={`Task · ${p?.name ?? ""}`} onClose={onClose} wide>
      <div className="task-modal">
        <div className="task-main">
          {editable ? (
            <input className="title-input" defaultValue={t.title} aria-label="Task title" onBlur={(e) => e.target.value.trim() !== t.title && save({ title: e.target.value })} />
          ) : (
            <h3 className="title-static">{t.title}</h3>
          )}
          <Err msg={err} />
          <h4>Details</h4>
          {editable ? (
            <textarea rows={4} defaultValue={t.desc} aria-label="Details" placeholder="Add a brief, links, references…" onBlur={(e) => e.target.value !== t.desc && save({ desc: e.target.value })} />
          ) : (
            <p className="prewrap">{t.desc || <span className="muted">No details.</span>}</p>
          )}

          <h4>
            Checklist{' '}
            {t.checklist.length > 0 && (
              <span className="muted">
                {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
              </span>
            )}
          </h4>
          <ul className="checklist">
            {t.checklist.map((c) => (
              <li key={c.id}>
                <label>
                  <input type="checkbox" checked={c.done} disabled={!editable} onChange={() => run(() => S.toggleCheck(me, t.id, c.id))} />
                  <span className={c.done ? 'struck' : ''}>{c.text}</span>
                </label>
                {editable && (
                  <button className="icon-btn sm" aria-label={`Remove “${c.text}”`} onClick={() => save({ checklist: t.checklist.filter((x) => x.id !== c.id) })}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (item.trim() && save({ checklist: [...t.checklist, { id: `c${Date.now()}`, text: item.trim(), done: false }] })) setItem('')
              }}
            >
              <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add a step" aria-label="Add a checklist step" />
              <button className="btn sm">Add</button>
            </form>
          )}

          <h4>Comments & handoffs</h4>
          <ul className="comments">
            {t.comments.map((c) => (
              <li key={c.id} className={c.handoff ? 'handoff' : ''}>
                <Avatar user={byId(d.users, c.userId)} size={28} />
                <div>
                  <p className="comment-meta">
                    <b>{S.userName(d, c.userId)}</b> {c.handoff && <span className="pill blue">Handed off: {c.handoff}</span>} <small className="muted">{ago(c.at)}</small>
                  </p>
                  {c.text && (
                    <p className="prewrap">
                      <RichText text={c.text} />
                    </p>
                  )}
                </div>
              </li>
            ))}
            {!t.comments.length && <li className="muted">No comments yet.</li>}
          </ul>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault()
              if (run(() => S.commentTask(me, t.id, comment))) setComment('')
            }}
          >
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment — type @name to notify someone" aria-label="Comment" />
            <button className="btn primary sm" disabled={!comment.trim()}>
              Comment
            </button>
          </form>
        </div>

        <aside className="task-side">
          <dl className="props">
            <dt>Status</dt>
            <dd>
              <select value={t.status} disabled={!editable} onChange={(e) => save({ status: e.target.value })} aria-label="Status">
                {Object.entries(TASK_STATUS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </dd>
            <dt>Owner</dt>
            <dd>
              {assignable ? (
                <select value={t.assigneeId || ''} onChange={(e) => save({ assigneeId: e.target.value || null })} aria-label="Owner">
                  <option value="">Unassigned (queue)</option>
                  {staff(d)
                    .filter((u) => u.teamId === t.teamId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              ) : t.assigneeId ? (
                <span className="who">
                  <Avatar user={byId(d.users, t.assigneeId)} size={22} /> {S.userName(d, t.assigneeId)}
                </span>
              ) : me.teamId === t.teamId ? (
                <button className="btn sm" onClick={() => run(() => S.claimTask(me, t.id))}>
                  Pick it up
                </button>
              ) : (
                <span className="muted">In the team queue</span>
              )}
            </dd>
            <dt>Team</dt>
            <dd className="stack">
              <TeamTag team={byId(d.teams, t.teamId)} />
              {editable && (
                <button className="btn sm" onClick={() => setHanding(true)}>
                  <Icon name="swap" size={14} /> Hand off
                </button>
              )}
            </dd>
            <dt>Project</dt>
            <dd>
              <a href={`#/projects/${p?.id}`}>{p?.name}</a>
              <small className="muted block">{byId(d.clients, p?.clientId)?.name}</small>
            </dd>
            <dt>Priority</dt>
            <dd>
              <select value={t.priority} disabled={!editable} onChange={(e) => save({ priority: e.target.value })} aria-label="Priority">
                {Object.entries(PRIORITY).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </dd>
            <dt>Due</dt>
            <dd>
              {editable ? <input type="date" value={t.due || ''} onChange={(e) => save({ due: e.target.value })} aria-label="Due date" /> : <DueChip t={t} />}
              {isOverdue(t) && <small className="late block">Overdue</small>}
            </dd>
            <dt>Time</dt>
            <dd>
              <b>{logged}h</b> logged{t.estimate ? ` of ${t.estimate}h` : ''}
            </dd>
            <dt>Created</dt>
            <dd className="muted">
              {S.userName(d, t.createdBy)}, {ago(t.createdAt)}
            </dd>
          </dl>

          {S.isStaff(me) && (
            <form
              className="log-time"
              onSubmit={(e) => {
                e.preventDefault()
                if (run(() => S.logTime(me, t.id, time.hours, time.date, time.note))) setTime({ ...time, hours: '', note: '' })
              }}
            >
              <h4>Log time</h4>
              <div className="row-2">
                <input type="number" min="0.25" max="16" step="0.25" placeholder="Hours" aria-label="Hours" value={time.hours} onChange={(e) => setTime({ ...time, hours: e.target.value })} />
                <input type="date" max={today()} aria-label="Day" value={time.date} onChange={(e) => setTime({ ...time, date: e.target.value })} />
              </div>
              <input placeholder="What did you do? (optional)" aria-label="Note" value={time.note} onChange={(e) => setTime({ ...time, note: e.target.value })} />
              <button className="btn sm" disabled={!time.hours}>
                Log
              </button>
              {t.time.length > 0 && (
                <ul className="time-list">
                  {[...t.time]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 6)
                    .map((x) => (
                      <li key={x.id}>
                        <span>{S.userName(d, x.userId).split(' ')[0]}</span>
                        <span className="muted">{fmtDay(x.date)}</span>
                        <b>{x.hours}h</b>
                      </li>
                    ))}
                </ul>
              )}
            </form>
          )}
          {can(me, 'task.delete', t) && (
            <button
              className="btn danger sm"
              onClick={() => {
                if (confirm(`Delete “${t.title}”? This can’t be undone.`) && run(() => S.deleteTask(me, t.id))) onClose()
              }}
            >
              <Icon name="trash" size={14} /> Delete task
            </button>
          )}
        </aside>
      </div>
      {handing && <HandoffForm t={t} onClose={() => setHanding(false)} />}
    </Modal>
  )
}

function HandoffForm({ t, onClose }) {
  const me = useMe()
  const d = useDb()
  // default to the next team on the same project
  const next = byId(d.projects, t.projectId)?.teamIds.find((id) => id !== t.teamId) ?? d.teams.find((x) => x.id !== t.teamId && x.id !== 'mgmt')?.id
  const { v, set, setV, err, run } = useForm({ teamId: next, assigneeId: '', note: '' })
  const canPick = can(me, 'task.assign', { teamId: v.teamId })
  return (
    <Modal title="Hand off to another team" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.handoff(me, t.id, v.teamId, v.assigneeId || null, v.note.trim()))) onClose()
        }}
      >
        <p className="full muted">“{t.title}” moves to the other team and back to To do. Everything on it — checklist, comments, time — goes with it.</p>
        <Field label="Hand to">
          <select value={v.teamId} onChange={(e) => setV({ ...v, teamId: e.target.value, assigneeId: '' })}>
            {d.teams
              .filter((x) => x.id !== t.teamId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Person" hint={canPick ? '' : 'Their team lead gets notified and assigns it.'}>
          <select value={v.assigneeId} onChange={set('assigneeId')} disabled={!canPick}>
            <option value="">Team queue</option>
            {canPick &&
              staff(d)
                .filter((u) => u.teamId === v.teamId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
          </select>
        </Field>
        <Field label="Note for them" full>
          <textarea rows={3} value={v.note} onChange={set('note')} placeholder="Where the files are, what’s done, what you need back and by when" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">
            <Icon name="swap" size={16} /> Hand off
          </button>
        </div>
      </form>
    </Modal>
  )
}
