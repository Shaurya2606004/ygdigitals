import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshTransmissionMaterial, Text } from '@react-three/drei'
import { BLACK, Bag, Box, Browser, Clapper, ClayBuddy, Clay, Heart, Phone, RED, RED_DEEP, WHITE, displayFont } from './clay'
import { REDUCED, TOUCH, aim, clamp01, elasticOut } from '../lib/motion'

/* Block-letter headline: stacked troika layers fake a chunky extrusion; each line is scaled to fit `width`. */
function FitLine({ text, width, y, onHeight, layers = 8 }) {
  const g = useRef()
  const bounds = useRef(null)
  const apply = () => {
    const b = bounds.current
    if (!b || !g.current) return
    const s = width / (b[2] - b[0])
    g.current.scale.setScalar(s)
    onHeight((b[3] - b[1]) * s)
  }
  useEffect(apply, [width])
  return (
    <group ref={g} position-y={y} scale={0.0001}>
      {Array.from({ length: layers }, (_, i) => {
        const d = layers - 1 - i // 0 = front face
        return (
          <Text
            key={d}
            font={displayFont}
            fontSize={1}
            letterSpacing={-0.03}
            lineHeight={1}
            anchorX="center"
            anchorY="top"
            position={[d * 0.011, -d * 0.013, -d * 0.02]}
            color={d === 0 ? WHITE : d === 1 ? '#ffd6da' : RED_DEEP}
            onSync={
              d === 0
                ? (mesh) => {
                    bounds.current = mesh.textRenderInfo.blockBounds
                    apply()
                  }
                : undefined
            }
          >
            {text}
          </Text>
        )
      })}
    </group>
  )
}

/* Anything that pops in after the loader, bobs, and explodes outward on scroll. */
// fly = [how far it spreads sideways, how far it rushes the camera] by the end of the hero scroll
function Pop({ readyAt, sp, delay = 0, position, rotation = [0, 0, 0], scale = 1, fly = [1.8, 4], children }) {
  const g = useRef()
  const seed = useMemo(() => Math.random() * 100, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const k = readyAt.current == null ? 0 : elasticOut((t - readyAt.current - delay) / 1.2)
    const p = sp.current
    const out = 1 + p * fly[0]
    const bob = REDUCED ? 0 : Math.sin(t * 0.9 + seed) * 0.12
    g.current.position.set(position[0] * out, position[1] * out + bob, position[2] + p * fly[1])
    const wob = REDUCED ? 0 : 1
    const a = aim(state)
    g.current.rotation.set(
      rotation[0] + wob * Math.sin(t * 0.5 + seed) * 0.15 + p * 2 - a.y * 0.2,
      rotation[1] + wob * Math.sin(t * 0.4 + seed) * 0.3 + a.x * 0.35,
      rotation[2] + p * 1.5,
    )
    g.current.scale.setScalar(Math.max(1e-4, k * scale))
  })
  return <group ref={g}>{children}</group>
}

/*
 * The cursor lens: real refraction of the scene, jelly-stretches along its velocity.
 * Touch screens have no hover, so it sweeps a slow figure-eight over the headline (where the refraction reads best)
 * and springs to wherever a finger lands or slides, drifting back once the finger lifts.
 */
function Lens({ radius, sp, wander }) {
  const m = useRef()
  const st = useRef({ x: 0, y: 0, px: 9, py: 9, last: -9 })
  useFrame((state, dt) => {
    dt = Math.max(dt, 1e-3)
    const cam = state.camera
    const dist = 5
    const hh = Math.tan((cam.fov * Math.PI) / 360) * dist
    const hw = hh * (state.size.width / state.size.height)
    const s = st.current
    const t = state.clock.elapsedTime
    if (state.pointer.x !== s.px || state.pointer.y !== s.py) {
      s.px = state.pointer.x
      s.py = state.pointer.y
      s.last = t
    }
    let tx = s.px * hw
    let ty = s.py * hh
    if (TOUCH && t - s.last > 1.8) {
      tx = Math.sin(t * 0.42) * wander.ax * hw
      ty = (wander.y + Math.sin(t * 0.84 + 1) * wander.ay) * hh
    }
    const k = 1 - Math.exp(-dt * (TOUCH ? 4 : 10))
    const nx = s.x + (tx - s.x) * k
    const ny = s.y + (ty - s.y) * k
    const vx = (nx - s.x) / dt
    const vy = (ny - s.y) / dt
    s.x = nx
    s.y = ny
    const speed = REDUCED ? 0 : Math.min(Math.hypot(vx, vy) * 0.05, 0.4)
    const fade = 1 - clamp01((sp.current - 0.35) / 0.3)
    const r = radius * Math.max(1e-4, fade)
    m.current.position.set(nx, ny, cam.position.z - dist)
    m.current.rotation.set(0, 0, Math.atan2(vy, vx))
    m.current.scale.set(r * (1 + speed), r * (1 - speed * 0.5), r * 0.42)
  })
  return (
    <mesh ref={m} raycast={() => null}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        samples={TOUCH ? 4 : 8}
        resolution={TOUCH ? 512 : 1024}
        transmission={1}
        thickness={1.4}
        roughness={0.06}
        ior={1.28}
        chromaticAberration={0.09}
        anisotropicBlur={0.25}
        distortion={0.35}
        distortionScale={0.4}
        temporalDistortion={0.08}
        clearcoat={1}
        attenuationDistance={2}
        attenuationColor="#ffffff"
        color="#ffffff"
      />
    </mesh>
  )
}

