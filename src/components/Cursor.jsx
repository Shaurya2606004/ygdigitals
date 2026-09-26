import { useEffect, useRef, useState } from 'react'
import { TOUCH, gsap } from '../lib/motion'

/*
 * Glass ring (lags) + exact dot. States: link (grows), label (dark glass pill with a verb),
 * lens (hero: the WebGL lens takes over, ring shrinks away), text (native I-beam in inputs).
 */
export default function Cursor() {
  const ring = useRef()
  const dot = useRef()
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState('')

  useEffect(() => {
    if (TOUCH) return
    document.documentElement.classList.add('has-cursor', 'cursor-out')
    gsap.set([ring.current, dot.current], { xPercent: -50, yPercent: -50 })
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.45, ease: 'power3' })
    const ry = gsap.quickTo(ring.current, 'y', { duration: 0.45, ease: 'power3' })
    const dx = gsap.quickTo(dot.current, 'x', { duration: 0.06 })
    const dy = gsap.quickTo(dot.current, 'y', { duration: 0.06 })

    let domLabel = ''
    let glLabel = null
    let domMode = ''
    const sync = () => {
      const l = glLabel ?? domLabel
      setLabel(l)
      setMode(l ? 'label' : domMode)
    }
    const move = (e) => {
      rx(e.clientX)
      ry(e.clientY)
      dx(e.clientX)
      dy(e.clientY)
      document.documentElement.classList.remove('cursor-out')
    }
    const over = (e) => {
      const t = e.target.closest?.('[data-cursor], a, button, input, textarea, select, label')
      const zone = e.target.closest?.('[data-cursor-zone]')
      domLabel = t?.dataset?.cursor || ''
      domMode = t?.matches('input, textarea, select') ? 'text' : t ? 'link' : zone?.dataset.cursorZone || ''
      sync()
    }
    const fromGL = (e) => {
      glLabel = e.detail
      sync()
    }
    const out = () => document.documentElement.classList.add('cursor-out')
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', over)
    document.documentElement.addEventListener('mouseleave', out)
    window.addEventListener('cursor-label', fromGL)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('mouseleave', out)
      window.removeEventListener('cursor-label', fromGL)
    }
  }, [])

  if (TOUCH) return null
  return (
    <>
      <div ref={ring} className={`cursor-ring is-${mode || 'idle'}`} aria-hidden>
        <span>{label}</span>
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden />
    </>
  )
}
