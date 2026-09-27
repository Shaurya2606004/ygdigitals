import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { lockScroll } from '../lib/motion'
import { SERVICES, WORK, waLink } from '../data'
import { Arrow } from './ui'

// a filter only for services that have projects to show (none is an empty grid)
const CATS = [{ id: 'all', title: 'All' }, ...SERVICES.filter((s) => WORK.some((w) => w.cat === s.id))]
const catTitle = Object.fromEntries(SERVICES.map((s) => [s.id, s.title]))
const ease = [0.22, 1, 0.36, 1]

/* Illustrated stand-ins until real project images arrive (set `image` in data.js). */
function Mock({ w }) {
  if (w.image) return <img src={w.image} alt={`${w.title} for ${w.client}`} loading="lazy" className="mk-img" />
  switch (w.cat) {
    case 'ads':
      return (
        <div className="mk mk-phone">
          <div className="mk-notch" />
          <div className="mk-user">
            <i /> <b>{w.client.toLowerCase().replace(/\s/g, '')}</b> <small>Sponsored</small>
          </div>
          <div className="mk-post">
            <b>SALE</b>
            <small>up to 50% off</small>
          </div>
          <div className="mk-actions">
            <span className="mk-heart">♥</span>
            <i />
            <i />
          </div>
          <div className="mk-cta">Shop now</div>
        </div>
      )
    case 'ecom':
      return (
        <div className="mk mk-product">
          <div className="mk-pimg">
            <div className="mk-blob" />
            <span className="mk-badge">Bestseller</span>
          </div>
          <i className="mk-line" />
          <i className="mk-line short" />
          <div className="mk-stars">★★★★★ <small>(2,184)</small></div>
          <div className="mk-price">
            <span className="rs">₹</span>499 <s><span className="rs">₹</span>999</s>
          </div>
          <div className="mk-btn">Add to cart</div>
        </div>
      )
    case 'pack':
      return (
        <div className="mk mk-cube-wrap">
          <div className="mk-cube">
            {['f', 'b', 'l', 'r', 't', 'd'].map((f) => (
              <div key={f} className={`mk-face ${f}`}>
                {f === 'f' && <span>YG</span>}
                {f === 'r' && <small>100% natural</small>}
              </div>
            ))}
          </div>
          <div className="mk-shadow" />
        </div>
      )
    case 'web':
      return (
        <div className="mk mk-browser">
          <div className="mk-bar">
            <i />
            <i />
            <i />
            <span />
          </div>
          <div className="mk-site">
            <div className="mk-hero">
              <b />
              <b className="short" />
              <span className="mk-go" />
            </div>
            <div className="mk-shot" />
          </div>
          <div className="mk-cols">
            <i />
            <i />
            <i />
          </div>
        </div>
      )
    default:
      return (
        <div className="mk mk-player">
          <div className="mk-screen">
            <span className="mk-play" />
            <span className="mk-rec">● REC</span>
          </div>
          <div className="mk-timeline">
            <span className="mk-clip a" />
            <span className="mk-clip b" />
            <span className="mk-clip c" />
            <span className="mk-head" />
          </div>
          <div className="mk-wave">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} style={{ '--h': `${20 + ((i * 37) % 70)}%` }} />
            ))}
          </div>
        </div>
      )
  }
}

// subtle pointer tilt on the inner card (Framer owns the outer layout transform)
const tilt = (e) => {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -10}deg`)
  el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`)
}
const untilt = (e) => {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

function Modal({ w, onClose }) {
  const close = useRef()
  useEffect(() => {
    lockScroll(true)
    close.current.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      lockScroll(false)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  return (
    <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={w.title} onClick={(e) => e.stopPropagation()} data-lenis-prevent>
        <motion.div layoutId={`art-${w.id}`} className={`modal-art tone-${w.tone}`} transition={{ duration: 0.6, ease }}>
          <Mock w={w} />
        </motion.div>
        <motion.div className="modal-body" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25, duration: 0.6, ease } }} exit={{ opacity: 0 }}>
          <p className="eyebrow">
            {catTitle[w.cat]} · {w.year}
          </p>
          <h3>{w.title}</h3>
          <p className="modal-client">for {w.client}</p>
          <ul>
            {w.did.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <a className="btn btn-red" href={waLink(`Hi YG Digitals! I saw "${w.title}" and want something similar for my business.`)} target="_blank" rel="noreferrer" data-cursor="Let's go">
            Start something similar <Arrow />
          </a>
        </motion.div>
        <button ref={close} className="modal-close" onClick={onClose} aria-label="Close project" data-cursor="Close">
          ✕
        </button>
      </div>
    </motion.div>
  )
}

export default function Work() {
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState(null)
  const items = cat === 'all' ? WORK : WORK.filter((w) => w.cat === cat)
  const closeModal = useCallback(() => setOpen(null), [])

  return (
    <section id="work" className="work" aria-label="Selected work">
      <header className="work-head">
        <p className="eyebrow">( Selected work )</p>
        <h2 className="h-xl">
          Work that <em>moves</em> <span className="h-sticker">product</span>
        </h2>
      </header>

      <div className="chips" role="group" aria-label="Filter projects">
        {CATS.map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}>
            {cat === c.id && <motion.span layoutId="chip-bg" className="chip-bg" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
            <span className="chip-label">{c.title}</span>
          </button>
        ))}
      </div>

      <motion.div layout className="work-grid">
        <AnimatePresence mode="popLayout">
          {items.map((w) => (
            <motion.article
              key={w.id}
              layout
              initial={{ opacity: 0, scale: 0.8, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, ease }}
            >
              <button className="card" onClick={() => setOpen(w)} onPointerMove={tilt} onPointerLeave={untilt} data-cursor="View">
                <motion.div layoutId={`art-${w.id}`} className={`card-art tone-${w.tone}`} transition={{ duration: 0.6, ease }}>
                  <Mock w={w} />
                </motion.div>
                <span className="card-meta">
                  <span className="card-title">{w.title}</span>
                  <span className="card-sub">
                    {w.client} · {catTitle[w.cat]}
                  </span>
                </span>
              </button>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>{open && <Modal w={open} onClose={closeModal} />}</AnimatePresence>
    </section>
  )
}