const DESKTOP = [
  { el: <Phone />, p: [-0.8, 0.24, 0.8], r: [0.1, 0.45, 0.2], s: 0.62, d: 0.1 },
  { el: <Bag body={BLACK} />, p: [0.82, 0.26, -0.6], r: [0.15, -0.5, -0.15], s: 0.68, d: 0.2 },
  { el: <Box body={WHITE} tape={RED_DEEP} label={BLACK} />, p: [0.76, -0.3, 1.0], r: [0.5, 0.6, 0.1], s: 0.52, d: 0.3 },
  { el: <Browser />, p: [-0.74, -0.34, -0.4], r: [-0.1, 0.45, -0.1], s: 0.6, d: 0.25 },
  { el: <Clapper body={BLACK} a={WHITE} b={RED_DEEP} />, p: [0.02, 0.72, -1.8], r: [0.2, -0.3, 0.2], s: 0.5, d: 0.35 },
  { el: <Heart color={WHITE} />, p: [-0.14, 0.62, 0.5], r: [0, 0, 0.3], s: 0.42, d: 0.4 },
  { el: <Heart color={BLACK} />, p: [0.52, -0.05, 1.8], r: [0, 0, -0.3], s: 0.3, d: 0.45 },
  { el: <Heart color={WHITE} />, p: [-0.22, -0.6, 1.2], r: [0, 0, -0.2], s: 0.34, d: 0.5 },
  { el: <Heart color={RED_DEEP} />, p: [1.0, 0.02, -1.2], r: [0, 0, 0.4], s: 0.36, d: 0.55 },
]

// portrait: a composed sticker sheet — phone + bag flank the short "THE" line, the browser peeks from behind
// STOP, and the rest sit in the band under the headline, clear of the copy and CTAs below it
const PORTRAIT = [
  { el: <Phone />, p: [-0.76, 0.25, 0.4], r: [0.1, 0.5, 0.25], s: 0.27, d: 0.1 },
  { el: <Bag body={BLACK} />, p: [0.77, 0.22, 0.2], r: [0.15, -0.5, -0.15], s: 0.29, d: 0.2 },
  { el: <Browser />, p: [-0.6, 0.64, -1.2], r: [-0.1, 0.5, -0.2], s: 0.25, d: 0.25 },
  { el: <Clapper body={BLACK} a={WHITE} b={RED_DEEP} />, p: [0.12, -0.36, -0.3], r: [0.2, -0.3, 0.15], s: 0.26, d: 0.35 },
  { el: <Box body={WHITE} tape={RED_DEEP} label={BLACK} />, p: [0.64, -0.36, 0.6], r: [0.5, 0.6, 0.1], s: 0.26, d: 0.3 },
  { el: <Heart color={WHITE} />, p: [0.4, -0.14, 1.2], r: [0, 0, -0.2], s: 0.13, d: 0.5 },
  { el: <Heart color={RED_DEEP} />, p: [-0.88, -0.1, -0.4], r: [0, 0, 0.4], s: 0.17, d: 0.55 },
]

const LINES_WIDE = [
  { t: 'STOP', f: 1 },
  { t: 'THE SCROLL.', f: 1 },
]
const LINES_PORTRAIT = [
  { t: 'STOP', f: 1 },
  { t: 'THE', f: 0.52 },
  { t: 'SCROLL.', f: 1 },
]

