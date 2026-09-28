import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollTrigger, lockScroll, scrollToId } from '../lib/motion'
import { CONTACT, SERVICES, pagePath } from '../data'
import { BookCall } from './ui'

const LINKS = [
  ['services', 'Services'],
  ['contact', 'Contact'],
]

// the glass takes its tone from the first solid page background behind its middle (overlays like the loader don't count):
// light text over dark sections, dark text over light ones
function darkBehind(nav) {
  for (const el of document.elementsFromPoint(innerWidth / 2, nav.offsetTop + nav.offsetHeight / 2)) {
    if (!el.closest('main, footer')) continue
    const [r, g, b, a = 1] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number)
    if (a > 0.5) return r * 0.299 + g * 0.587 + b * 0.114 < 140
  }
  return false
}

const ease = [0.76, 0, 0.24, 1]
const HOME = typeof location !== 'undefined' && location.pathname === '/'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [dark, setDark] = useState(false)
  const bar = useRef()

  useEffect(() => {
    const tone = () => setDark(darkBehind(bar.current))
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (s) => {
        setHidden(s.direction === 1 && s.scroll() > 300)
        tone()
      },
    })
    // the services section fades its background between themes, so look again once a fade has finished
    const faded = (e) => e.propertyName === 'background-color' && tone()
    tone()
    document.addEventListener('transitionend', faded)
    return () => {
      st.kill()
      document.removeEventListener('transitionend', faded)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    lockScroll(true)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => {
      lockScroll(false)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  // sections on this page scroll smoothly; the rest (home sections seen from a service page) are normal links to /#id
  const go = (id) => (e) => {
    lockScroll(false)
    setOpen(false)
    if (!document.getElementById(id)) return
    e.preventDefault()
    scrollToId(id)
  }

  return (
    <>
      <header ref={bar} className={`nav ${hidden && !open ? 'is-hidden' : ''} ${dark || open ? 'is-dark' : ''}`}>
        <a href={HOME ? '#top' : '/'} className="nav-logo" onClick={HOME ? go('top') : undefined} aria-label={HOME ? 'YG Digitals — back to top' : 'YG Digitals — home'}>
          <img className="nav-mark" src="/yg-logo.webp" alt="" width="44" height="44" />
          <span className="nav-word">digitals</span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          {/* both on purpose: clicking Services scrolls to the home section, hovering (or tabbing in) opens the service pages */}
          <div className="nav-drop">
            <a href="/#services" onClick={go('services')}>
              Services
            </a>
            <ul>
              {SERVICES.map((s) => (
                <li key={s.id}>
                  <a href={pagePath(s)}>
                    <small>{s.no}</small>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <a href="/#contact" onClick={go('contact')}>
            Contact
          </a>
        </nav>
        <div className="nav-right">
          <BookCall className="btn-red nav-cta" />
          <button className={`nav-burger ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="menu" aria-label={open ? 'Close menu' : 'Open menu'}>
            <i />
            <i />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu"
            className="menu"
            initial={{ clipPath: 'circle(0% at calc(100% - 44px) 44px)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 44px) 44px)' }}
            exit={{ clipPath: 'circle(0% at calc(100% - 44px) 44px)' }}
            transition={{ duration: 0.8, ease }}
          >
            <nav className="menu-links" aria-label="Menu">
              {[['top', 'Home'], ...LINKS].map(([id, label], i) => (
                <span key={id} className="menu-mask">
                  <motion.a
                    href={id === 'top' ? '/' : `/#${id}`}
                    onClick={id === 'top' && !HOME ? undefined : go(id)}
                    initial={{ y: '110%', rotate: 6 }}
                    animate={{ y: 0, rotate: 0 }}
                    exit={{ y: '110%' }}
                    transition={{ duration: 0.7, ease, delay: 0.2 + i * 0.06 }}
                  >
                    <sup>0{i + 1}</sup>
                    {label}
                  </motion.a>
                </span>
              ))}
            </nav>
            <motion.nav className="menu-pages" aria-label="Service pages" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5, duration: 0.6, ease } }} exit={{ opacity: 0 }}>
              <p>Service pages</p>
              <ul>
                {SERVICES.map((p) => (
                  <li key={p.id}>
                    <a href={pagePath(p)}>{p.title}</a>
                  </li>
                ))}
              </ul>
            </motion.nav>
            <motion.div className="menu-foot" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6 } }} exit={{ opacity: 0 }}>
              <a href={CONTACT.tel}>{CONTACT.phone}</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={CONTACT.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
              <span>{CONTACT.city} · Pan-India</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
