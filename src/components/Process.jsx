import { useLayoutEffect, useRef } from 'react'
import { REDUCED, gsap } from '../lib/motion'
import { PROCESS } from '../data'

const TONES = ['black', 'white', 'black', 'white']

/*
 * Sticky card stack: each step sticks slightly lower than the last; as the next card slides over,
 * the one beneath shrinks, tilts and darkens (scrubbed) — a deck being dealt.
 */
export default function Process() {
  const root = useRef()

  useLayoutEffect(() => {
    if (REDUCED) return
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.step')
      cards.forEach((card, i) => {
        const next = cards[i + 1]
        if (!next) return
        const st = { trigger: next, start: 'top bottom', end: 'top 20%', scrub: true }
        gsap.to(card, { scale: 0.9, rotate: i % 2 ? 2.5 : -2.5, ease: 'none', scrollTrigger: st })
        gsap.to(card.querySelector('.step-shade'), { opacity: 0.55, ease: 'none', scrollTrigger: { ...st } })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section id="process" className="process" ref={root} aria-label="How we work">
      <header className="process-head">
        <p className="eyebrow">( How we work )</p>
        <h2 className="h-xl">
          Four steps. <em>Zero</em> fluff.
        </h2>
      </header>
      <div className="steps">
        {PROCESS.map((p, i) => (
          <article key={p.no} className={`step tone-${TONES[i]}`} style={{ top: `calc(14vh + ${i * 1.4}rem)` }}>
            <span className="step-no">{p.no}</span>
            <div className="step-body">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
            <span className="step-shade" aria-hidden />
          </article>
        ))}
      </div>
    </section>
  )
}
