import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, invoiceState, invoiceTotals, PROJECT_STATUS, progress, staff } from '../store.js'
import { Avatar, Bar, Card, Empty, Err, Field, Icon, Modal, PageHead, PeopleOptions, Status, TeamTag, useDb, useForm, useMe } from '../ui.jsx'
import { fmtDay, inr, today } from '../util.js'
import { PersonForm } from './People.jsx'
import { ProjectForm } from './Projects.jsx'

const owed = (d, clientId) =>
  d.invoices
    .filter((i) => i.clientId === clientId && ['sent', 'overdue'].includes(invoiceState(i)))
    .reduce((s, i) => s + invoiceTotals(i).total, 0)

export default function Clients({ args }) {
  return args[0] ? <ClientPage id={args[0]} /> : <ClientList />
}

function ClientList() {
  const me = useMe()
  const d = useDb()
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const money = can(me, 'invoices.manage')
  const list = d.clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
  const retainers = d.clients.filter((c) => c.plan === 'retainer').reduce((s, c) => s + Number(c.fee || 0), 0)
  return (
    <div className="page">
      <PageHead title="Clients" sub={`${d.clients.length} clients${money ? ` · ${inr(retainers)} a month in retainers` : ''}`}>
        {can(me, 'clients.manage') && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add client
          </button>
        )}
      </PageHead>
      <div className="toolbar">
        <div className="filters">
          <input type="search" placeholder="Filter clients" aria-label="Filter clients" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Services</th>
              <th>Plan</th>
              <th>Account manager</th>
              <th className="num">Open projects</th>
              {money && <th className="num">Owed</th>}
              <th>Portal</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const logins = S.clientUsers(d, c.id).length
              const due = owed(d, c.id)
              return (
                <tr key={c.id}>
                  <td>
                    <a href={`#/clients/${c.id}`}>
                      <b>{c.name}</b>
                    </a>
                    <small className="block muted">
                      {c.industry} · {c.city}
                    </small>
                  </td>
                  <td>
                    <span className="tags">
                      {c.teamIds.map((id) => (
                        <TeamTag key={id} team={byId(d.teams, id)} />
                      ))}
                    </span>
                  </td>
                  <td>
                    {c.plan === 'retainer' ? 'Retainer' : 'Project'}
                    {money && <small className="block muted">{inr(c.fee)}{c.plan === 'retainer' ? ' / month' : ''}</small>}
                  </td>
                  <td>{S.userName(d, c.managerId)}</td>
                  <td className="num">{d.projects.filter((p) => p.clientId === c.id && p.status !== 'done').length}</td>
                  {money && <td className={`num ${due ? 'warn-text' : 'muted'}`}>{due ? inr(due) : '—'}</td>}
                  <td>{logins ? <span className="pill green">{logins} login{logins > 1 ? 's' : ''}</span> : <span className="pill grey">No login</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!list.length && <Empty icon="briefcase" title="No clients match" />}
      {adding && <ClientForm onClose={() => setAdding(false)} />}
    </div>
  )
}

