import { useEffect, useLayoutEffect, useRef } from 'react'
import { REDUCED, gsap, listenTilt, scrollToId, smoothScroll } from '../lib/motion'
import { SafeGL, Stage } from '../three/clay'
import { EcosystemScene, ServicesScene } from '../three/MiniScenes'
import { PAGES, SERVICES, pagePath, waLink } from '../data'
import Cursor from '../components/Cursor'
import Nav from '../components/Nav'
import { Contact, Footer, WhatsAppFab } from '../components/Contact'
import { Arrow, Statement } from '../components/ui'
import { CONTENT, WHY } from './content'

// "E-commerce Handling", not the short "E-commerce" the home page chips use
const fullName = (p) => (p.lines ? p.lines.join(' ') : p.title)

/*
 * /services/<slug>: the thought process behind one service (or the whole ecosystem).
 * Hero with the service's clay prop → belief → the steps we take → the small details → deliverables + why us → FAQ → next page.
 */
export default function ServicePage({ page }) {
  const root = useRef()
  const c = CONTENT[page.id]
  const i = SERVICES.indexOf(page)
  const next = PAGES[(PAGES.indexOf(page) + 1) % PAGES.length]
  const book = waLink(`Hi YG Digitals! I'd like to talk about ${fullName(page).toLowerCase()} for my business.`)

  useEffect(() => {
    history.scrollRestoration = 'auto'
    return smoothScroll()
  }, [])
  useEffect(() => listenTilt(), [])

  // rows rise in as they enter; everything is visible from the start with reduced motion
  useLayoutEffect(() => {
    if (REDUCED) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.sp-rise').forEach((el) =>
        gsap.from(el, { y: 50, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
      )
      gsap.from('.sp-hero-copy > *', { y: 40, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', delay: 0.1 })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <Cursor />
      <Nav />
      <main ref={root} className="sp">
        <header className="sp-hero" onClick={(e) => !e.target.closest('a, button') && listenTilt(true)}>
          <div className="sp-hero-copy">
            <nav className="sp-crumbs" aria-label="Breadcrumb">
              <a href="/">Home</a> / <a href="/#services">Services</a> / <span aria-current="page">{fullName(page)}</span>
            </nav>
            <p className="eyebrow">( {c.kicker} )</p>
            <h1 className="sp-title">
              {(c.lines || page.lines).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h1>
            <p className="sp-lede">{c.lede}</p>
            <div className="sp-ctas">
              <a className="btn btn-red" href={book} target="_blank" rel="noreferrer" data-cursor="Book">
                Book a free call <Arrow />
              </a>
              <a
                className="btn btn-glass"
                href="#approach"
                data-cursor="Read"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToId('approach')
                }}
              >
                How we think
              </a>
            </div>
          </div>
          <div className="sp-stage">
            <SafeGL>
              <Stage className="sp-canvas" camera={{ position: [0, 0, 6.5], fov: 35 }}>
                {i < 0 ? <EcosystemScene /> : <ServicesScene index={i} buddy="black" />}
              </Stage>
            </SafeGL>
          </div>
        </header>

        <section className="sp-belief" aria-label="What we believe">
          <p className="eyebrow">( What we believe )</p>
          <Statement text={c.belief} />
        </section>

        <section id="approach" className="sp-steps" aria-labelledby="approach-title">
          <header className="sp-head">
            <p className="eyebrow">( Our thought process )</p>
            <h2 id="approach-title" className="h-xl">
              How we <em>think</em>
            </h2>
          </header>
          <ol>
            {c.steps.map((s, k) => (
              <li key={s.t} className="sp-step sp-rise">
                <span className="sp-step-no">{String(k + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
                <ul>
                  {s.p.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {c.roles && (
          <section className="sp-system" aria-labelledby="system-title">
            <header className="sp-head">
              <p className="eyebrow">( Five services, one system )</p>
              <h2 id="system-title" className="h-xl">
                Every part <em>connects</em>
              </h2>
            </header>
            <ul>
              {SERVICES.map((s) => (
                <li key={s.id} className="sp-rise">
                  <a href={pagePath(s)} data-cursor="Open">
                    <small>{s.no}</small>
                    <b>{s.title}</b>
                    <span>{c.roles[s.id]}</span>
                    <Arrow />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="sp-details" aria-labelledby="details-title">
          <header className="sp-head">
            <p className="eyebrow">( The small stuff )</p>
            <h2 id="details-title" className="h-xl">
              Details we <em>never</em> skip
            </h2>
          </header>
          <ul>
            {c.details.map((d) => (
              <li key={d} className="sp-rise">
                {d}
              </li>
            ))}
          </ul>
        </section>

        <section className="sp-deliver" aria-label="What you get and why YG">
          <div className="sp-rise">
            <p className="eyebrow">( What you get )</p>
            <ol className="sp-get">
              {c.deliver.map((d, k) => (
                <li key={d}>
                  <small>{String(k + 1).padStart(2, '0')}</small>
                  {d}
                </li>
              ))}
            </ol>
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
          <ul>
            {PAGES.map((p) => (
              <li key={p.id}>
                <a href={pagePath(p)} className={p === page ? 'on' : ''} aria-current={p === page ? 'page' : undefined}>
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Contact service={i < 0 ? 'A bit of everything' : page.title} />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
