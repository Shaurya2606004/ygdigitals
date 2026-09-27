import { useEffect, useLayoutEffect, useRef } from 'react'
import { REDUCED, gsap, listenTilt, scrollToId, smoothScroll } from '../lib/motion'
import { SafeGL, Stage } from '../three/clay'
import { ServicesScene } from '../three/MiniScenes'
import { CONTACT, SERVICES, pagePath } from '../data'
import Cursor from '../components/Cursor'
import Nav from '../components/Nav'
import { Contact, Footer, WhatsAppFab } from '../components/Contact'
import { Arrow, BookCall, Statement } from '../components/ui'
import { CONTENT, WHY } from './content'

// "E-commerce Handling", not the short "E-commerce" the home page chips use
const fullName = (p) => p.lines.join(' ')

/*
 * /services/<slug>: the thought process behind one service.
 * Hero with the service's clay prop → belief → live projects → the steps we take → the small details → deliverables + why us → FAQ → next page.
 */
export default function ServicePage({ page }) {
  const root = useRef()
  const c = CONTENT[page.id]
  const i = SERVICES.indexOf(page)
  const next = SERVICES[(i + 1) % SERVICES.length]

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
              <BookCall className="btn-red">Book a free call</BookCall>
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
                <ServicesScene index={i} buddy="black" />
              </Stage>
            </SafeGL>
          </div>
        </header>

        <section className="sp-belief" aria-label="What we believe">
          <p className="eyebrow">( What we believe )</p>
          <Statement text={c.belief} />
        </section>

        <section className="sp-live" aria-labelledby="live-title">
          <header className="sp-head">
            <p className="eyebrow">( Our work )</p>
            <h2 id="live-title" className="h-xl">
              Live <em>projects</em>
            </h2>
          </header>
          <ul className="sp-live-grid">
            {c.projects.map((w) => {
              // a card links out only once it has a real address
              const Card = w.url ? 'a' : 'div'
              return (
                <li key={w.title} className="sp-rise">
                  <Card className="sp-proj" {...(w.url && { href: w.url, target: '_blank', rel: 'noreferrer', 'data-cursor': 'Visit' })}>
                    {w.image && <img src={w.image} alt={`${w.title} for ${w.client}`} loading="lazy" />}
                    <small>
                      {w.client} · {w.year}
                    </small>
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
                  {CONTACT.phone} <Arrow />
                </span>
              </a>
            </li>
          </ul>
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
            {SERVICES.map((p) => (
              <li key={p.id}>
                <a href={pagePath(p)} className={p === page ? 'on' : ''} aria-current={p === page ? 'page' : undefined}>
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Contact service={page.title} />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
