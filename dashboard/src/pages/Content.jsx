import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, FORMATS, isStaff, PLATFORMS, POST_STATUS, postDept, postMark, seesAll, staff, taskMark, team } from '../store.js'
import { Avatar, Empty, Err, Field, Icon, Mark, Modal, PageHead, PeopleOptions, Status, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, ago, fmtDay, fmtLong, fmtMonth, fmtTime, parseDay, today, ymd } from '../util.js'
import { MonthGrid } from './Calendar.jsx'
import { DeptSelect } from './Tasks.jsx'

const shiftMonth = (s, n) => {
  const d = parseDay(`${s.slice(0, 8)}01`)
  d.setMonth(d.getMonth() + n)
  return ymd(d)
}

const VIEWS = { month: 'Calendar', board: 'Pipeline', report: 'Report', owed: 'Owed' }

export default function Content({ args = [] }) {
  const me = useMe()
  const d = useDb()
  const staffer = isStaff(me)
  const manage = can(me, 'content.manage')
  const [month, setMonth] = useState(`${today().slice(0, 8)}01`)
  const [view, setView] = useState(args[0] === 'owed' && staffer ? 'owed' : 'month')
  const [making, setMaking] = useState(null) // a make-up to note: {initial}
  const [client, setClient] = useState('')
  const [platform, setPlatform] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const posts = d.posts.filter((p) => can(me, 'content.view', p) && (!client || p.clientId === client) && (!platform || p.platform === platform))
  const inMonth = posts.filter((p) => p.date.slice(0, 7) === month.slice(0, 7))
  const items = posts.map((p) => ({ key: p.id, kind: 'post', date: p.date, title: `${staffer && !client ? `${byId(d.clients, p.clientId)?.name.split(' ')[0]}: ` : ''}${p.format} · ${p.title}`, type: `ps-${p.status}`, post: p }))
  const waiting = posts.filter((p) => p.status === 'ready').length
  return (
    <div className="page">
      <PageHead title="Content plan" sub={staffer ? 'Every post, Reel and ad for every client — planned, made, approved by the client, scheduled.' : 'What’s going out on your pages and when. Approve posts marked “Ready”.'}>
        {manage && (
          <button className="btn primary" onClick={() => setForm({ initial: { clientId: client || undefined } })}>
            <Icon name="plus" /> Plan a post
          </button>
        )}
      </PageHead>
      <div className="toolbar">
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <Icon name="left" />
          </button>
          <button className="btn sm" onClick={() => setMonth(`${today().slice(0, 8)}01`)}>
            This month
          </button>
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <Icon name="right" />
          </button>
          <h2 className="cal-label">{fmtMonth(month)}</h2>
          {waiting > 0 && <span className="pill amber">{waiting} waiting for client approval</span>}
        </div>
        <div className="filters">
          {staffer && (
            <select aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="">All clients</option>
              {d.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <div className="seg" role="group" aria-label="View">
            {Object.entries(VIEWS)
              .filter(([v]) => staffer || ['month', 'board'].includes(v))
              .map(([v, label]) => (
                <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
                  {label}
                </button>
              ))}
          </div>
        </div>
      </div>
      {view === 'report' ? (
        <Report month={month} posts={posts} />
      ) : view === 'owed' ? (
        <Owed client={client} onNew={() => setMaking({ initial: { clientId: client || d.clients[0]?.id } })} onEdit={(k) => setMaking({ edit: k })} />
      ) : (
        <>
          <p className="legend">
            {Object.entries(POST_STATUS).map(([k, l]) => (
              <span key={k}>
                <i className={`t-ps-${k}`} /> {l}
              </span>
            ))}
          </p>
          {view === 'month' ? (
            <MonthGrid month={month} items={items} onItem={(it) => setOpen(it.post.id)} onDay={(day) => manage && setForm({ initial: { date: day, clientId: client || undefined } })} />
          ) : (
            <div className="board">
              {Object.entries(POST_STATUS)
                .filter(([s]) => s !== 'missed' || inMonth.some((p) => p.status === 'missed')) // Undelivered only when there is some
                .map(([s, label]) => {
                const col = inMonth.filter((p) => p.status === s).sort((a, b) => a.date.localeCompare(b.date))
                return (
                  <section key={s} className="col" aria-label={label}>
                    <header className="col-head">
                      <Status s={s} label={label} />
                      <span className="muted">{col.length}</span>
                    </header>
                    <div className="cards">
                      {col.map((p) => (
                        <button key={p.id} className="tcard" onClick={() => setOpen(p.id)}>
                          <span className="tcard-top">
                            <span className="pill grey">
                              {p.platform} · {p.format}
                            </span>
                          </span>
                          <b>{p.title}</b>
                          <small className="muted">{byId(d.clients, p.clientId)?.name}</small>
                          <span className="tcard-foot">
                            {['overdue', 'undelivered'].includes(postMark(p)) ? <Mark m={postMark(p)} /> : <span className="due">{fmtDay(p.date)}</span>}
                            <span className="grow" />
                            {p.assigneeId && <Avatar user={byId(d.users, p.assigneeId)} size={22} />}
                          </span>
                        </button>
                      ))}
                      {!col.length && <p className="col-empty">—</p>}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
          {!posts.length && <Empty icon="grid" title="No posts planned yet" />}
        </>
      )}
      {open && byId(d.posts, open) && (
        <PostView
          id={open}
          onClose={() => setOpen(null)}
          onEdit={() => (setForm({ edit: byId(d.posts, open) }), setOpen(null))}
          onMissed={(p) => setMaking({ initial: makeUpFor(p) })}
        />
      )}
      {form && <PostForm onClose={() => setForm(null)} initial={form.initial} edit={form.edit} />}
      {making && <CompensationForm {...making} onClose={() => setMaking(null)} />}
    </div>
  )
}

// a missed post's make-up, filled in: one more of the same, a week from today, by whoever was making it
export const makeUpFor = (p) => ({ clientId: p.clientId, postId: p.id, missed: `${p.format} — ${p.title} (${fmtDay(p.date)})`, offer: `1 extra ${p.format}`, due: addDays(today(), 7), ownerId: p.assigneeId || '' })

// marks for the month: per client, what was planned and where each post stands; per person, tasks on time or late
function Report({ month, posts }) {
  const me = useMe()
  const d = useDb()
  const m = month.slice(0, 7)
  const inMonth = posts.filter((p) => p.date.slice(0, 7) === m)
  const cols = ['delivered', 'undelivered', 'overdue', 'due']
  const byClient = [...new Set(inMonth.map((p) => p.clientId))].map((cid) => {
    const list = inMonth.filter((p) => p.clientId === cid)
    const count = Object.fromEntries(cols.map((k) => [k, list.filter((p) => (postMark(p) === 'today' ? 'due' : postMark(p)) === k).length]))
    const owed = d.compensations.filter((k) => k.clientId === cid && k.status === 'open' && can(me, 'comp.view', k)).length
    return { cid, total: list.length, count, owed }
  })
  const people = seesAll(me)
    ? staff(d).map((u) => {
        const ts = d.tasks.filter((t) => t.assigneeId === u.id)
        const doneIn = ts.filter((t) => t.status === 'done' && (t.completedAt || '').slice(0, 7) === m)
        return {
          u,
          onTime: doneIn.filter((t) => taskMark(t) === 'done').length,
          late: doneIn.filter((t) => taskMark(t) === 'late').length,
          overdue: ts.filter((t) => taskMark(t) === 'overdue').length,
          asked: ts.reduce((n, t) => n + (t.extensions || []).filter((x) => (x.at || '').slice(0, 7) === m).length + (t.ask ? 1 : 0), 0),
        }
      })
    : []
  return (
    <div className="report">
      <section className="card">
        <div className="card-head">
          <h2>Posts this month, by client</h2>
        </div>
        {byClient.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="num">Planned</th>
                  {cols.map((k) => (
                    <th key={k} className="num">
                      <Mark m={k} />
                    </th>
                  ))}
                  <th className="num">Make-ups owed</th>
                </tr>
              </thead>
              <tbody>
                {byClient.map((r) => (
                  <tr key={r.cid}>
                    <td>
                      <b>{byId(d.clients, r.cid)?.name}</b>
                    </td>
                    <td className="num">{r.total}</td>
                    {cols.map((k) => (
                      <td key={k} className={`num ${['undelivered', 'overdue'].includes(k) && r.count[k] ? 'late' : ''}`}>
                        {r.count[k]}
                      </td>
                    ))}
                    <td className={`num ${r.owed ? 'late' : ''}`}>{r.owed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="grid" title="No posts this month" />
        )}
      </section>
      {people.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Tasks this month, by person</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">
                    <Mark m="done" /> on time
                  </th>
                  <th className="num">
                    <Mark m="late" />
                  </th>
                  <th className="num">
                    <Mark m="overdue" /> now
                  </th>
                  <th className="num">Asked for more time</th>
                </tr>
              </thead>
              <tbody>
                {people.map((r) => (
                  <tr key={r.u.id}>
                    <td>
                      <span className="who">
                        <Avatar user={r.u} size={24} /> {r.u.name}
                      </span>
                    </td>
                    <td className="num">{r.onTime}</td>
                    <td className="num">{r.late}</td>
                    <td className={`num ${r.overdue ? 'late' : ''}`}>{r.overdue}</td>
                    <td className="num">{r.asked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

// what we owe clients for work never delivered: open first (soonest due), then what's been given
function Owed({ client, onNew, onEdit }) {
  const me = useMe()
  const d = useDb()
  const [err, setErr] = useState('')
  const run = (fn) => {
    try {
      fn()
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  const list = d.compensations
    .filter((k) => can(me, 'comp.view', k) && (!client || k.clientId === client))
    .sort((a, b) => (a.status === 'given') - (b.status === 'given') || (a.due || '9').localeCompare(b.due || '9'))
  return (
    <section className="card">
      <div className="card-head">
        <h2>Make-ups owed to clients</h2>
        {can(me, 'content.manage') && (
          <button className="btn sm primary" onClick={onNew}>
            <Icon name="plus" size={14} /> Note a make-up
          </button>
        )}
      </div>
      <Err msg={err} />
      {list.length ? (
        <ul className="list">
          {list.map((k) => {
            const late = k.status === 'open' && k.due && k.due < today()
            return (
              <li key={k.id} className="row owed-row">
                <span className={`row-icon ${late ? 'late' : ''}`}>
                  <Icon name={k.status === 'given' ? 'check' : 'clock'} size={16} />
                </span>
                <span className="grow">
                  <b>
                    {byId(d.clients, k.clientId)?.name}: {k.offer}
                  </b>
                  <small>
                    For {k.missed}
                    {k.due && k.status === 'open' ? ` · by ${fmtDay(k.due)}` : ''}
                    {k.status === 'given' ? ` · given ${fmtDay(k.givenAt)}` : ''}
                  </small>
                </span>
                {k.shared && <span className="pill violet">Client told</span>}
                {late ? <Mark m="overdue" /> : <Status s={k.status === 'given' ? 'done' : 'pending'} label={k.status === 'given' ? 'Given' : 'Owed'} />}
                {k.ownerId && <Avatar user={byId(d.users, k.ownerId)} size={24} />}
                <span className="row-actions">
                  {k.status === 'open' && (me.role === 'admin' || k.ownerId === me.id || k.createdBy === me.id) && (
                    <button className="btn sm" onClick={() => run(() => S.giveCompensation(me, k.id))}>
                      Given
                    </button>
                  )}
                  {(me.role === 'admin' || k.createdBy === me.id) && (
                    <button className="btn sm ghost" onClick={() => onEdit(k)}>
                      Edit
                    </button>
                  )}
                  {me.role === 'admin' && (
                    <button className="icon-btn sm" aria-label="Remove" onClick={() => confirm('Remove this make-up?') && run(() => S.deleteCompensation(me, k.id))}>
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty title="Nothing owed — every promise kept" />
      )}
    </section>
  )
}

export function CompensationForm({ onClose, edit, initial = {} }) {
  const me = useMe()
  const d = useDb()
  const { v, set, err, run } = useForm(edit || { clientId: d.clients[0]?.id ?? '', postId: null, missed: '', offer: '', due: addDays(today(), 7), ownerId: '', shared: false, ...initial })
  return (
    <Modal title={edit ? 'Edit make-up' : 'Make up for missed work'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.saveCompensation(me, { ...v, ownerId: v.ownerId || null, due: v.due || null }))) onClose()
        }}
      >
        <Field label="Client" full>
          <select value={v.clientId} onChange={set('clientId')} disabled={Boolean(v.postId)}>
            {d.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What was missed" full>
          <input data-autofocus={!edit || undefined} value={v.missed} onChange={set('missed')} placeholder="e.g. Reel — Navratri wishes (1 Oct)" />
        </Field>
        <Field label="What we’ll give instead" full>
          <input value={v.offer} onChange={set('offer')} placeholder="e.g. 1 extra Reel, or 2 Stories" />
        </Field>
        <Field label="By">
          <input type="date" value={v.due || ''} onChange={set('due')} />
        </Field>
        <Field label="Who’s on it">
          <select value={v.ownerId || ''} onChange={set('ownerId')}>
            <option value="">—</option>
            <PeopleOptions users={team(d)} />
          </select>
        </Field>
        {me.role === 'admin' && (
          <label className="check-field full">
            <input type="checkbox" checked={Boolean(v.shared)} onChange={set('shared')} />
            <span>
              <b>Tell the client</b> — they see it on their Home and hear when it’s delivered.
            </span>
          </label>
        )}
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {edit ? 'Cancel' : 'Skip'}
          </button>
          <button className="btn primary">{edit ? 'Save' : 'Note the make-up'}</button>
        </div>
      </form>
    </Modal>
  )
}

function PostView({ id, onClose, onEdit, onMissed }) {
  const me = useMe()
  const d = useDb()
  const p = byId(d.posts, id)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
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
  const manage = can(me, 'content.manage')
  const decide = p.status === 'ready' && can(me, 'content.decide', p)
  return (
    <Modal title={p.title} onClose={onClose}>
      <div className="event-view">
        <p className="ev-when">
          <Status s={p.status} label={POST_STATUS[p.status]} /> {['overdue', 'undelivered'].includes(postMark(p)) && p.status !== 'missed' && <Mark m={postMark(p)} />}{' '}
          <b>{byId(d.clients, p.clientId)?.name}</b> · {p.platform} {p.format} · {fmtLong(p.date)}, {fmtTime(p.time || '19:00')}
        </p>
        {p.assigneeId && (
          <p className="who">
            <Avatar user={byId(d.users, p.assigneeId)} size={22} /> Made by {S.userName(d, p.assigneeId)}
          </p>
        )}
        {d.compensations
          .filter((k) => k.postId === p.id && can(me, 'comp.view', k))
          .map((k) => (
            <p key={k.id} className="warn-box">
              Make-up {k.status === 'given' ? 'given' : 'owed'}: <b>{k.offer}</b>
              {k.due && k.status === 'open' ? ` by ${fmtDay(k.due)}` : ''}
              {k.ownerId ? ` · ${S.userName(d, k.ownerId).split(' ')[0]}` : ''}
            </p>
          ))}
        <h4>Caption</h4>
        <p className="prewrap caption">{p.caption || <span className="muted">No caption yet.</span>}</p>
        {p.notes?.length > 0 && (
          <>
            <h4>Feedback</h4>
            <ul className="comments">
              {p.notes.map((n, i) => (
                <li key={i}>
                  <Avatar user={byId(d.users, n.userId)} size={24} />
                  <div>
                    <p className="comment-meta">
                      <b>{S.userName(d, n.userId)}</b> <small className="muted">{ago(n.at)}</small>
                    </p>
                    <p>{n.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {decide && (
          <div className="decide">
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Feedback (needed if you want changes)" aria-label="Feedback" />
            <div className="form-actions">
              <button className="btn" onClick={() => run(() => S.decidePost(me, p.id, false, note)) && onClose()}>
                Request changes
              </button>
              <button className="btn primary" onClick={() => run(() => S.decidePost(me, p.id, true, note)) && onClose()}>
                Approve
              </button>
            </div>
          </div>
        )}
        <Err msg={err} />
        {manage && (
          <div className="form-actions">
            <select
              aria-label="Status"
              value={p.status}
              onChange={(e) => {
                const status = e.target.value
                // undelivered: note what we'll give the client instead
                if (run(() => S.savePost(me, { ...p, status })) && status === 'missed' && !d.compensations.some((k) => k.postId === p.id)) {
                  onClose()
                  onMissed(p)
                }
              }}
            >
              {Object.entries(POST_STATUS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <span className="grow" />
            <button className="btn danger sm" onClick={() => confirm(`Delete “${p.title}”?`) && run(() => S.deletePost(me, p.id)) && onClose()}>
              <Icon name="trash" size={14} /> Delete
            </button>
            <button className="btn sm" onClick={onEdit}>
              <Icon name="edit" size={14} /> Edit
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function PostForm({ onClose, initial = {}, edit }) {
  const me = useMe()
  const d = useDb()
  const { v, set, setV, err, run } = useForm(
    edit || { clientId: d.clients[0]?.id, date: today(), time: '19:00', platform: 'Instagram', format: 'Reel', dept: 'video', title: '', caption: '', status: 'idea', assigneeId: '', ...Object.fromEntries(Object.entries(initial).filter(([, x]) => x !== undefined)) },
  )
  const makers = team(d)
  return (
    <Modal title={edit ? 'Edit post' : 'Plan a post'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.savePost(me, { ...v, assigneeId: v.assigneeId || null }))) onClose()
        }}
      >
        <Field label="Hook / working title" full>
          <input data-autofocus value={v.title} onChange={set('title')} placeholder="e.g. 3 mistakes people make buying a plot" />
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
        <Field label="Made by">
          <select value={v.assigneeId || ''} onChange={set('assigneeId')}>
            <option value="">—</option>
            <PeopleOptions users={makers} />
          </select>
        </Field>
        <Field label="Platform">
          <select value={v.platform} onChange={set('platform')}>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Format">
          <select value={v.format} onChange={(e) => setV((s) => ({ ...s, format: e.target.value, dept: postDept(e.target.value) }))}>
            {FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Department" hint="Who makes it. Social media sees every post.">
          <DeptSelect value={v.dept} onChange={set('dept')} />
        </Field>
        <Field label="Goes out on">
          <input type="date" value={v.date} onChange={set('date')} />
        </Field>
        <Field label="At">
          <input type="time" value={v.time} onChange={set('time')} />
        </Field>
        <Field label="Stage" hint="“Ready for approval” notifies the client.">
          <select value={v.status} onChange={set('status')}>
            {Object.entries(POST_STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Caption" full>
          <textarea rows={4} value={v.caption} onChange={set('caption')} placeholder="Caption, hashtags, CTA…" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{edit ? 'Save' : 'Add to plan'}</button>
        </div>
      </form>
    </Modal>
  )
}
