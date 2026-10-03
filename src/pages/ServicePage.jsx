import { useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { REDUCED, ScrollTrigger, gsap, listenTilt, lockScroll, scrollToId, smoothScroll } from '../lib/motion'
import { SafeGL, Stage } from '../three/clay'
import { ServicesScene } from '../three/MiniScenes'
import { CONTACT, SERVICES, pagePath } from '../data'
import Loader, { useLoader } from '../components/Loader'
import Cursor from '../components/Cursor'
import Nav from '../components/Nav'
import { Contact, Footer, WhatsAppFab } from '../components/Contact'
import { Arrow, BookCall } from '../components/ui'
import { CONTENT, WHY } from './content'

// "E-commerce Handling", not the short "E-commerce" the home page chips use
const fullName = (p) => p.lines.join(' ')

// no WebGL: nothing for the loader to wait for
function NoGL({ onReady }) {
  useEffect(onReady, [onReady])
  return null
}

/*
 * /services/<slug>: the thought process behind one service.
 * The work comes first, the words stay short: hero → live projects → how we think (the full checklist folded away) →
 * what you get + why us → FAQ → next page.
 */
export default function ServicePage({ page }) {
  const root = useRef()
  const c = CONTENT[page.id]
  const i = SERVICES.indexOf(page)
  const next = SERVICES[(i + 1) % SERVICES.length]
  // the fine print of the process, one list behind a toggle: still on the page for Google, out of the way for people
  const checks = [...c.steps.flatMap((s) => s.p), ...c.details]
  const { loading, progress, onSceneReady, done } = useLoader()

  useEffect(() => {
    history.scrollRestoration = 'auto'
    return smoothScroll()
  }, [])
  useEffect(() => listenTilt(), [])
  // the page is built behind the loader and revealed all at once
  useEffect(() => {
    lockScroll(loading)
    if (!loading) ScrollTrigger.refresh()
  }, [loading])

  // clips play only while on screen: nothing downloads before a card comes near (they held up the page as it
  // loaded), and swiped-away ones stop
  useEffect(() => {
    if (REDUCED) return
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { rootMargin: '200px' })
    root.current.querySelectorAll('.sp-proj video').forEach((v) => io.observe(v))
    return () => io.disconnect()
  }, [])

  // rows rise in as soon as they peek in (the work below the hero shows on the first screen); all visible from the start with reduced motion
  useLayoutEffect(() => {
    if (REDUCED) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.sp-rise').forEach((el) =>
        gsap.from(el, { y: 50, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top bottom', once: true } }),
      )
    }, root)
    return () => ctx.revert()
  }, [])
  // as the loader lifts: the hero copy rises in (the prop pops in and the mascot hops, via index below)
  useLayoutEffect(() => {
    if (REDUCED || loading) return
    const ctx = gsap.context(() => gsap.from('.sp-hero-copy > *', { y: 40, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }), root)
    return () => ctx.revert()
  }, [loading])

  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" progress={progress} onDone={done} />}</AnimatePresence>
      <Cursor />
      <Nav />
      <main ref={root} className="sp">
        <header className="sp-hero" onClick={(e) => !e.target.closest('a, button') && listenTilt(true)}>
          <div className="sp-hero-copy">
            <nav className="sp-crumbs" aria-label="Breadcrumb">
              <a href="/">Home</a> / <a href="/#services">Services</a> / <span aria-current="page">{fullName(page)}</span>
            </nav>
            <p className="eyebrow">
              ( Service {page.no} / {String(SERVICES.length).padStart(2, '0')} )
            </p>
            <h1 className="sp-title">
              {page.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h1>
            <p className="sp-lede">{c.lede}</p>
            <div className="sp-ctas">
              <BookCall className="btn-red">
                Book a free call
              </BookCall>
              <a
                className="btn btn-glass"
                href="#work"
                data-cursor="View"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToId('work')
                }}
              >
                See the work
              </a>
            </div>
          </div>
          <div className="sp-stage">
            <SafeGL fallback={<NoGL onReady={onSceneReady} />}>
              <Stage className="sp-canvas" camera={{ position: [0, 0, 6.5], fov: 35 }} onReady={onSceneReady}>
                <ServicesScene index={loading ? -1 : i} near={i} />
              </Stage>
            </SafeGL>
          </div>
        </header>

        <section id="work" className="sp-live" aria-labelledby="live-title">
          <header className="sp-head">
            <p className="eyebrow">( Our work )</p>
            <h2 id="live-title" className="h-xl">
              Live <em>projects</em>
            </h2>
          </header>
          {/* with pictures it's a gallery: three across, a swipe row on phones. --rows: picture, client, title, chips (+ link), lined up across the cards */}
          <ul className={`sp-live-grid ${c.projects.some((w) => w.image || w.embed) ? 'has-shots' : ''}`} style={{ '--rows': c.projects.some((w) => w.url) ? 5 : 4 }}>
            {c.projects.map((w) => {
              // a card links out only once it has a real address
              const Card = w.url ? 'a' : 'div'
              return (
                <li key={w.title} className="sp-rise">
                  <Card className="sp-proj" {...(w.url && { href: w.url, target: '_blank', rel: 'noreferrer', 'data-cursor': 'Visit' })}>
                    {w.embed ? (
                      // Instagram's own player: the Reel plays right here
                      <div className="sp-embed">
                        <iframe src={w.embed} title={`${w.title} — ${w.client}`} loading="lazy" scrolling="no" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                      </div>
                    ) : w.video ? (
                      <video src={w.video} poster={w.image} aria-label={`${w.title} — ${w.client}`} width="800" height="800" muted loop playsInline preload="none" />
                    ) : (
                      // fetched right after the reveal, so swiping the gallery never lands on a blank card
                      w.image && <img src={w.image} alt={`${w.title} — ${w.client}`} width="800" height="800" loading={loading ? 'lazy' : 'eager'} decoding="async" />
                    )}
                    <small>{[w.client, w.year].filter(Boolean).join(' · ')}</small>
                    <b>{w.title}</b>
                    <ul>
                      {w.did.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    {w.url && (
                      <span className="sp-proj-go">
                        View live <Arrow />
                      </span>
                    )}
                  </Card>
                </li>
              )
            })}
            <li className="sp-rise">
              <a className="sp-proj sp-proj-next" href={CONTACT.tel} data-cursor="Call">
                <small>Book a call</small>
                <b>Your brand, live next.</b>
                <span className="sp-proj-go">
                  Call us <Arrow />
                </span>
              </a>
            </li>
          </ul>
          {c.proof && (
            <div className="sp-proof">
              <p className="eyebrow">( Straight from the dashboards )</p>
              <ul>
                {c.proof.map((p) => (
                  <li key={p.src} className="sp-rise">
                    <a href={p.src} target="_blank" rel="noreferrer" data-cursor="Zoom">
                      <img src={p.src} alt={p.caption} width={p.w} height={p.h} loading="lazy" />
                    </a>
                    <span>{p.caption}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section id="approach" className="sp-steps" aria-labelledby="approach-title">
          <header className="sp-head">
            <p className="eyebrow">( Our thought process )</p>
            <h2 id="approach-title" className="h-xl">
              How we <em>think</em>
            </h2>
          </header>
          <ol className="sp-step-list">
            {c.steps.map((s, k) => (
              <li key={s.t} className="sp-step sp-rise">
                <span className="sp-step-no">{String(k + 1).padStart(2, '0')}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
          <details className="sp-checks sp-rise">
            <summary>
              Every check we run <small>{checks.length}</small>
            </summary>
            <ul>
              {checks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        </section>

        <section className="sp-deliver" aria-label="What you get and why YG">
          <div className="sp-rise">
            <p className="eyebrow">( What you get )</p>
            <ul className="sp-get">
              {c.deliver.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="sp-rise">
            <p className="eyebrow">( Why YG )</p>
            <h2 className="sp-why-title">
              Gohana’s most <em>obsessive</em> digital studio.
            </h2>
            <ul className="sp-why">
              {WHY.map((w) => (
                <li key={w.t}>
                  <b>{w.t}</b>
                  <span>{w.d}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sp-faq" aria-labelledby="faq-title">
          <header className="sp-head">
            <p className="eyebrow">( Questions )</p>
            <h2 id="faq-title" className="h-xl">
              Asked <em>often</em>
            </h2>
          </header>
          <div>
            {c.faq.map((f) => (
              <details key={f.q} className="sp-rise">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <nav className="sp-next" aria-label="More services">
          <p className="eyebrow">( Next )</p>
          <a className="sp-next-link" href={pagePath(next)} data-cursor="Next">
            {fullName(next)} <Arrow />
          </a>
        </nav>

        <Contact service={page.title} />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
