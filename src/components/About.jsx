import { useLayoutEffect, useRef } from 'react'
import { REDUCED, gsap } from '../lib/motion'
import { INDUSTRIES, STATS } from '../data'
import { Statement } from './ui'

const STATEMENT =
  "We're a Gohana-born studio helping *factory owners*, *real-estate brands* and *e-commerce sellers* across India look big online — and sell even bigger."

/*
 * Statement words brighten one by one, scrubbed to scroll. Stats count up once on entry.
 */
export default function About() {
  const root = useRef()

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.stat-num').forEach((el) => {
        const end = Number(el.dataset.value)
        const obj = { v: REDUCED ? end : 0 }
        el.textContent = String(obj.v).padStart(2, '0')
        if (REDUCED) return
        gsap.to(obj, {
          v: end,
          duration: 1.6,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onUpdate: () => (el.textContent = String(Math.round(obj.v)).padStart(2, '0')),
        })
      })
      if (!REDUCED)
        gsap.from('.sticker', {
          scale: 0,
          rotate: () => gsap.utils.random(-30, 30),
          stagger: 0.07,
          ease: 'back.out(2.5)',
          duration: 0.8,
          scrollTrigger: { trigger: '.stickers', start: 'top 85%', once: true },
        })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="about" ref={root} aria-label="About YG Digitals">
      <p className="eyebrow">( Hello )</p>
      <Statement text={STATEMENT} />

      <ul className="stats">
        {STATS.map((s) => (
          <li key={s.label}>
            <span className="stat-big">
              <span className="stat-num" data-value={s.value}>
                {String(s.value).padStart(2, '0')}
              </span>
              {s.suffix}
            </span>
            <span className="stat-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <div className="grow-for">
        <p className="eyebrow">( Who we grow )</p>
        <ul className="stickers">
          {INDUSTRIES.map((x, i) => (
            <li key={x} className={`sticker s${i % 3}`} style={{ '--r': `${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg` }}>
              {x}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
