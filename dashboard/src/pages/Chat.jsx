import { Fragment, useEffect, useRef, useState } from 'react'
import * as S from '../store.js'
import { byId, can, channelName, firstName, isStaff, unread } from '../store.js'
import { Avatar, Empty, Err, go, Icon, Modal, PeopleOptions, RichText, useDb, useMe } from '../ui.jsx'
import { ago, fmtLong, relDay, ymd } from '../util.js'

export default function Chat({ args }) {
  const me = useMe()
  const d = useDb()
  const [newDm, setNewDm] = useState(false)
  const visible = d.channels.filter((c) => can(me, 'channel.view', c))
  const fallback = isStaff(me) ? 'ch-general' : visible[0]?.id
  const current = args[0] && visible.some((c) => c.id === args[0]) ? args[0] : null
  const groups = [
    ['Company', visible.filter((c) => c.type === 'public')],
    ['Projects', visible.filter((c) => c.type === 'project' && byId(d.projects, c.projectId)?.status !== 'done')],
    ['Direct messages', visible.filter((c) => c.type === 'dm')],
  ]
  const last = (c) => d.messages.findLast((m) => m.channelId === c.id)?.at ?? ''
  return (
    <div className={`chat ${current ? 'has-current' : ''}`}>
      <nav className="chat-list" aria-label="Channels">
        <div className="chat-list-head">
          <h1>Messages</h1>
          <button className="btn sm" onClick={() => setNewDm(true)}>
            <Icon name="plus" size={14} /> New
          </button>
        </div>
        {groups.map(
          ([label, list]) =>
            list.length > 0 && (
              <div key={label} className="chat-group">
                <h2>{label}</h2>
                {(label === 'Direct messages' ? [...list].sort((a, b) => last(b).localeCompare(last(a))) : list).map((c) => {
                  const n = unread(d, me, c)
                  const other = c.type === 'dm' && byId(d.users, c.memberIds.find((x) => x !== me.id))
                  return (
                    <a key={c.id} href={`#/chat/${c.id}`} className={`chat-item ${(current || fallback) === c.id ? 'on' : ''} ${n ? 'unread' : ''}`}>
                      {other ? <Avatar user={other} size={22} /> : <Icon name="hash" size={16} />}
                      <span className="grow">{channelName(d, c, me)}</span>
                      {c.type === 'project' && c.clientVisible && isStaff(me) && <Icon name="eye" size={14} />}
                      {n > 0 && <span className="badge hot">{n}</span>}
                    </a>
                  )
                })}
              </div>
            ),
        )}
      </nav>
      <section className="chat-main">
        {current || fallback ? (
          <>
            <a href="#/chat" className="back only-sm">
              <Icon name="left" size={16} /> All channels
            </a>
            <ChatPane channelId={current || fallback} key={current || fallback} />
          </>
        ) : (
          <Empty icon="chat" title="No conversations yet" />
        )}
      </section>
      {newDm && <NewDm onClose={() => setNewDm(false)} />}
    </div>
  )
}

function NewDm({ onClose }) {
  const me = useMe()
  const d = useDb()
  // clients can message the people on their projects; staff can message anyone
  const mine = d.projects.filter((p) => p.clientId === me.clientId)
  const options = d.users.filter((u) => u.active && u.id !== me.id && (isStaff(me) || mine.some((p) => p.managerId === u.id || p.memberIds.includes(u.id))))
  return (
    <Modal title="New direct message" onClose={onClose}>
      <div className="form-grid">
        <label className="field full">
          <span className="field-label">To</span>
          <select
            data-autofocus
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return
              go(`#/chat/${S.openDm(me, e.target.value)}`)
              onClose()
            }}
          >
            <option value="">Pick a person…</option>
            <PeopleOptions users={options} />
          </select>
        </label>
      </div>
    </Modal>
  )
}