function ClientPage({ id }) {
  const me = useMe()
  const d = useDb()
  const [editing, setEditing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const [err, setErr] = useState('')
  const c = byId(d.clients, id)
  if (!c) return <div className="page"><Empty icon="briefcase" title="Client not found" /></div>
  const money = can(me, 'invoices.manage')
  const projects = d.projects.filter((p) => p.clientId === id)
  const logins = d.users.filter((u) => u.role === 'client' && u.clientId === id)
  const invoices = d.invoices.filter((i) => i.clientId === id).sort((a, b) => b.date.localeCompare(a.date))
  const month = today().slice(0, 7)
  const posts = d.posts.filter((p) => p.clientId === id && p.date.slice(0, 7) === month)
  return (
    <div className="page">
      <a href="#/clients" className="back">
        <Icon name="left" size={16} /> Clients
      </a>
      <PageHead title={c.name} sub={`${c.industry} · ${c.city} · client since ${fmtDay(c.since)}`}>
        {can(me, 'clients.manage') && (
          <button className="btn" onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} /> Edit
          </button>
        )}
        {can(me, 'project.create') && (
          <button className="btn primary" onClick={() => setNewProject(true)}>
            <Icon name="plus" /> New project
          </button>
        )}
      </PageHead>
      <Err msg={err} />
      <div className="cols">
        <div className="col-main">
          <Card title="Projects">
            {projects.length ? (
              <ul className="list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <a href={`#/projects/${p.id}`} className="row project-row">
                      <span className="grow">
                        <b>{p.name}</b>
                        <small>
                          {p.status === 'done' ? 'Delivered' : 'Due'} {fmtDay(p.due)}
                        </small>
                      </span>
                      <Status s={p.status} label={PROJECT_STATUS[p.status]} />
                      <span className="prog">
                        <Bar pct={progress(d, p.id)} label={`${p.name} progress`} />
                        <small>{progress(d, p.id)}%</small>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="folder" title="No projects yet" />
            )}
          </Card>
          {money && (
            <Card title="Invoices" action={<a href={`#/invoices/new/${id}`}>New invoice</a>}>
              {invoices.length ? (
                <ul className="list">
                  {invoices.map((i) => (
                    <li key={i.id}>
                      <a href={`#/invoices/${i.id}`} className="row">
                        <span className="grow">
                          <b>{i.no}</b>
                          <small>
                            {fmtDay(i.date)} · due {fmtDay(i.due)}
                          </small>
                        </span>
                        <b>{inr(invoiceTotals(i).total)}</b>
                        <Status s={invoiceState(i)} label={S.INVOICE_STATUS[invoiceState(i)]} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon="receipt" title="No invoices yet" />
              )}
            </Card>
          )}
        </div>
        <div className="col-side">
          <Card title="Account">
            <dl className="props">
              <dt>Contact</dt>
              <dd>{c.contact || '—'}</dd>
              <dt>Email</dt>
              <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
              <dt>Phone</dt>
              <dd>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : '—'}</dd>
              <dt>Plan</dt>
              <dd>
                {c.plan === 'retainer' ? 'Monthly retainer' : 'Project basis'}
                {money && ` · ${inr(c.fee)}${c.plan === 'retainer' ? '/mo' : ''}`}
              </dd>
              <dt>Manager</dt>
              <dd>{S.userName(d, c.managerId)}</dd>
              {money && (
                <>
                  <dt>Owed now</dt>
                  <dd>{inr(owed(d, id))}</dd>
                </>
              )}
              <dt>This month</dt>
              <dd>
                <a href="#/content">{posts.length} posts planned</a>
              </dd>
            </dl>
            <p className="tags">
              {c.teamIds.map((t) => (
                <TeamTag key={t} team={byId(d.teams, t)} />
              ))}
            </p>
            {c.notes && <p className="note-box prewrap">{c.notes}</p>}
          </Card>
          <Card
            title="Portal logins"
            action={
              can(me, 'people.manage') && (
                <button className="btn sm" onClick={() => setInviting(true)}>
                  <Icon name="plus" size={14} /> Add login
                </button>
              )
            }
          >
            {logins.length ? (
              <ul className="list">
                {logins.map((u) => (
                  <li key={u.id} className="row">
                    <Avatar user={u} size={30} />
                    <span className="grow">
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </span>
                    {can(me, 'people.manage', u) && (
                      <button
                        className="btn sm ghost"
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
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="lock" title="No portal login yet">
                Give the client a login so they can follow progress and approve work here instead of on WhatsApp.
              </Empty>
            )}
          </Card>
        </div>
      </div>
      {editing && <ClientForm edit={c} onClose={() => setEditing(false)} />}
      {inviting && <PersonForm clientId={id} onClose={() => setInviting(false)} />}
      {newProject && <ProjectForm onClose={() => setNewProject(false)} initial={{ clientId: id, teamIds: c.teamIds.slice(0, 1), managerId: c.managerId }} />}
    </div>
  )
}

export function ClientForm({ onClose, edit }) {
  const me = useMe()
  const d = useDb()
  const { v, set, setV, err, run } = useForm(edit || { name: '', industry: '', city: '', contact: '', email: '', phone: '', plan: 'retainer', fee: '', teamIds: [], managerId: me.id, notes: '' })
  const toggle = (id) => setV({ ...v, teamIds: v.teamIds.includes(id) ? v.teamIds.filter((x) => x !== id) : [...v.teamIds, id] })
  return (
    <Modal title={edit ? `Edit ${edit.name}` : 'Add a client'} onClose={onClose} wide>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.saveClient(me, { ...v, fee: Number(v.fee) || 0 }))) onClose()
        }}
      >
        <Field label="Business name">
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
        <Field label="Email">
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Phone / WhatsApp">
          <input type="tel" value={v.phone} onChange={set('phone')} />
        </Field>
        <Field label="Plan">
          <select value={v.plan} onChange={set('plan')}>
            <option value="retainer">Monthly retainer</option>
            <option value="project">Project basis</option>
          </select>
        </Field>
        <Field label={v.plan === 'retainer' ? 'Fee per month (₹)' : 'Project value (₹)'}>
          <input type="number" min="0" step="500" value={v.fee} onChange={set('fee')} />
        </Field>
        <Field label="Account manager">
          <select value={v.managerId} onChange={set('managerId')}>
            <PeopleOptions users={staff(d).filter((u) => u.role !== 'member')} />
          </select>
        </Field>
        <div className="field full">
          <span className="field-label">Services</span>
          <div className="team-checks">
            {d.teams
              .filter((t) => t.id !== 'mgmt')
              .map((t) => (
                <label key={t.id} className={`team-check ${v.teamIds.includes(t.id) ? 'on' : ''}`} style={{ '--c': t.color }}>
                  <input type="checkbox" checked={v.teamIds.includes(t.id)} onChange={() => toggle(t.id)} />
                  {t.name}
                </label>
              ))}
          </div>
        </div>
        <Field label="Notes for the team" full>
          <textarea rows={3} value={v.notes} onChange={set('notes')} placeholder="How they like to work, who approves, anything sensitive…" />
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
