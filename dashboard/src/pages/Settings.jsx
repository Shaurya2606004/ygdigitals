import * as S from '../store.js'
import { can, isStaff, PERMISSIONS, ROLES } from '../store.js'
import { Avatar, Card, download, Err, Field, Icon, PageHead, useDb, useForm, useMe } from '../ui.jsx'

export default function Settings() {
  const me = useMe()
  return (
    <div className="page">
      <PageHead title="Settings" sub="Your profile, how roles work, and company details." />
      <div className="cols">
        <div className="col-main">
          <Profile me={me} />
          {isStaff(me) && <RolesMatrix />}
        </div>
        <div className="col-side">
          {can(me, 'org.settings') && <Company />}
          {can(me, 'org.settings') && <DemoData />}
        </div>
      </div>
    </div>
  )
}

function Profile({ me }) {
  const { v, set, err, run, setErr } = useForm({ name: me.name, title: me.title, phone: me.phone, about: me.about, skills: me.skills.join(', ') })
  const staffer = isStaff(me)
  return (
    <Card title="Your profile">
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.updateProfile(me, { ...v, skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean) }))) setErr('')
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
        <Field label="Job title">
          <input value={v.title} onChange={set('title')} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={v.phone} onChange={set('phone')} />
        </Field>
        {staffer && (
          <Field label="Skills" hint="Comma separated">
            <input value={v.skills} onChange={set('skills')} />
          </Field>
        )}
        <Field label="About you" full>
          <textarea rows={2} value={v.about} onChange={set('about')} placeholder="What you work on, working hours, how you like to get briefs…" />
        </Field>
        <p className="full muted small">
          <Icon name="lock" size={14} /> Password and email changes come with real logins (Supabase Auth). Your role and team are set by an admin.
        </p>
        <Err msg={err} />
        <div className="form-actions">
          <button className="btn primary">Save profile</button>
        </div>
      </form>
    </Card>
  )
}

function RolesMatrix() {
  const roles = Object.keys(ROLES)
  return (
    <Card title="Roles & permissions">
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
                    {who.includes(r) ? <span className="yes" aria-label="Yes">✓</span> : <span className="no" aria-label="No">—</span>}
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

function Company() {
  const me = useMe()
  const d = useDb()
  const { v, set, err, run, setErr } = useForm({ ...d.org })
  return (
    <Card title="Company (on invoices)">
      <form
        className="form-grid one"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => S.saveOrg(me, v))) setErr('')
        }}
      >
        <Field label="Business name">
          <input value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Address">
          <input value={v.address} onChange={set('address')} />
        </Field>
        <Field label="Email">
          <input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input value={v.phone} onChange={set('phone')} />
        </Field>
        <Field label="GSTIN">
          <input value={v.gstin} onChange={set('gstin')} placeholder="06XXXXX0000X1ZX" />
        </Field>
        <Field label="Bank details">
          <textarea rows={3} value={v.bank} onChange={set('bank')} placeholder={'Account name\nA/c no.\nIFSC'} />
        </Field>
        <Field label="UPI ID">
          <input value={v.upi} onChange={set('upi')} placeholder="ygdigitals@okhdfcbank" />
        </Field>
        <Err msg={err} />
        <div className="form-actions">
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Card>
  )
}

function DemoData() {
  const d = useDb()
  return (
    <Card title="Demo data">
      <p className="small muted">Everything you see lives in this browser only. Export a backup before you reset, or to hand over to the live version.</p>
      <div className="row-actions">
        <button className="btn sm" onClick={() => download(`yg-hub-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2), 'application/json')}>
          <Icon name="download" size={14} /> Export backup
        </button>
        <button className="btn sm danger" onClick={() => confirm('Reset everything back to the sample studio? All changes in this browser are lost.') && S.resetDemo()}>
          Reset demo data
        </button>
      </div>
    </Card>
  )
}
