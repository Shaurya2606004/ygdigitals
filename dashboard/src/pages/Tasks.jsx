import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, isOverdue, PRIORITY, staff, TASK_STATUS } from '../store.js'
import { Avatar, Empty, Err, Field, Icon, Modal, PageHead, PeopleOptions, RichText, Status, Tabs, useDb, useForm, useMe } from '../ui.jsx'
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
        {t.assigneeId ? <Avatar user={byId(d.users, t.assigneeId)} size={24} /> : <span className="pill amber">No owner</span>}
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
                  const done = t.checklist.filter((c) => c.done).length
                  return (
                    <button key={t.id} type="button" className="tcard" draggable={can(me, 'task.edit', t)} onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => setOpen(t.id)}>
                      {t.priority !== 'normal' && (
                        <span className="tcard-top">
                          <Status s={t.priority} label={PRIORITY[t.priority]} />
                        </span>
                      )}
                      <b>{t.title}</b>
                      <small className="muted">{byId(d.projects, t.projectId)?.name}</small>
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
                        {t.assigneeId ? <Avatar user={byId(d.users, t.assigneeId)} size={22} /> : <span className="pill amber">No owner</span>}
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
  const [scope, setScope] = useState(me.role === 'admin' ? 'all' : 'mine')
  const [view, setView] = useState('board')
  const [f, setF] = useState({ project: '', person: '', priority: '', q: '' })
  const [adding, setAdding] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const q = f.q.trim().toLowerCase()
  const tasks = d.tasks.filter(
    (t) =>
      (scope === 'all' || t.assigneeId === me.id || (!t.assigneeId && t.createdBy === me.id)) &&
      (!f.project || t.projectId === f.project) &&
      (!f.person || (f.person === 'none' ? !t.assigneeId : t.assigneeId === f.person)) &&
      (!f.priority || t.priority === f.priority) &&
      (!q || t.title.toLowerCase().includes(q)),
  )
  const mine = d.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').length
  const sorted = [...tasks].sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.due || '9').localeCompare(b.due || '9'))
  return (
    <div className="page">
      <PageHead title="Tasks" sub="Everything the studio is working on. Drag a card to change its status; use Hand off to pass work on.">
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
            <select aria-label="Owner" value={f.person} onChange={set('person')}>
              <option value="">Anyone</option>
              <option value="none">No owner yet</option>
              <PeopleOptions users={staff(d)} />
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
      {args[0] && byId(d.tasks, args[0]) && <TaskModal id={args[0]} onClose={() => (location.hash = '#/tasks')} />}
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
            <th>Owner</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
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
              <td>{t.assigneeId ? S.userName(d, t.assigneeId) : <span className="muted">No owner</span>}</td>
              <td>
                <Status s={t.status} label={TASK_STATUS[t.status]} />
              </td>
              <td>
                <Status s={t.priority} label={PRIORITY[t.priority]} />
              </td>
              <td>
                <DueChip t={t} />
              </td>
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
  const { v, set, err, run } = useForm({ title: '', projectId: projects[0]?.id ?? '', assigneeId: me.id, priority: 'normal', due: '', desc: '', checklist: '', status: 'todo', ...initial })
  const submit = (e) => {
    e.preventDefault()
    const checklist = v.checklist
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: `c${Date.now()}${i}`, text, done: false }))
    if (run(() => S.saveTask(me, { ...v, assigneeId: v.assigneeId || null, checklist }))) onClose()
  }
  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="What needs doing?" full>
          <input data-autofocus value={v.title} onChange={set('title')} placeholder="e.g. Edit Reel 3 — gift box unboxing (30s)" />
        </Field>
        <Field label="Project" full>
          <select value={v.projectId} onChange={set('projectId')}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {byId(d.clients, p.clientId)?.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <select value={v.assigneeId || ''} onChange={set('assigneeId')}>
            <option value="">No owner yet</option>
            <PeopleOptions users={staff(d)} />
          </select>
        </Field>
        <Field label="Due">
          <input type="date" value={v.due} onChange={set('due')} />
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
  if (!t) return null
  const p = byId(d.projects, t.projectId)
  const editable = can(me, 'task.edit', t)
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
  return (
    <Modal title={`Task · ${p?.name ?? ''}`} onClose={onClose} wide>
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
            <dd className="stack">
              <select value={t.assigneeId || ''} disabled={!editable} onChange={(e) => save({ assigneeId: e.target.value || null })} aria-label="Owner">
                <option value="">No owner yet</option>
                <PeopleOptions users={staff(d)} />
              </select>
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
            <dt>Created</dt>
            <dd className="muted">
              {S.userName(d, t.createdBy)}, {ago(t.createdAt)}
            </dd>
          </dl>
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
  const people = staff(d).filter((u) => u.id !== t.assigneeId)
  const { v, set, err, run } = useForm({ toId: people.find((u) => u.id !== me.id)?.id ?? '', note: '' })
  return (
    <Modal title="Hand off" onClose={onClose}>
      <form
        className="form-grid one"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.handoff(me, t.id, v.toId, v.note.trim()))) onClose()
        }}
      >
        <p className="muted">“{t.title}” becomes theirs and goes back to To do. The checklist and comments go with it, and they get your note.</p>
        <Field label="Hand to">
          <select data-autofocus value={v.toId} onChange={set('toId')}>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.title ? ` — ${u.title}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note for them">
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
