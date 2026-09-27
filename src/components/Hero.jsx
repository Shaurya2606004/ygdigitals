import { useEffect, useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { REDUCED, ScrollTrigger, gsap, listenTilt, scrollToId } from '../lib/motion'
import { SafeGL, Stage } from '../three/clay'
import HeroScene from '../three/HeroScene'
import { waLink } from '../data'
import { Arrow } from './ui'

function Fallback({ onReady }) {
  useEffect(onReady, [onReady])
  return (
    <div className="hero-fallback" aria-hidden>
      STOP
      <br />
      THE SCROLL.
    </div>
  )
}

const rise = {
  hide: { y: 40, opacity: 0 },
  show: (i) => ({ y: 0, opacity: 1, transition: { delay: 0.35 + i * 0.08, duration: 0.9, ease: [0.22, 1, 0.36, 1] } }),
}

/*
 * Pinned (CSS sticky) for 200vh (150vh on phones). Scroll progress 0→1 is fed to the WebGL scene: the headline recedes and
 * tilts away while the clay props explode outward toward the camera. The DOM overlay fades out over the first 70% of the runway.
 */
export default function Hero({ ready, onSceneReady }) {
  const root = useRef()
  const progress = useRef(0)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (s) => (progress.current = REDUCED ? 0 : s.progress),
      })
      if (!REDUCED)
        gsap.to('.hero-ui', {
          autoAlpha: 0,
          y: -60,
          ease: 'none',
          // fades over the first 70% of the sticky runway, whatever height the runway has on this screen
          scrollTrigger: { trigger: root.current, start: 'top top', end: () => `+=${(root.current.offsetHeight - innerHeight) * 0.7}`, scrub: true },
        })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => listenTilt(), [])

  return (
    // iOS only hands out tilt data after a tap, so the first tap on the scene asks for it
    <section id="top" ref={root} className="hero" data-cursor-zone="lens" onClick={(e) => !e.target.closest('a, button') && listenTilt(true)}>
      <div className="hero-sticky">
        <SafeGL fallback={<Fallback onReady={onSceneReady} />}>
          <Stage className="hero-canvas" eventSource={root} warmOffscreen>
            <HeroScene ready={ready} progress={progress} onReady={onSceneReady} />
          </Stage>
        </SafeGL>
        <h1 className="sr-only">YG Digitals — stop the scroll. Social media management, e-commerce, packaging design, website design, video editing and video ad &amp; Reel shoots.</h1>

        <motion.div className="hero-ui" initial="hide" animate={ready ? 'show' : 'hide'}>
          <motion.p className="hero-kicker" variants={rise} custom={0}>
            <span className="dot" /> Digital studio
          </motion.p>
          <motion.div className="hero-ctas" variants={rise} custom={1}>
            <a className="btn btn-dark" href={waLink()} target="_blank" rel="noreferrer" data-cursor="Book">
              Book a free call <Arrow />
            </a>
            <a
              className="btn btn-glass"
              href="#work"
              data-cursor="Peek"
              onClick={(e) => {
                e.preventDefault()
                scrollToId('work')
              }}
            >
              <span>
                <span className="hide-sm">See the </span>work
              </span>
            </a>
          </motion.div>
          <motion.div className="hero-scroll" variants={rise} custom={2} aria-hidden>
            <span>Scroll</span>
            <i />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
