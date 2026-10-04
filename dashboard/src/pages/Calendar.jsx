import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, conflicts, EVENT_TYPES, isStaff, occurrences, REPEAT } from '../store.js'
import { Avatar, Confirm, Empty, Err, Field, go, Icon, isUrl, Modal, PageHead, PeoplePicker, Status, Tabs, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, clockNow, fmtDay, fmtLong, fmtMonth, fmtTime, parseDay, startOfWeek, today, ymd } from '../util.js'

const LAYERS = { meeting: 'Team meetings', client: 'Client calls', shoot: 'Shoots', review: 'Creative reviews', deadline: 'Deadlines', post: 'Content', leave: 'Leave' }
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))
function shiftMonth(s, n) {
  const d = parseDay(`${s.slice(0, 8)}01`)
  d.setMonth(d.getMonth() + n)
  return ymd(d)
}

// everything that belongs on the calendar between two days, as one flat list
function useItems(me, from, to, scope, layers) {
  const d = useDb()
  const staffer = isStaff(me)
  const inScope = (ids) => scope === 'all' || ids.includes(me.id)
  const items = []
  for (const o of occurrences(d, from, to))
    if (layers[o.type] && can(me, 'event.view', o) && inScope(o.attendeeIds))
      items.push({ key: o.id + o.date, kind: 'event', date: o.date, start: o.start, end: o.end, title: o.title, type: o.type, ev: o, declined: o.rsvp?.[me.id] === 'no' })
  if (layers.deadline) {
    if (staffer)
      for (const t of d.tasks)
        if (t.due >= from && t.due <= to && t.status !== 'done' && inScope([t.assigneeId]))
          items.push({ key: `t${t.id}`, kind: 'task', date: t.due, title: t.title, type: 'deadline', href: `#/tasks/${t.id}` })
    for (const p of d.projects)
      if (p.due >= from && p.due <= to && p.status !== 'done' && can(me, 'project.view', p)) items.push({ key: `p${p.id}`, kind: 'project', date: p.due, title: `Due: ${p.name}`, type: 'deadline', href: `#/projects/${p.id}` })
  }
  if (layers.post)
    for (const p of d.posts)
      if (p.date >= from && p.date <= to && can(me, 'content.view', p) && (!staffer || inScope([p.assigneeId])))
        items.push({ key: `s${p.id}`, kind: 'post', date: p.date, title: `${byId(d.clients, p.clientId)?.name}: ${p.title}`, type: 'post', href: '#/content' })
  // approved leave: one all-day item per day away
  if (layers.leave && staffer)
    for (const l of d.leaves)
      if (l.status === 'approved' && l.end >= from && l.start <= to && can(me, 'leave.view', l))
        for (let day = l.start > from ? l.start : from; day <= l.end && day <= to; day = addDays(day, 1))
          items.push({ key: `l${l.id}${day}`, kind: 'leave', date: day, title: `${S.userName(d, l.userId).split(' ')[0]} on leave`, type: 'leave', href: '#/leave' })
  return items.sort((a, b) => (a.start || '').localeCompare(b.start || ''))
}

