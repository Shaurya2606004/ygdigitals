import { useState } from 'react'
import { createPortal } from 'react-dom'
import * as S from '../store.js'
import { byId, can, DEPTS, isOverdue, POST_STATUS, PRIORITY, REPEATS, seesAll, setsDue, staff, TASK_STATUS, taskMark } from '../store.js'
import { Avatar, Confirm, Empty, Err, Field, Icon, Mark, Modal, PageHead, PeopleOptions, RichText, Status, Tabs, useDb, useForm, useMe, usePhone } from '../ui.jsx'
import { addDays, ago, fmtDay, relDay, today } from '../util.js'

// a finished task shows whether it was on time; an open one, when it's due
export const DueChip = ({ t }) =>
  t.status === 'done' ? (
    <Mark m={taskMark(t)} />
  ) : t.due ? (
    <span className={`due ${isOverdue(t) ? 'late' : t.due === today() && t.status !== 'done' ? 'soon' : ''}`}>
      <Icon name="clock" size={13} />
      {isOverdue(t) ? `Overdue · ${fmtDay(t.due)}` : relDay(t.due)}
    </span>
  ) : null

// when it's due; whoever sets the dates moves it from here without opening the task. Its popup lives outside the card
// or row, and clicks on it stay out of the card's own (which opens the task).
export function DueMenu({ t }) {
  const me = useMe()
  const [moving, setMoving] = useState(false)
  if (t.status === 'done' || !can(me, 'task.edit', t) || !setsDue(me, t)) return <DueChip t={t} />
  return (
    <span className="due-menu" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="due-btn" title="Change the date" onClick={() => setMoving(true)}>
        {t.due ? (
          <DueChip t={t} />
        ) : (
          <span className="due">
            <Icon name="clock" size={13} /> Set a date
          </span>
        )}
      </button>
      {moving && createPortal(<MoveDate t={t} onClose={() => setMoving(false)} />, document.body)}
    </span>
  )
}

function MoveDate({ t, onClose }) {
  const me = useMe()
  const d = useDb()
  const post = byId(d.posts, t.postId)
  const { v, set, err, run } = useForm({ day: t.due || '' })
  const move = (due) => (due === t.due || run(() => S.saveTask(me, { ...t, due }))) && onClose()
  return (
    <Modal title={`When is “${t.title}” due?`} onClose={onClose}>
      <form
        className="form-grid one"
        onSubmit={(e) => {
          e.preventDefault()
          move(v.day)
        }}
      >
        <div className="row-actions">
          <button type="button" className="btn" data-autofocus onClick={() => move(today())}>
            Today
          </button>
          <button type="button" className="btn" onClick={() => move(addDays(today(), 1))}>
            Tomorrow
          </button>
        </div>
        <Field label="Another day" hint={post && !['posted', 'missed'].includes(post.status) ? `It goes out ${fmtDay(post.date)}. A later day moves the post to that day too.` : ''}>
          <input type="date" value={v.day} onChange={set('day')} required />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Move it</button>
        </div>
      </form>
    </Modal>
  )
}

// who last changed a task's status, and when ('' if no one has since it was made)
export const movedBy = (d, t) => (t.statusAt ? `Moved by ${t.statusBy ? S.userName(d, t.statusBy).split(' ')[0] : 'YG Hub'} · ${ago(t.statusAt)}` : '')

// finished work stays on the board and in the lists for a day after it's done, then leaves them (it isn't deleted)
const showing = (t) => t.status !== 'done' || Date.parse(t.statusAt) > Date.now() - 864e5

