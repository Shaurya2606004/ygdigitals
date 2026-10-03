import { useState } from 'react'
import * as S from '../store.js'
import { byId, can, INVOICE_STATUS, invoiceState, invoiceTotals } from '../store.js'
import { Empty, Err, Field, go, Icon, PageHead, Status, Tabs, useDb, useForm, useMe } from '../ui.jsx'
import { addDays, fmtDay, inr, inWords, today } from '../util.js'

export default function Invoices({ args }) {
  if (args[0] === 'new') return <InvoiceEditor clientId={args[1]} />
  if (args[0] && args[1] === 'edit') return <InvoiceEditor id={args[0]} />
  if (args[0]) return <InvoiceView id={args[0]} />
  return <InvoiceList />
}

function InvoiceList() {
  const me = useMe()
  const d = useDb()
  const manage = can(me, 'invoices.manage')
  const [tab, setTab] = useState('open')
  const all = d.invoices.filter((i) => can(me, 'invoice.view', i)).sort((a, b) => b.no.localeCompare(a.no))
  const total = (list) => list.reduce((s, i) => s + invoiceTotals(i).total, 0)
  const by = (st) => all.filter((i) => invoiceState(i) === st)
  const month = today().slice(0, 7)
  const list = tab === 'all' ? all : tab === 'open' ? all.filter((i) => ['sent', 'overdue'].includes(invoiceState(i))) : by(tab)
  return (
    <div className="page">
      <PageHead title="Invoices" sub={manage ? 'GST invoices for every client. Draft, send, get paid.' : 'Your invoices from YG Digitals.'}>
        {manage && (
          <a className="btn primary" href="#/invoices/new">
            <Icon name="plus" /> New invoice
          </a>
        )}
      </PageHead>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Outstanding</span>
          <span className="kpi-value">{inr(total([...by('sent'), ...by('overdue')]))}</span>
          <span className="kpi-note">{by('sent').length + by('overdue').length} invoices</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Overdue</span>
          <span className={`kpi-value ${by('overdue').length ? 'late' : ''}`}>{inr(total(by('overdue')))}</span>
          <span className="kpi-note">{by('overdue').length} invoices</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Paid this month</span>
          <span className="kpi-value">{inr(total(by('paid').filter((i) => (i.paidOn || '').startsWith(month))))}</span>
        </div>
        {manage && (
          <div className="kpi">
            <span className="kpi-label">Drafts</span>
            <span className="kpi-value">{by('draft').length}</span>
          </div>
        )}
      </div>
      <Tabs
        label="Invoice status"
        value={tab}
        onChange={setTab}
        tabs={[['open', 'Unpaid', by('sent').length + by('overdue').length], ['overdue', 'Overdue', by('overdue').length], manage && ['draft', 'Drafts', by('draft').length], ['paid', 'Paid'], ['all', 'All']].filter(Boolean)}
      />
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                {manage && <th>Client</th>}
                <th>Date</th>
                <th>Due</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="click" onClick={() => go(`#/invoices/${i.id}`)}>
                  <td>
                    <a href={`#/invoices/${i.id}`}>
                      <b>{i.no}</b>
                    </a>
                  </td>
                  {manage && <td>{byId(d.clients, i.clientId)?.name}</td>}
                  <td>{fmtDay(i.date)}</td>
                  <td className={invoiceState(i) === 'overdue' ? 'late' : ''}>{fmtDay(i.due)}</td>
                  <td className="num">
                    <b>{inr(invoiceTotals(i).total)}</b>
                  </td>
                  <td>
                    <Status s={invoiceState(i)} label={INVOICE_STATUS[invoiceState(i)]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="receipt" title="No invoices here" />
      )}
    </div>
  )
}