function Confetti({ count, spread, offY = 0, fly, readyAt, sp }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        p: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4],
        c: [WHITE, BLACK, RED_DEEP][i % 3],
        s: 0.05 + Math.random() * 0.07,
        torus: i % 4 === 0,
      })),
    [count],
  )
  return bits.map((b, i) => (
    <Pop key={i} readyAt={readyAt} sp={sp} fly={fly} delay={0.3 + i * 0.03} position={[b.p[0] * spread[0], b.p[1] * spread[1] + offY, b.p[2]]} scale={b.s}>
      <mesh>
        {b.torus ? <torusGeometry args={[1, 0.4, 12, 24]} /> : <sphereGeometry args={[1, 16, 16]} />}
        <Clay color={b.c} />
      </mesh>
    </Pop>
  ))
}

export default function HeroScene({ ready, progress, onReady }) {
  const { viewport, size, clock, camera } = useThree()
  const portrait = size.width / size.height < 0.85
  const vw = viewport.width
  const vh = viewport.height
  const width = portrait ? Math.min(vw * 0.9, vh * 0.42) : Math.min(vw * 0.58, 8)
  const lines = portrait ? LINES_PORTRAIT : LINES_WIDE
  const [h, setH] = useState({})
  const readyAt = useRef(null)
  const sp = useRef(0)
  const text = useRef()
  const reported = useRef(false)

  useEffect(() => {
    if (ready && readyAt.current == null) readyAt.current = clock.elapsedTime
  }, [ready, clock])


  const gap = width * 0.03
  // stack lines top-down; each FitLine reports its scaled height once troika has laid it out
  let cursor = 0
  const ys = lines.map((l) => {
    const y = cursor
    cursor -= (h[l.t] || 0) + gap
    return y
  })
  const total = -cursor - gap
  const textY = portrait ? vh * 0.15 : vh * 0.04

  const framesSinceSync = useRef(0)
  useFrame((state, dt) => {
    // ready = headline laid out AND real frames on screen (frames only start once the shaders are compiled)
    if (!reported.current && lines.every((l) => h[l.t]) && ++framesSinceSync.current === 2) {
      reported.current = true
      onReady()
    }
    sp.current += (progress.current - sp.current) * (1 - Math.exp(-dt * 6))
    const p = sp.current
    const k = readyAt.current == null ? 0 : elasticOut((state.clock.elapsedTime - readyAt.current) / 1.4)
    const g = text.current
    g.scale.setScalar(Math.max(1e-4, k))
    const a = REDUCED ? { x: 0, y: 0 } : aim(state)
    g.position.set(0, textY + p * vh * 0.12, -p * (portrait ? 3 : 5))
    g.rotation.set(-p * 0.6 - a.y * 0.05, a.x * 0.1, 0)
    camera.position.z = 10 - p * 1.5
  })

  const items = portrait ? PORTRAIT : DESKTOP
  // on a narrow screen a sideways burst leaves it empty at once, so props swell toward the camera and rush past instead
  const fly = portrait ? [0.9, 6.5] : undefined
  return (
    <>
      <color attach="background" args={[RED]} />
      <group ref={text}>
        <group position-y={total / 2}>
          {lines.map((l, i) => (
            <FitLine key={l.t} text={l.t} width={width * l.f} y={ys[i]} onHeight={(v) => setH((o) => (o[l.t] === v ? o : { ...o, [l.t]: v }))} />
          ))}
        </group>
        {/* white buddy peeks over the top of STOP, black buddy waves from the bottom corner */}
        <ClayBuddy color={WHITE} seed={2} position={[width * 0.3, total / 2 + 0.05, -0.6]} scale={width * 0.065} />
        <ClayBuddy
          color={BLACK}
          seed={5}
          wave
          position={portrait ? [-width * 0.3, -total / 2 - width * 0.2, 0.8] : [-width * 0.5, -total / 2 - width * 0.02, 0.8]}
          scale={width * (portrait ? 0.1 : 0.05)}
          rotation={[0, 0.4, 0]}
        />
      </group>
      {items.map((it, i) => (
        <Pop key={i + (portrait ? 'p' : 'd')} readyAt={readyAt} sp={sp} fly={fly} delay={it.d} position={[it.p[0] * vw * 0.5, it.p[1] * vh * 0.5, it.p[2]]} rotation={it.r} scale={it.s}>
          {it.el}
        </Pop>
      ))}
      {/* portrait confetti stays in the band under the headline, off the letters and clear of the CTAs */}
      <Confetti count={portrait ? 7 : 18} spread={[vw * 0.5, vh * (portrait ? 0.13 : 0.5)]} offY={portrait ? -vh * 0.16 : 0} fly={fly} readyAt={readyAt} sp={sp} />
      <Lens
        radius={portrait ? 0.2 : 0.55}
        sp={sp}
        wander={{ y: textY / (vh / 2), ax: (width / vw) * 0.75, ay: (total / vh) * 0.7 }}
      />
    </>
  )
}
