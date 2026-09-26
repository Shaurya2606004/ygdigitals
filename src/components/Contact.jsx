import { useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from '../lib/motion'
import { SafeGL, Stage } from '../three/clay'
import { ContactScene } from '../three/MiniScenes'
import { CONTACT, SERVICES, waLink } from '../data'
import { Arrow, Chat } from './ui'

/* No backend: the form composes a WhatsApp message to the studio — the channel their clients already use. */
export function Contact() {
  const root = useRef()
  const submit = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const lines = [
      `Hi YG Digitals! I'm ${f.get('name')}${f.get('business') ? ` from ${f.get('business')}` : ''}.`,
      `I'm interested in: ${f.get('service')}`,
      `My number: ${f.get('phone')}`,
      f.get('message') && `\n${f.get('message')}`,
    ]
    window.open(waLink(lines.filter(Boolean).join('\n')), '_blank', 'noopener')
  }

  return (
    <section id="contact" className="contact" ref={root} aria-label="Contact">
      <div className="contact-copy">
        <p className="eyebrow">( Book a call )</p>
        <h2 className="contact-title">
          <span>Let’s make</span>
          <span>
            some <em>noise.</em>
          </span>
        </h2>
        <p className="contact-lede">Tell us about your business. We’ll tell you exactly how we’d grow it — on a free call, no strings.</p>
        <ul className="contact-direct">
          <li>
            <a href={CONTACT.tel} data-cursor="Call">
              <small>Call</small>
              {CONTACT.phone}
            </a>
          </li>
          <li>
            <a href={`mailto:${CONTACT.email}`} data-cursor="Mail">
              <small>Email</small>
              {CONTACT.email}
            </a>
          </li>
          <li>
            <a href={CONTACT.instagram} target="_blank" rel="noreferrer" data-cursor="Follow">
              <small>Instagram</small>@ygdigitals.marketing
            </a>
          </li>
        </ul>
      </div>

      <div className="contact-stage">
        <SafeGL>
          <Stage className="contact-canvas" eventSource={root} camera={{ position: [0, 0, 7], fov: 35 }}>
            <ContactScene />
          </Stage>
        </SafeGL>
      </div>

      <form className="contact-form" onSubmit={submit}>
        <label>
          <span>Your name *</span>
          <input name="name" required autoComplete="name" placeholder="Rahul Sharma" />
        </label>
        <label>
          <span>Phone / WhatsApp *</span>
          <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" pattern="[0-9+\-\s]{10,15}" placeholder="98XXX XXXXX" />
        </label>
        <label>
          <span>Business</span>
          <input name="business" autoComplete="organization" placeholder="Sharma Textiles" />
        </label>
        <label>
          <span>What do you need?</span>
          <select name="service" defaultValue={SERVICES[0].title}>
            {SERVICES.map((s) => (
              <option key={s.id}>{s.title}</option>
            ))}
            <option>A bit of everything</option>
          </select>
        </label>
        <label className="full">
          <span>Anything else?</span>
          <textarea name="message" rows={3} placeholder="Tell us about your goals, budget or deadline…" />
        </label>
        <button className="btn btn-dark full" type="submit" data-cursor="Send">
          Send on WhatsApp <Arrow />
        </button>
      </form>
    </section>
  )
}

const WORD = 'YG DIGITALS'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-row">
        <p>
          {CONTACT.city}
          <br />
          {CONTACT.reach}
        </p>
        <p>
          <a href={CONTACT.tel}>{CONTACT.phone}</a>
          <br />
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </p>
        <p>
          <a href={CONTACT.instagram} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <br />
          <a href={waLink()} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </p>
      </div>
      <p className="footer-word" aria-label="YG Digitals">
        {WORD.split('').map((c, i) => (
          <span key={i} aria-hidden>
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </p>
      <div className="footer-base">
        <span>© {new Date().getFullYear()} YG Digitals. All rights reserved.</span>
        <span>Made loud in India.</span>
      </div>
    </footer>
  )
}

export function WhatsAppFab() {
  // stays out of the way of the hero CTAs, pops in once the visitor is past it
  const [away, setAway] = useState(true)
  useEffect(() => {
    const st = ScrollTrigger.create({ start: () => window.innerHeight * 0.9, end: 'max', onToggle: (s) => setAway(!s.isActive) })
    return () => st.kill()
  }, [])
  return (
    <a className={`fab ${away ? 'is-away' : ''}`} href={waLink()} target="_blank" rel="noreferrer" aria-label="Chat with YG Digitals on WhatsApp" data-cursor="Chat">
      <Chat />
    </a>
  )
}