function InvoiceView({ id }) {
  const me = useMe()
  const d = useDb()
  const [err, setErr] = useState('')
  const inv = byId(d.invoices, id)
  if (!inv || !can(me, 'invoice.view', inv)) return <div className="page"><Empty icon="lock" title="Invoice not found" /></div>
  const c = byId(d.clients, inv.clientId)
  const t = invoiceTotals(inv)
  const st = invoiceState(inv)
  const manage = can(me, 'invoices.manage')
  const mark = (s) => {
    try {
      S.setInvoiceStatus(me, id, s)
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  const org = d.org
  return (
    <div className="page">
      <div className="no-print">
        <a href="#/invoices" className="back">
          <Icon name="left" size={16} /> Invoices
        </a>
        <PageHead title={inv.no} sub={`${c?.name} · ${inr(t.total)}`}>
          <Status s={st} label={INVOICE_STATUS[st]} />
          <button className="btn" onClick={() => print()}>
            <Icon name="printer" size={16} /> Print / PDF
          </button>
          {manage && (
            <>
              <a className="btn" href={`#/invoices/${id}/edit`}>
                <Icon name="edit" size={16} /> Edit
              </a>
              {inv.status === 'draft' && (
                <button className="btn primary" onClick={() => mark('sent')}>
                  <Icon name="send" size={16} /> Mark as sent
                </button>
              )}
              {inv.status === 'sent' && (
                <button className="btn primary" onClick={() => mark('paid')}>
                  Mark as paid
                </button>
              )}
              {inv.status === 'paid' && (
                <button className="btn ghost" onClick={() => mark('sent')}>
                  Mark unpaid
                </button>
              )}
            </>
          )}
        </PageHead>
        <Err msg={err} />
        {manage && inv.status === 'draft' && <p className="muted small">Drafts are only visible to YG. “Mark as sent” shows it in the client’s portal and notifies them.</p>}
      </div>
      <article className="invoice card">
        <header className="inv-head">
          <div>
            <div className="logo-mark ink">
              YG<span>Digitals</span>
            </div>
            <p>
              {org.address}
              <br />
              {org.email} · {org.phone}
              {org.gstin && (
                <>
                  <br />
                  GSTIN: {org.gstin}
                </>
              )}
            </p>
          </div>
          <div className="inv-meta">
            <h2>Tax invoice</h2>
            <dl>
              <dt>Invoice no.</dt>
              <dd>{inv.no}</dd>
              <dt>Date</dt>
              <dd>{fmtDay(inv.date)}</dd>
              <dt>Due</dt>
              <dd>{fmtDay(inv.due)}</dd>
              {inv.paidOn && (
                <>
                  <dt>Paid</dt>
                  <dd>{fmtDay(inv.paidOn)}</dd>
                </>
              )}
            </dl>
          </div>
        </header>
        <section className="inv-to">
          <small>Bill to</small>
          <b>{c?.name}</b>
          <span>
            {c?.contact}
            {c?.city ? `, ${c.city}` : ''}
          </span>
          {c?.email && <span>{c.email}</span>}
        </section>
        <table className="inv-items">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.desc}</td>
                <td className="num">{it.qty}</td>
                <td className="num">{inr(it.rate)}</td>
                <td className="num">{inr(it.qty * it.rate)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Subtotal</td>
              <td className="num">{inr(t.sub)}</td>
            </tr>
            {Number(inv.gst) > 0 && (
              <>
                <tr>
                  <td colSpan={4}>CGST {inv.gst / 2}%</td>
                  <td className="num">{inr(t.gst / 2)}</td>
                </tr>
                <tr>
                  <td colSpan={4}>SGST {inv.gst / 2}%</td>
                  <td className="num">{inr(t.gst / 2)}</td>
                </tr>
              </>
            )}
            <tr className="grand">
              <td colSpan={4}>Total</td>
              <td className="num">{inr(t.total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="inv-words">
          Amount in words: <b>Rupees {inWords(t.total)} only</b>
        </p>
        {(org.bank || org.upi) && (
          <section className="inv-pay">
            <small>Pay to</small>
            {org.bank && <span className="prewrap">{org.bank}</span>}
            {org.upi && <span>UPI: {org.upi}</span>}
          </section>
        )}
        {inv.notes && <p className="inv-notes prewrap">{inv.notes}</p>}
        {st === 'paid' && <div className="inv-stamp">Paid</div>}
      </article>
    </div>
  )
}

function InvoiceEditor({ id, clientId }) {
  const me = useMe()
  const d = useDb()
  const old = id && byId(d.invoices, id)
  const client0 = byId(d.clients, clientId) || d.clients[0]
  const { v, set, setV, err, run } = useForm(
    old
      ? structuredClone(old)
      : { clientId: client0?.id ?? '', date: today(), due: addDays(today(), 7), gst: 18, items: [{ desc: '', qty: 1, rate: '' }], notes: 'Payment by bank transfer or UPI within the due date. Thank you!' },
  )
  if (!can(me, 'invoices.manage')) return <div className="page"><Empty icon="lock" title="Only leadership and accounts can create invoices" /></div>
  const t = invoiceTotals(v)
  const client = byId(d.clients, v.clientId)
  const setItem = (i, k, val) => setV({ ...v, items: v.items.map((it, n) => (n === i ? { ...it, [k]: val } : it)) })
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date())
  const save = (e) => {
    e.preventDefault()
    let saved
    if (run(() => (saved = S.saveInvoice(me, { ...v, gst: Number(v.gst) || 0, items: v.items.map((i) => ({ desc: i.desc, qty: Number(i.qty), rate: Number(i.rate) })) })))) go(`#/invoices/${saved}`)
  }
  return (
    <div className="page">
      <a href={old ? `#/invoices/${id}` : '#/invoices'} className="back">
        <Icon name="left" size={16} /> {old ? old.no : 'Invoices'}
      </a>
      <PageHead title={old ? `Edit ${old.no}` : 'New invoice'} sub={old ? '' : `Will be numbered ${S.nextInvoiceNo(d)}`} />
      <form className="card form-grid invoice-form" onSubmit={save}>
        <Field label="Client">
          <select value={v.clientId} onChange={set('clientId')}>
            {d.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="GST %">
          <input type="number" min="0" max="28" value={v.gst} onChange={set('gst')} />
        </Field>
        <Field label="Invoice date">
          <input type="date" value={v.date} onChange={set('date')} />
        </Field>
        <Field label="Due date">
          <input type="date" value={v.due} min={v.date} onChange={set('due')} />
        </Field>
        <div className="field full">
          <span className="field-label">Line items</span>
          <div className="items-editor">
            {v.items.map((it, i) => (
              <div key={i} className="item-row">
                <input aria-label={`Line ${i + 1} description`} placeholder="Description" value={it.desc} onChange={(e) => setItem(i, 'desc', e.target.value)} />
                <input aria-label={`Line ${i + 1} quantity`} type="number" min="0" step="any" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                <input aria-label={`Line ${i + 1} rate`} type="number" min="0" step="any" placeholder="Rate ₹" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
                <span className="num">{inr((Number(it.qty) || 0) * (Number(it.rate) || 0))}</span>
                <button type="button" className="icon-btn sm" aria-label={`Remove line ${i + 1}`} disabled={v.items.length === 1} onClick={() => setV({ ...v, items: v.items.filter((_, n) => n !== i) })}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="row-actions">
            <button type="button" className="btn sm" onClick={() => setV({ ...v, items: [...v.items, { desc: '', qty: 1, rate: '' }] })}>
              <Icon name="plus" size={14} /> Add line
            </button>
            {client?.plan === 'retainer' && (
              <button type="button" className="btn sm ghost" onClick={() => setV({ ...v, items: [...v.items.filter((i) => i.desc), { desc: `Monthly retainer — ${monthName}`, qty: 1, rate: client.fee }] })}>
                + Retainer ({inr(client.fee)})
              </button>
            )}
          </div>
        </div>
        <div className="totals full">
          <span>Subtotal</span>
          <b>{inr(t.sub)}</b>
          <span>GST {v.gst}%</span>
          <b>{inr(t.gst)}</b>
          <span className="grand">Total</span>
          <b className="grand">{inr(t.total)}</b>
        </div>
        <Field label="Notes on the invoice" full>
          <textarea rows={2} value={v.notes} onChange={set('notes')} />
        </Field>
        {!d.org.gstin && <p className="full muted small">Tip: add YG’s GSTIN, bank details and UPI ID in Settings › Company so they print on every invoice.</p>}
        <Err msg={err} />
        <div className="form-actions">
          <a className="btn ghost" href={old ? `#/invoices/${id}` : '#/invoices'}>
            Cancel
          </a>
          <button className="btn primary">{old ? 'Save' : 'Save draft'}</button>
        </div>
      </form>
    </div>
  )
}
