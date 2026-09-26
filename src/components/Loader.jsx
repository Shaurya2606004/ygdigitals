import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { REDUCED } from '../lib/motion'

const WORDS = ['Loading likes', 'Stacking boxes', 'Cutting reels', 'Listing products', 'Pushing pixels']

/*
 * Counter follows real readiness (fonts + first hero frame). At 100 the clay blob swells until it
 * *is* the red hero background, then the loader fades and the hero props pop in.
 */
export default function Loader({ progress, onDone }) {
  const num = useRef()
  const target = useRef(progress)
  target.current = progress
  const [grow, setGrow] = useState(false)
  const [word, setWord] = useState(0)

  useEffect(() => {
    let shown = 0
    let raf
    let last = performance.now()
    const step = (now = last) => {
      // time-based so throttled tabs still finish: ~1.4s minimum from 0 to 100
      shown = Math.min(target.current * 100, shown + ((now - last) / 1000) * (REDUCED ? 400 : 72))
      last = now
      num.current.textContent = String(Math.floor(shown)).padStart(3, '0')
      if (shown >= 100) return setGrow(true)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const id = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 650)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [])

  const cover = (Math.hypot(window.innerWidth, window.innerHeight) / 150) * 1.15

  return (
    <motion.div className={`loader ${grow ? 'is-grow' : ''}`} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} role="status" aria-label="Loading YG Digitals">
      <div className="loader-brand">YG DIGITALS®</div>
      <div className="loader-count">
        <span ref={num}>000</span>
        <small>%</small>
      </div>
      <div className="loader-word" aria-hidden>
        <AnimatePresence mode="wait">
          <motion.span key={word} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {WORDS[word]}…
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.div
        className="loader-blob"
        initial={{ scale: 0 }}
        animate={{ scale: grow ? cover : 1 }}
        transition={grow ? { duration: REDUCED ? 0.2 : 1.05, ease: [0.76, 0, 0.24, 1] } : { type: 'spring', stiffness: 260, damping: 12 }}
        onAnimationComplete={() => grow && onDone()}
      >
        <div className="loader-eyes">
          <i />
          <i />
        </div>
      </motion.div>
    </motion.div>
  )
}
