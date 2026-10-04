import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, LEAVE_STATUS, leaveDays, openWork } from '../store.js'
import { Avatar, Card, Empty, Err, Field, Icon, Modal, PageHead, Status, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, ago, daysBetween, fmtDay, today } from '../util.js'

const TONE = { pending: 'pending', approved: 'approved', declined: 'declined' }
const days = (l) => {
  const n = daysBetween(l.start, l.end) + 1
  return n === 1 ? '1 day' : `${n} days`
}

export default function Leave() {
  const me = useMe()
  const d = useDb()
  const T = today()
  const [applying, setApplying] = useState(false)
  const visible = d.leaves.filter((l) => can(me, 'leave.view', l))
  const requests = visible.filter((l) => l.status === 'pending' && me.role === 'admin' && l.userId !== me.id).sort((a, b) => a.start.localeCompare(b.start))
  const away = visible.filter((l) => l.status === 'approved' && l.end >= T).sort((a, b) => a.start.localeCompare(b.start))
  const mine = visible.filter((l) => l.userId === me.id).sort((a, b) => b.start.localeCompare(a.start))
  return (
    <div className="page">
      <PageHead title="Leave" sub="Ask for days off; a supervisor approves. For leave today or tomorrow, finish or hand over the work due on those days first.">
        <button className="btn primary" onClick={() => setApplying(true)}>
          <Icon name="plus" /> Apply for leave
        </button>
      </PageHead>
      <div className="cols">
        <div className="col-main">
          {me.role === 'admin' && (
            <Card title="Requests to decide">
              {requests.length ? (
                <ul className="list">
                  {requests.map((l) => (
                    <LeaveRequest key={l.id} l={l} />
                  ))}
                </ul>
              ) : (
                <Empty icon="sun" title="No leave waiting for you" />
              )}
            </Card>
          )}
          <Card title="Your leave">
            {mine.length ? (
              <ul className="list">
                {mine.map((l) => (
                  <li key={l.id} className="row leave-row">
                    <span className="grow">
                      <b>
                        {leaveDays(l)} <span className="muted">· {days(l)}</span>
                      </b>
                      {l.note && <small>{l.note}</small>}
                      {l.reply && (
                        <small>
                          {S.userName(d, l.decidedBy).split(' ')[0]}: {l.reply}
                        </small>
                      )}
                    </span>
                    <Status s={TONE[l.status]} label={LEAVE_STATUS[l.status]} />
                    {S.canCancelLeave(me, l) && l.end >= T && <CancelButton l={l} />}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="sun" title="No leave yet" />
            )}
          </Card>
        </div>
        <div className="col-side">
          <Card title="Who’s away">
            {away.length ? (
              <ul className="list">
                {away.map((l) => {
                  const u = byId(d.users, l.userId)
                  return (
                    <li key={l.id} className="row">
                      <Avatar user={u} size={28} />
                      <span className="grow">
                        <b>{u?.name ?? 'Someone'}</b>
                        <small>
                          {leaveDays(l)} · {days(l)}
                        </small>
                      </span>
                      {l.start <= T && <span className="pill violet">Away now</span>}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty icon="sun" title="Everyone’s in" />
            )}
          </Card>
        </div>
      </div>
      {applying && <LeaveForm onClose={() => setApplying(false)} />}
    </div>
  )
}

function CancelButton({ l }) {
  const me = useMe()
  const [err, setErr] = useState('')
  return (
    <>
      <button
        className="btn sm ghost"
        onClick={() => {
          if (!confirm(`Cancel the leave ${leaveDays(l)}?`)) return
          try {
            S.cancelLeave(me, l.id)
          } catch (x) {
            setErr(x.message)
          }
        }}
      >
        Cancel
      </button>
      <Err msg={err} />
    </>
  )
}

// one request for the admin: who, when, why — and what of theirs falls due while they're away
function LeaveRequest({ l }) {
  const me = useMe()
  const d = useDb()
  const [reply, setReply] = useState('')
  const [err, setErr] = useState('')
  const u = byId(d.users, l.userId)
  const due = openWork(d, l.userId, l.start, l.end)
  const decide = (ok) => {
    try {
      S.decideLeave(me, l.id, ok, reply, ok && due.length > 0)
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  return (
    <li className="leave-request">
      <div className="row">
        <Avatar user={u} size={32} />
        <span className="grow">
          <b>
            {u?.name} · {leaveDays(l)} <span className="muted">({days(l)})</span>
          </b>
          <small>
            Asked {ago(l.createdAt)}
            {l.note ? ` · ${l.note}` : ''}
          </small>
        </span>
      </div>
      {due.length > 0 ? (
        <div className="warn-box">
          <b>
            Due while {u?.name.split(' ')[0]} is away ({due.length}):
          </b>
          <ul>
            {due.map((w) => (
              <li key={w.href + w.title}>
                <a href={w.href}>{w.title}</a> <span className="muted">· {fmtDay(w.due)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="small muted">Nothing of theirs is due on those days.</p>
      )}
      <div className="row-actions">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply (optional)" aria-label={`Reply to ${u?.name}`} className="grow" />
        <button className="btn sm" onClick={() => decide(false)}>
          Decline
        </button>
        <button className="btn sm primary" onClick={() => decide(true)}>
          {due.length ? 'Approve anyway' : 'Approve'}
        </button>
      </div>
      <Err msg={err} />
    </li>
  )
}

function LeaveForm({ onClose }) {
  const me = useMe()
  const d = useDb()
  const T = today()
  const { v, set, err, run } = useForm({ start: addDays(T, 1), end: addDays(T, 1), note: '' })
  const end = v.end && v.end >= v.start ? v.end : v.start
  const due = v.start ? openWork(d, me.id, v.start, end) : []
  const shortNotice = v.start && v.start <= addDays(T, 1)
  return (
    <Modal title="Apply for leave" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.applyLeave(me, { start: v.start, end, note: v.note }))) onClose()
        }}
      >
        <Field label="From">
          <input type="date" data-autofocus min={T} value={v.start} onChange={set('start')} />
        </Field>
        <Field label="To (last day off)">
          <input type="date" min={v.start || T} value={v.end} onChange={set('end')} />
        </Field>
        <Field label="Note for your supervisor" hint="Only you and the supervisors see this." full>
          <textarea rows={2} value={v.note} onChange={set('note')} placeholder="Optional" />
        </Field>
        {due.length > 0 ? (
          <div className={`warn-box ${shortNotice ? 'bad' : ''}`}>
            <b>{shortNotice ? 'Finish or hand over these first — they’re due on those days:' : 'Due while you’re away — finish or hand them over before you go:'}</b>
            <ul>
              {due.map((w) => (
                <li key={w.href + w.title}>
                  <a href={w.href}>{w.title}</a> <span className="muted">· {fmtDay(w.due)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          v.start && <p className="small muted">Nothing of yours is due on those days.</p>
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
