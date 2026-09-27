import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BLACK, Heart, RED, SERVICE_PROPS, WHITE } from './clay'
import { Buddy } from './character'
import { REDUCED, spring } from '../lib/motion'
import { SERVICES } from '../data'

/*
 * "Clay squish" swap: x/z and y ride two springs of different stiffness, so an outgoing prop
 * flattens like a pressed lump of clay and the incoming one stretches up and wobbles into place.
 */
function Swap({ active, scale, children }) {
  const g = useRef()
  const sx = useRef({ x: 0, v: 0 })
  const sy = useRef({ x: 0, v: 0 })
  useFrame((state, dt) => {
    dt = Math.min(dt, 1 / 30)
    spring(sx.current, active ? 1 : 0, dt, 130, 11)
    spring(sy.current, active ? 1 : 0, dt, 260, 12)
    const x = Math.max(0, sx.current.x)
    const y = Math.max(0, sy.current.x)
    g.current.visible = x > 0.002 && y > 0.002
    g.current.scale.set(x * scale, y * scale, x * scale)
    const t = state.clock.elapsedTime
    g.current.rotation.set(-state.pointer.y * 0.25, (REDUCED ? 0 : Math.sin(t * 0.7) * 0.35) + state.pointer.x * 0.6, 0)
    g.current.position.y = REDUCED ? 0 : Math.sin(t * 1.1) * 0.08
  })
  return (
    <group ref={g} scale={0}>
      {children}
    </group>
  )
}

/*
 * Laid out from the canvas shape (tall on desktop, wide on phones and tablets): the mascot stands in the
 * bottom-right corner with room for its waving arm, and the prop is centred and sized in the space left of it.
 */
export function ServicesScene({ index, buddy }) {
  const { size, camera } = useThree()
  const hh = Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - 0.8) // visible half-height at the mascot's depth
  const hw = hh * (size.width / size.height)
  const s = Math.min(0.6, hw * 0.3)
  const bx = Math.min(hw - 0.8 * s - 0.1, 1.9)
  const room = bx - 0.6 * s + hw // width left of the mascot
  return (
    <>
      <group position={[Math.max((bx - 0.6 * s - hw) / 2, -0.6), 0.15, 0]}>
        {SERVICES.map((x, i) => (
          <Swap key={x.id} active={i === index} scale={Math.min(1.25, room / 2.4)}>
            {SERVICE_PROPS[x.id]}
          </Swap>
        ))}
      </group>
      <Buddy outfit={buddy} hop={index + 1} seed={3} wave position={[bx, -hh + 0.25 + 1.23 * s, 0.8]} scale={s} rotation={[0, -0.45, 0]} />
    </>
  )
}

// Live-stream style hearts drifting up behind the mascots.
function HeartStream({ count }) {
  const refs = useRef([])
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * 5,
        off: Math.random() * 6,
        speed: 0.45 + Math.random() * 0.45,
        c: [BLACK, RED, WHITE][i % 3],
        s: 0.16 + Math.random() * 0.16,
      })),
    [count],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    data.forEach((d, i) => {
      const m = refs.current[i]
      const y = ((t * d.speed + d.off) % 6) - 3
      m.position.set(d.x + Math.sin(t + d.off) * 0.3, y, -1.2)
      m.rotation.z = Math.sin(t * 2 + d.off) * 0.3
      m.scale.setScalar(Math.max(1e-4, d.s * Math.sin(((y + 3) / 6) * Math.PI)))
    })
  })
  return data.map((d, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <Heart color={d.c} />
    </group>
  ))
}

export function ContactScene() {
  return (
    <>
      {!REDUCED && <HeartStream count={6} />}
      <Buddy look="girl" outfit="white" wave seed={7} follow={false} position={[-0.95, -0.05, 0]} scale={1.3} rotation={[0, 0.35, 0]} />
      <Buddy look="guy" outfit="black" seed={11} follow={false} position={[1.1, -0.3, -0.4]} scale={1.15} rotation={[0, -0.35, 0]} />
    </>
  )
}

/*
 * Ecosystem page: the service props float in one arch over the two mascots, each bobbing on its own beat.
 * Sized from the canvas width so the arch always fits.
 */
export function EcosystemScene() {
  const { size, camera } = useThree()
  const hh = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
  const hw = hh * (size.width / size.height)
  const W = Math.min(hw * 0.9, 2.6) // half-width of the arch
  const slot = (2 * W) / SERVICES.length
  const k = Math.min(0.42, slot * 0.5)
  const s = Math.min(0.5, hh * 0.24)
  const items = useRef([])
  useFrame((state) => {
    const t = REDUCED ? 0 : state.clock.elapsedTime
    items.current.forEach((g, i) => {
      const x = -W + (i + 0.5) * slot
      g.position.set(x, hh * 0.38 - (x / W) ** 2 * hh * 0.22 + Math.sin(t * 1.2 + i * 1.3) * 0.05, 0)
      g.rotation.set(0.1, Math.sin(t * 0.6 + i) * 0.3 + state.pointer.x * 0.35, Math.sin(t * 0.8 + i) * 0.04)
    })
  })
  return (
    <>
      {SERVICES.map((x, i) => (
        <group key={x.id} ref={(el) => (items.current[i] = el)} scale={k}>
          {SERVICE_PROPS[x.id]}
        </group>
      ))}
      <Buddy look="girl" outfit="white" wave seed={4} position={[-s, -hh * 0.4, 0.4]} scale={s} rotation={[0, 0.3, 0]} />
      <Buddy look="guy" outfit="black" seed={9} hop={1} position={[s, -hh * 0.44, 0.2]} scale={s} rotation={[0, -0.3, 0]} />
    </>
  )
}
