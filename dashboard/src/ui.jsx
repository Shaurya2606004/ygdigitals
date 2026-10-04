import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { byId, getDb, subscribe } from './store.js'
import { initials } from './util.js'

export const useDb = () => useSyncExternalStore(subscribe, getDb)
export const MeCtx = createContext(null)
export function useMe() {
  const d = useDb()
  return byId(d.users, useContext(MeCtx))
}
export const go = (path) => (location.hash = path)

// 24px stroke icons, one path each
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  calendar: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M8 3v4M16 3v4',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  briefcase: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M3 13h18',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 4v6M10 14v6',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  video: 'M15 10l5-3v10l-5-3zM3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  swap: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
}
export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ico">
    <path d={ICONS[name]} />
  </svg>
)

export const Avatar = ({ user, size = 28 }) => (
  <span className={`av ${user && !user.active ? 'off' : ''}`} style={{ '--c': user?.color ?? '#999', '--s': `${size}px` }} title={user?.name ?? ''}>
    {user ? initials(user.name) : '?'}
  </span>
)

export function Avatars({ ids, max = 4, size = 24 }) {
  const d = useDb()
  const users = ids.map((id) => byId(d.users, id)).filter(Boolean)
  return (
    <span className="avs" aria-label={users.map((u) => u.name).join(', ')}>
      {users.slice(0, max).map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {users.length > max && <span className="av more" style={{ '--s': `${size}px` }}>+{users.length - max}</span>}
    </span>
  )
}

const TONES = {
  todo: 'grey', doing: 'blue', review: 'amber', done: 'green',
  planning: 'grey', active: 'blue', hold: 'grey',
  internal: 'amber', changes: 'red', client: 'violet', approved: 'green',
  idea: 'grey', production: 'blue', ready: 'amber', scheduled: 'violet', posted: 'green',
  draft: 'grey', sent: 'blue', paid: 'green', overdue: 'red',
  pending: 'amber', declined: 'red',
  low: 'grey', normal: 'grey', high: 'amber', urgent: 'red',
}
export const Pill = ({ tone = 'grey', children }) => <span className={`pill ${tone}`}>{children}</span>
export const Status = ({ s, label }) => <Pill tone={TONES[s]}>{label}</Pill>

export const Bar = ({ pct, label }) => (
  <span className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <i style={{ width: `${pct}%` }} />
  </span>
)

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null)
  const downOnBackdrop = useRef(false)
  useEffect(() => {
    const el = ref.current
    el.showModal()
    // showModal() moves focus itself, after React's autoFocus already ran — so focus the marked field here
    el.querySelector('[data-autofocus]')?.focus()
    return () => el.open && el.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onMouseDown={(e) => (downOnBackdrop.current = e.target === ref.current)}
      onClick={(e) => downOnBackdrop.current && e.target === ref.current && onClose()}
    >
      <div className="modal-in">
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}

export const Field = ({ label, hint, children, full }) => (
  <label className={`field ${full ? 'full' : ''}`}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
)

export const Err = ({ msg }) =>
  msg ? (
    <p className="err" role="alert">
      {msg}
    </p>
  ) : null

export const Empty = ({ icon = 'check', title, children }) => (
  <div className="empty" role="status">
    <Icon name={icon} size={26} />
    <strong>{title}</strong>
    {children && <p>{children}</p>}
  </div>
)

// form state + "run this action, show its error if it throws"
export function useForm(init) {
  const [v, setV] = useState(init)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
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
  return { v, setV, set, err, setErr, run }
}

// the team first, then client logins, for any <select>
export function PeopleOptions({ users }) {
  const groups = [
    ['YG team', users.filter((u) => u.role !== 'client')],
    ['Clients', users.filter((u) => u.role === 'client')],
  ]
  return groups
    .filter(([, list]) => list.length)
    .map(([name, list]) => (
      <optgroup key={name} label={name}>
        {list.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.title ? ` — ${u.title}` : ''}
          </option>
        ))}
      </optgroup>
    ))
}

export function PeoplePicker({ value, onChange, options, label = 'Add a person' }) {
  const d = useDb()
  const team = options.filter((u) => u.role !== 'client' && !value.includes(u.id))
  return (
    <div className="picker">
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => {
            const u = byId(d.users, id)
            return (
              u && (
                <span key={id} className="chip">
                  <Avatar user={u} size={20} />
                  {u.name}
                  <button type="button" aria-label={`Remove ${u.name}`} onClick={() => onChange(value.filter((x) => x !== id))}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              )
            )
          })}
        </div>
      )}
      <div className="picker-row">
        <select aria-label={label} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">+ {label}…</option>
          <PeopleOptions users={options.filter((u) => !value.includes(u.id))} />
        </select>
        {team.length > 1 && (
          <button type="button" className="btn sm" onClick={() => onChange([...value, ...team.map((u) => u.id)])}>
            + Whole team
          </button>
        )}
      </div>
    </div>
  )
}

export function Menu({ label, children, className = 'btn', align = 'right', title }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const out = (e) => !ref.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', out)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className={className} aria-expanded={open} aria-haspopup="true" aria-label={title} title={title} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className={`menu ${align}`} onClick={(e) => e.target.closest('a,button:not([data-keep])') && setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

export const Tabs = ({ tabs, value, onChange, label }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {tabs.map(([k, text, count]) => (
      <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
        {text}
        {count ? <span className="count">{count}</span> : null}
      </button>
    ))}
  </div>
)

export const Card = ({ title, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {title && (
      <div className="card-head">
        <h2>{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
)

// a meeting's location is either a place or a video-call link
export const isUrl = (s) => /^https?:\/\//.test(s || '')

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </div>
    {children && <div className="actions">{children}</div>}
  </div>
)

// linkify bare URLs and highlight @mentions in chat / comments (rendered as text nodes, never HTML)
export function RichText({ text }) {
  return text.split(/(https?:\/\/\S+|@\w+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : part.startsWith('@') ? (
      <mark key={i} className="mention">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
