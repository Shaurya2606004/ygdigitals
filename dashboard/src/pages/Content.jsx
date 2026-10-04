import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, FORMATS, isStaff, PLATFORMS, POST_STATUS, staff } from '../store.js'
import { Avatar, Empty, Err, Field, Icon, Modal, PageHead, PeopleOptions, Status, useDb, useForm, useMe } from '../ui.jsx'
import { ago, fmtDay, fmtLong, fmtMonth, fmtTime, parseDay, today, ymd } from '../util.js'
import { MonthGrid } from './Calendar.jsx'

const shiftMonth = (s, n) => {
  const d = parseDay(`${s.slice(0, 8)}01`)
  d.setMonth(d.getMonth() + n)
  return ymd(d)
}

export default function Content() {
  const me = useMe()
  const d = useDb()
  const staffer = isStaff(me)
  const manage = can(me, 'content.manage')
  const [month, setMonth] = useState(`${today().slice(0, 8)}01`)
  const [view, setView] = useState('month')
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
            {['month', 'board'].map((v) => (
              <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
                {v === 'month' ? 'Calendar' : 'Pipeline'}
              </button>
            ))}
          </div>
        </div>
      </div>
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
          {Object.entries(POST_STATUS).map(([s, label]) => {
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
                        <span className="due">{fmtDay(p.date)}</span>
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
      {open && byId(d.posts, open) && <PostView id={open} onClose={() => setOpen(null)} onEdit={() => (setForm({ edit: byId(d.posts, open) }), setOpen(null))} />}
      {form && <PostForm onClose={() => setForm(null)} initial={form.initial} edit={form.edit} />}
    </div>
  )
}

function PostView({ id, onClose, onEdit }) {
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
          <Status s={p.status} label={POST_STATUS[p.status]} /> <b>{byId(d.clients, p.clientId)?.name}</b> · {p.platform} {p.format} · {fmtLong(p.date)}, {fmtTime(p.time || '19:00')}
        </p>
        {p.assigneeId && (
          <p className="who">
            <Avatar user={byId(d.users, p.assigneeId)} size={22} /> Made by {S.userName(d, p.assigneeId)}
          </p>
        )}
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
            <select aria-label="Status" value={p.status} onChange={(e) => run(() => S.savePost(me, { ...p, status: e.target.value }))}>
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
  const { v, set, err, run } = useForm(
    edit || { clientId: d.clients[0]?.id, date: today(), time: '19:00', platform: 'Instagram', format: 'Reel', title: '', caption: '', status: 'idea', assigneeId: '', ...Object.fromEntries(Object.entries(initial).filter(([, x]) => x !== undefined)) },
  )
  const makers = staff(d)
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
          <select value={v.format} onChange={set('format')}>
            {FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
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
