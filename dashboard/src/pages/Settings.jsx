import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, DEPTS, isStaff, level, PERMISSIONS, PERSON_DEPTS, ROLES } from '../store.js'
import { Avatar, Card, Confirm, download, Empty, Err, Field, Icon, Modal, PageHead, Tabs, useDb, useForm, useMe } from '../ui.jsx'

export default function Settings({ args }) {
  const me = useMe()
  const staffer = isStaff(me)
  const tabs = [['profile', 'Profile'], staffer && ['team', 'Team'], staffer && ['clients', 'Clients'], staffer && ['roles', 'Roles']].filter(Boolean)
  const tab = tabs.some(([k]) => k === args[0]) ? args[0] : 'profile'
  return (
    <div className="page">
      <PageHead title="Settings" sub={staffer ? 'Your profile, the team, clients and their logins, and who can do what.' : 'Your profile.'} />
      {tabs.length > 1 && <Tabs label="Settings sections" value={tab} onChange={(t) => (location.hash = `#/settings${t === 'profile' ? '' : `/${t}`}`)} tabs={tabs} />}
      <div className="tab-body">
        {tab === 'profile' && <Profile me={me} />}
        {tab === 'team' && <Team />}
        {tab === 'clients' && <Clients />}
        {tab === 'roles' && <Roles />}
      </div>
    </div>
  )
}

