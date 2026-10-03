import { useState } from 'react'
import { byId, staff } from '../store.js'
import { Avatar, Bar, Card, download, Icon, PageHead, Tabs, TeamTag, useDb, useMe } from '../ui.jsx'
import { addDays, fmtDay, startOfWeek, today } from '../util.js'
import { Workload } from './Home.jsx'

const CAPACITY = 48 // hours a week: 6 days × 8h, the studio's working week

export default function Reports() {
  const me = useMe()
  const d = useDb()
  const [week, setWeek] = useState(startOfWeek(today()))
  const [scope, setScope] = useState(me.role === 'lead' ? 'team' : 'all')
  const T = today()
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const people = staff(d).filter((u) => scope === 'all' || u.teamId === me.teamId)
  const entries = d.tasks.flatMap((t) => t.time.map((x) => ({ ...x, task: t })))
  const hours = (uid, day) => entries.filter((x) => x.userId === uid && x.date === day).reduce((s, x) => s + x.hours, 0)
  const rows = people.map((u) => ({ u, per: days.map((day) => hours(u.id, day)) })).map((r) => ({ ...r, total: r.per.reduce((s, h) => s + h, 0) }))

  // delivery over the last 30 days
  const since = addDays(T, -30)
  const done = d.tasks.filter((t) => t.completedAt && t.completedAt >= since && (scope === 'all' || t.teamId === me.teamId))
  const withDue = done.filter((t) => t.due)
  const onTime = withDue.filter((t) => t.completedAt <= t.due).length
  const approved = d.deliverables.filter((x) => x.status === 'approved')
  const firstTime = approved.filter((x) => !x.history.some((h) => h.action.startsWith('requested changes'))).length
  const month = T.slice(0, 7)
  const byClient = d.clients
    .map((c) => ({ c, h: entries.filter((x) => x.date.startsWith(month) && byId(d.projects, x.task.projectId)?.clientId === c.id).reduce((s, x) => s + x.hours, 0) }))
    .sort((a, b) => b.h - a.h)
  const maxClient = Math.max(1, ...byClient.map((r) => r.h))
  const byTeam = d.teams
    .filter((t) => t.id !== 'mgmt')
    .map((t) => {
      const list = d.tasks.filter((x) => x.teamId === t.id && x.completedAt && x.completedAt >= since)
      const due = list.filter((x) => x.due)
      return { t, n: list.length, pct: due.length ? Math.round((due.filter((x) => x.completedAt <= x.due).length / due.length) * 100) : null }
    })

  const csv = () => {
    const head = ['Person', 'Team', ...days.map(fmtDay), 'Total']
    const lines = rows.map((r) => [r.u.name, byId(d.teams, r.u.teamId)?.name, ...r.per, r.total])
    download(`timesheet-${week}.csv`, [head, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv')
  }

  return (
    <div className="page">
      <PageHead title="Reports" sub="Workload, timesheets and how reliably work ships.">
        <Tabs
          label="Scope"
          value={scope}
          onChange={setScope}
          tabs={[
            ['team', 'My team'],
            ['all', 'Whole studio'],
          ]}
        />
      </PageHead>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Tasks finished · 30 days</span>
          <span className="kpi-value">{done.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">On time</span>
          <span className={`kpi-value ${withDue.length && onTime / withDue.length < 0.8 ? 'warn' : ''}`}>{withDue.length ? `${Math.round((onTime / withDue.length) * 100)}%` : '—'}</span>
          <span className="kpi-note">
            {onTime} of {withDue.length} with a due date
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Approved first time</span>
          <span className="kpi-value">{approved.length ? `${Math.round((firstTime / approved.length) * 100)}%` : '—'}</span>
          <span className="kpi-note">client approved with no changes</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Hours this week</span>
          <span className="kpi-value">{rows.reduce((s, r) => s + r.total, 0)}h</span>
          <span className="kpi-note">{people.length} people</span>
        </div>
      </div>

      <Card
        title="Timesheet"
        action={
          <div className="row-actions">
            <button className="icon-btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">
              <Icon name="left" />
            </button>
            <span className="small">
              {fmtDay(days[0])} – {fmtDay(days[6])}
            </span>
            <button className="icon-btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">
              <Icon name="right" />
            </button>
            <button className="btn sm" onClick={csv}>
              <Icon name="download" size={14} /> CSV
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="table timesheet">
            <thead>
              <tr>
                <th>Person</th>
                {days.map((day) => (
                  <th key={day} className={`num ${day === T ? 'today' : ''}`}>
                    {fmtDay(day).replace(',', '')}
                  </th>
                ))}
                <th className="num">Total</th>
                <th>Load ({CAPACITY}h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ u, per, total }) => (
                <tr key={u.id}>
                  <td>
                    <a href={`#/people/${u.id}`} className="who">
                      <Avatar user={u} size={24} /> {u.name}
                    </a>
                  </td>
                  {per.map((h, i) => (
                    <td key={i} className={`num ${h ? '' : 'muted'}`}>
                      {h || '·'}
                    </td>
                  ))}
                  <td className="num">
                    <b>{total}h</b>
                  </td>
                  <td>
                    <Bar pct={Math.min(100, Math.round((total / CAPACITY) * 100))} label={`${u.name} load`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="cols">
        <div className="col-main">
          <Card title="Open work by team">
            <Workload />
          </Card>
        </div>
        <div className="col-side">
          <Card title="On-time by team · 30 days">
            <ul className="list">
              {byTeam.map(({ t, n, pct }) => (
                <li key={t.id} className="row">
                  <TeamTag team={t} />
                  <span className="grow muted small">{n} finished</span>
                  <b className={pct !== null && pct < 80 ? 'warn-text' : ''}>{pct === null ? '—' : `${pct}%`}</b>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Hours by client · this month">
            <ul className="hbars">
              {byClient.map(({ c, h }) => (
                <li key={c.id}>
                  <a href={`#/clients/${c.id}`}>{c.name}</a>
                  <span className="hbar">
                    <i style={{ width: `${(h / maxClient) * 100}%` }} />
                  </span>
                  <b>{h}h</b>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
