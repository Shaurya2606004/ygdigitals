import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { REDUCED } from '../lib/motion'

/*
 * A page's loader state: progress follows real readiness — every font the page uses, then its 3D stage drawing
 * (call onSceneReady). After 8 s it finishes anyway, so a stalled WebGL never traps anyone behind it.
 */
export function useLoader() {
  const [fontsReady, setFontsReady] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([document.fonts.load('800 1em Unbounded'), document.fonts.load('400 1em Manrope'), document.fonts.ready]).finally(() => setFontsReady(true))
    const t = setTimeout(() => setSceneReady(true), 8000)
    return () => clearTimeout(t)
  }, [])
  const onSceneReady = useCallback(() => setSceneReady(true), [])
  const done = useCallback(() => setLoading(false), [])
  return { loading, progress: 0.15 + (fontsReady ? 0.35 : 0) + (sceneReady ? 0.5 : 0), onSceneReady, done }
}

const WORDS = ['Loading likes', 'Stacking boxes', 'Cutting reels', 'Listing products', 'Pushing pixels']

/*
 * Counter follows real readiness (fonts + first hero frame). At 100 the red clay blob swells and pales until it
 * *is* the hero's light backdrop, then the loader fades and the hero props pop in.
 * The blob itself is already on screen before any JS runs (static copy in index.html), so it starts full size.
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
      // time-based so throttled tabs still finish: ~0.8s minimum from 0 to 100, and a quick sprint once ready
      const rate = REDUCED ? 400 : target.current >= 1 ? 260 : 125
      shown = Math.min(target.current * 100, shown + ((now - last) / 1000) * rate)
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
    <motion.div className={`loader ${grow ? 'is-grow' : ''}`} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} role="status" aria-label="Loading YG Digitals">
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
        initial={false}
        animate={{ scale: grow ? cover : 1, backgroundColor: grow ? '#f2f1ee' : '#e04c5c' }}
        transition={grow ? { duration: REDUCED ? 0.2 : 0.75, ease: [0.76, 0, 0.24, 1] } : { type: 'spring', stiffness: 260, damping: 12 }}
        onAnimationComplete={() => grow && onDone()}
      />
    </motion.div>
  )
}
