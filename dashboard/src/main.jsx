import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/unbounded/700.css'
import './styles.css'
import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as S from './store.js'
import { byId, can, isStaff, readNotifications, ROLES, unread, userName } from './store.js'
import { seed } from './seed.js'
import { Avatar, Empty, Icon, MeCtx, Menu, useDb } from './ui.jsx'
import { ago } from './util.js'
import Calendar, { EventForm } from './pages/Calendar.jsx'
import Chat from './pages/Chat.jsx'
import Content, { PostForm } from './pages/Content.jsx'
import Home from './pages/Home.jsx'
import Leave from './pages/Leave.jsx'
import Projects, { ProjectForm } from './pages/Projects.jsx'
import Settings from './pages/Settings.jsx'
import Tasks, { TaskForm } from './pages/Tasks.jsx'

// dev only: one-click sign-in as any sample account (loaded by scripts/seed-sql.mjs with this password).
// Production builds define it as '' (vite.config.js), which drops the buttons and the sample list entirely.
const DEMO_PASSWORD = __DEMO_PASSWORD__
const DEMO = DEMO_PASSWORD ? seed() : null

const NAV = [
  { id: 'home', label: 'Home', icon: 'home', show: () => true, page: Home },
  { id: 'tasks', label: 'Tasks', icon: 'check', show: isStaff, page: Tasks },
  { id: 'projects', label: 'Projects', icon: 'folder', show: () => true, page: Projects },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', show: () => true, page: Calendar },
  { id: 'leave', label: 'Leave', icon: 'sun', show: isStaff, page: Leave },
  { id: 'chat', label: 'Messages', icon: 'chat', show: () => true, page: Chat },
  { id: 'content', label: 'Content plan', icon: 'grid', show: (u) => u.role !== 'freelancer', page: Content },
  { id: 'settings', label: 'Settings', icon: 'sliders', show: () => true, page: Settings },
]

function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const f = () => setHash(location.hash)
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('yg-hub-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('yg-hub-theme', theme)
    } catch {
      /* theme just won't be remembered */
    }
  }, [theme])
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')]
}

function App() {
  const d = useDb()
  const session = S.getSession()
  if (!S.live) return <Splash text="YG Hub isn’t connected yet: copy dashboard/.env.example to .env.local and fill it in." />
  if (session === undefined) return <Splash />
  if (!session) return <Login />
  if (!S.isLoaded()) return <Splash error={S.getNotice()} />
  const me = byId(d.users, session.userId)
  if (!me?.active) return <Splash error="This login has no access to YG Hub any more. Ask your admin." />
  return (
    <MeCtx.Provider value={me.id}>
      <Shell me={me} signOut={S.signOut} />
    </MeCtx.Provider>
  )
}