export function ChatPane({ channelId }) {
  const me = useMe()
  const d = useDb()
  const ch = byId(d.channels, channelId)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const msgs = d.messages.filter((m) => m.channelId === channelId)
  const count = msgs.length
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    S.markRead(me, channelId)
  }, [count, channelId, me])

  if (!ch || !can(me, 'channel.view', ch)) return <Empty icon="lock" title="You can’t see this channel" />
  const canPost = can(me, 'channel.post', ch)
  const project = ch.type === 'project' && byId(d.projects, ch.projectId)
  const other = ch.type === 'dm' && byId(d.users, ch.memberIds.find((x) => x !== me.id))
  const members = d.users.filter((u) => u.active && can(u, 'channel.view', ch))
  // @mention suggestions for the word being typed
  const word = text.match(/@(\w*)$/)?.[1]
  const suggest = word !== undefined ? members.filter((u) => u.id !== me.id && firstName(u).toLowerCase().startsWith(word.toLowerCase())).slice(0, 6) : []
  const send = () => {
    try {
      S.sendMessage(me, channelId, text)
      setText('')
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  let prevDay = ''
  let prevMsg = null
  return (
    <div className="pane">
      <header className="pane-head">
        {other ? <Avatar user={other} size={34} /> : <span className="pane-icon">#</span>}
        <div className="grow">
          <h2>{channelName(d, ch, me)}</h2>
          <p className="muted small">
            {ch.type === 'dm' && other?.title}
            {ch.type === 'public' && (ch.readOnly ? 'Studio news — only the admin posts here' : 'Everyone at YG')}
            {project && (
              <>
                <a href={`#/projects/${project.id}`}>{project.name}</a> · {members.length} people
              </>
            )}
          </p>
        </div>
        {project && isStaff(me) && ch.clientVisible && (
          <span className="pill violet" title="The client’s logins can read and post in this channel">
            <Icon name="eye" size={13} /> Client can see this
          </span>
        )}
      </header>
      <div className="msgs" ref={listRef} role="log" aria-live="polite" aria-label={`Messages in ${channelName(d, ch, me)}`}>
        {!msgs.length && <Empty icon="chat" title="No messages yet">Say hello 👋</Empty>}
        {msgs.map((m) => {
          const day = ymd(new Date(m.at))
          const sep = day !== prevDay
          const grouped = !sep && prevMsg?.userId === m.userId && new Date(m.at) - new Date(prevMsg.at) < 5 * 60000
          prevDay = day
          prevMsg = m
          const u = byId(d.users, m.userId)
          const mentionsMe = new RegExp(`@${firstName(me)}\\b`, 'i').test(m.text)
          return (
            <Fragment key={m.id}>
              {sep && (
                <div className="day-sep">
                  <span>{['Today', 'Yesterday'].includes(relDay(day)) ? relDay(day) : fmtLong(day)}</span>
                </div>
              )}
              <div className={`msg ${grouped ? 'grouped' : ''} ${mentionsMe ? 'mention-me' : ''}`}>
                {!grouped && <Avatar user={u} size={34} />}
                <div className="msg-body">
                  {!grouped && (
                    <p className="msg-meta">
                      <b>{u?.name}</b>
                      {u?.role === 'client' && <span className="pill violet">Client</span>}
                      <time dateTime={m.at} title={new Date(m.at).toLocaleString('en-IN')}>
                        {ago(m.at)}
                      </time>
                    </p>
                  )}
                  <p className="prewrap">
                    <RichText text={m.text} />
                  </p>
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>
      {canPost ? (
        <form
          className="composer chat-composer"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          {suggest.length > 0 && (
            <ul className="mention-list" role="listbox" aria-label="Mention someone">
              {suggest.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(text.replace(/@\w*$/, `@${firstName(u)} `))
                      inputRef.current.focus()
                    }}
                  >
                    <Avatar user={u} size={20} /> {u.name} <small className="muted">{u.title}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (suggest.length && word !== undefined) setText(text.replace(/@\w*$/, `@${firstName(suggest[0])} `))
                else send()
              }
            }}
            placeholder={`Message ${ch.type === 'dm' ? channelName(d, ch, me) : `#${channelName(d, ch, me)}`} — Enter to send, Shift+Enter for a new line, @ to mention`}
            aria-label="Message"
          />
          <button className="btn primary" disabled={!text.trim()} aria-label="Send">
            <Icon name="send" size={16} />
          </button>
        </form>
      ) : (
        <p className="composer muted small">Only the admin can post here.</p>
      )}
      <Err msg={err} />
    </div>
  )
}