// soonest date first, undated last
const byDue = (a, b) => (a.due || '9').localeCompare(b.due || '9')
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 }
const projectName = (d, t) => byId(d.projects, t.projectId)?.name ?? ''
const personName = (d, t) => (t.assigneeId ? S.userName(d, t.assigneeId) : '')
// "Sort by": each puts its own order first, then soonest due, then the most urgent
const SORTS = {
  due: ['Due date', () => 0],
  priority: ['Priority', (d, a, b) => RANK[a.priority] - RANK[b.priority]],
  project: ['Project', (d, a, b) => projectName(d, a).localeCompare(projectName(d, b))],
  person: ['Person', (d, a, b) => Number(!a.assigneeId) - Number(!b.assigneeId) || personName(d, a).localeCompare(personName(d, b))], // no one: last
}
const order = (d, sort) => (a, b) => SORTS[sort][1](d, a, b) || byDue(a, b) || RANK[a.priority] - RANK[b.priority]
// a list: open work first
const openFirst = (d, sort) => (a, b) => (a.status === 'done') - (b.status === 'done') || order(d, sort)(a, b)

// the sort each person last picked stays, on this device
const SORT_KEY = 'yg-hub.tasks.sort'
function savedSort() {
  try {
    const s = localStorage.getItem(SORT_KEY)
    return s in SORTS ? s : 'due'
  } catch {
    return 'due' // storage blocked (a private window): it just isn't remembered
  }
}
function saveSort(s) {
  try {
    localStorage.setItem(SORT_KEY, s)
  } catch {
    // storage blocked: it just isn't remembered
  }
}

// a link to the task page, or with onOpen a button that opens it where you are. A click anywhere else on the row opens
// it too (its date is a button of its own).
export function TaskRow({ t, project = true, onOpen }) {
  const d = useDb()
  const p = byId(d.projects, t.projectId)
  const open = onOpen ?? (() => (location.hash = `#/tasks/${t.id}`))
  const title = (
    <>
      <b>{t.title}</b>
      {(project || t.statusAt) && <small>{[project && p?.name, movedBy(d, t)].filter(Boolean).join(' · ')}</small>}
    </>
  )
  return (
    <li className="row task-row" onClick={(e) => !e.target.closest('a, button') && open()}>
      <Status s={t.status} label={TASK_STATUS[t.status]} />
      {onOpen ? (
        <button type="button" className="grow" onClick={onOpen}>
          {title}
        </button>
      ) : (
        <a href={`#/tasks/${t.id}`} className="grow">
          {title}
        </a>
      )}
      <DueMenu t={t} />
      {t.assigneeId ? <Avatar user={byId(d.users, t.assigneeId)} size={24} /> : <span className="pill amber">Not given to anyone</span>}
    </li>
  )
}