export default function Calendar() {
  const me = useMe()
  const staffer = isStaff(me)
  const [cursor, setCursor] = useState(today())
  const [view, setView] = useState(() => (matchMedia('(max-width: 720px)').matches ? 'agenda' : 'month'))
  const [scope, setScope] = useState(staffer ? 'all' : 'mine')
  const [layers, setLayers] = useState(Object.fromEntries(Object.keys(LAYERS).map((k) => [k, true])))
  const [open, setOpen] = useState(null) // an event occurrence
  const [day, setDay] = useState(null)
  const [form, setForm] = useState(null) // {initial} for new, {edit} for existing

  const first = `${cursor.slice(0, 8)}01`
  const range =
    view === 'month' ? [startOfWeek(first), addDays(startOfWeek(first), 41)] : view === 'week' ? [startOfWeek(cursor), addDays(startOfWeek(cursor), 6)] : [cursor, addDays(cursor, 29)]
  const items = useItems(me, range[0], range[1], scope, layers)
  const click = (it) => (it.kind === 'event' ? setOpen(it.ev) : go(it.href))
  const step = (n) => setCursor(view === 'month' ? shiftMonth(cursor, n) : addDays(cursor, n * (view === 'week' ? 7 : 30)))
  const label = view === 'month' ? fmtMonth(first) : `${fmtDay(range[0])} – ${fmtDay(range[1])}`

  return (
    <div className="page">
      <PageHead title="Calendar" sub="Stand-ups, client calls, shoots, reviews, deadlines and posts — one calendar for the whole studio.">
        <button className="btn primary" onClick={() => setForm({ initial: {} })}>
          <Icon name="plus" /> Schedule
        </button>
      </PageHead>
      <div className="toolbar">
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
            <Icon name="left" />
          </button>
          <button className="btn sm" onClick={() => setCursor(today())}>
            Today
          </button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next">
            <Icon name="right" />
          </button>
          <h2 className="cal-label">{label}</h2>
        </div>
        <div className="filters">
          {staffer && (
            <Tabs
              label="Whose calendar"
              value={scope}
              onChange={setScope}
              tabs={[
                ['mine', 'Mine'],
                ['all', 'Everyone'],
              ]}
            />
          )}
          <div className="seg" role="group" aria-label="View">
            {['month', 'week', 'agenda'].map((v) => (
              <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="layer-chips" role="group" aria-label="Show on calendar">
        {Object.entries(LAYERS).map(([k, l]) => (
            <button key={k} className={`lchip t-${k} ${layers[k] ? 'on' : ''}`} aria-pressed={layers[k]} onClick={() => setLayers({ ...layers, [k]: !layers[k] })}>
              <i aria-hidden="true" />
              {l}
            </button>
          ))}
      </div>

      {view === 'month' && <MonthGrid month={first} items={items} onItem={click} onDay={setDay} />}
      {view === 'week' && <WeekGrid start={range[0]} items={items} onItem={click} onSlot={(date, start) => setForm({ initial: { date, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00` } })} />}
      {view === 'agenda' && <AgendaList from={range[0]} to={range[1]} items={items} onItem={click} />}

      {day && (
        <Modal title={fmtLong(day)} onClose={() => setDay(null)}>
          <DayList items={items.filter((i) => i.date === day)} onItem={(it) => (setDay(null), click(it))} />
          <div className="form-actions">
            <button
              className="btn primary"
              onClick={() => {
                setForm({ initial: { date: day } })
                setDay(null)
              }}
            >
              <Icon name="plus" /> Schedule on this day
            </button>
          </div>
        </Modal>
      )}
      {open && <EventView ev={open} onClose={() => setOpen(null)} onEdit={() => (setForm({ edit: byId(S.getDb().events, open.id) }), setOpen(null))} />}
      {form && <EventForm onClose={() => setForm(null)} initial={form.initial} edit={form.edit} />}
    </div>
  )
}

const Chip = ({ it, onItem, compact }) => (
  <button type="button" className={`ev-chip t-${it.type} ${it.declined ? 'declined' : ''}`} onClick={() => onItem(it)} title={it.title}>
    {it.start && <span className="ev-time">{fmtTime(it.start)}</span>}
    <span className="ev-title">{it.title}</span>
    {!compact && it.end && <span className="ev-time">– {fmtTime(it.end)}</span>}
  </button>
)

export function MonthGrid({ month, items, onItem, onDay }) {
  const start = startOfWeek(month)
  const T = today()
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  return (
    <div className="month" role="grid" aria-label={fmtMonth(month)}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
        <div key={w} className="month-dow" role="columnheader">
          {w}
        </div>
      ))}
      {days.map((day) => {
        const list = items.filter((i) => i.date === day)
        return (
          <div key={day} role="gridcell" className={`month-cell ${day.slice(0, 7) !== month.slice(0, 7) ? 'out' : ''} ${day === T ? 'today' : ''}`}>
            <button className="day-num" onClick={() => onDay(day)} aria-label={`${fmtLong(day)}, ${list.length} items`}>
              {Number(day.slice(8))}
            </button>
            {list.slice(0, 3).map((it) => (
              <Chip key={it.key} it={it} onItem={onItem} compact />
            ))}
            {list.length > 3 && (
              <button className="more" onClick={() => onDay(day)}>
                +{list.length - 3} more
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WeekGrid({ start, items, onItem, onSlot }) {
  const T = today()
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const px = 48 / 60 // px per minute
  const now = clockNow()
  return (
    <div className="week">
      <div className="week-head">
        <span />
        {days.map((day) => (
          <div key={day} className={`week-day ${day === T ? 'today' : ''}`}>
            <b>{fmtDay(day).split(' ')[0].replace(',', '')}</b> {Number(day.slice(8))}
            <div className="allday">
              {items
                .filter((i) => i.date === day && !i.start)
                .map((it) => (
                  <Chip key={it.key} it={it} onItem={onItem} compact />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="week-body">
        <div className="week-hours">
          {HOURS.map((h) => (
            <span key={h}>{fmtTime(`${String(h).padStart(2, '0')}:00`)}</span>
          ))}
        </div>
        {days.map((day) => {
          const timed = items.filter((i) => i.date === day && i.start)
          // ponytail: side-by-side lanes only for direct overlaps; fine for a studio's day
          const lanes = []
          const placed = timed.map((it) => {
            let lane = lanes.findIndex((end) => end <= it.start)
            if (lane === -1) lane = lanes.push(it.end) - 1
            else lanes[lane] = it.end
            return { it, lane }
          })
          return (
            <div key={day} className={`week-col ${day === T ? 'today' : ''}`}>
              {HOURS.map((h) => (
                <button key={h} className="slot" aria-label={`Schedule ${fmtDay(day)} ${h}:00`} onClick={() => onSlot(day, `${String(h).padStart(2, '0')}:00`)} />
              ))}
              {day === T && toMin(now) >= HOURS[0] * 60 && <span className="now-line" style={{ top: (toMin(now) - HOURS[0] * 60) * px }} />}
              {placed.map(({ it, lane }) => (
                <button
                  key={it.key}
                  className={`ev-block t-${it.type} ${it.declined ? 'declined' : ''}`}
                  style={{
                    top: Math.max(0, (toMin(it.start) - HOURS[0] * 60) * px),
                    height: Math.max(22, (toMin(it.end) - toMin(it.start)) * px - 2),
                    left: `${(lane / lanes.length) * 100}%`,
                    width: `${100 / lanes.length}%`,
                  }}
                  onClick={() => onItem(it)}
                >
                  <b>{it.title}</b>
                  <small>
                    {fmtTime(it.start)}–{fmtTime(it.end)}
                  </small>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayList({ items, onItem }) {
  if (!items.length) return <Empty icon="calendar" title="Nothing on this day" />
  return (
    <ul className="list">
      {items.map((it) => (
        <li key={it.key}>
          <button className={`row day-item ${it.declined ? 'declined' : ''}`} onClick={() => onItem(it)}>
            <span className="time">{it.start ? fmtTime(it.start) : (it.when ?? 'All day')}</span>
            <span className={`type-bar t-${it.type}`} aria-hidden="true" />
            <span className="grow">
              <b>{it.line ?? it.title}</b>
              <small>
                {it.sub ?? (it.kind === 'event' ? EVENT_TYPES[it.type] : LAYERS[it.type])}
                {it.declined ? ' · you declined' : ''}
              </small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function AgendaList({ from, to, items, onItem, empty = 'Nothing in the next 30 days' }) {
  const days = []
  for (let day = from; day <= to; day = addDays(day, 1)) if (items.some((i) => i.date === day)) days.push(day)
  if (!days.length) return <Empty icon="calendar" title={empty} />
  return (
    <div className="agenda">
      {days.map((day) => (
        <section key={day} className={`card agenda-day ${day === today() ? 'today' : ''}`}>
          <h3>{fmtLong(day)}</h3>
          <DayList items={items.filter((i) => i.date === day)} onItem={onItem} />
        </section>
      ))}
    </div>
  )
}

/* ---------- one event ---------- */

const icsEsc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`)
const icsTime = (date, hm) => `${date.replace(/-/g, '')}T${hm.replace(':', '')}00`
function ics(e) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YG Digitals//YG Hub//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@yghub`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Kolkata:${icsTime(e.date, e.start)}`,
    `DTEND;TZID=Asia/Kolkata:${icsTime(e.date, e.end)}`,
    e.repeat === 'weekdays' && 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    e.repeat === 'weekly' && 'RRULE:FREQ=WEEKLY',
    `SUMMARY:${icsEsc(e.title)}`,
    e.location && `LOCATION:${icsEsc(e.location)}`,
    e.agenda && `DESCRIPTION:${icsEsc(e.agenda)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}
const gcal = (e) =>
  `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${icsTime(e.date, e.start)}/${icsTime(e.date, e.end)}`, ctz: 'Asia/Kolkata', details: e.agenda || '', location: e.location || '' })}`

function EventView({ ev, onClose, onEdit }) {
  const me = useMe()
  const d = useDb()
  const e = { ...byId(d.events, ev.id), date: ev.date } // live copy, on the clicked day
  const [err, setErr] = useState('')
  if (!e.id) return null
  const run = (fn) => {
    try {
      fn()
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  const project = byId(d.projects, e.projectId)
  const mine = e.rsvp?.[me.id]
  const editable = can(me, 'event.edit', e)
  const saveIcs = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics(e)], { type: 'text/calendar' }))
    a.download = `${e.title.replace(/[^\w]+/g, '-')}.ics`
    a.click()
  }
  return (
    <Modal title={e.title} onClose={onClose}>
      <div className="event-view">
        <p className="ev-when">
          <span className={`type-dot t-${e.type}`} aria-hidden="true" />
          <b>{EVENT_TYPES[e.type]}</b> · {fmtLong(e.date)} · {fmtTime(e.start)}–{fmtTime(e.end)}
          {e.repeat !== 'none' && <span className="pill grey">{REPEAT[e.repeat]}</span>}
        </p>
        {e.location && (
          <p className="ev-loc">
            {isUrl(e.location) ? (
              <a className="btn primary sm" href={e.location} target="_blank" rel="noreferrer">
                <Icon name="video" size={15} /> Join video call
              </a>
            ) : (
              <>
                <Icon name="pin" size={16} /> {e.location}
              </>
            )}
          </p>
        )}
        {project && (
          <p>
            Project: <a href={`#/projects/${project.id}`}>{project.name}</a>
          </p>
        )}
        {e.agenda && <p className="prewrap agenda-text">{e.agenda}</p>}
        <h4>
          Who’s coming <span className="muted">({e.attendeeIds.length})</span>
        </h4>
        <ul className="attendees">
          {e.attendeeIds.map((id) => {
            const u = byId(d.users, id)
            const r = e.rsvp?.[id]
            return (
              u && (
                <li key={id}>
                  <Avatar user={u} size={26} />
                  <span className="grow">
                    {u.name}
                    {id === e.createdBy && <small className="muted"> · organiser</small>}
                  </span>
                  <Status s={r === 'yes' ? 'done' : r === 'no' ? 'urgent' : 'todo'} label={r === 'yes' ? 'Going' : r === 'no' ? 'Not going' : 'No reply'} />
                </li>
              )
            )
          })}
        </ul>
        <Err msg={err} />
        {e.attendeeIds.includes(me.id) && (
          <div className="rsvp" role="group" aria-label="Your reply">
            <span>Going?</span>
            <button className={`btn sm ${mine === 'yes' ? 'primary' : ''}`} aria-pressed={mine === 'yes'} onClick={() => run(() => S.rsvp(me, e.id, 'yes'))}>
              Yes
            </button>
            <button className={`btn sm ${mine === 'no' ? 'danger' : ''}`} aria-pressed={mine === 'no'} onClick={() => run(() => S.rsvp(me, e.id, 'no'))}>
              No
            </button>
          </div>
        )}
        <div className="form-actions">
          <button className="btn ghost sm" onClick={saveIcs}>
            <Icon name="download" size={15} /> .ics
          </button>
          <a className="btn ghost sm" href={gcal(e)} target="_blank" rel="noreferrer">
            Add to Google Calendar
          </a>
          <span className="grow" />
          {editable && (
            <>
              <Confirm
                className="btn danger sm"
                ask={`Cancel “${e.title}”${e.repeat !== 'none' ? ' and every repeat of it' : ''}?`}
                detail="Everyone invited is told."
                yes="Cancel event"
                onYes={() => {
                  run(() => S.deleteEvent(me, e.id))
                  onClose()
                }}
              >
                Cancel event
              </Confirm>
              <button className="btn sm" onClick={onEdit}>
                <Icon name="edit" size={15} /> Edit{e.repeat !== 'none' ? ' series' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function EventForm({ onClose, initial = {}, edit }) {
  const me = useMe()
  const d = useDb()
  const h = Math.min(20, Number(clockNow().slice(0, 2)) + 1)
  const hh = String(h).padStart(2, '0')
  const { v, set, setV, err, run } = useForm(
    edit || { title: '', type: isStaff(me) ? 'meeting' : 'client', date: today(), start: `${hh}:00`, end: `${hh}:30`, repeat: 'none', attendeeIds: [], projectId: '', location: '', agenda: '', ...initial },
  )
  const staffer = isStaff(me)
  // clients can invite the people working on their projects and their own colleagues
  const myProjects = d.projects.filter((p) => p.clientId === me.clientId)
  const options = staffer
    ? d.users.filter((u) => u.active && u.id !== me.id)
    : d.users.filter((u) => u.active && u.id !== me.id && (u.clientId === me.clientId || myProjects.some((p) => p.managerId === u.id || p.memberIds.includes(u.id))))
  const clash = v.date && v.start < v.end ? conflicts(d, { ...v, attendeeIds: [...new Set([me.id, ...v.attendeeIds])] }) : []
  const submit = (e) => {
    e.preventDefault()
    if (run(() => S.saveEvent(me, v))) onClose()
  }
  return (
    <Modal title={edit ? 'Edit event' : staffer ? 'Schedule' : 'Book a meeting with YG'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Title" full>
          <input data-autofocus value={v.title} onChange={set('title')} placeholder="e.g. Diwali Reels — rough cut review" />
        </Field>
        <Field label="Type">
          <select value={v.type} onChange={set('type')}>
            {Object.entries(EVENT_TYPES)
              .filter(([k]) => staffer || k === 'client')
              .map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Repeats">
          <select value={v.repeat} onChange={set('repeat')}>
            {Object.entries(REPEAT).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={v.date} onChange={set('date')} />
        </Field>
        <div className="row-2 field">
          <Field label="Starts">
            <input type="time" step="900" value={v.start} onChange={set('start')} />
          </Field>
          <Field label="Ends">
            <input type="time" step="900" value={v.end} onChange={set('end')} />
          </Field>
        </div>
        <div className="field full">
          <span className="field-label">Who’s invited</span>
          <PeoplePicker value={v.attendeeIds} onChange={(ids) => setV({ ...v, attendeeIds: ids })} options={options} label="Invite someone" />
          <small>You’re added automatically.</small>
        </div>
        {clash.length > 0 && (
          <div className="warn-box full" role="status">
            <b>Heads up — clashes:</b>
            <ul>
              {clash.map((c, i) => (
                <li key={i}>
                  {S.userName(d, c.userId)}: {c.what}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field label="Project (optional)">
          <select value={v.projectId || ''} onChange={set('projectId')}>
            <option value="">—</option>
            {d.projects
              .filter((p) => can(me, 'project.view', p) && p.status !== 'done')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Where" hint={<>A place, or paste a video-call link. <a href="https://meet.new" target="_blank" rel="noreferrer">Create a Google Meet</a></>}>
          <input value={v.location} onChange={set('location')} placeholder="Studio, Gohana · or https://meet.google.com/…" />
        </Field>
        <Field label="Agenda" full>
          <textarea rows={3} value={v.agenda} onChange={set('agenda')} placeholder="What will you cover? What should people bring?" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{edit ? 'Save changes' : 'Send invites'}</button>
        </div>
      </form>
    </Modal>
  )
}
