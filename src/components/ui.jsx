export const Arrow = () => (
  <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

// Chunky 8-point star used as a separator in the tapes.
const STAR = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 ? 8 : 20
  const a = (i / 16) * Math.PI * 2
  return `${(20 + Math.sin(a) * r).toFixed(2)},${(20 - Math.cos(a) * r).toFixed(2)}`
}).join(' ')

export const Star = () => (
  <svg className="star" viewBox="0 0 40 40" aria-hidden>
    <polygon fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="3" points={STAR} />
  </svg>
)

export const Chat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5z" />
    <path d="M9 10.5c.5 1.7 2 3.2 3.7 3.7l1.3-1.2 2 .9c-.3 1.2-1.3 1.9-2.5 1.7-2.8-.5-5-2.7-5.5-5.5-.2-1.2.5-2.2 1.7-2.5l.9 2z" fill="currentColor" stroke="none" />
  </svg>
)