export function Board({ tasks, project = true, sort = 'due' }) {
  const me = useMe()
  const d = useDb()
  const [open, setOpen] = useState(null)
  const [over, setOver] = useState(null)
  const [err, setErr] = useState('')
  const phone = usePhone()
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
  // a phone can't drag: one list, most urgent first
  if (phone) {
    const list = tasks.filter(showing).sort(openFirst(d, sort))
    return (
      <>
        {list.length ? (
          <ul className="list card task-list">
            {list.map((t) => (
              <TaskRow key={t.id} t={t} project={project} onOpen={() => setOpen(t.id)} />
            ))}
          </ul>
        ) : (
          <Empty title="No tasks here">Tap “New task” to add one.</Empty>
        )}
        {open && <TaskModal id={open} onClose={() => setOpen(null)} />}
      </>
    )
  }
  return (
    <>
      <Err msg={err} />
      <div className="board">
        {/* Social media tasks skip "Ready to check": the column is there only for other work */}
        {Object.entries(TASK_STATUS).filter(([s]) => s !== 'review' || tasks.some((t) => t.dept !== 'social')).map(([s, label]) => {
          const col = tasks.filter((t) => t.status === s && showing(t)).sort(order(d, sort))
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
                    // a click anywhere on the card opens it (the title is its button, for keyboards; the date is one of its own)
                    <div
                      key={t.id}
                      className="tcard"
                      draggable={can(me, 'task.edit', t)}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                      onClick={(e) => !e.target.closest('button') && setOpen(t.id)}
                    >
                      {t.priority !== 'normal' && (
                        <span className="tcard-top">
                          <Status s={t.priority} label={PRIORITY[t.priority]} />
                        </span>
                      )}
                      <button type="button" className="tcard-open" onClick={() => setOpen(t.id)}>
                        <b>{t.title}</b>
                      </button>
                      <small className="muted">{byId(d.projects, t.projectId)?.name}</small>
                      {t.statusAt && <small className="muted">{movedBy(d, t)}</small>}
                      <span className="tcard-foot">
                        <DueMenu t={t} />
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
                        {t.assigneeId ? <Avatar user={byId(d.users, t.assigneeId)} size={22} /> : <span className="pill amber">Not given to anyone</span>}
                      </span>
                    </div>
                  )
                })}
                {!col.length && <p className="col-empty">{s === 'done' ? 'Nothing finished in the last day' : 'Drop tasks here'}</p>}
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
  const [sort, setSort] = useState(savedSort)
  const [adding, setAdding] = useState(false)
  const phone = usePhone()
  const [filtering, setFiltering] = useState(false)
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
  const sorted = tasks.filter(showing).sort(openFirst(d, sort))
  const filtered = Object.values(f).filter(Boolean).length
  return (
    <div className="page">
      <PageHead title="Tasks" sub={`${seesAll(me) ? 'Everything the studio is working on' : 'Your work and your department’s'}. ${phone ? 'Tap a task to open it.' : 'Drag a card to change where it’s at, or open it to change it.'}`}>
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
            ['all', seesAll(me) ? 'Everyone' : DEPTS[me.dept] ? `${DEPTS[me.dept]} team` : 'Shared with me'],
          ]}
        />
        {phone && (
          <button className="btn" aria-expanded={filtering} onClick={() => setFiltering(!filtering)}>
            <Icon name="sliders" size={16} /> Sort & filter{filtered ? ` (${filtered})` : ''}
          </button>
        )}
        {(!phone || filtering) && (
          <div className="filters">
            <select
              aria-label="Sort by"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value)
                saveSort(e.target.value)
              }}
            >
              {Object.entries(SORTS).map(([k, [label]]) => (
                <option key={k} value={k}>
                  Sort by: {label}
                </option>
              ))}
            </select>
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
              <select aria-label="Given to" value={f.person} onChange={set('person')}>
                <option value="">Anyone</option>
                <option value="none">Not given to anyone</option>
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
            {!phone && (
              <div className="seg" role="group" aria-label="View">
                <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')} aria-pressed={view === 'board'}>
                  Board
                </button>
                <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}>
                  List
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {phone || view === 'board' ? (
        <Board tasks={tasks} sort={sort} />
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
            <th>Given to</th>
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
              <td>{t.assigneeId ? S.userName(d, t.assigneeId) : <span className="muted">Not given to anyone</span>}</td>
              <td>
                <Status s={t.status} label={TASK_STATUS[t.status]} />
              </td>
              <td>
                <Status s={t.priority} label={PRIORITY[t.priority]} />
              </td>
              <td>
                <DueMenu t={t} />
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
  const projects = d.projects.filter((p) => p.status !== 'done' && can(me, 'task.create', { projectId: p.id }))
  const { v, set, setV, err, run } = useForm({ title: '', projectId: projects[0]?.id ?? '', assigneeId: me.id, dept: me.dept === 'all' ? '' : me.dept || '', priority: 'normal', repeat: 'none', due: '', desc: '', checklist: '', status: 'todo', ...initial })
  // the work usually belongs to whoever does it
  const pickOwner = (e) => {
    const dept = byId(d.users, e.target.value)?.dept
    setV((s) => ({ ...s, assigneeId: e.target.value, dept: dept && dept !== 'all' && DEPTS[dept] ? dept : s.dept }))
  }
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
        <Field label="Give it to">
          <select value={v.assigneeId || ''} onChange={pickOwner}>
            <option value="">No one yet</option>
            <PeopleOptions users={staff(d)} />
          </select>
        </Field>
        <Field label="Department" hint="Everyone in it can see this task.">
          <DeptSelect value={v.dept} onChange={set('dept')} />
        </Field>
        <Field label="Due" hint={v.assigneeId && v.due && S.isAway(d, v.assigneeId, v.due) ? `${S.userName(d, v.assigneeId).split(' ')[0]} is on leave that day.` : ''}>
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
        <Field label="Repeats" hint={v.repeat !== 'none' ? 'Finishing it makes the next one, due a week or a month later.' : ''}>
          <RepeatSelect value={v.repeat} onChange={set('repeat')} />
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

export const DeptSelect = ({ value, onChange, disabled, label }) => (
  <select value={value || ''} onChange={onChange} disabled={disabled} aria-label={label}>
    <option value="">No department</option>
    {Object.entries(DEPTS).map(([k, l]) => (
      <option key={k} value={k}>
        {l}
      </option>
    ))}
  </select>
)

const RepeatSelect = ({ value, onChange, disabled }) => (
  <select value={value || 'none'} onChange={onChange} disabled={disabled} aria-label="Repeats">
    {Object.entries(REPEATS).map(([k, l]) => (
      <option key={k} value={k}>
        {l}
      </option>
    ))}
  </select>
)

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
  const source = byId(d.tasks, t.uploadOf) // an upload task: the Video or Design work it uploads
  const post = byId(d.posts, t.postId ?? source?.postId)
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
      {editable ? (
        <input className="title-input" defaultValue={t.title} aria-label="Task title" onBlur={(e) => e.target.value.trim() !== t.title && save({ title: e.target.value })} />
      ) : (
        <h3 className="title-static">{t.title}</h3>
      )}
      <Err msg={err} />
      {/* on a phone the side panel (status, who, when, delete) comes first, then details and comments */}
      <div className="task-modal">
        <div className="task-main">
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

          <h4>Comments</h4>
          <ul className="comments">
            {t.comments.map((c) => (
              <li key={c.id} className={c.handoff ? 'handoff' : ''}>
                <Avatar user={byId(d.users, c.userId)} size={28} />
                <div>
                  <p className="comment-meta">
                    <b>{S.userName(d, c.userId)}</b> {c.handoff && <span className="pill blue">Handed over: {c.handoff}</span>} <small className="muted">{ago(c.at)}</small>
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
            <dd className="stack">
              <select value={t.status} disabled={!editable} onChange={(e) => save({ status: e.target.value })} aria-label="Status">
                {Object.entries(TASK_STATUS)
                  .filter(([k]) => k !== 'review' || t.dept !== 'social')
                  .map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
              </select>
              {t.statusAt && <small className="muted">{movedBy(d, t)}</small>}
            </dd>
            <dt>Given to</dt>
            <dd className="stack">
              <select value={t.assigneeId || ''} disabled={!editable} onChange={(e) => save({ assigneeId: e.target.value || null })} aria-label="Given to">
                <option value="">No one yet</option>
                <PeopleOptions users={staff(d)} />
              </select>
              {editable && t.status !== 'done' && (
                <button className="btn sm" onClick={() => setHanding(true)}>
                  <Icon name="swap" size={14} /> Hand over
                </button>
              )}
            </dd>
            <dt>Department</dt>
            <dd>
              <DeptSelect value={t.dept} disabled={!editable} onChange={(e) => save({ dept: e.target.value })} label="Department" />
            </dd>
            <dt>Project</dt>
            <dd>
              <a href={`#/projects/${p?.id}`}>{p?.name}</a>
              <small className="muted block">{byId(d.clients, p?.clientId)?.name}</small>
            </dd>
            {source && (
              <>
                <dt>Upload of</dt>
                <dd>
                  <a href={`#/tasks/${source.id}`}>{source.title}</a>
                  <small className="muted block">{movedBy(d, source)}</small>
                </dd>
              </>
            )}
            {post && (
              <>
                <dt>Content plan</dt>
                <dd>
                  <a href={`#/content/post/${post.id}`}>
                    {post.format} on {post.platform}
                  </a>
                  <small className="muted block">
                    Goes out {fmtDay(post.date)} · {POST_STATUS[post.status]}
                  </small>
                  {can(me, 'content.manage') && can(me, 'content.view', post) ? (
                    <input
                      type="url"
                      className="post-link-input"
                      defaultValue={post.link}
                      aria-label="Link to the finished work"
                      placeholder="Link to the finished work"
                      onBlur={(e) => e.target.value.trim() !== (post.link || '') && run(() => S.savePost(me, { ...post, link: e.target.value }))}
                    />
                  ) : (
                    post.link && (
                      <a className="work-link" href={post.link} target="_blank" rel="noreferrer">
                        See the work
                      </a>
                    )
                  )}
                </dd>
              </>
            )}
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
            <dd className="stack">
              {editable && setsDue(me, t) ? <input type="date" value={t.due || ''} onChange={(e) => save({ due: e.target.value })} aria-label="Due date" /> : <DueChip t={t} />}
              {t.assigneeId === me.id && t.status !== 'done' && !setsDue(me, t) && <small className="muted">Need more time? Tell {dateSetter(d, me, t)}.</small>}
            </dd>
            <dt>Repeats</dt>
            <dd>
              <RepeatSelect value={t.repeat} disabled={!editable || t.status === 'done'} onChange={(e) => save({ repeat: e.target.value })} />
            </dd>
            <dt>Created</dt>
            <dd className="muted">
              {S.userName(d, t.createdBy)}, {ago(t.createdAt)}
            </dd>
          </dl>
          {can(me, 'task.delete', t) && (
            <Confirm
              className="btn danger sm"
              ask={`Delete “${t.title}”?`}
              detail="It goes for everyone, with its checklist and comments. This can’t be undone."
              yes="Delete task"
              onYes={() => run(() => S.deleteTask(me, t.id)) && onClose()}
            >
              <Icon name="trash" size={14} /> Delete task
            </Confirm>
          )}
        </aside>
      </div>
      {handing && <HandoffForm t={t} onClose={() => setHanding(false)} />}
    </Modal>
  )
}

// who to ask for a new date: whoever gave you the task, else the project lead, else a supervisor
const dateSetter = (d, me, t) => {
  const id = [t.createdBy, byId(d.projects, t.projectId)?.managerId].find((x) => x && x !== me.id)
  return id ? S.userName(d, id).split(' ')[0] : 'your supervisor'
}

export function SendBackForm({ t, onClose }) {
  const me = useMe()
  const d = useDb()
  const { v, set, err, run } = useForm({ note: '' })
  return (
    <Modal title={`Send “${t.title}” back`} onClose={onClose}>
      <form
        className="form-grid one"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.sendBack(me, t.id, v.note))) onClose()
        }}
      >
        <p className="muted">It goes back to In progress, and {t.assigneeId ? S.userName(d, t.assigneeId).split(' ')[0] : 'whoever made it'} gets your note.</p>
        <Field label="What needs changing?">
          <textarea data-autofocus rows={3} value={v.note} onChange={set('note')} placeholder="e.g. Brighter thumbnail, and the logo bigger" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Send back</button>
        </div>
      </form>
    </Modal>
  )
}

export function HandoffForm({ t, onClose }) {
  const me = useMe()
  const d = useDb()
  const people = staff(d).filter((u) => u.id !== t.assigneeId)
  const { v, set, err, run } = useForm({ toId: people.find((u) => u.id !== me.id)?.id ?? '', note: '' })
  return (
    <Modal title="Hand over" onClose={onClose}>
      <form
        className="form-grid one"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.handoff(me, t.id, v.toId, v.note.trim()))) onClose()
        }}
      >
        <p className="muted">“{t.title}” becomes theirs and starts again at To do. The checklist and comments go with it, and they get your note.</p>
        <Field label="Give it to">
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
            <Icon name="swap" size={16} /> Hand over
          </button>
        </div>
      </form>
    </Modal>
  )
}
