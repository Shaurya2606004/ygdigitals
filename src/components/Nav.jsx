import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollTrigger, lockScroll, scrollToId } from '../lib/motion'
import { CONTACT, waLink } from '../data'
import { Arrow } from './ui'

const LINKS = [
  ['services', 'Services'],
  ['work', 'Work'],
  ['process', 'Process'],
  ['contact', 'Contact'],
]

const ease = [0.76, 0, 0.24, 1]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (s) => setHidden(s.direction === 1 && s.scroll() > 300),
    })
    return () => st.kill()
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

  const go = (id) => (e) => {
    e.preventDefault()
    lockScroll(false)
    setOpen(false)
    scrollToId(id)
  }

  return (
    <>
      <header className={`nav ${hidden && !open ? 'is-hidden' : ''}`}>
        <a href="#top" className="nav-logo" onClick={go('top')} aria-label="YG Digitals — back to top">
          <span className="nav-mark">YG</span>
          <span className="nav-word">digitals</span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={go(id)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-right">
          <a className="btn btn-light nav-cta" href={waLink()} target="_blank" rel="noreferrer" data-cursor="Book">
            Book a call <Arrow />
          </a>
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
                    href={`#${id}`}
                    onClick={go(id)}
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
