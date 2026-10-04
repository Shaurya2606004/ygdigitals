import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, isStaff, PERMISSIONS, ROLES } from '../store.js'
import { Avatar, Card, download, Empty, Err, Field, Icon, Modal, PageHead, Tabs, useDb, useForm, useMe } from '../ui.jsx'

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
                {ROLES[me.role].label} — {ROLES[me.role].blurb}
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
            <Icon name="lock" size={14} /> Password and email changes come with real logins. Your role is set by the admin.
          </p>
          <Err msg={err} />
          <div className="form-actions">
            {saved && <span className="muted small">Saved.</span>}
            <button className="btn primary">Save profile</button>
          </div>
        </form>
      </Card>
      {can(me, 'org.manage') && (
        <Card title="Demo data">
          <p className="small muted">Everything you see lives in this browser only. Export a backup before you reset, or to carry it over to the live version.</p>
          <div className="row-actions">
            <button className="btn sm" onClick={() => download(`yg-hub-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2), 'application/json')}>
              <Icon name="download" size={14} /> Export backup
            </button>
            <button className="btn sm danger" onClick={() => confirm('Reset everything back to the sample studio? All changes in this browser are lost.') && S.resetDemo()}>
              Reset demo data
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

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
        <p className="muted">Everyone at YG who can sign in. The admin adds people and sets their role.</p>
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
                  <span className="pill grey">{u.active ? ROLES[u.role].label : 'Deactivated'}</span>
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
                  {admin && u.id !== me.id && (
                    <button
                      className={`btn sm ${u.active ? 'danger' : ''}`}
                      onClick={() => {
                        if (!u.active || confirm(`Deactivate ${u.name}? They can’t sign in any more; their tasks stay with them until you hand them on.`))
                          try {
                            S.setActive(me, u.id, !u.active)
                            setErr('')
                          } catch (x) {
                            setErr(x.message)
                          }
                      }}
                    >
                      {u.active ? 'Deactivate' : 'Reactivate'}
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
  const [login, setLogin] = useState(null) // clientId to add a login for
  const [err, setErr] = useState('')
  const admin = can(me, 'org.manage')
  if (!d.clients.length) return <Empty icon="briefcase" title="No clients yet" />
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
                  <button className="btn sm" onClick={() => setForm(c)}>
                    Edit
                  </button>
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
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          try {
                            S.setActive(me, u.id, !u.active)
                          } catch (x) {
                            setErr(x.message)
                          }
                        }}
                      >
                        {u.active ? 'Revoke' : 'Restore'}
                      </button>
                    )}
                  </span>
                ))}
                {!logins.length && <span className="small muted">No portal login yet.</span>}
                {admin && (
                  <button className="btn sm ghost" onClick={() => setLogin(c.id)}>
                    <Icon name="plus" size={14} /> Add login
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {form && <ClientForm edit={form.id ? form : null} onClose={() => setForm(null)} />}
      {login && <PersonForm clientId={login} onClose={() => setLogin(null)} />}
    </>
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
                    {who.includes(r) ? (
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

function PersonForm({ onClose, edit, clientId }) {
  const me = useMe()
  const d = useDb()
  const { v, set, setV, err, run } = useForm(edit || { name: '', email: '', role: clientId ? 'client' : 'member', clientId: clientId || '', title: '', phone: '' })
  return (
    <Modal title={edit ? `Edit ${edit.name}` : clientId ? `Login for ${byId(d.clients, clientId)?.name}` : 'Add a person'} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.savePerson(me, v))) onClose()
        }}
      >
        <Field label="Full name">
          <input data-autofocus value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Email (their login)">
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        {!clientId && (
          <Field label="Role" hint={ROLES[v.role]?.blurb}>
            <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} disabled={edit?.id === me.id}>
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {v.role === 'client' && !clientId && (
          <Field label="Client">
            <select value={v.clientId || ''} onChange={set('clientId')}>
              <option value="">Pick…</option>
              {d.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
        {!edit && <p className="muted small">Demo mode: new logins use the demo password. Once live, they get an email invite to set their own.</p>}
        <Err msg={err} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">{edit ? 'Save' : 'Add'}</button>
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
