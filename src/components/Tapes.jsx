import { useLayoutEffect, useRef } from 'react'
import { REDUCED, ScrollTrigger, gsap } from '../lib/motion'
import { PLATFORMS, SERVICES } from '../data'
import { Star } from './ui'

const ROWS = [PLATFORMS, SERVICES.map((s) => s.title)]

/*
 * Two crossed "tapes" stuck over the hero/about seam. Each loops forever; scroll velocity
 * speeds them up (and reverses them when scrolling up), then they ease back to cruising speed.
 */
export default function Tapes() {
  const root = useRef()

  useLayoutEffect(() => {
    if (REDUCED) return
    const ctx = gsap.context(() => {
      const loops = gsap.utils.toArray('.tape-track').map((el, i) =>
        gsap.fromTo(el, { xPercent: i ? -50 : 0 }, { xPercent: i ? 0 : -50, duration: 26, ease: 'none', repeat: -1 }),
      )
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate(self) {
          const v = gsap.utils.clamp(-6, 6, self.getVelocity() / 250)
          const cruise = self.direction
          loops.forEach((tl) => {
            gsap.to(tl, {
              timeScale: Math.abs(v) < 1 ? cruise : v,
              duration: 0.2,
              overwrite: true,
              onComplete: () => gsap.to(tl, { timeScale: cruise, duration: 1.2 }),
            })
          })
        },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="tapes" ref={root} aria-hidden>
      <div className="tapes-inner">
        {ROWS.map((row, i) => (
          <div key={i} className={`tape tape-${i + 1}`}>
            <div className="tape-track">
              {[0, 1].map((dup) => (
                <div key={dup} className="tape-set">
                  {[...row, ...row].map((w, j) => (
                    <span key={j} className="tape-item">
                      {w}
                      <Star />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
