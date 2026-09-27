import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollTrigger, gsap, scroller } from '../lib/motion'
import { SafeGL, Stage } from '../three/clay'
import { ServicesScene } from '../three/MiniScenes'
import { SERVICES, pagePath } from '../data'
import { Arrow } from './ui'

const ease = [0.22, 1, 0.36, 1]
const line = {
  hide: { y: '105%' },
  show: (i) => ({ y: 0, transition: { duration: 0.7, ease, delay: i * 0.07 } }),
  out: { y: '-105%', transition: { duration: 0.35, ease: [0.7, 0, 0.84, 0] } },
}
const fade = {
  hide: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease, delay: 0.2 } },
  out: { opacity: 0, transition: { duration: 0.2 } },
}

// shrinks a title only when its longest line is wider than the column ("Management" is, at full size)
function fit(h) {
  if (!h) return
  const run = () => {
    h.style.fontSize = ''
    const widest = Math.max(...[...h.querySelectorAll('.line > span')].map((s) => s.offsetWidth))
    if (widest > h.clientWidth) h.style.fontSize = `${(parseFloat(getComputedStyle(h).fontSize) * h.clientWidth) / widest}px`
  }
  run()
  addEventListener('resize', run)
  return () => removeEventListener('resize', run)
}

/*
 * One sticky viewport per 100vh of scroll. Each step: the background floods to the service's colour,
 * the title lines are masked out/in, and the 3D prop clay-squishes into the next one while the mascot hops.
 */
export default function Services() {
  const root = useRef()
  const [i, setI] = useState(0)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (s) => setI(Math.min(SERVICES.length - 1, Math.floor(s.progress * SERVICES.length))),
      })
      gsap.fromTo('.svc-bar-fill', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true } })
    }, root)
    return () => ctx.revert()
  }, [])

  const jump = (j) => {
    const el = root.current
    const y = el.offsetTop + ((el.offsetHeight - window.innerHeight) / SERVICES.length) * (j + 0.5)
    scroller.lenis ? scroller.lenis.scrollTo(y, { duration: 1.2 }) : window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const s = SERVICES[i]
  return (
    <section id="services" ref={root} className="svc" style={{ height: `${SERVICES.length * 100}vh` }} aria-label="Services">
      <div className={`svc-sticky theme-${s.theme}`}>
        <div className="svc-head">
          <span>( What we do )</span>
          <span>
            {s.no} / {String(SERVICES.length).padStart(2, '0')}
          </span>
        </div>

        <div className="svc-stage">
          <SafeGL>
            <Stage className="svc-canvas" camera={{ position: [0, 0, 6.5], fov: 35 }}>
              <ServicesScene index={i} buddy={s.buddy} />
            </Stage>
          </SafeGL>
        </div>

        <div className="svc-copy">
          <AnimatePresence mode="wait">
            <motion.div key={s.id} initial="hide" animate="show" exit="out">
              <h2 className="svc-title" ref={fit}>
                {s.lines.map((l, k) => (
                  <span className="line" key={l}>
                    <motion.span variants={line} custom={k}>
                      {l}
                    </motion.span>
                  </span>
                ))}
              </h2>
              <motion.p className="svc-desc" variants={fade}>
                {s.desc}
              </motion.p>
              <motion.ul className="svc-tags" variants={fade}>
                {s.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </motion.ul>
              <motion.div className="svc-more" variants={fade}>
                <a className="btn btn-red" href={pagePath(s)} data-cursor="Open">
                  Explore service <Arrow />
                </a>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        <ol className="svc-index">
          {SERVICES.map((x, j) => (
            <li key={x.id}>
              <button className={j === i ? 'on' : ''} onClick={() => jump(j)} aria-current={j === i}>
                <span>{x.no}</span> {x.title}
              </button>
            </li>
          ))}
        </ol>
        <div className="svc-bar" aria-hidden>
          <div className="svc-bar-fill" />
        </div>
      </div>
      <ul className="sr-only">
        {SERVICES.map((x) => (
          <li key={x.id}>
            {x.title}: {x.desc}
          </li>
        ))}
      </ul>
    </section>
  )
}
