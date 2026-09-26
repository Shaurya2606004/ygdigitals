import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ClayBuddy, Heart, RED_DEEP, SERVICE_PROPS, TONE, WHITE, BLACK } from './clay'
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

export function ServicesScene({ index, buddy }) {
  const { size } = useThree()
  const narrow = size.width / size.height < 1
  return (
    <>
      <group position={narrow ? [-0.35, 0.15, 0] : [-0.3, 0.2, 0]}>
        {SERVICES.map((s, i) => (
          <Swap key={s.id} active={i === index} scale={narrow ? 1.05 : 1.25}>
            {SERVICE_PROPS[s.id]}
          </Swap>
        ))}
      </group>
      <ClayBuddy
        color={TONE[buddy]}
        hop={index + 1}
        seed={3}
        wave
        position={narrow ? [1.2, -0.85, 0.8] : [1.35, -1.0, 0.8]}
        scale={narrow ? 0.45 : 0.55}
        rotation={[0, -0.45, 0]}
      />
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
        c: [WHITE, BLACK, RED_DEEP][i % 3],
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
      {!REDUCED && <HeartStream count={12} />}
      <ClayBuddy color={WHITE} wave seed={7} position={[-0.95, -0.35, 0]} scale={0.95} rotation={[0, 0.35, 0]} />
      <ClayBuddy color={BLACK} seed={11} position={[1.05, -0.7, -0.4]} scale={0.72} rotation={[0, -0.35, 0]} />
    </>
  )
}
