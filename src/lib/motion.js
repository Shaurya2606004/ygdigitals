import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

const mq = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches
export const REDUCED = mq('(prefers-reduced-motion: reduce)')
export const TOUCH = mq('(pointer: coarse)')

// Lenis instance lives here so nav / modal can reach it without context plumbing.
export const scroller = { lenis: null }

export function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  if (scroller.lenis) scroller.lenis.scrollTo(el, { duration: 1.4 })
  else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' })
}

export function lockScroll(locked) {
  if (scroller.lenis) locked ? scroller.lenis.stop() : scroller.lenis.start()
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x))
const clamp1 = (x) => Math.min(1, Math.max(-1, x))

/*
 * Phones have no cursor, so tilting the phone steers what the pointer steers on desktop (clay eyes, parallax).
 * Android streams orientation straight away; iOS only after a permission prompt, which must come from a tap.
 */
export const tilt = { x: 0, y: 0, on: false }
let tiltState = 'idle'
export function listenTilt(fromTap = false) {
  const DOE = typeof window !== 'undefined' && window.DeviceOrientationEvent
  if (tiltState !== 'idle' || !TOUCH || REDUCED || !DOE) return
  if (DOE.requestPermission && !fromTap) return
  tiltState = 'asking'
  ;(DOE.requestPermission ? DOE.requestPermission() : Promise.resolve('granted'))
    .then((res) => {
      tiltState = 'done'
      if (res !== 'granted') return
      let bx = null
      let by = null
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return
        if (bx == null) [bx, by] = [e.gamma, e.beta]
        // the neutral pose slowly follows however the phone is being held
        bx += (e.gamma - bx) * 0.02
        by += (e.beta - by) * 0.02
        tilt.x += (clamp1((e.gamma - bx) / 18) - tilt.x) * 0.25
        tilt.y += (clamp1((by - e.beta) / 18) - tilt.y) * 0.25
        tilt.on = true
      })
    })
    .catch(() => (tiltState = 'idle'))
}
// what the scene should "look at": the tilt on phones, the pointer everywhere else
export const aim = (state) => (tilt.on ? tilt : state.pointer)

// Rubbery overshoot used for every clay "pop" in.
export function elasticOut(x) {
  x = clamp01(x)
  if (x === 0 || x === 1) return x
  return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
}

// Under-damped spring (semi-implicit Euler). s = { x, v }.
export function spring(s, target, dt, k = 170, c = 12) {
  s.v += (k * (target - s.x) - c * s.v) * dt
  s.x += s.v * dt
}