function Profile({ me }) {
  const d = useDb()
  const { v, set, err, run } = useForm({ name: me.name, title: me.title, phone: me.phone })
  const [saved, setSaved] = useState(false)
  return (
    <div className="cols">
      <Card title="Your profile">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            setSaved(run(() => S.updateProfile(me, v)))
          }}
        >
          <div className="full who big">
            <Avatar user={me} size={48} />
            <span>
              <b>{me.email}</b>
              <small className="muted block">
                {ROLES[level(me)].label} — {ROLES[level(me)].blurb}
              </small>
            </span>
          </div>
          <Field label="Name">
            <input value={v.name} onChange={set('name')} />
          </Field>
          <Field label={me.role === 'client' ? 'Your role at the company' : 'What you do'}>
            <input value={v.title} onChange={set('title')} />
          </Field>
          <Field label="Phone / WhatsApp">
            <input type="tel" value={v.phone} onChange={set('phone')} />
          </Field>
          <p className="full muted small">
            <Icon name="lock" size={14} />{' '}
            {me.role === 'admin' ? 'Change your login email under Team. Only another supervisor or owner can change your role.' : 'Your email (your login) and role are set by your supervisor.'}
          </p>
          <Err msg={err} />
          <div className="form-actions">
            {saved && <span className="muted small">Saved.</span>}
            <button className="btn primary">Save profile</button>
          </div>
        </form>
      </Card>
      <div className="col-side">
        {S.live && <PasswordCard />}
        {can(me, 'org.manage') && (
          <Card title="Backup">
            <p className="small muted">Download a copy of everything in YG Hub — projects, tasks, approvals, chat — as one file. Keep one now and then.</p>
            <button className="btn sm" onClick={() => download(`yg-hub-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2), 'application/json')}>
              <Icon name="download" size={14} /> Download backup
            </button>
          </Card>
        )}
      </div>
    </div>
  )
}

function PasswordCard() {
  const { v, set, setV, err, runAsync, busy } = useForm({ password: '', again: '' })
  const [saved, setSaved] = useState(false)
  return (
    <Card title="Change password">
      <form
        className="form-grid one"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaved(false)
          const ok = await runAsync(() => {
            if (v.password !== v.again) throw new Error('The two passwords don’t match.')
            return S.changePassword(v.password)
          })
          if (ok) {
            setV({ password: '', again: '' })
            setSaved(true)
          }
        }}
      >
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" value={v.password} onChange={set('password')} />
        </Field>
        <Field label="Type it again">
          <input type="password" autoComplete="new-password" value={v.again} onChange={set('again')} />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          {saved && <span className="muted small">Password changed.</span>}
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </Card>
  )
}

// for actions that may wait on the server: shows their error in place of throwing
const attempt = (fn, setErr) => Promise.resolve().then(fn).then(() => setErr(''), (x) => setErr(x.message))

function Team() {
  const me = useMe()
  const d = useDb()
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')
  const admin = can(me, 'org.manage')
  const people = d.users.filter((u) => u.role !== 'client' && (admin || u.active))
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          {admin ? 'Everyone at YG who can sign in. Edit someone to change their role or set them a new password.' : 'Everyone at YG who can sign in. A supervisor adds people and sets their role.'}
        </p>
        {admin && (
          <button className="btn primary" onClick={() => setForm({})}>
            <Icon name="plus" /> Add person
          </button>
        )}
      </div>
      <Err msg={err} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Contact</th>
              <th className="num">Open tasks</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'muted'}>
                <td>
                  <span className="who">
                    <Avatar user={u} size={30} />
                    <span>
                      <b>{u.name}</b>
                      <small className="block muted">{u.title}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="pill grey">{u.active ? ROLES[level(u)].label : 'Deactivated'}</span>
                  {u.dept && <small className="block muted">{PERSON_DEPTS[u.dept]}</small>}
                </td>
                <td className="small">
                  <a href={`mailto:${u.email}`}>{u.email}</a>
                  {u.phone && <small className="block muted">{u.phone}</small>}
                </td>
                <td className="num">{d.tasks.filter((t) => t.assigneeId === u.id && t.status !== 'done').length}</td>
                <td className="row-actions end">
                  {u.id !== me.id && u.active && (
                    <button className="btn sm ghost" onClick={() => (location.hash = `#/chat/${S.openDm(me, u.id)}`)}>
                      <Icon name="chat" size={14} /> Message
                    </button>
                  )}
                  {admin && (
                    <button className="btn sm" onClick={() => setForm(u)}>
                      Edit
                    </button>
                  )}
                  {admin && u.id !== me.id && u.active && (
                    <Confirm
                      className="btn sm danger"
                      ask={`Deactivate ${u.name}?`}
                      detail="They can’t sign in any more. Their tasks stay with them until you hand them on."
                      yes="Deactivate"
                      onYes={() => attempt(() => S.setActive(me, u.id, false), setErr)}
                    >
                      Deactivate
                    </Confirm>
                  )}
                  {admin && u.id !== me.id && !u.active && (
                    <button className="btn sm" onClick={() => attempt(() => S.setActive(me, u.id, true), setErr)}>
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && <PersonForm edit={form.id ? form : null} onClose={() => setForm(null)} />}
    </>
  )
}

function Clients() {
  const me = useMe()
  const d = useDb()
  const [form, setForm] = useState(null) // {client} to edit, {} for new
  const [login, setLogin] = useState(null) // {clientId, edit?, fill?}: a portal login to add or edit
  const [deleting, setDeleting] = useState(null) // the client to delete
  const [err, setErr] = useState('')
  const admin = can(me, 'org.manage')
  return (
    <>
      <div className="toolbar">
        <p className="muted">Each client can have one or more logins to the portal. They only ever see their own projects.</p>
        {admin && (
          <button className="btn primary" onClick={() => setForm({})}>
            <Icon name="plus" /> Add client
          </button>
        )}
      </div>
      <Err msg={err} />
      {!d.clients.length && <Empty icon="briefcase" title="No clients yet">{admin && 'Add a client, then give them a portal login.'}</Empty>}
      <div className="client-list">
        {d.clients.map((c) => {
          const logins = d.users.filter((u) => u.role === 'client' && u.clientId === c.id)
          const open = d.projects.filter((p) => p.clientId === c.id && p.status !== 'done')
          return (
            <article key={c.id} className="card">
              <header className="card-head">
                <h2>
                  {c.name} <small className="muted">· {[c.industry, c.city].filter(Boolean).join(' · ')}</small>
                </h2>
                {admin && (
                  <span className="row-actions">
                    <button className="btn sm" onClick={() => setForm(c)}>
                      Edit
                    </button>
                    <button className="btn sm danger" onClick={() => setDeleting(c)}>
                      <Icon name="trash" size={14} /> Delete
                    </button>
                  </span>
                )}
              </header>
              <p className="small muted">
                {c.contact}
                {c.email && (
                  <>
                    {' '}
                    · <a href={`mailto:${c.email}`}>{c.email}</a>
                  </>
                )}
                {c.phone && ` · ${c.phone}`}
                {' · '}
                {open.length ? open.map((p) => p.name).join(', ') : 'No open projects'}
              </p>
              {c.notes && <p className="note-box prewrap">{c.notes}</p>}
              <div className="logins">
                {logins.map((u) => (
                  <span key={u.id} className={`chip ${u.active ? '' : 'muted'}`}>
                    <Avatar user={u} size={20} />
                    {u.name}
                    {admin && (
                      <>
                        <button type="button" className="link-btn" onClick={() => setLogin({ clientId: c.id, edit: u })}>
                          Edit
                        </button>
                        {u.active ? (
                          <Confirm className="link-btn" ask={`Revoke ${u.name}’s login?`} detail="They can’t sign in until you restore it." yes="Revoke" onYes={() => attempt(() => S.setActive(me, u.id, false), setErr)}>
                            Revoke
                          </Confirm>
                        ) : (
                          <button type="button" className="link-btn" onClick={() => attempt(() => S.setActive(me, u.id, true), setErr)}>
                            Restore
                          </button>
                        )}
                      </>
                    )}
                  </span>
                ))}
                {!logins.length && <span className="small muted">No portal login yet.</span>}
                {admin && (
                  // the first login is usually the contact person, so start from their details
                  <button className="btn sm ghost" onClick={() => setLogin({ clientId: c.id, fill: logins.length ? null : { name: c.contact, email: c.email, phone: c.phone } })}>
                    <Icon name="plus" size={14} /> Add login
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {form && <ClientForm edit={form.id ? form : null} onClose={() => setForm(null)} />}
      {login && <PersonForm {...login} onClose={() => setLogin(null)} />}
      {deleting && <DeleteClient c={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}

// deleting a client can't be undone, so say exactly what goes and ask for their name
function DeleteClient({ c, onClose }) {
  const me = useMe()
  const d = useDb()
  const { v, set, err, run } = useForm({ confirm: '' })
  const pids = d.projects.filter((p) => p.clientId === c.id).map((p) => p.id)
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const goes = [
    count(pids.length, 'project', 'projects'),
    count(d.tasks.filter((t) => pids.includes(t.projectId)).length, 'task', 'tasks'),
    count(d.deliverables.filter((x) => pids.includes(x.projectId)).length, 'piece of work for approval', 'pieces of work for approval'),
    count(d.posts.filter((p) => p.clientId === c.id).length, 'content post', 'content posts'),
    count(d.users.filter((u) => u.clientId === c.id).length, 'portal login', 'portal logins'),
  ]
  const match = v.confirm.trim().toLowerCase() === c.name.toLowerCase()
  return (
    <Modal title={`Delete ${c.name}?`} onClose={onClose}>
      <form
        className="form-grid one"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.deleteClient(me, c.id, v.confirm))) onClose()
        }}
      >
        <p>
          This deletes the client and everything of theirs: <b>{goes.join(', ')}</b>, and their project discussions. Meetings stay on the
          calendar. <b>It can’t be undone.</b>
        </p>
        <Field label={`Type “${c.name}” to confirm`}>
          <input data-autofocus value={v.confirm} onChange={set('confirm')} autoComplete="off" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger" disabled={!match}>
            <Icon name="trash" size={16} /> Delete forever
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Roles() {
  const roles = Object.keys(ROLES)
  return (
    <Card title="Who can do what">
      <ul className="role-list">
        {roles.map((r) => (
          <li key={r}>
            <b>{ROLES[r].label}</b>
            <span className="muted">{ROLES[r].blurb}</span>
          </li>
        ))}
      </ul>
      <div className="table-wrap">
        <table className="table matrix">
          <thead>
            <tr>
              <th>Can…</th>
              {roles.map((r) => (
                <th key={r} className="c">
                  {ROLES[r].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map(([what, who]) => (
              <tr key={what}>
                <td>{what}</td>
                {roles.map((r) => (
                  <td key={r} className="c">
                    {who.includes(r) || (r === 'owner' && who.includes('admin')) ? (
                      <span className="yes" aria-label="Yes">
                        ✓
                      </span>
                    ) : (
                      <span className="no" aria-label="No">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// a team login (from Team), or a client's portal login (from Clients, which passes clientId)
function PersonForm({ onClose, edit, clientId, fill }) {
  const me = useMe()
  const d = useDb()
  const { v, set, setV, err, runAsync, busy } = useForm({ password: '', dept: '', sendEmail: true, ...(edit ? { ...edit, role: level(edit) } : { name: '', email: '', role: clientId ? 'client' : 'member', clientId: clientId || '', title: '', phone: '', ...fill }) })
  return (
    <Modal title={edit ? `Edit ${edit.name}` : clientId ? `Login for ${byId(d.clients, clientId)?.name}` : 'Add a person'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await runAsync(() => S.savePerson(me, v))) onClose()
        }}
      >
        <Field label="Full name">
          <input data-autofocus value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Email (their login)">
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        {!clientId && (
          <Field label="Role" hint={edit?.id === me.id ? 'Only another supervisor or owner can change your role.' : ROLES[v.role]?.blurb}>
            <select value={v.role} onChange={set('role')} disabled={edit?.id === me.id}>
              {Object.entries(ROLES)
                .filter(([k]) => k !== 'client') // client logins are added under their client (Settings › Clients)
                .map(([k, r]) => (
                  <option key={k} value={k}>
                    {r.label}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {v.role !== 'client' && (
          <Field
            label="Department"
            hint={
              ['owner', 'admin'].includes(v.role)
                ? 'Supervisors and owners see the whole studio whatever this says.'
                : v.role === 'freelancer'
                  ? 'Freelancers see only the projects they’re on; this is a label.'
                  : v.dept === 'all'
                    ? 'Sees the whole studio, like a supervisor, but can’t manage people or check work.'
                    : v.dept
                      ? `Sees ${PERSON_DEPTS[v.dept]} work, plus anything they own, made or lead.`
                      : 'No department: sees only the work they own, made or lead.'
            }
          >
            <select value={v.dept || ''} onChange={set('dept')}>
              <option value="">None</option>
              {Object.entries(v.role === 'member' ? PERSON_DEPTS : DEPTS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={v.role === 'client' ? 'Their role at the company' : 'What they do'}>
          <input value={v.title} onChange={set('title')} placeholder={v.role === 'client' ? 'e.g. Marketing Head' : 'e.g. Shoots & video editing'} />
        </Field>
        <Field label="Phone / WhatsApp">
          <input type="tel" value={v.phone} onChange={set('phone')} placeholder="+91 …" />
        </Field>
        {S.live && (
          <Field
            label={edit ? 'New password (optional)' : 'Temporary password'}
            hint={edit ? 'Only if they forgot theirs. Share it with them; they can change it in Settings.' : 'At least 8 characters. It goes in their welcome email (or share it yourself); they can change it in Settings › Profile.'}
            full
          >
            <input type="text" autoComplete="off" spellCheck={false} value={v.password} onChange={set('password')} />
          </Field>
        )}
        {S.live && !edit && (
          <label className="check-field full">
            <input type="checkbox" checked={v.sendEmail} onChange={set('sendEmail')} />
            <span>
              <b>Email them their login</b> — the sign-in link and this temporary password, from hub@ygdigitals.com.
            </span>
          </label>
        )}
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : edit ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ClientForm({ onClose, edit }) {
  const me = useMe()
  const { v, set, err, run } = useForm(edit || { name: '', industry: '', city: '', contact: '', email: '', phone: '', notes: '' })
  return (
    <Modal title={edit ? `Edit ${edit.name}` : 'Add a client'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.saveClient(me, v))) onClose()
        }}
      >
        <Field label="Business name" full>
          <input data-autofocus value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Industry">
          <input value={v.industry} onChange={set('industry')} placeholder="e.g. Real estate" />
        </Field>
        <Field label="City">
          <input value={v.city} onChange={set('city')} />
        </Field>
        <Field label="Contact person">
          <input value={v.contact} onChange={set('contact')} />
        </Field>
        <Field label="Phone / WhatsApp">
          <input type="tel" value={v.phone} onChange={set('phone')} />
        </Field>
        <Field label="Email" full>
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Notes for the team" hint="Only the YG team sees these." full>
          <textarea rows={3} value={v.notes} onChange={set('notes')} placeholder="Who approves, how they like to work, anything sensitive…" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{edit ? 'Save' : 'Add client'}</button>
        </div>
      </form>
    </Modal>
  )
}
