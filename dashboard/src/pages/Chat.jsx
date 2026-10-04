import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as S from '../store.js'
import { audience, byId, can, canDeleteMessage, channelName, firstName, isStaff, MAX_MESSAGE, seenBy, unread } from '../store.js'
import { Avatar, Avatars, Confirm, Empty, Err, Field, go, Icon, Modal, PeopleOptions, PeoplePicker, RichText, useDb, useForm, useMe } from '../ui.jsx'
import { ago, fmtLong, relDay, ymd } from '../util.js'

const drafts = new Map() // what you'd typed in each conversation, kept while you hop between them

// a phone keyboard's Enter adds a new line, like WhatsApp; you send with the button
const touch = matchMedia('(pointer: coarse)').matches

export default function Chat({ args }) {
  const me = useMe()
  const d = useDb()
  const [newChat, setNewChat] = useState(false)
  const visible = d.channels.filter((c) => can(me, 'channel.view', c))
  const fallback = visible.some((c) => c.id === 'ch-general') ? 'ch-general' : visible[0]?.id
  const current = args[0] && visible.some((c) => c.id === args[0]) ? args[0] : null
  const last = (c) => d.messages.findLast((m) => m.channelId === c.id)?.at ?? ''
  const byLatest = (list) => [...list].sort((a, b) => last(b).localeCompare(last(a)))
  const isGroup = (c) => c.type === 'group'
  const sections = [
    ['Company', visible.filter((c) => c.type === 'public')],
    ['Projects', visible.filter((c) => c.type === 'project' && byId(d.projects, c.projectId)?.status !== 'done')],
    ['Groups', byLatest(visible.filter((c) => isGroup(c) && c.memberIds.includes(me.id)))],
    ['Direct messages', byLatest(visible.filter((c) => c.type === 'dm'))],
    // only an admin gets here: groups they can read without being in them
    ['Other groups', byLatest(visible.filter((c) => isGroup(c) && !c.memberIds.includes(me.id)))],
  ]
  return (
    <div className={`chat ${current ? 'has-current' : ''}`}>
      <nav className="chat-list" aria-label="Conversations">
        <div className="chat-list-head">
          <h1>Messages</h1>
          <button className="btn sm" onClick={() => setNewChat(true)}>
            <Icon name="plus" size={14} /> New
          </button>
        </div>
        {sections.map(
          ([label, list]) =>
            list.length > 0 && (
              <div key={label} className="chat-group">
                <h2 title={label === 'Other groups' ? 'Groups you’re not in. Only supervisors see these, and the members don’t know.' : undefined}>
                  {label} {label === 'Other groups' && <Icon name="lock" size={11} />}
                </h2>
                {list.map((c) => {
                  const n = unread(d, me, c)
                  const other = c.type === 'dm' && byId(d.users, c.memberIds.find((x) => x !== me.id))
                  return (
                    <a key={c.id} href={`#/chat/${c.id}`} className={`chat-item ${(current || fallback) === c.id ? 'on' : ''} ${n ? 'unread' : ''}`}>
                      {other ? <Who user={other} size={22} /> : <Icon name={isGroup(c) ? 'chat' : 'hash'} size={16} />}
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
              <Icon name="left" size={16} /> All conversations
            </a>
            <ChatPane channelId={current || fallback} key={current || fallback} />
          </>
        ) : (
          <Empty icon="chat" title="No conversations yet" />
        )}
      </section>
      {newChat && <NewChat onClose={() => setNewChat(false)} />}
    </div>
  )
}

// an avatar with a green dot while that person has the app open
function Who({ user, size }) {
  return (
    <span className="av-wrap">
      <Avatar user={user} size={size} />
      {S.isOnline(user.id) && <i className="online-dot" aria-label="online" />}
    </span>
  )
}

function NewChat({ onClose }) {
  const me = useMe()
  const [mode, setMode] = useState('dm')
  return (
    <Modal title={mode === 'dm' ? 'New direct message' : 'New group'} onClose={onClose}>
      {isStaff(me) && (
        <div className="seg new-chat-seg" role="group" aria-label="Kind of conversation">
          <button type="button" className={mode === 'dm' ? 'on' : ''} aria-pressed={mode === 'dm'} onClick={() => setMode('dm')}>
            Direct message
          </button>
          <button type="button" className={mode === 'group' ? 'on' : ''} aria-pressed={mode === 'group'} onClick={() => setMode('group')}>
            Group
          </button>
        </div>
      )}
      {mode === 'dm' ? (
        <NewDm onClose={onClose} />
      ) : (
        <GroupForm
          onDone={(id) => {
            go(`#/chat/${id}`)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}

function NewDm({ onClose }) {
  const me = useMe()
  const d = useDb()
  // clients can message the people on their projects; staff can message anyone
  const mine = d.projects.filter((p) => p.clientId === me.clientId)
  const options = d.users.filter((u) => u.active && u.id !== me.id && (isStaff(me) || mine.some((p) => p.managerId === u.id || p.memberIds.includes(u.id))))
  return (
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
  )
}

// create a group, or rename it and change who's in it. Team only: clients stay in their project discussions.
function GroupForm({ group, onDone }) {
  const me = useMe()
  const d = useDb()
  const { v, set, err, run } = useForm({ name: group?.name ?? '', memberIds: (group?.memberIds ?? []).filter((id) => id !== me.id) })
  const options = d.users.filter((u) => u.active && isStaff(u) && u.id !== me.id)
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault()
        let id
        if (run(() => (id = S.saveGroup(me, { id: group?.id, ...v })))) onDone(id)
      }}
    >
      <Field label="Group name" full>
        <input data-autofocus value={v.name} onChange={set('name')} maxLength={80} placeholder="e.g. Shoot crew" required />
      </Field>
      <div className="field full">
        <span className="field-label">People (you’re in it too)</span>
        <PeoplePicker value={v.memberIds} onChange={set('memberIds')} options={options} label="Add someone" />
      </div>
      <Err msg={err} />
      <div className="form-actions">
        <button className="btn primary">{group ? 'Save changes' : 'Create group'}</button>
      </div>
    </form>
  )
}

export function ChatPane({ channelId }) {
  const me = useMe()
  const d = useDb()
  const ch = byId(d.channels, channelId)
  const [text, setTextState] = useState(() => drafts.get(channelId) ?? '')
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null) // id of the message being edited
  const [manage, setManage] = useState(false)
  const [typingIds, setTypingIds] = useState([])
  const [jump, setJump] = useState(false) // new messages arrived below while you were reading further up
  const [older, setOlder] = useState('') // '' | 'loading' | an error
  // where you'd read up to when you opened this conversation: the "New" line goes there
  const [since] = useState(() => d.reads[me.id]?.[channelId] ?? '')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const typing = useRef(null)
  const atBottom = useRef(true)
  const opened = useRef(false)
  const keepFromBottom = useRef(null) // while older messages load in above, stay where you were
  const msgs = d.messages.filter((m) => m.channelId === channelId)
  const count = msgs.length
  const lastMsg = msgs.at(-1)

  const setText = (t) => {
    drafts.set(channelId, t)
    setTextState(t)
    if (t.trim()) typing.current?.typing()
    else typing.current?.done()
  }

  useEffect(() => {
    const t = S.watchTyping(channelId, setTypingIds)
    typing.current = t
    return () => {
      t.done()
      t.stop()
    }
  }, [channelId])

  // read only counts while the app is actually in front of you, so "Seen" means seen
  useEffect(() => {
    const read = () => document.visibilityState === 'visible' && S.markRead(me, channelId)
    read()
    document.addEventListener('visibilitychange', read)
    return () => document.removeEventListener('visibilitychange', read)
  }, [count, channelId, me])

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (keepFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - keepFromBottom.current
      keepFromBottom.current = null
    } else if (!opened.current) {
      // open at the first unread message, or at the bottom
      opened.current = true
      const sep = el.querySelector('.new-sep')
      if (sep) sep.scrollIntoView({ block: 'center' })
      else el.scrollTop = el.scrollHeight
    } else if (atBottom.current || lastMsg?.userId === me.id) el.scrollTop = el.scrollHeight
    else setJump(true)
  }, [count]) // only when messages arrive or older ones load in, not on every re-render

  if (!ch || !can(me, 'channel.view', ch)) return <Empty icon="lock" title="You can’t see this conversation" />
  const canPost = can(me, 'channel.post', ch)
  const isGroup = ch.type === 'group'
  const hidden = isGroup && !ch.memberIds.includes(me.id) // an admin reading a group they aren't in
  const project = ch.type === 'project' && byId(d.projects, ch.projectId)
  const other = ch.type === 'dm' && byId(d.users, ch.memberIds.find((x) => x !== me.id))
  const people = audience(d, ch)
  const firstNew = since ? msgs.find((m) => m.at > since && m.userId !== me.id && !m.system)?.id : null
  const typers = typingIds.map((id) => byId(d.users, id)).filter((u) => u && u.id !== me.id)

  // @mention suggestions for the word being typed
  const word = text.match(/@(\w*)$/)?.[1]
  const suggest = word !== undefined ? people.filter((u) => u.id !== me.id && firstName(u).toLowerCase().startsWith(word.toLowerCase())).slice(0, 6) : []
  const send = () => {
    try {
      S.sendMessage(me, channelId, text)
      typing.current?.done()
      setText('')
      setErr('')
    } catch (x) {
      setErr(x.message)
    }
  }
  const toBottom = () => {
    const el = listRef.current
    el.scrollTop = el.scrollHeight
    setJump(false)
  }
  const loadOlder = async () => {
    const el = listRef.current
    setOlder('loading')
    keepFromBottom.current = el.scrollHeight - el.scrollTop
    try {
      await S.loadEarlier(channelId)
      setOlder('')
    } catch (x) {
      keepFromBottom.current = null
      setOlder(x.message)
    }
  }

  let prevDay = ''
  let prevMsg = null
  return (
    <div className="pane">
      <header className="pane-head">
        {other ? <Who user={other} size={34} /> : <span className="pane-icon">{isGroup ? <Icon name="chat" size={16} /> : '#'}</span>}
        <div className="grow">
          <h2>{channelName(d, ch, me)}</h2>
          <p className="muted small">
            {other && (S.isOnline(other.id) ? <span className="online-text">Online</span> : other.title)}
            {ch.type === 'public' && (ch.readOnly ? 'Studio news — only supervisors post here' : 'Everyone at YG')}
            {project && (
              <>
                <a href={`#/projects/${project.id}`}>{project.name}</a> · {people.length} people
              </>
            )}
            {isGroup && `${people.length} ${people.length === 1 ? 'person' : 'people'}: ${people.map(firstName).join(', ')}`}
          </p>
        </div>
        {isGroup && <Avatars ids={people.map((u) => u.id)} />}
        {project && isStaff(me) && ch.clientVisible && (
          <span className="pill violet" title="The client’s logins can read and post in this channel">
            <Icon name="eye" size={13} /> Client can see this
          </span>
        )}
        {hidden && (
          <span className="pill" title="You can read this group because you’re a supervisor. The members don’t see you here, and nothing you do here shows.">
            <Icon name="lock" size={13} /> Supervisor view
          </span>
        )}
        {can(me, 'group.manage', ch) && (
          <button className="btn sm" onClick={() => setManage(true)}>
            <Icon name="edit" size={14} /> Edit group
          </button>
        )}
      </header>
      <div
        className="msgs"
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={`Messages in ${channelName(d, ch, me)}`}
        onScroll={(e) => {
          const el = e.currentTarget
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          if (atBottom.current && jump) setJump(false)
        }}
      >
        {S.hasEarlier(channelId) && (
          <button className="btn sm older" onClick={loadOlder} disabled={older === 'loading'}>
            {older === 'loading' ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {older && older !== 'loading' && <Err msg={older} />}
        {!msgs.length && <Empty icon="chat" title="No messages yet">Say hello 👋</Empty>}
        {msgs.map((m) => {
          const day = ymd(new Date(m.at))
          const sep = day !== prevDay
          const isNew = m.id === firstNew
          const grouped = !sep && !isNew && !m.system && prevMsg && !prevMsg.system && prevMsg.userId === m.userId && new Date(m.at) - new Date(prevMsg.at) < 5 * 60000
          prevDay = day
          prevMsg = m
          const u = byId(d.users, m.userId)
          return (
            <Fragment key={m.id}>
              {sep && (
                <div className="day-sep">
                  <span>{['Today', 'Yesterday'].includes(relDay(day)) ? relDay(day) : fmtLong(day)}</span>
                </div>
              )}
              {isNew && (
                <div className="new-sep">
                  <span>New</span>
                </div>
              )}
              {m.system ? (
                <p className="sys-line">
                  <b>{u ? firstName(u) : 'Someone'}</b> {m.text}
                  <time dateTime={m.at} title={new Date(m.at).toLocaleString('en-IN')}>
                    {' '}
                    · {ago(m.at)}
                  </time>
                </p>
              ) : (
                <Message m={m} u={u} ch={ch} grouped={grouped} editing={editing === m.id} setEditing={setEditing} />
              )}
            </Fragment>
          )
        })}
        {lastMsg?.userId === me.id && !lastMsg.system && !lastMsg.deleted && <Seen ch={ch} m={lastMsg} people={people} />}
      </div>
      {jump && (
        <button className="btn sm jump" onClick={toBottom}>
          New messages ↓
        </button>
      )}
      <p className="typing" aria-live="polite">
        {typers.length === 1 && `${firstName(typers[0])} is typing…`}
        {typers.length === 2 && `${firstName(typers[0])} and ${firstName(typers[1])} are typing…`}
        {typers.length > 2 && 'Several people are typing…'}
      </p>
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
              if (e.key === 'Enter' && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (suggest.length && word !== undefined) setText(text.replace(/@\w*$/, `@${firstName(suggest[0])} `))
                else send()
              }
            }}
            placeholder={`Message ${ch.type === 'dm' ? channelName(d, ch, me) : `#${channelName(d, ch, me)}`}${touch ? '' : ' — Enter to send, Shift+Enter for a new line, @ to mention'}`}
            aria-label="Message"
          />
          {text.length > MAX_MESSAGE - 500 && (
            <small className={`count ${text.length > MAX_MESSAGE ? 'over' : ''}`}>
              {text.length}/{MAX_MESSAGE}
            </small>
          )}
          <button className="btn primary" disabled={!text.trim()} aria-label="Send">
            <Icon name="send" size={16} />
          </button>
        </form>
      ) : (
        <p className="composer muted small">
          {hidden ? 'You’re reading this group as a supervisor. Only its members can post.' : 'Only supervisors can post here.'}
        </p>
      )}
      <Err msg={err} />
      {manage && (
        <Modal title="Edit group" onClose={() => setManage(false)}>
          <GroupForm group={ch} onDone={() => setManage(false)} />
          <div className="leave-row">
            <Confirm
              className="btn danger sm"
              ask={`Leave “${ch.name}”?`}
              detail="You won’t see its messages any more unless someone adds you back."
              yes="Leave group"
              onYes={() => {
                try {
                  S.leaveGroup(me, ch.id)
                  setManage(false)
                  if (!can(me, 'channel.view', { ...ch, memberIds: ch.memberIds.filter((x) => x !== me.id) })) go('#/chat')
                } catch (x) {
                  setErr(x.message)
                }
              }}
            >
              Leave group
            </Confirm>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Message({ m, u, ch, grouped, editing, setEditing }) {
  const me = useMe()
  const [draft, setDraft] = useState(m.text)
  const [err, setErr] = useState('')
  const mine = m.userId === me.id
  const canEdit = mine && !m.deleted && can(me, 'channel.post', ch)
  const canDelete = canDeleteMessage(me, m, ch)
  const mentionsMe = !m.deleted && new RegExp(`@${firstName(me)}\\b`, 'i').test(m.text)
  const save = () => {
    try {
      S.editMessage(me, m.id, draft)
      setEditing(null)
    } catch (x) {
      setErr(x.message)
    }
  }
  return (
    <div className={`msg ${grouped ? 'grouped' : ''} ${mentionsMe ? 'mention-me' : ''}`} tabIndex={canEdit || canDelete ? -1 : undefined}>
      {!grouped && <Avatar user={u} size={34} />}
      <div className="msg-body">
        {!grouped && (
          <p className="msg-meta">
            <b>{u?.name ?? 'Someone'}</b>
            {u?.role === 'client' && <span className="pill violet">Client</span>}
            <time dateTime={m.at} title={new Date(m.at).toLocaleString('en-IN')}>
              {ago(m.at)}
            </time>
          </p>
        )}
        {m.deleted ? (
          <p className="deleted">This message was deleted</p>
        ) : editing ? (
          <div className="msg-edit">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  save()
                }
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setEditing(null)
                }
              }}
              aria-label="Edit message"
            />
            <div className="row-actions">
              <button type="button" className="btn primary sm" onClick={save}>
                Save
              </button>
              <button type="button" className="btn sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              {!touch && <small className="muted">Enter to save · Esc to cancel</small>}
            </div>
            <Err msg={err} />
          </div>
        ) : (
          <p className="prewrap">
            <RichText text={m.text} />
            {m.editedAt && (
              <small className="edited" title={`Edited ${new Date(m.editedAt).toLocaleString('en-IN')}`}>
                {' '}
                (edited)
              </small>
            )}
          </p>
        )}
      </div>
      {!editing && (canEdit || canDelete) && (
        <div className="msg-actions">
          {canEdit && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Edit message"
              title="Edit"
              onClick={() => {
                setDraft(m.text)
                setErr('')
                setEditing(m.id)
              }}
            >
              <Icon name="edit" size={15} />
            </button>
          )}
          {canDelete && (
            <Confirm
              className="icon-btn"
              aria-label="Delete message"
              title="Delete"
              ask={mine ? 'Delete this message for everyone?' : `Delete ${u?.name ?? 'this person'}’s message for everyone?`}
              yes="Delete"
              onYes={() => S.deleteMessage(me, m.id)}
            >
              <Icon name="trash" size={15} />
            </Confirm>
          )}
        </div>
      )}
    </div>
  )
}

// under your latest message: "Seen", "Seen by Priya and Vikas", "Seen by everyone"
function Seen({ ch, m, people }) {
  const me = useMe()
  const d = useDb()
  const seen = seenBy(d, ch, m)
  const others = people.filter((u) => u.id !== me.id)
  if (!others.length) return null
  const names = seen.map(firstName)
  let label = 'Sent'
  if (seen.length && ch.type === 'dm') label = 'Seen'
  else if (seen.length && seen.length === others.length && others.length > 1) label = 'Seen by everyone'
  else if (seen.length) label = `Seen by ${names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ')}`
  return (
    <p className="seen" title={seen.length ? `Seen by ${seen.map((u) => u.name).join(', ')}` : 'Not seen yet'}>
      {seen.length > 0 && <Icon name="check" size={12} />} {label}
    </p>
  )
}