// shown while we check for a saved sign-in and load the studio (well under a second), or when that fails
function Splash({ text, error }) {
  return (
    <div className="splash" role={error ? 'alert' : 'status'}>
      <div className="logo-mark">
        YG<span>Hub</span>
      </div>
      {error ? (
        <>
          <p className="err">{error}</p>
          <div className="row-actions">
            <button className="btn primary" onClick={S.retry}>
              Try again
            </button>
            <button className="btn ghost" onClick={S.signOut}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <p className="muted">{text || 'Loading…'}</p>
      )}
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const attempt = async (e, as) => {
    e?.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await S.signIn(as || email, as ? DEMO_PASSWORD : pw)
      location.hash = '#/'
    } catch (x) {
      setErr(x.message)
      setBusy(false)
    }
  }
  const groups = DEMO && [
    ['YG team', DEMO.users.filter((u) => u.role !== 'client')],
    ['Client portal', DEMO.users.filter((u) => u.role === 'client')],
  ]
  return (
    <div className="login">
      <section className="login-brand">
        <div className="logo-mark">
          YG<span>Hub</span>
        </div>
        <h1>Every shoot, edit, post, page and parcel — in one place.</h1>
        <ul>
          <li>Hand work to each other with a note, instead of losing it in WhatsApp.</li>
          <li>Work goes maker → check → client approval, with every version kept.</li>
          <li>One calendar for stand-ups, shoots and client calls.</li>
          <li>Clients log in to see progress and what’s planned, and approve work.</li>
        </ul>
      </section>
      <section className="login-form">
        <form onSubmit={attempt} className="card">
          <h2>Sign in</h2>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </label>
          {err && (
            <p className="err" role="alert">
              {err}
            </p>
          )}
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="small muted">Forgot your password? Ask your admin to set a new one.</p>
        </form>
        {groups && (
          <div className="demo-accounts">
            {groups.map(([label, users]) => (
              <div key={label}>
                <h3>{label} · sample accounts (dev only)</h3>
                <div className="demo-grid">
                  {users.map((u) => (
                    <button key={u.id} type="button" className="demo-acc" onClick={() => attempt(null, `${u.id}@example.com`)} disabled={busy}>
                      <Avatar user={u} size={32} />
                      <span>
                        <b>{u.name}</b>
                        <small>{u.role === 'client' ? byId(DEMO.clients, u.clientId)?.name : `${ROLES[u.role].label} · ${u.title}`}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function Shell({ me, signOut }) {
  const d = useDb()
  const route = useRoute()
  const [theme, toggleTheme] = useTheme()
  const [navOpen, setNavOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const path = route.join('/')
  // new page → top of it; switching a project tab or opening a task popup keeps your place
  const pageKey = route[0] === 'tasks' ? 'tasks' : route.slice(0, 2).join('/')
  useEffect(() => setNavOpen(false), [path])
  useEffect(() => {
    scrollTo(0, 0) // braces matter: newer browsers return a Promise here, and React treats a returned value as cleanup
  }, [pageKey])

  const nav = NAV.filter((n) => n.show(me))
  const current = NAV.find((n) => n.id === (route[0] || 'home'))
  const Page = current && current.show(me) ? current.page : null
  const unreadChat = d.channels.filter((c) => can(me, 'channel.view', c)).reduce((s, c) => s + unread(d, me, c), 0)
  const myOpen = d.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').length
  const leaveAsks = me.role === 'admin' ? d.leaves.filter((l) => l.status === 'pending' && l.userId !== me.id).length : 0
  const badge = { chat: unreadChat, tasks: myOpen, leave: leaveAsks }
  const client = byId(d.clients, me.clientId)

  return (
    <div className="app">
      <a href="#content" className="skip">
        Skip to content
      </a>
      <aside className={`side ${navOpen ? 'open' : ''}`} aria-label="Main navigation">
        <a href="#/" className="logo-mark small">
          YG<span>Hub</span>
        </a>
        <nav className="nav">
          {nav.map((n) => (
            <a key={n.id} href={`#/${n.id === 'home' ? '' : n.id}`} className={current?.id === n.id ? 'on' : ''} aria-current={current?.id === n.id ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {badge[n.id] > 0 && <span className={`badge ${n.id === 'chat' ? 'hot' : ''}`}>{badge[n.id]}</span>}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me-card">
            <Avatar user={me} size={34} />
            <span>
              <b>{me.name}</b>
              <small>{client ? client.name : ROLES[me.role].label}</small>
            </span>
          </div>
        </div>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="top">
          <button className="icon-btn only-sm" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div className="top-actions">
            <Menu
              className="btn primary"
              title="Create"
              label={
                <>
                  <Icon name="plus" />
                  <span className="hide-sm">New</span>
                </>
              }
            >
              {isStaff(me) && (
                <button className="menu-item" onClick={() => setModal('task')}>
                  <Icon name="check" /> Task
                </button>
              )}
              {can(me, 'project.create') && (
                <button className="menu-item" onClick={() => setModal('project')}>
                  <Icon name="folder" /> Project
                </button>
              )}
              <button className="menu-item" onClick={() => setModal('event')}>
                <Icon name="calendar" /> Meeting
              </button>
              {can(me, 'content.manage') && (
                <button className="menu-item" onClick={() => setModal('post')}>
                  <Icon name="grid" /> Content post
                </button>
              )}
            </Menu>
            <Bell me={me} />
            <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <Menu className="avatar-btn" title="Your account" label={<Avatar user={me} size={32} />}>
              <div className="menu-label">
                <b>{me.name}</b>
                <small>{me.email}</small>
              </div>
              <a className="menu-item" href="#/settings">
                <Icon name="sliders" /> Profile & settings
              </a>
              <button className="menu-item" onClick={signOut}>
                <Icon name="logout" /> Sign out
              </button>
            </Menu>
          </div>
        </header>
        <main id="content" tabIndex={-1}>
          {Page ? (
            <Page args={route.slice(1)} />
          ) : (
            <div className="page">
              <Empty icon="lock" title={current ? 'You don’t have access to this page' : 'Page not found'}>
                <a href="#/">Back to Home</a>
              </Empty>
            </div>
          )}
        </main>
      </div>

      {S.getNotice() && <Toast text={S.getNotice()} />}
      {modal === 'task' && <TaskForm onClose={() => setModal(null)} />}
      {modal === 'project' && <ProjectForm onClose={() => setModal(null)} />}
      {modal === 'event' && <EventForm onClose={() => setModal(null)} />}
      {modal === 'post' && <PostForm onClose={() => setModal(null)} />}
    </div>
  )
}

// a popover sits in the browser's top layer, so it shows above an open dialog too (a z-index can't)
function Toast({ text }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.hidePopover() // re-raise above anything opened since
    el.showPopover()
  })
  return (
    <div ref={ref} popover="manual" className="toast" role="alert">
      <span>{text}</span>
      <button className="icon-btn" onClick={S.dismissNotice} aria-label="Dismiss">
        <Icon name="x" />
      </button>
    </div>
  )
}

function Bell({ me }) {
  const d = useDb()
  const mine = d.notifications.filter((n) => n.userId === me.id)
  const count = mine.filter((n) => !n.read).length
  return (
    <Menu
      className="icon-btn"
      title={`Notifications${count ? ` (${count} unread)` : ''}`}
      label={
        <>
          <Icon name="bell" />
          {count > 0 && <span className="badge hot">{count > 99 ? '99+' : count}</span>}
        </>
      }
    >
      <div className="notifs">
        <div className="notifs-head">
          <strong>Notifications</strong>
          {count > 0 && (
            <button data-keep className="link-btn" onClick={() => readNotifications(me)}>
              Mark all as read
            </button>
          )}
        </div>
        {mine.length === 0 ? (
          <Empty icon="bell" title="You’re all caught up" />
        ) : (
          <ul>
            {mine.slice(0, 40).map((n) => (
              <li key={n.id}>
                <a href={n.link || '#/'} className={`notif ${n.read ? '' : 'new'}`} onClick={() => readNotifications(me, [n.id])}>
                  {n.fromId ? (
                    <Avatar user={byId(d.users, n.fromId)} size={30} />
                  ) : (
                    <span className="av" style={{ '--c': '#e04c5c', '--s': '30px' }} aria-hidden="true">
                      YG
                    </span>
                  )}
                  <span>
                    {/* the morning reminders come from the hub itself */}
                    <b>{n.fromId ? userName(d, n.fromId) : 'YG Hub:'}</b> {n.text}
                    <small>{ago(n.at)}</small>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Menu>
  )
}

// only the app page has #root (a test page can import Shell without starting the app)
const root = document.getElementById('root')
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
